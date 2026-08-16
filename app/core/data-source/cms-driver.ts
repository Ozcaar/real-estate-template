import type { DataSourceAdapter, DataSourceSchema } from './data-source'
import { DataSourceInvalidPayloadError } from './data-source'

/**
 * CMS data-source adapter (Task 103).
 *
 * A provider-agnostic adapter that wraps a {@link CmsDriver}
 * and validates the driver's output against the boundary
 * schema. This is the second data-source implementation
 * shipped in the v1.x template that performs network I/O at
 * request time (the first was the v1.1.0 M17 HTTP API
 * adapter).
 *
 * **Why a separate file from the contract.** The contract
 * (`data-source.ts`) defines the small public surface every
 * feature service crosses; this file is the CMS-specific
 * adapter that plugs a {@link CmsDriver} into the contract.
 * The CMS adapter does NOT know how to talk to any specific
 * CMS — that knowledge lives behind the
 * {@link CmsDriver} boundary. The provider-specific logic
 * (Sanity / Contentful / Strapi / a custom HTTP endpoint)
 * is encapsulated by the driver; the adapter only knows
 * how to dispatch a driver, validate the output, and
 * memoise the result.
 *
 * **Async contract.** `loadAll()` is the primary surface.
 * Pages consume it through Nuxt's `useAsyncData` so SSR
 * awaits the driver's `dispatch()` before rendering.
 * `getAll()` returns the cached resolved value and throws
 * until `loadAll()` has populated it — the same "throw if
 * not loaded" contract the v1.1.0 M16 multi-tenant
 * foundation enforces and the api adapter already follows.
 *
 * **Validation boundary.** When a `schema` is supplied, the
 * driver's output is parsed against it. A 2xx-shaped
 * response that fails validation throws
 * {@link DataSourceInvalidPayloadError} — the driver's output
 * is treated as the source of truth, the same as the api
 * adapter treats the remote JSON response. Shipping the
 * bundled static data would hide the misconfiguration, so
 * the adapter fails loudly.
 *
 * **Memoization.** The first `loadAll()` call invokes the
 * driver's `dispatch()` and validates the result; subsequent
 * calls return the same memoized array reference. A page
 * that calls `useAsyncData` three times with the same key
 * produces one driver dispatch.
 *
 * **No retries, no caching layer, no pagination.** The
 * adapter is a thin transport + validation boundary; the
 * same constraints as the api adapter. Distributed caching,
 * retries, and pagination are documented future concerns.
 *
 * **Server-only by call site.** The driver and adapter are
 * constructed inside server-only modules (the property
 * loader at `server/utils/properties.ts`, gated by
 * `typeof window === 'undefined'`) so CMS endpoints and
 * auth tokens are never bundled into the client. The
 * adapter module itself has no client-only imports and is
 * safe to bundle anywhere; the privacy guarantee comes from
 * where the construction happens, not from tree-shaking.
 *
 * @see CmsDriver for the provider-driver boundary
 * @see createHttpJsonCmsDriver for the simple HTTP/JSON provider
 */

/**
 * Provider-driver boundary.
 *
 * A driver encapsulates the provider-specific knowledge
 * needed to load and map remote content into the target
 * domain shape. The adapter knows nothing about Sanity,
 * Contentful, Strapi, or any other CMS — it just calls
 * `driver.dispatch()` and validates the result.
 *
 * **Generic over `T`.** The driver is constructed for a
 * specific target shape (the loader constructs
 * `CmsDriver<Property>`); the adapter pairs the driver
 * with the matching Zod schema (`propertyListSchema`) at
 * the boundary.
 *
 * **No retries, no caching layer.** The driver loads on
 * every `dispatch()`; the adapter memoises the resolved
 * value. A future retry / cache layer would slot between
 * the adapter and the driver without changing the contract.
 *
 * **Two shipped providers (Task 103).**
 *
 *  - `createHttpJsonCmsDriver<T>` — simple HTTP/JSON
 *    provider. Fetches a JSON array from a configured
 *    endpoint, returns it as the mapped list. Identity
 *    mapping: the provider is expected to return records
 *    already in the `T` shape (or in a shape the supplied
 *    Zod schema accepts after no transformation).
 *  - (future) Sanity / Contentful / Strapi drivers would
 *    carry a `mapRecord` step that converts the provider's
 *    native shape (e.g. a Sanity document) into `T`. The
 *    contract stays the same; only the driver changes.
 */
