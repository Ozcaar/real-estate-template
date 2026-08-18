import { createApiDataSource } from '~/core/data-source/adapters/api-adapter'
import { createStaticDataSource } from '~/core/data-source/adapters/static-adapter'
import {
  DataSourceMissingConfigError,
  DataSourceNotImplementedError,
  isDataSourceKind,
  type DataSourceAdapter,
  type DataSourceKind,
  type DataSourceSchema,
} from '~/core/data-source/data-source'

/**
 * Shared server-side data-source loader utilities (Task 108).
 *
 * The three feature loaders (`server/utils/properties.ts`,
 * `server/utils/agents.ts`, `server/utils/developments.ts`) each
 * own their own `NUXT_<FEATURE>_*` env var names, Zod schema,
 * and bundled data. The duplicated parts — kind parsing,
 * `isDataSourceKind` dispatch, missing-config / unsupported-kind
 * error mapping, timeout parsing, static / api branch construction,
 * and the in-flight `pending` coalescing — live in this module
 * and are reused through two functions:
 *
 *  - {@link createServerDataSourceAdapter} — pure synchronous
 *    factory that reads the configured kind, validates it
 *    against the loader's `shippedKinds`, and returns a
 *    `DataSourceAdapter<T>` (or throws one of the documented
 *    `DataSourceNotImplementedError` / `DataSourceMissingConfigError`
 *    shapes).
 *  - {@link createServerLoader} — closure factory that wraps
 *    an adapter-factory with the in-flight `pending`
 *    coalescing the loader docs describe (concurrent callers
 *    share a single in-flight promise; the reference is
 *    cleared on settle, success or failure, so the next call
 *    constructs a fresh adapter and performs a new fetch).
 *
 * **Why a `server/utils/` module.** Same reasoning as the
 * per-feature loaders: `server/utils/` is the canonical Nuxt
 * 4 location for server-only utilities. The api-adapter and
 * static-adapter modules imported here are bundled to the
 * Nitro server output only, never to the client. A future
 * change cannot reintroduce the leak without moving this file
 * out of `server/utils/`.
 *
 * **No new features.** The module re-shapes existing logic
 * without adding new data-source kinds, new env vars, new
 * adapters, new error classes, new caching layers, or new
 * retries. The CMS path is provided as an optional branch
 * so the properties loader can keep its CMS support; the
 * agents and developments loaders omit the branch and the
 * shared utility falls back to the documented
 * `DataSourceNotImplementedError('cms', shippedKinds)` for
 * them. The `cms` kind is the ONLY difference between the
 * feature loaders; everything else is identical.
 *
 * **Pure factory.** The shared utility holds no module-level
 * mutable state. The in-flight `pending` reference is captured
 * per `createServerLoader` call — each feature loader owns its
 * own `pending` closure, so concurrent requests for different
 * features cannot share coalescing state.
 */

/**
 * The default request timeout for the api + cms adapters
 * (10 seconds). Matches the default inside `createApiDataSource`
 * and `createHttpJsonCmsDriver` so a deployment that omits
 * the per-feature timeout env var still has a documented upper
 * bound. Exported so a future feature loader can reuse it.
 */
export const DEFAULT_API_TIMEOUT_MS = 10_000

/**
 * Read an env var from `process.env`, guarded by
 * `typeof process` so the loader can be evaluated in test
 * environments that do not define `process.env` (older Node,
 * certain bundlers).
 *
 * Identical to the per-feature `readEnv` helpers in
 * `properties.ts`, `agents.ts`, and `developments.ts` before
 * this consolidation.
 */
export function readEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env[name] ?? ''
}

/**
 * Parse a numeric timeout env var, falling back to
 * `defaultMs` for an unset, empty, whitespace, or non-integer
 * value. The fallback is silent (no log line) — a malformed
 * timeout is a deployment misconfiguration, not an
 * operator-facing condition.
 *
 * Identical to the per-feature timeout parsing in the three
 * feature loaders before this consolidation.
 */
export function parseTimeoutMs(envName: string, defaultMs: number): number {
  const raw = readEnv(envName)
  if (raw === '') return defaultMs
  return Number.parseInt(raw, 10) || defaultMs
}

/**
 * Options for the static branch. The static adapter wraps
 * the bundled `data` array, validates it against the
 * boundary `schema` at construction, and surfaces the
 * `source` string for diagnostics.
 */
export interface ServerDataSourceStaticBranch<T> {
  readonly data: readonly T[]
  readonly schema: DataSourceSchema<T>
  readonly source: string
}

