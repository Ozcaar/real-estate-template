import { createApiDataSource } from '~/core/data-source/adapters/api-adapter'
import { createStaticDataSource } from '~/core/data-source/adapters/static-adapter'
import {
  DataSourceMissingConfigError,
  DataSourceNotImplementedError,
  isDataSourceKind,
  type DataSourceAdapter,
  type DataSourceKind,
} from '~/core/data-source/data-source'
import { agentListSchema } from '~/features/agents/schemas/agent.schema'
import { sampleAgents } from '~/features/agents/data/agents'
import type { Agent } from '~/features/agents/types/agent.types'

/**
 * Server-only agent loader (Task 104).
 *
 * Mirrors `server/utils/properties.ts` for the agents feature:
 * owns the `NUXT_AGENTS_*` private configuration and the
 * static / api source selection, and exposes the resolved
 * data through two public surfaces:
 *
 *  - {@link loadAgentsServer} — async, returns the validated
 *    list. Used by the same-origin Nitro endpoint at
 *    `server/api/agents.get.ts` (which the app-side agent
 *    service calls via `$fetch`) and by the sitemap at
 *    `server/routes/sitemap.xml.ts` (which imports the loader
 *    directly without going through the Nitro endpoint).
 *  - {@link createAgentsServerAdapter} — lower-level factory
 *    that returns a {@link DataSourceAdapter}. Exposed for the
 *    unit tests that exercise the static-default and
 *    api-configured branches without booting a Nitro server.
 *
 * **Why a `server/utils/` module.** `server/utils/` is the
 * canonical Nuxt 4 location for server-only utilities: the
 * files are auto-imported by Nitro and bundled exclusively to
 * the server output, never to the client. The api-adapter
 * module and the three `NUXT_AGENTS_*` env vars therefore
 * cannot reach the client bundle by code organization, not by
 * tree-shaking — a future change cannot reintroduce the leak
 * without moving this file out of `server/utils/`.
 *
 * **Why no Nuxt plugin.** A Nuxt plugin would run on EVERY
 * server request and pre-populate shared state, which couples
 * the agent source to the Nuxt request lifecycle and triggers
 * a fetch on routes that do not need agents (e.g. `/about`,
 * `/contact`, `/properties/*`, `/developments/*`). The loader
 * function is a plain async function that runs only when a
 * server route that needs agent data calls it (the Nitro
 * endpoint or the sitemap). The `loadAll()` on the agent
 * service is invoked only by the agents listing, the agent
 * detail page, and the sitemap — three call sites — so the
 * api fetch happens on demand, not on every request.
 *
 * **No permanent process-lifetime cache.** A successful
 * API result is NOT retained between calls. Each call to
 * {@link loadAgentsServer} constructs a fresh adapter and
 * awaits its `loadAll()`; a later request observes the latest
 * upstream data, not a stale snapshot. The only shared state
 * is the `pending` reference, which coalesces concurrent
 * in-flight calls: when a call arrives while a previous call
 * is still resolving, it shares the same promise. The
 * `pending` reference is cleared after settle (success or
 * failure), so the next call constructs a new adapter and
 * performs a new fetch. The api is therefore fetched on every
 * call, not "at most once per server lifetime".
 *
 * **Why `process.env` directly (not `useRuntimeConfig`).**
 * `NUXT_AGENTS_API_URL` and `NUXT_AGENTS_API_TIMEOUT_MS` are
 * intentionally NOT declared in `nuxt.config.ts` →
 * `runtimeConfig`. Declaring them in `runtimeConfig` would put
 * them on the `nuxt` runtime config surface (server-only by
 * Nuxt convention, but still a public-sh-shaped surface); the
 * `process.env` read keeps them in the loader module only.
 * `runtimeConfig` is reserved for the `leads*` /
 * `NUXT_LEADS_*` configuration that the lead-capture pipeline
 * consumes through `useRuntimeConfig`.
 *
 * **Failure modes.**
 *
 *  - `NUXT_AGENTS_DATA_SOURCE` unset / empty / whitespace is
 *    the default — the loader returns the bundled static
 *    adapter.
 *  - `NUXT_AGENTS_DATA_SOURCE=static` is an explicit opt-in
 *    to the bundled default.
 *  - `NUXT_AGENTS_DATA_SOURCE=api` with an empty / whitespace
 *    `NUXT_AGENTS_API_URL` raises
 *    {@link DataSourceMissingConfigError} at the first loader
 *    call so the misconfiguration is fixed at server startup
 *    rather than at first request.
 *  - `NUXT_AGENTS_DATA_SOURCE=cms` raises
 *    {@link DataSourceNotImplementedError}: the contract
 *    defines `'cms'` for the data-source kind set, but the
 *    agents feature intentionally does NOT ship a CMS adapter
 *    (Task 104 scope is static + api only — CMS support is a
 *    future task).
 *  - Any other non-empty value (e.g. `'graphql'`, `'STATIC'`,
 *    `'Api'`, `'sanity'`) raises
 *    {@link DataSourceNotImplementedError} naming the literal
 *    env-var value. The type guard {@link isDataSourceKind} is
 *    the source of truth for the accepted set; case variants
 *    and unknown strings are misconfigurations, not
 *    silently-coerced defaults.
 *  - A non-integer `NUXT_AGENTS_API_TIMEOUT_MS` falls back to
 *    the documented default (10 000 ms). The fallback is silent
 *    (no log line) — a malformed timeout is a deployment
 *    misconfiguration, not an operator-facing condition.
 *  - The remote API returning a non-2xx response, a JSON
 *    parse failure, a timeout, or a payload that fails
 *    {@link agentListSchema} re-throws the matching
 *    `DataSourceHttpError` / `DataSourceTimeoutError` /
 *    `DataSourceInvalidPayloadError` from the loader's
 *    `await adapter.loadAll()` call. Nitro maps the thrown
 *    error to the route's error state.
 *  - A failed load does NOT retain the failure — the loader
 *    does not memoise successes OR failures. The next call
 *    constructs a new adapter and retries from scratch.
 */
