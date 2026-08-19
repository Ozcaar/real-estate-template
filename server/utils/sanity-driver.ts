import type { SanityClient } from '@sanity/client'
import {
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '~/core/data-source/data-source'
import type { CmsDriver } from '~/core/data-source/cms-driver'

/**
 * Sanity CMS provider driver (Task 116 — v1.2 pilot server-only move).
 *
 * The first provider-specific {@link CmsDriver} implementation
 * shipping in the v1.x template. The driver encapsulates the
 * Sanity-specific knowledge needed to load and map remote
 * content into the target `T` shape; the adapter
 * (`createCmsDataSource<T>`) is provider-agnostic — it just
 * calls `driver.dispatch()` and validates the result against
 * the boundary Zod schema.
 *
 * **Why this file lives in `server/utils/`.** Task 116 moved
 * the implementation out of `app/core/data-source/adapters/`
 * (the previous location from Task 115B) and into
 * `server/utils/`, the canonical Nuxt 4 location for
 * server-only utilities. The folder is auto-imported by
 * Nitro and bundled exclusively to the server output, never
 * to the client. The boundary regression test in
 * `server/utils/sanity-boundary.test.ts` asserts that no
 * file under `app/` imports `@sanity/client` or references
 * `NUXT_SANITY_TOKEN`; the move makes the boundary a file-
 * location guarantee, not a tree-shaking wish. The shared
 * contract (`CmsDriver<T>`) stays in
 * `app/core/data-source/cms-driver.ts`; only the provider-
 * specific implementation moved.
 *
 * **Why a separate file from the contract.** The contract
 * (`cms-driver.ts`) defines the provider-driver boundary;
 * this file is one concrete implementation (the `'http-json'`
 * driver at `http-json-cms-driver.ts` is the other). The
 * Sanity driver uses the official `@sanity/client` SDK to
 * execute GROQ projections against the agency's Sanity
 * project + dataset, and applies a feature-specific
 * `mapRecord` function (supplied by the loader) to convert
 * each Sanity document into the target `Property` / `Agent`
 * / `Development` shape before the boundary Zod schema
 * validates the result.
 *
 * **Image strategy.** The pilot projects image asset URLs
 * directly via `asset->url` in the GROQ projection. The pilot
 * does NOT depend on `@sanity/image-url` (a separate Sanity
 * package) — hotspot / crop-aware URL building is a future
 * task. The direct projected URLs are the Sanity CDN URLs
 * (`cdn.sanity.io`) and work with the existing
 * `<ResponsiveImage>` wrapper via `@nuxt/image`. The Nuxt
 * Image config in `nuxt.config.ts` adds `cdn.sanity.io` to
 * `image.domains` so the optimisation pipeline accepts the
 * remote URLs.
 *
 * **Reference resolution.** The pilot resolves
 * `Property.agentId` and `Property.developmentId` by projecting
 * `agent._ref` and `development._ref` in the GROQ query. The
 * mapping function reads the `_ref` string and stores it as
 * the boundary shape's `agentId` / `developmentId`. The agents
 * and developments lists are loaded independently by their
 * own loaders; the per-property reference is resolved at the
 * per-record mapping step.
 *
 * **Async contract.** `dispatch()` is the primary surface.
 * The driver runs the GROQ query once per call and returns the
 * mapped array. The adapter memoise the resolved value; the
 * per-feature loader's `createServerLoader` coalesces
 * concurrent in-flight calls. The driver does NOT retain a
 * permanent process-lifetime cache — every call to
 * `dispatch()` executes the GROQ query.
 *
 * **Timeout.** The driver wraps the GROQ request in the
 * `@sanity/client` built-in timeout. The default is
 * 10 000 ms (the shared `DEFAULT_API_TIMEOUT_MS` constant in
 * `server/utils/server-data-source.ts` is the canonical
 * default). The driver translates timeout aborts to
 * {@link DataSourceTimeoutError}; the underlying `AbortError`
 * is intentionally NOT chained on the public error —
 * `DataSourceTimeoutError` is the documented contract.
 *
 * **Validation.** The driver itself does NOT validate the
 * response with a Zod schema — the
 * {@link createCmsDataSource} adapter runs the boundary
 * schema validation. The driver only checks that the response
 * is a JSON array; a non-array body becomes a
 * {@link DataSourceInvalidPayloadError} so a misconfigured
 * upstream is a hard error at the boundary.
 *
 * **No retries, no permanent caching layer.** The driver is a
 * thin transport + per-record mapper. The adapter memoises
 * the resolved value. Distributed caching, retries, and
 * pagination are documented future concerns.
 *
 * **No new dependencies beyond `@sanity/client`.** The driver
 * imports the SDK directly. The `@sanity/image-url` builder
 * is a separate package and is intentionally deferred.
 *
 * **Server-only by file location.** The driver lives in
 * `server/utils/` so the import is bundled exclusively to the
 * Nitro server output. The `sanity-config.ts` and
 * `sanity-mappings.ts` helpers in `server/utils/` are also
 * server-only. The `NUXT_SANITY_TOKEN` env var is read inside
 * `sanity-config.ts` via `process.env`, never reaches the
 * client bundle, and is not declared in
 * `nuxt.config.ts → runtimeConfig`.
 */

/**
 * A minimal subset of the {@link SanityClient} interface the
 * driver uses. The driver's constructor takes the full
 * SanityClient at the call site; this subset exists for the
 * tests' mock client that records the GROQ query and
 * returns a fixture.
 */
export type SanityDriverClient = Pick<
  SanityClient,
  'fetch'
>

/**
 * Construction options for {@link createSanityDriver}.
 */
export interface SanityDriverOptions<T> {
  /**
   * The Sanity client instance. Constructed by the loader
   * from `NUXT_SANITY_PROJECT_ID` / `NUXT_SANITY_DATASET` /
   * `NUXT_SANITY_API_VERSION` / optional `NUXT_SANITY_TOKEN`.
   * The client is owned by the loader (the loader creates a
   * fresh client per `loadPropertiesServer()` /
   * `loadAgentsServer()` / `loadDevelopmentsServer()` call),
   * never the driver; the driver is a thin wrapper.
   */
  readonly client: SanityDriverClient
  /**
   * The GROQ query to execute. The query is supplied by the
   * loader (it is the feature-specific bit that names the
   * document type and the projection shape). The driver
   * itself does not know about Property / Agent / Development
   * — that knowledge lives in the loader's `mapRecord` and
   * the feature-specific GROQ query.
   */
  readonly query: string
  /**
   * The per-record mapping function. Converts each Sanity
   * document (the value the GROQ projection returns) into the
   * target `T` shape. The driver calls `mapRecord(doc)` for
   * every record in the response array, in order. The
   * boundary Zod schema (supplied to the adapter) validates
   * the mapped result.
   */
  readonly mapRecord: (doc: unknown) => T
  /**
   * Identifier for diagnostics. Surfaced in the adapter's
   * `Symbol.toStringTag` and in every error message. Should
   * name the feature (e.g. `'sanity:property'`,
   * `'sanity:agent'`, `'sanity:development'`) so an operator
   * can see which loader produced the error. Defaults to the
   * empty string.
   */
  readonly source?: string
  /**
   * Override the default request timeout (10 000 ms).
   * The driver's own timeout control; the Sanity client
   * itself accepts a `timeout` option on its `fetch` call.
   */
  readonly timeoutMs?: number
}

/**
 * Default request timeout (10 seconds). Matches the
 * `DEFAULT_API_TIMEOUT_MS` constant in
 * `server/utils/server-data-source.ts` so all three remote
 * adapters (api, http-json cms, sanity cms) share the same
 * documented default.
 */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Construct a Sanity `CmsDriver<T>` implementation.
 *
 * Construction validates the query synchronously and returns
 * a driver that performs the GROQ fetch lazily on the first
 * `dispatch()` call. The client is supplied by the loader —
 * the driver does not own the client lifecycle.
 *
 * **Error mapping (in `dispatch()`).**
 *
 *  - Non-array response or empty body →
 *    {@link DataSourceInvalidPayloadError} (the boundary
 *    schema would reject a malformed array too, but this
 *    branch catches the structural "not an array" case
 *    before the schema runs).
 *  - Network / fetch failure with a status code →
 *    {@link DataSourceHttpError} (carries the status code and
 *    the source).
 *  - Timeout →
 *    {@link DataSourceTimeoutError} (carries the source and
 *    the timeout in ms).
 *  - Generic fetch exception (network, DNS, etc.) →
 *    {@link DataSourceHttpError} with status 0 to preserve
 *    the existing transport-error contract.
 */
export function createSanityDriver<T>(
  options: SanityDriverOptions<T>,
): CmsDriver<T> {
  if (!options.client || typeof options.client.fetch !== 'function') {
    throw new DataSourceMissingConfigError('cms', 'sanity client')
  }
  if (typeof options.query !== 'string' || options.query.trim() === '') {
    throw new DataSourceMissingConfigError('cms', 'sanity query')
  }
  const query = options.query
  const source = options.source ?? 'sanity'
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS

  return {
    id: 'sanity',
    /**
     * Async loader. Executes the GROQ query, validates the
     * response is an array, maps each record through the
     * supplied `mapRecord`, and returns the mapped list.
     * The adapter validates the result against the boundary
     * Zod schema before exposing it to consumers.
     */
    async dispatch(): Promise<readonly T[]> {
      let raw: unknown
      try {
        raw = await options.client.fetch(query, {}, {
          filterResponse: true,
          timeout: timeoutMs,
        })
      }
      catch (error) {
        // Translate timeout-like failures to the documented
        // contract. @sanity/client throws a plain `Error` with
        // a `code` or `name` discriminator; the fallback
        // recognises the abort signature and the documented
        // "timed out" / "timeout" / "exceeded" patterns the
        // platform fetch surfaces.
        if (
          error instanceof Error
          && (error.name === 'AbortError'
            || /abort|timeout|timed out|exceed/i.test(error.message))
        ) {
          throw new DataSourceTimeoutError(source, timeoutMs)
        }
        // A non-2xx response carries a `statusCode` property on
        // the Sanity error envelope (when the client has
        // structured the response). Preserve the existing
        // transport-error contract.
        const statusCode = (error as { statusCode?: number, status?: number })?.statusCode
          ?? (error as { statusCode?: number, status?: number })?.status
          ?? 0
        throw new DataSourceHttpError(statusCode, source)
      }

      // Sanity's filtered response is the projected values
      // array. A non-array body is a structural failure that
      // the boundary schema would also reject; we surface it
      // here with a dedicated error so the operator sees the
      // exact cause.
      if (!Array.isArray(raw)) {
        throw new DataSourceInvalidPayloadError(
          source,
          new Error('Sanity driver response is not a JSON array.'),
        )
      }

      // Map each record through the loader-supplied mapper.
      // The boundary schema (provided to the adapter) validates
      // the result; a malformed mapping raises
      // `DataSourceInvalidPayloadError` from the adapter
      // boundary.
      return raw.map(record => options.mapRecord(record)) as readonly T[]
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
