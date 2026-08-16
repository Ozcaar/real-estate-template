import {
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '../data-source'
import type { CmsDriver } from '../cms-driver'

/**
 * Simple HTTP/JSON CMS provider driver (Task 103).
 *
 * The first concrete {@link CmsDriver} shipped in the v1.x
 * template. Fetches a JSON array from a configured endpoint
 * and returns it as the mapped list (identity mapping — the
 * provider is expected to return records already in the
 * target `T` shape, or in a shape the boundary Zod schema
 * accepts after no transformation).
 *
 * **Why a separate file.** The driver contract lives in
 * `cms-driver.ts`; this file is one concrete implementation.
 * Adding a new provider (Sanity, Contentful, Strapi, a
 * different internal shape) is a new file in
 * `adapters/<provider>-driver.ts`, registered in the loader
 * if the operator selects it. The contract never changes.
 *
 * **Why identity mapping here.** The simple HTTP/JSON
 * provider assumes the upstream CMS (or its public REST API)
 * returns the property list already in the target shape.
 * This matches the v1.1.0 M17 api adapter's contract (no
 * transformation, boundary validation via the Zod schema).
 * A future Sanity / Contentful / Strapi driver would carry
 * a `mapRecord` step that converts the provider's native
 * shape (e.g. a Sanity document with `_type`, `_id`,
 * `_rev`, projection-specific keys) into the `Property`
 * shape. The mapping stays inside the driver — the adapter
 * stays provider-agnostic.
 *
 * **Async contract.** `dispatch()` is the primary surface.
 * Pages consume the adapter through Nuxt's `useAsyncData`
 * so SSR awaits the driver's dispatch before rendering.
 *
 * **Timeout.** The driver wraps every fetch in an
 * `AbortController` with a configurable timeout
 * (default 10 000 ms). An abort is translated to
 * {@link DataSourceTimeoutError}; the original
 * `AbortError` is intentionally NOT chained on the public
 * error — `DataSourceTimeoutError` is the documented
 * contract. The timer is cleared on both success and
 * failure so the request does not leak.
 *
 * **Validation.** The driver itself does NOT validate the
 * response with a Zod schema — the
 * {@link createCmsDataSource} adapter runs the boundary
 * schema validation. The driver only checks that the
 * response body is a JSON array; a non-array body becomes
 * a {@link DataSourceInvalidPayloadError} so a misconfigured
 * upstream is a hard error at the boundary.
 *
 * **No retries, no caching layer.** The driver is a thin
 * transport; the adapter memoises the resolved value.
 *
 * **No new dependencies.** The driver uses the platform
 * `fetch` (Node 18+ / Nitro). The signature is
 * intentionally minimal so the test surface can mock the
 * fetch without stubbing the global.
 *
 * **Server-only by call site.** The driver is constructed
 * inside server-only modules (the property loader at
 * `server/utils/properties.ts`) so the CMS endpoint and
 * any future auth token are never bundled into the client.
 * The driver module itself has no client-only imports.
 */

/**
 * A minimal subset of the platform `fetch` signature the
 * driver uses. Tests inject a mock implementation;
 * production code relies on the global `fetch`
 * (Node 18+ / Nitro).
 */
export type CmsDriverFetch = (
  input: string,
  init?: { headers?: Record<string, string>, signal?: AbortSignal },
) => Promise<{
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}>

/**
 * Construction options for {@link createHttpJsonCmsDriver}.
 */
export interface HttpJsonCmsDriverOptions {
  /**
   * The absolute URL the driver fetches. The endpoint must
   * return a JSON document that is an array of records in
   * the target `T` shape (the boundary schema, supplied to
   * the adapter, validates the response after parsing).
   *
   * An empty / whitespace-only endpoint throws
   * {@link DataSourceMissingConfigError} at construction
   * time so a misconfigured deployment is a hard error,
   * not a silent fallback. Operators select the CMS source
   * via the `NUXT_PROPERTIES_DATA_SOURCE` env var; setting
   * it to `'cms'` without supplying `NUXT_PROPERTIES_CMS_URL`
   * is the documented misconfiguration that triggers this
   * error.
   */
  readonly endpoint: string
  /**
   * Identifier for diagnostics. Surfaced in the adapter's
   * `Symbol.toStringTag` (composed by the adapter) and in
   * every error message. Should name the env var that
   * supplied the endpoint (e.g.
   * `'cms:NUXT_PROPERTIES_CMS_URL'`). Defaults to the
   * endpoint itself.
   */
  readonly source?: string
  /**
   * Request timeout in milliseconds. The driver aborts the
   * request when the timer fires and raises
   * {@link DataSourceTimeoutError}. Defaults to 10 000 ms.
   */
  readonly timeoutMs?: number
  /**
   * Optional `fetch` implementation override. Tests inject a
   * mock; production code relies on the platform `fetch`.
   * The signature is intentionally minimal (just
   * `input`, `headers`, and `signal`) so the mock can be
   * hand-rolled without stubbing the global.
   */
  readonly fetchImpl?: CmsDriverFetch
}

/**
 * Default request timeout (10 seconds).
 */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Construct a simple HTTP/JSON CMS provider driver.
 *
 * Construction validates the endpoint synchronously and
 * returns a driver that performs the fetch lazily on the
 * first `dispatch()` call. The endpoint is required — a
 * blank / whitespace endpoint throws
 * {@link DataSourceMissingConfigError} so the
 * misconfiguration is fixed at startup rather than at
 * first request.
 *
 * The fetch uses the platform `fetch` by default; tests can
 * override with `fetchImpl`. The AbortController-based
 * timeout is independent of any server-side fetch timeout so
 * the driver's contract is observable from a unit test.
 */
export function createHttpJsonCmsDriver<T>(
  options: HttpJsonCmsDriverOptions,
): CmsDriver<T> {
  if (typeof options.endpoint !== 'string' || options.endpoint.trim() === '') {
    throw new DataSourceMissingConfigError('cms', 'endpoint')
  }
  const endpoint = options.endpoint
  const source = options.source ?? endpoint
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS
  const fetchImpl: CmsDriverFetch = options.fetchImpl ?? ((input, init) => fetch(input, init))

  return {
    id: 'http-json',
    /**
     * Async loader. Performs the fetch, parses the JSON,
     * and returns the array (identity mapping). The adapter
     * validates the result against the boundary schema
     * before exposing it to consumers.
     *
     * Error mapping:
     *
     *  - Non-2xx response → {@link DataSourceHttpError}
     *    (carries status + endpoint).
     *  - JSON parse failure → {@link DataSourceInvalidPayloadError}
     *    with the `SyntaxError` as `cause` (a misconfigured
     *    upstream that returns HTML or empty body is a hard
     *    error, not a misleading `SyntaxError`).
     *  - Body is not a JSON array → {@link DataSourceInvalidPayloadError}
     *    (the boundary schema will reject a malformed array
     *    too, but this branch catches the structural
     *    "not an array" case before the schema runs).
     *  - Timeout → {@link DataSourceTimeoutError}; the
     *    `AbortError` is NOT chained on the public error.
     *  - Network / DNS errors → propagate as-is. The adapter
     *    does not wrap transport errors in a custom class
     *    (the api adapter follows the same convention).
     */
    async dispatch(): Promise<readonly T[]> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(endpoint, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new DataSourceHttpError(response.status, endpoint)
        }
        let json: unknown
        try {
          json = await response.json()
        }
        catch (parseError) {
          throw new DataSourceInvalidPayloadError(endpoint, parseError)
        }
        if (!Array.isArray(json)) {
          throw new DataSourceInvalidPayloadError(
            endpoint,
            new Error('CMS driver response is not a JSON array.'),
          )
        }
        return json as readonly T[]
      }
      catch (error) {
        if (
          controller.signal.aborted
          && error instanceof Error
          && error.name === 'AbortError'
        ) {
          throw new DataSourceTimeoutError(endpoint, timeoutMs)
        }
        throw error
      }
      finally {
        clearTimeout(timeoutId)
      }
    },
    /**
     * Diagnostic tag. Surfaced in `String(driver)` and
     * `Object.prototype.toString.call(driver)`. The CMS
     * adapter composes its own `Symbol.toStringTag` using
     * the configured `source` so the driver-side tag is the
     * last-resort diagnostic.
     */
    [Symbol.toStringTag]: `cms-driver:${source}`,
  } as CmsDriver<T> & { readonly [Symbol.toStringTag]: string }
}