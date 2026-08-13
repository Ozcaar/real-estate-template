import type { z } from 'zod'

/**
 * Data-source adapter contract.
 *
 * This is the boundary every feature service crosses to read its
 * domain data. The contract is intentionally small — an adapter
 * only knows how to produce the full validated list. Filtering,
 * sorting, pagination and related-record scoring stay in the
 * service layer (see `propertiesService.filter`,
 * `developmentsService.getRelated`, etc.).
 *
 * **Why a contract.** Every feature service currently imports
 * from a `data/*.ts` file (the bundled TypeScript module). The
 * adapter contract lets a future release swap the source for an
 * HTTP API or a headless CMS without changing the service
 * signatures that pages and components depend on. The service
 * is the public boundary; the adapter is the implementation
 * boundary.
 *
 * **Async-first contract.** Every adapter — static, api, cms —
 * exposes `loadAll(): Promise<readonly T[]>` as the primary
 * surface. The static adapter resolves immediately with the
 * bundled data; the api / cms adapters fetch and parse on
 * demand. Pages consume the loader through Nuxt's
 * `useAsyncData('key', () => service.loadAll())` so SSR awaits
 * the load before rendering. A second, synchronous accessor
 * (`getAll()`) is retained for adapter implementations whose
 * data is pre-loaded at construction time (the static
 * adapter); remote adapters expose `getAll()` as the cached
 * result of their first `loadAll()` call. The service layer
 * treats `loadAll()` as the only contract entry point and
 * ignores `getAll()` — the data argument passed to the
 * service methods is the resolved `loadAll()` value.
 *
 * @see docs/ARCHITECTURE.md for the feature-first architecture
 * @see docs/DATA_MODELS.md for the domain models each adapter validates
 */

/**
 * Supported data-source kinds.
 *
 * - `'static'` — bundled TypeScript modules under
 *   `app/features/<feature>/data/<feature>.ts`. Default for the
 *   v1.x template. Zero network at request time; data travels
 *   with the build.
 * - `'api'` — external HTTP API. The `createApiDataSource`
 *   factory at `app/core/data-source/adapters/api-adapter.ts`
 *   is the implementation. The same `DataSourceAdapter<T>`
 *   contract applies; selecting `'api'` without a registered
 *   adapter throws {@link DataSourceMissingConfigError} so a
 *   misconfigured rebrand is a hard error, not a silent
 *   fallback to the bundled data.
 * - `'cms'` — headless CMS. Same status as `'api'`: the
 *   contract exists today, the implementation is a future
 *   task (no CMS adapter ships in v1.x).
 *
 * The kind set is the source of truth for the data-source
 * configuration. Adding a new kind (e.g. `'graphql'`, `'s3'`) is
 * a TypeScript-only change here plus a new adapter file under
 * `adapters/`.
 */
export type DataSourceKind = 'static' | 'api' | 'cms'

/**
 * Data-source configuration.
 *
 * Today the only field is `kind`. Future versions can add
 * transport-specific options (API base URL, CMS project id,
 * API key, pagination strategy) without breaking existing
 * configs — the type only grows.
 */
export interface DataSourceConfig {
  readonly kind: DataSourceKind
}

/**
 * Default data-source configuration.
 *
 * `static` is the default because the v1.x template ships with
 * bundled TypeScript data only. A rebrand that wants a real
 * API or CMS override the kind in `app/config/site.config.ts`
 * (future) or in the per-feature adapter registry.
 */
export const DEFAULT_DATA_SOURCE: DataSourceConfig = Object.freeze({
  kind: 'static',
}) as DataSourceConfig

/**
 * A data-source adapter.
 *
 * Implementations are constructed once per feature at module
 * load and reused. The service layer calls `loadAll()` on every
 * page (or every request, on the server) and passes the
 * resolved array to the pure service methods. The adapter is
 * memoized per-instance so a single SSR request produces a
 * single fetch.
 *
 * The adapter is intentionally read-only and does not know
 * about filtering, sorting, or pagination. The service layer
 * applies those on top so the same adapter can serve a list
 * page, a detail page, and a "related records" widget without
 * leaking data-source concerns into the UI.
 */