/**
 * Options for the api branch. The api adapter fetches
 * `readEnv(endpointEnvName)` and times out after
 * `readEnv(timeoutEnvName)` (or `defaultTimeoutMs`). The
 * `schema` is the boundary validation tool — a 2xx response
 * that fails Zod validation throws
 * `DataSourceInvalidPayloadError` from inside the adapter.
 */
export interface ServerDataSourceApiBranch<T> {
  readonly endpointEnvName: string
  readonly timeoutEnvName: string
  readonly schema: DataSourceSchema<T>
  readonly defaultTimeoutMs?: number
}

/**
 * Options for the cms branch. ONLY the properties loader
 * supplies this; the agents and developments loaders omit
 * it, and the shared utility falls back to
 * `DataSourceNotImplementedError('cms', shippedKinds)` for
 * them.
 *
 * The `build` callback constructs the CMS adapter from the
 * resolved endpoint + timeout + schema + source. The callback
 * is the only feature-specific piece of the cms branch — it
 * is where the properties loader wires the
 * `createHttpJsonCmsDriver` + `createCmsDataSource` pair
 * (the agents and developments loaders do not need a `build`
 * because they do not ship CMS support).
 */
export interface ServerDataSourceCmsBranch<T> {
  readonly endpointEnvName: string
  readonly timeoutEnvName: string
  readonly schema: DataSourceSchema<T>
  readonly defaultTimeoutMs?: number
  readonly build: (cfg: {
    readonly endpoint: string
    readonly timeoutMs: number
    readonly schema: DataSourceSchema<T>
    readonly source: string
  }) => DataSourceAdapter<T>
}

/**
 * Options for {@link createServerDataSourceAdapter}.
 *
 * Every feature loader supplies:
 *
 *  - `kindEnvName` — the env var that holds the kind
 *    (`'NUXT_PROPERTIES_DATA_SOURCE'` for properties, etc.).
 *  - `shippedKinds` — the kinds the loader actually ships,
 *    used to populate the `supportedKinds` line on the
 *    `DataSourceNotImplementedError` message. Properties
 *    ships `['static', 'api', 'cms']`; agents and
 *    developments ship `['static', 'api']`.
 *  - `static` — always supplied. The static branch is the
 *    bundled default.
 *  - `api` — always supplied. The api branch is part of
 *    every loader's `shippedKinds`.
 *  - `cms` — supplied only by the loader that ships CMS
 *    support (properties). When omitted, requesting `'cms'`
 *    raises `DataSourceNotImplementedError('cms',
 *    shippedKinds)`.
 */
export interface ServerDataSourceOptions<T> {
  readonly kindEnvName: string
  readonly shippedKinds: readonly DataSourceKind[]
  readonly static: ServerDataSourceStaticBranch<T>
  readonly api: ServerDataSourceApiBranch<T>
  readonly cms?: ServerDataSourceCmsBranch<T>
}

/**
 * Resolve the configured kind and dispatch on it.
 *
 * Returns a {@link DataSourceAdapter} for the static / api /
 * cms branch. Throws:
 *
 *  - {@link DataSourceNotImplementedError} for any non-empty
 *    value not in the kind set (case variants like `'STATIC'`,
 *    unknown strings like `'graphql'` / `'sanity'`).
 *  - {@link DataSourceNotImplementedError} (`'cms'`) when
 *    `'cms'` is requested but no `cms` branch was supplied
 *    (the agents and developments loaders intentionally do
 *    not ship CMS support).
 *  - {@link DataSourceMissingConfigError} when the api or
 *    cms endpoint env var is empty or whitespace.
 *
 * The kind parsing, the `isDataSourceKind` type-guard
 * dispatch, the `readEnv` + `parseTimeoutMs` plumbing, and
 * the `static` / `api` / `cms` construction logic were
 * duplicated verbatim across `server/utils/properties.ts`,
 * `server/utils/agents.ts`, and `server/utils/developments.ts`
 * before this consolidation; this function is the single
 * source of truth.
 */