const PROP_ENV_KIND = 'NUXT_AGENTS_DATA_SOURCE'
const PROP_ENV_ENDPOINT = 'NUXT_AGENTS_API_URL'
const PROP_ENV_TIMEOUT_MS = 'NUXT_AGENTS_API_TIMEOUT_MS'

/**
 * The default request timeout for the api adapter (10
 * seconds). Matches the default inside `createApiDataSource`
 * so a deployment that omits the env var still has a
 * documented upper bound.
 */
const DEFAULT_API_TIMEOUT_MS = 10_000

/**
 * Read an env var from `process.env`, guarded by
 * `typeof process` so the loader can be evaluated in test
 * environments that do not define `process.env` (older Node,
 * certain bundlers).
 */
function readEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) return ''
  return process.env[name] ?? ''
}

/**
 * The kinds the loader ships with.
 *
 * `'static'` is the bundled default; `'api'` is the real
 * HTTP adapter. `'cms'` is intentionally NOT in the list: the
 * contract is defined but no CMS adapter ships for the agents
 * feature in Task 104. A rebrand that asks for `'cms'` (or any
 * other unknown value such as `'graphql'` or `'STATIC'`) fails
 * loudly via {@link DataSourceNotImplementedError} so the
 * misconfiguration is fixed at server startup rather than
 * silently shipping the bundled static data.
 */
const SHIPPED_KINDS: readonly DataSourceKind[] = ['static', 'api'] as const

/**
 * Construct the data-source adapter the loader should use.
 *
 *  - `NUXT_AGENTS_DATA_SOURCE` unset / empty / whitespace /
 *    `'static'` → the bundled static adapter.
 *  - `NUXT_AGENTS_DATA_SOURCE=api` + a non-empty
 *    `NUXT_AGENTS_API_URL` → the api adapter.
 *  - `NUXT_AGENTS_DATA_SOURCE=cms` → raises
 *    {@link DataSourceNotImplementedError} (the contract
 *    exists but no CMS adapter ships for the agents feature in
 *    Task 104).
 *  - Any other non-empty value (e.g. `'graphql'`, `'STATIC'`,
 *    `'API'`) → raises {@link DataSourceNotImplementedError}
 *    naming the unknown kind. The type guard
 *    {@link isDataSourceKind} is the source of truth for the
 *    accepted set; everything else is a misconfiguration that
 *    must be fixed, not silently coerced to `'static'`.
 *
 * The api-adapter module is imported here only — the
 * `server/utils/` location keeps the import server-only by
 * code organization. Exposed for the unit tests that exercise
 * the static default and the api-configured branch.
 */