export interface DataSourceAdapter<T> {
  /**
   * The kind this adapter implements. Useful for diagnostics
   * (logs, error messages) so an operator can see which source
   * actually served a request.
   */
  readonly id: DataSourceKind
  /**
   * Async loader. Returns the full list, already validated
   * against the boundary schema supplied at construction time.
   *
   * For the static adapter, the promise resolves immediately
   * with the bundled data. For remote adapters (api, cms),
   * the promise resolves after the fetch + Zod parse; the
   * first call performs the work and subsequent calls return
   * the same memoized array.
   *
   * Pages consume this through Nuxt's
   * `useAsyncData('key', () => service.loadAll())` so SSR
   * awaits the load before rendering.
   */
  loadAll(): Promise<readonly T[]>
  /**
   * Synchronous accessor. Returns the cached, validated list
   * without performing the load. Implementations that load
   * asynchronously (api, cms) MUST populate this with the
   * resolved value of `loadAll()` and return the same array
   * reference; calling `getAll()` before `loadAll()` has
   * resolved throws. The static adapter exposes the array it
   * parsed at construction time.
   *
   * The service layer does NOT use this accessor — it works
   * exclusively with the value `loadAll()` resolves to. The
   * accessor is exposed for diagnostic purposes and for the
   * rare synchronous consumer that has pre-loaded the data
   * (a Vitest fixture, an `await`-aware server route).
   */
  getAll(): readonly T[]
}

/**
 * Adapter registry. Each kind maps to its adapter (or is
 * absent when not yet implemented). The selector uses this
 * map to resolve a `DataSourceConfig` to a concrete
 * `DataSourceAdapter`.
 *
 * The map is `Partial` so a feature that only has a static
 * adapter can declare the registry with `{ static: ... }`
 * and let the selector throw if asked for `api` or `cms`.
 */
export type DataSourceAdapterRegistry<T> = Partial<Record<DataSourceKind, DataSourceAdapter<T>>>

/**
 * Thrown when the configured kind has no registered adapter.
 *
 * The error message names the missing kind and points the
 * operator at the adapter folder. We throw rather than
 * silently falling back to `'static'` so a rebrand that
 * accidentally asks for a future source fails loudly at
 * module load — the misconfiguration cannot be hidden by
 * shipping the wrong content.
 *
 * The optional `supportedKinds` argument overrides the
 * default "Supported kinds" line in the message. Callers
 * that know the actual subset they ship (e.g. a feature
 * loader that only has `'static'` + `'api'` adapters)
 * can pass the list so the message reflects the runtime
 * reality, not the full contract kind set. The selector
 * (the typical caller) computes the list from its own
 * registry; the loader passes its hard-coded list.
 */
export class DataSourceNotImplementedError extends Error {
  readonly kind: DataSourceKind
  readonly supportedKinds: readonly DataSourceKind[]
  constructor(
    kind: DataSourceKind,
    supportedKinds: readonly DataSourceKind[] = ['static', 'api', 'cms'] as const,
  ) {
    super(
      `[data-source] kind "${kind}" is not implemented. `
      + `Register a "${kind}" adapter under app/core/data-source/adapters/ `
      + `and add it to the adapter registry. `
      + `Supported kinds: ${supportedKinds.map(k => `"${k}"`).join(', ')}.`,
    )
    this.name = 'DataSourceNotImplementedError'
    this.kind = kind
    this.supportedKinds = supportedKinds
  }
}

/**
 * Thrown when a remote source is selected but the required
 * transport configuration is missing.
 *
 * Today this is raised by the lazy adapter-selection logic in
 * the feature service when the kind is `'api'` but the
 * endpoint env var (`NUXT_PROPERTIES_API_URL` for properties)
 * is empty. The error names the env var so a misconfigured
 * deployment can be fixed without reading source code.
 */
export class DataSourceMissingConfigError extends Error {
  readonly kind: DataSourceKind
  readonly field: string
  constructor(kind: DataSourceKind, field: string) {
    super(
      `[data-source:${kind}] required configuration "${field}" is missing. `
      + `Set the env var that supplies this value (or unset "${kind}" as the configured kind) `
      + `and restart the server.`,
    )
    this.name = 'DataSourceMissingConfigError'
    this.kind = kind
    this.field = field
  }
}

/**
 * Thrown when a remote source returns a non-2xx response.
 *
 * The error carries the HTTP status code and the endpoint
 * URL so an operator can correlate the failure with their
 * upstream logs. The response body is intentionally NOT
 * included — a 5xx page can contain stack traces or other
 * sensitive details that should not be logged at warn level
 * without filtering.
 */
export class DataSourceHttpError extends Error {
  readonly status: number
  readonly endpoint: string
  constructor(status: number, endpoint: string) {
    super(`[data-source:api] HTTP ${status} fetching "${endpoint}".`)
    this.name = 'DataSourceHttpError'
    this.status = status
    this.endpoint = endpoint
  }
}