export function createServerDataSourceAdapter<T>(
  options: ServerDataSourceOptions<T>,
): DataSourceAdapter<T> {
  const rawKind = readEnv(options.kindEnvName)

  // Unset / empty / whitespace → default to the bundled
  // static adapter. This is the documented behavior for a
  // deployment that does not opt into a non-default source.
  if (rawKind.trim() === '') {
    return createStaticDataSource<T>({
      data: options.static.data,
      schema: options.static.schema,
      source: options.static.source,
    })
  }

  // Use the existing type guard to dispatch on a known
  // kind. The guard rejects case variants (`'STATIC'`,
  // `'Api'`) and unknown strings (`'graphql'`,
  // `'sanity'`) uniformly; we then dispatch on the
  // validated value.
  if (!isDataSourceKind(rawKind)) {
    // The value is non-empty but is not a documented kind.
    // The type guard's narrowed type is `DataSourceKind`,
    // but the value is genuinely unknown; we cast through
    // `DataSourceKind` so the error names the literal
    // env-var value. The error message lists the kinds the
    // loader actually ships so an operator can fix the
    // misconfiguration without reading source code.
    throw new DataSourceNotImplementedError(
      rawKind as DataSourceKind,
      options.shippedKinds,
    )
  }

  if (rawKind === 'cms') {
    if (!options.cms) {
      // The agents and developments loaders intentionally do
      // not ship a CMS adapter. The contract defines `'cms'`
      // for the data-source kind set, but the feature loader
      // does not implement it. Throw the existing
      // not-implemented error so a rebrand that asks for
      // `'cms'` fails loudly instead of silently falling back
      // to the bundled static data.
      throw new DataSourceNotImplementedError('cms', options.shippedKinds)
    }
    const endpoint = readEnv(options.cms.endpointEnvName)
    if (endpoint.trim() === '') {
      throw new DataSourceMissingConfigError('cms', options.cms.endpointEnvName)
    }
    const defaultMs = options.cms.defaultTimeoutMs ?? DEFAULT_API_TIMEOUT_MS
    const timeoutMs = parseTimeoutMs(options.cms.timeoutEnvName, defaultMs)
    const source = `cms:${options.cms.endpointEnvName}`
    return options.cms.build({
      endpoint,
      timeoutMs,
      schema: options.cms.schema,
      source,
    })
  }

  if (rawKind === 'api') {
    const endpoint = readEnv(options.api.endpointEnvName)
    if (endpoint.trim() === '') {
      throw new DataSourceMissingConfigError('api', options.api.endpointEnvName)
    }
    const defaultMs = options.api.defaultTimeoutMs ?? DEFAULT_API_TIMEOUT_MS
    const timeoutMs = parseTimeoutMs(options.api.timeoutEnvName, defaultMs)
    return createApiDataSource<T>({
      endpoint,
      schema: options.api.schema,
      source: `api:${options.api.endpointEnvName}`,
      timeoutMs,
    })
  }

  // rawKind === 'static' — explicit opt-in to the bundled
  // adapter. Same shape as the unset default.
  return createStaticDataSource<T>({
    data: options.static.data,
    schema: options.static.schema,
    source: options.static.source,
  })
}

/**
 * The result of {@link createServerLoader}. An async `load`
 * function (the production API) and a `reset` function
 * exposed for unit tests that exercise the
 * static-default → api-configured transition (each test
 * starts with a clean in-flight state so a test that left
 * a pending promise in flight does not pollute the next).
 *
 * `reset` is intentionally NOT part of the production API;
 * the per-feature loader re-exports it as
 * `_resetXServerCacheForTests` (a name that signals the
 * test-only intent to a human reader).
 */
export interface ServerLoader<T> {
  load: () => Promise<readonly T[]>
  reset: () => void
}

/**
 * Wrap an adapter factory with the in-flight `pending`
 * coalescing the feature loaders describe.
 *
 * While a call is resolving, subsequent callers share the
 * same promise. The `pending` reference is cleared on settle
 * (success or failure) so the next call constructs a fresh
 * adapter (via `buildAdapter`) and performs a new fetch. A
 * successful result is NOT retained between calls — there is
 * NO process-lifetime cache. The `pending` reference exists
 * only to collapse simultaneous in-flight calls into a
 * single adapter construction.
 *
 * Each call to `createServerLoader` captures its own
 * `pending` closure, so the per-feature loaders (properties,
 * agents, developments) do not share coalescing state. A
 * concurrent request for properties and a concurrent request
 * for agents perform their own in-flight fetches, each with
 * a single adapter construction per settle cycle.
 */
export function createServerLoader<T>(
  buildAdapter: () => DataSourceAdapter<T>,
): ServerLoader<T> {
  let pending: Promise<readonly T[]> | null = null
  return {
    load: () => {
      if (pending) return pending
      pending = (async () => {
        try {
          const adapter = buildAdapter()
          return await adapter.loadAll()
        }
        finally {
          pending = null
        }
      })()
      return pending
    },
    reset: () => {
      pending = null
    },
  }
}
