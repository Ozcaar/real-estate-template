import type { DataSourceAdapter, DataSourceSchema } from '../data-source'
import {
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '../data-source'

/**
 * HTTP API data-source adapter.
 *
 * A generic implementation of {@link DataSourceAdapter<T>}
 * that fetches the full list from a remote HTTP endpoint and
 * validates the response against a Zod schema. The first
 * adapter shipped in the v1.x template that performs network
 * I/O at request time.
 *
 * **Why a separate file.** The contract (`data-source.ts`)
 * defines the shape; this file is one implementation. The
 * `'api'` kind has shipped as a contract since the v1.1.0
 * M13 data-source foundation but with no implementation;
 * selecting `'api'` then threw `DataSourceNotImplementedError`.
 * With this file, a rebrand that supplies an API endpoint
 * can switch `kind` to `'api'` and the same boundary
 * contract applies.
 *
 * **Async contract.** `loadAll()` is the primary surface.
 * Pages consume it through Nuxt's `useAsyncData` so SSR
 * awaits the fetch before rendering. `getAll()` returns the
 * cached resolved value and throws until `loadAll()` has
 * populated it — the same "throw if not loaded" contract
 * the v1.1.0 M16 multi-tenant foundation enforces.
 *
 * **Validation boundary.** When a `schema` is supplied, the
 * response body is parsed against it. A 2xx response that
 * fails validation throws {@link DataSourceInvalidPayloadError}
 * (the remote endpoint is treated as the source of truth —
 * shipping the bundled static data would hide the
 * misconfiguration). When no schema is supplied, the
 * adapter expects the response to be a JSON array and skips
 * per-record validation.
 *
 * **Timeout.** The adapter wraps every fetch in an
 * `AbortController` with a configurable timeout
 * (default 10 000 ms). An abort is translated to
 * {@link DataSourceTimeoutError}; the original
 * `AbortError` is intentionally NOT chained on the public
 * error — `DataSourceTimeoutError` is the documented
 * contract. The timer is cleared on both success and
 * failure so the request does not leak.
 *
 * **Memoization.** The first `loadAll()` call performs the
 * work; subsequent calls return the same memoized array
 * reference. A page that calls `useAsyncData` three times
 * with the same key produces one fetch.
 *
 * **No new dependencies.** The adapter uses the platform
 * `fetch` (Node 18+ / Nitro). No retries, no pagination
 * protocols, no caching layer — those are documented
 * future concerns. The adapter is a thin transport that
 * delegates parsing to the supplied Zod schema.
 *
 * **Server-only by call site.** The adapter is constructed
 * inside server-only modules (the property service's lazy
 * adapter selector, gated by `typeof window === 'undefined'`)
 * so the endpoint URL is never bundled into the client. The
 * adapter module itself has no client-only imports and is
 * safe to bundle anywhere; the privacy guarantee comes from
 * where the construction happens, not from tree-shaking.
 */

/**
 * A minimal subset of the platform `fetch` signature the
 * adapter uses. Tests inject a mock implementation; production
 * code relies on the global `fetch` (Node 18+ / Nitro).
 */
export type ApiDataSourceFetch = (
  input: string,
  init?: { headers?: Record<string, string>, signal?: AbortSignal },
) => Promise<{
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}>

/**
 * Construction options for {@link createApiDataSource}.
 */
export interface ApiDataSourceOptions<T> {
  /**
   * The absolute URL the adapter fetches. The endpoint must
   * return a JSON document that matches the supplied Zod
   * schema (or, when no schema is supplied, a JSON array of
   * `T`-shaped records).
   *
   * An empty / whitespace-only endpoint throws
   * {@link DataSourceMissingConfigError} at construction time
   * so a misconfigured rebrand is a hard error, not a silent
   * fallback. Operators select the API source via the
   * `NUXT_PROPERTIES_DATA_SOURCE` env var; setting it to
   * `'api'` without supplying `NUXT_PROPERTIES_API_URL` is
   * the documented misconfiguration that triggers this error.
   */
  readonly endpoint: string
  /**
   * Optional Zod schema used to validate the response body at
   * the boundary. When supplied, the adapter runs
   * `schema.safeParse(json)` after parsing the JSON; a
   * failure raises {@link DataSourceInvalidPayloadError}.
   * When omitted, the adapter expects the response to be a
   * JSON array and performs no per-record validation.
   */
  readonly schema?: DataSourceSchema<T>
  /**
   * Identifier for diagnostics. Surfaced in the adapter's
   * `Symbol.toStringTag` and in every error message. Should
   * name the env var that supplied the endpoint (e.g.
   * `'api:NUXT_PROPERTIES_API_URL'`) so an operator can
   * correlate the failure with their configuration.
   * Defaults to the endpoint itself.
   */
  readonly source?: string
  /**
   * Request timeout in milliseconds. The adapter aborts the
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
  readonly fetchImpl?: ApiDataSourceFetch
}

/**
 * Default request timeout (10 seconds).
 */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Construct an HTTP API data-source adapter.
 *
 * Construction validates the endpoint synchronously and
 * returns an adapter that performs the fetch lazily on the
 * first `loadAll()` call. The endpoint is required — a
 * blank / whitespace endpoint throws
 * {@link DataSourceMissingConfigError} so the misconfiguration
 * is fixed at startup rather than at first request.
 *
 * The fetch uses the platform `fetch` by default; tests can
 * override with `fetchImpl`. The AbortController-based timeout
 * is independent of any server-side fetch timeout so the
 * adapter's contract is observable from a unit test.
 */
export function createApiDataSource<T>(
  options: ApiDataSourceOptions<T>,
): DataSourceAdapter<T> {
  if (typeof options.endpoint !== 'string' || options.endpoint.trim() === '') {
    throw new DataSourceMissingConfigError('api', 'endpoint')
  }
  const endpoint = options.endpoint
  const source = options.source ?? endpoint
  const schema = options.schema
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS
  const fetchImpl: ApiDataSourceFetch = options.fetchImpl ?? ((input, init) => fetch(input, init))

  let cached: readonly T[] | undefined
  let pending: Promise<readonly T[]> | undefined

  async function performLoad(): Promise<readonly T[]> {
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
        // The response body was not valid JSON. Treat it as a
        // payload failure so a misconfigured upstream that
        // returns HTML or an empty body is a hard error,
        // not a misleading `SyntaxError` from `JSON.parse`.
        throw new DataSourceInvalidPayloadError(endpoint, parseError)
      }
      let data: readonly T[]
      if (schema) {
        const parsed = schema.safeParse(json)
        if (!parsed.success) {
          throw new DataSourceInvalidPayloadError(endpoint, parsed.error)
        }
        data = parsed.data as readonly T[]
      }
      else {
        if (!Array.isArray(json)) {
          throw new DataSourceInvalidPayloadError(
            endpoint,
            new Error('Response body is not a JSON array and no schema was supplied for validation.'),
          )
        }
        data = json as readonly T[]
      }
      return data
    }
    catch (error) {
      // The platform `fetch` raises `DOMException` with
      // `name === 'AbortError'` when the AbortController's
      // signal fires. The check matches by `name` (not by
      // `instanceof DOMException`) so a test mock that
      // throws a plain `Error` with `name = 'AbortError'`
      // is translated the same way as the real DOMException.
      // `controller.signal.aborted` confirms the abort was
      // our own timeout, not an upstream-initiated cancel.
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
  }

  return {
    id: 'api',
    /**
     * Async loader. Performs the fetch on the first call,
     * validates the response, and memoizes the array. Subsequent
     * calls return the same reference — a Nuxt page that calls
     * `useAsyncData` three times with the same key produces one
     * fetch.
     */
    loadAll(): Promise<readonly T[]> {
      if (cached !== undefined) {
        return Promise.resolve(cached)
      }
      if (!pending) {
        pending = performLoad().then((data) => {
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
          `[data-source:api] getAll() called before loadAll() resolved. `
          + `Call \`await adapter.loadAll()\` first.`,
        )
      }
      return cached
    },
    /**
     * Diagnostic tag. Surfaces the source in `String(adapter)`
     * and `Object.prototype.toString.call(adapter)`.
     */
    [Symbol.toStringTag]: `api:${source}`,
  } as DataSourceAdapter<T> & { readonly [Symbol.toStringTag]: string }
}