/**
 * Thrown when a remote source request exceeds the configured
 * timeout.
 *
 * The error carries the timeout (in milliseconds) and the
 * endpoint URL so an operator can correlate the failure
 * with their upstream latency. The original `AbortError`
 * is intentionally NOT chained on the public error — the
 * `DataSourceTimeoutError` is the documented contract; the
 * upstream error is implementation detail.
 */
export class DataSourceTimeoutError extends Error {
  readonly endpoint: string
  readonly timeoutMs: number
  constructor(endpoint: string, timeoutMs: number) {
    super(`[data-source:api] request to "${endpoint}" timed out after ${timeoutMs}ms.`)
    this.name = 'DataSourceTimeoutError'
    this.endpoint = endpoint
    this.timeoutMs = timeoutMs
  }
}

/**
 * Thrown when a remote source returns a 2xx response that
 * fails Zod validation against the boundary schema.
 *
 * The error carries the underlying Zod issue as `cause` so a
 * developer inspecting the error in the server logs sees the
 * exact field that failed. The remote response is treated as
 * the source of truth and a malformed payload is a hard
 * error — the misconfigured upstream cannot be hidden by
 * shipping the bundled static data.
 */
export class DataSourceInvalidPayloadError extends Error {
  readonly endpoint: string
  readonly cause: unknown
  constructor(endpoint: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(
      `[data-source:api] response from "${endpoint}" failed validation: ${detail}. `
      + `The API endpoint must return the same shape as the bundled static data.`,
    )
    this.name = 'DataSourceInvalidPayloadError'
    this.endpoint = endpoint
    this.cause = cause
  }
}

/**
 * Type guard for `DataSourceKind`.
 *
 * Accepts the exact lowercase string literals documented on
 * {@link DataSourceKind}. Anything else (including the empty
 * string, `null`, numbers, or future kinds not yet defined) is
 * rejected. Use this when reading a kind from configuration
 * (env, JSON, agency config) before passing it to the
 * selector.
 */
export function isDataSourceKind(value: unknown): value is DataSourceKind {
  return value === 'static' || value === 'api' || value === 'cms'
}

/**
 * Resolve a `DataSourceConfig` to a concrete `DataSourceAdapter`.
 *
 * Behaviour:
 *
 *  - When the configured kind is in the registry, the matching
 *    adapter is returned.
 *  - When the configured kind is not in the registry, the
 *    selector throws a {@link DataSourceNotImplementedError}.
 *    This is the "fail clearly rather than silently fall
 *    back" behaviour required by the contract: a rebrand that
 *    sets `kind: 'api'` without a registered API adapter fails
 *    at module load instead of silently shipping the bundled
 *    static data.
 *  - The default kind (`'static'`) is {@link DEFAULT_DATA_SOURCE}.
 *    A typical call site is:
 *
 *    ```ts
 *    const propertiesAdapter = selectDataSource(
 *      DEFAULT_DATA_SOURCE,
 *      {
 *        static: createStaticDataSource<Property>({
 *          data: sampleProperties,
 *          schema: propertyListSchema,
 *          source: 'app/features/properties/data/properties.ts',
 *        }),
 *      },
 *    )
 *    ```
 *
 * The selector is generic over the record type `T` so each
 * feature's adapter is type-checked against its own model
 * (`Property` / `Agent` / `Development`). A registry entry for
 * `'static'` that returns the wrong record type fails the
 * compile-time check.
 */
export function selectDataSource<T>(
  config: DataSourceConfig,
  registry: DataSourceAdapterRegistry<T>,
): DataSourceAdapter<T> {
  const adapter = registry[config.kind]
  if (!adapter) {
    // The supported kinds are the kinds the registry
    // actually carries — not the full contract set. A
    // rebrand that registers only a `'static'` adapter
    // sees a message like "Supported kinds: 'static'."
    // and knows exactly what's missing.
    const supportedKinds = Object.keys(registry) as DataSourceKind[]
    throw new DataSourceNotImplementedError(config.kind, supportedKinds)
  }
  return adapter
}

/**
 * A Zod schema shape accepted by the static adapter at
 * construction. The schema is the runtime boundary tool — the
 * adapter calls `schema.parse(data)` once at construction so
 * a future async source is held to the same rules as the
 * bundled static data. Re-exported here so callers do not
 * need to import from `zod` directly when they only need the
 * type.
 */
export type DataSourceSchema<T> = z.ZodType<T[]>