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
 * **Why a small contract.** The contract does not try to model
 * every async / CMS / API concern. It only captures what the
 * static adapter needs to expose and what a future async adapter
 * would still need to expose (`getAll()`). When the time comes to
 * add a network adapter, the small surface area means a new
 * `ApiDataSource` can be written in one file and the registry
 * updated — no service changes.
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
 * - `'api'` — external HTTP API. Not implemented in v1.x; the
 *   adapter contract is the only thing that exists today.
 *   Selecting `'api'` without a registered adapter throws
 *   {@link DataSourceNotImplementedError} so a misconfigured
 *   rebrand is a hard error, not a silent fallback to the
 *   bundled data.
 * - `'cms'` — headless CMS. Same status as `'api'`: contract
 *   only, no implementation shipped.
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
 * load and reused. The service layer reads `getAll()` on every
 * call (the result is memoized inside the adapter for the
 * static implementation; a future async implementation would
 * fetch and parse on demand).
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
   * Return the full list, already validated against the
   * boundary schema supplied at construction time. The
   * implementation is free to memoize.
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
 */
export class DataSourceNotImplementedError extends Error {
  readonly kind: DataSourceKind
  constructor(kind: DataSourceKind) {
    super(
      `[data-source] kind "${kind}" is not implemented. `
      + `Register a "${kind}" adapter under app/core/data-source/adapters/ `
      + `and add it to the adapter registry. `
      + `Supported kinds: "static".`,
    )
    this.name = 'DataSourceNotImplementedError'
    this.kind = kind
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
    throw new DataSourceNotImplementedError(config.kind)
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