export interface CmsDriver<T> {
  /**
   * Provider identifier for diagnostics. Surfaced in the
   * adapter's `Symbol.toStringTag` and in every error
   * message. Should name the provider (e.g. `'http-json'`,
   * `'sanity'`, `'contentful'`).
   */
  readonly id: string
  /**
   * Load the remote catalog and map it into the target
   * `T` shape. Returns a `Promise<readonly T[]>` that
   * resolves with the mapped list. The adapter runs the
   * boundary schema validation on this value before
   * exposing it to consumers.
   *
   * The driver's contract is "load + map" — provider-
   * specific HTTP calls, pagination, auth, and per-record
   * mapping all live inside this method. A driver that
   * cannot reach the provider, times out, or returns a
   * non-2xx response MUST surface that failure as an
   * exception (the adapter does not catch driver
   * exceptions). HTTP errors, timeouts, and JSON parse
   * failures all propagate to the consumer verbatim;
   * boundary validation is the adapter's only
   * transformation.
   */
  dispatch(): Promise<readonly T[]>
}

/**
 * Construction options for {@link createCmsDataSource}.
 */
export interface CmsDataSourceOptions<T> {
  /**
   * The provider driver. Constructed once per loader call;
   * the adapter does not memoise the driver — only the
   * resolved array is memoised. The driver must already be
   * configured (endpoint, auth, etc.); an unconfigured
   * driver should throw on `dispatch()`.
   */
  readonly driver: CmsDriver<T>
  /**
   * The boundary Zod schema. The driver's output is parsed
   * against it before being cached. A failure raises
   * {@link DataSourceInvalidPayloadError}.
   *
   * The schema is the same one every other adapter uses
   * (`propertyListSchema` for properties) so the CMS path
   * is held to the same rules as the bundled static data.
   */
  readonly schema: DataSourceSchema<T>
  /**
   * Identifier for diagnostics. Surfaced in the adapter's
   * `Symbol.toStringTag` and in error messages. Should name
   * the env var that supplied the driver configuration
   * (e.g. `'cms:NUXT_PROPERTIES_CMS_URL'`).
   */
  readonly source?: string
}

/**
 * Construct a CMS data-source adapter.
 *
 * The adapter wraps a {@link CmsDriver} and validates its
 * output against the supplied boundary schema. Construction
 * is synchronous — the actual driver dispatch happens lazily
 * on the first `loadAll()` call.
 */
export function createCmsDataSource<T>(
  options: CmsDataSourceOptions<T>,
): DataSourceAdapter<T> {
  const driver = options.driver
  const schema = options.schema
  const source = options.source ?? `cms:${driver.id}`

  let cached: readonly T[] | undefined
  let pending: Promise<readonly T[]> | undefined

  async function performDispatch(): Promise<readonly T[]> {
    const data = await driver.dispatch()
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      throw new DataSourceInvalidPayloadError(source, parsed.error)
    }
    return parsed.data as readonly T[]
  }

  return {
    id: 'cms',
    /**
     * Async loader. Dispatches the driver on the first call,
     * validates the response, and memoises the array.
     * Subsequent calls return the same reference — a Nuxt page
     * that calls `useAsyncData` three times with the same key
     * produces one driver dispatch.
     */
    loadAll(): Promise<readonly T[]> {
      if (cached !== undefined) {
        return Promise.resolve(cached)
      }
      if (!pending) {
        pending = performDispatch().then((data) => {
          cached = data
          pending = undefined
          return data
        }).catch((error: unknown) => {
          pending = undefined
          throw error
        })
      }
      return pending
    },
    /**
     * Synchronous accessor. Returns the cached, validated list
     * once `loadAll()` has resolved; throws otherwise. The
     * service layer does NOT use this accessor — it works
     * exclusively with the value `loadAll()` resolves to.
     */
    getAll(): readonly T[] {
      if (cached === undefined) {
        throw new Error(
          `[data-source:cms] getAll() called before loadAll() resolved. `
          + `Call \`await adapter.loadAll()\` first.`,
        )
      }
      return cached
    },
    /**
     * Diagnostic tag. Surfaces the source in `String(adapter)`
     * and `Object.prototype.toString.call(adapter)`.
     */
    [Symbol.toStringTag]: `cms:${source}`,
  } as DataSourceAdapter<T> & { readonly [Symbol.toStringTag]: string }
}