export function createAgentsServerAdapter(): DataSourceAdapter<Agent> {
  const rawKind = readEnv(PROP_ENV_KIND)

  // Unset / empty / whitespace → default to the bundled
  // static adapter. This is the documented behavior for a
  // deployment that does not opt into a non-default source.
  if (rawKind.trim() === '') {
    return createStaticDataSource<Agent>({
      data: sampleAgents,
      schema: agentListSchema,
      source: 'app/features/agents/data/agents.ts',
    })
  }

  // Use the existing type guard to dispatch on a known
  // kind. The guard rejects case variants (`'STATIC'`,
  // `'Api'`) and unknown strings (`'graphql'`, `'sanity'`)
  // uniformly; we then dispatch on the validated value.
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
      SHIPPED_KINDS,
    )
  }

  if (rawKind === 'cms') {
    // The contract defines `'cms'`, but no CMS adapter ships
    // for the agents feature in Task 104. Throw the
    // existing not-implemented error so a rebrand that asks
    // for `'cms'` fails loudly instead of silently falling
    // back to the bundled static data. The full data-source
    // contract is documented in `app/core/data-source/data-source.ts`;
    // the cms path for properties is shipped in the v1.1.0
    // M20 milestone.
    throw new DataSourceNotImplementedError('cms', SHIPPED_KINDS)
  }

  if (rawKind === 'api') {
    const endpoint = readEnv(PROP_ENV_ENDPOINT)
    if (endpoint.trim() === '') {
      // The missing-config error uses `kind: 'api'` to match the
      // shared data-source contract — `kind` is the data-source
      // kind (`'static' | 'api' | 'cms'`) per `DataSourceKind`, not
      // the resource name. The `field` carries the operator-facing
      // env-var name so a misconfigured rebrand is a hard error
      // with a precise diagnostic.
      throw new DataSourceMissingConfigError('api', PROP_ENV_ENDPOINT)
    }
    const timeoutRaw = readEnv(PROP_ENV_TIMEOUT_MS)
    const timeoutMs = timeoutRaw === ''
      ? DEFAULT_API_TIMEOUT_MS
      : Number.parseInt(timeoutRaw, 10) || DEFAULT_API_TIMEOUT_MS
    return createApiDataSource<Agent>({
      endpoint,
      schema: agentListSchema,
      source: `api:${PROP_ENV_ENDPOINT}`,
      timeoutMs,
    })
  }

  // rawKind === 'static' — explicit opt-in to the bundled
  // adapter. Same shape as the unset default.
  return createStaticDataSource<Agent>({
    data: sampleAgents,
    schema: agentListSchema,
    source: 'app/features/agents/data/agents.ts',
  })
}

/**
 * The in-flight promise for the loader. Coalesces concurrent
 * calls: while a call is resolving, subsequent callers share
 * the same promise. The reference is cleared on settle
 * (success or failure) so the next call constructs a new
 * adapter and performs a new fetch.
 *
 * There is NO permanent process-lifetime cache for the
 * resolved list — a later request observes the latest
 * upstream data. The `pending` reference exists only to
 * collapse simultaneous in-flight calls into a single
 * adapter construction; it is NOT a memoised result.
 */
let pending: Promise<readonly Agent[]> | null = null

/**
 * Load the resolved agent list for the current server.
 *
 * Each call constructs a fresh adapter (driven by
 * `NUXT_AGENTS_DATA_SOURCE`) and awaits its `loadAll()`.
 * Concurrent calls are coalesced through the in-flight
 * `pending` promise so a single render produces at most one
 * in-flight fetch; the promise is cleared on settle, so the
 * next call performs a new fetch. A successful API result is
 * NOT retained between calls.
 *
 * The function is safe to call from any server-only context:
 * the Nitro endpoint (`server/api/agents.get.ts`), the
 * sitemap (`server/routes/sitemap.xml.ts`), and the unit tests
 * in `server/utils/agents.test.ts`. It is NOT a Nuxt composable
 * and does not require a Nuxt app context.
 */
export async function loadAgentsServer(): Promise<readonly Agent[]> {
  if (pending) return pending
  pending = (async () => {
    try {
      const adapter = createAgentsServerAdapter()
      return await adapter.loadAll()
    }
    finally {
      pending = null
    }
  })()
  return pending
}

/**
 * Reset the in-flight promise. Exposed for the unit tests
 * that exercise the static-default → api-configured
 * transition (each test starts with a clean in-flight state
 * so a test that left a pending promise in flight does not
 * pollute the next). Not part of the production API.
 *
 * Note: there is no permanent cache to reset. The
 * process-lifetime cache that previously lived here was
 * removed so the api source reflects upstream changes
 * between calls.
 */
export function _resetAgentsServerCacheForTests(): void {
  pending = null
}