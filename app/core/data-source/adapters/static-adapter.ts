import type { DataSourceAdapter, DataSourceSchema } from '../data-source'

/**
 * Static data-source adapter.
 *
 * The only data-source adapter shipped with the v1.x template.
 * Wraps a bundled TypeScript array (the existing
 * `app/features/<feature>/data/<feature>.ts` exports) and
 * exposes it through the {@link DataSourceAdapter} contract.
 *
 * **Why a separate file.** The contract (`data-source.ts`)
 * defines the shape; this file is the only implementation
 * today. Keeping the implementation in `adapters/` makes the
 * "add a new source" path obvious: write a new file in this
 * folder, register it in the service's adapter registry, done.
 * The contract file never needs to change.
 *
 * **Validation boundary.** When a `schema` is supplied, the
 * adapter calls `schema.parse(data)` at construction time and
 * memoizes the validated list. A bad record prevents the
 * adapter from being constructed — the same fail-fast
 * behaviour the existing `properties/data/properties.ts`
 * already relies on. When no `schema` is supplied, the data
 * is returned as-is (the static data file is the source of
 * truth and is responsible for any shape guarantees).
 *
 * **No network.** The static adapter never reaches out. It is
 * a synchronous in-memory wrapper. A future `api` / `cms`
 * adapter would do its fetching here without changing the
 * service signature.
 */

/**
 * Construction options for {@link createStaticDataSource}.
 */
export interface StaticDataSourceOptions<T> {
  /**
   * The bundled data. Typically the `sampleX` export from
   * `app/features/<feature>/data/<feature>.ts`. The array is
   * consumed at construction time and never re-read, so
   * mutating the original array after construction does not
   * affect the adapter's view.
   */
  readonly data: readonly T[]
  /**
   * Optional Zod schema used to validate `data` at the
   * boundary. When supplied, the adapter parses the array at
   * construction; a `ZodError` is thrown for any malformed
   * record. When omitted, the adapter returns the data
   * unchanged — the calling code is responsible for any shape
   * guarantees.
   */
  readonly schema?: DataSourceSchema<T>
  /**
   * Identifier for diagnostics. Should point at the file that
   * holds the raw data (e.g.
   * `'app/features/properties/data/properties.ts'`). Surfaced
   * in the adapter's `Symbol.toStringTag` and in any error
   * message raised during construction. Defaults to
   * `'static'`.
   */
  readonly source?: string
}

/**
 * Construct a static data-source adapter.
 *
 * The construction runs the optional Zod parse synchronously
 * and caches the validated list. `getAll()` then returns the
 * same array reference on every call — the static adapter
 * has no async work to do, and a cached reference is the
 * cheapest possible implementation.
 */
export function createStaticDataSource<T>(
  options: StaticDataSourceOptions<T>,
): DataSourceAdapter<T> {
  const validated: readonly T[] = options.schema
    ? options.schema.parse(options.data)
    : options.data
  const source = options.source ?? 'static'
  return {
    id: 'static',
    getAll(): readonly T[] {
      return validated
    },
    /**
     * Diagnostic tag. Surfaces the source in `String(adapter)`
     * and `Object.prototype.toString.call(adapter)` so a
     * debugger, log line, or test assertion can identify the
     * adapter without a separate label field.
     */
    [Symbol.toStringTag]: `static:${source}`,
  } as DataSourceAdapter<T> & { readonly [Symbol.toStringTag]: string }
}
