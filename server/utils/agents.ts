import type { DataSourceAdapter, DataSourceKind } from '~/core/data-source/data-source'
import { agentListSchema } from '~/features/agents/schemas/agent.schema'
import { sampleAgents } from '~/features/agents/data/agents'
import type { Agent } from '~/features/agents/types/agent.types'
import {
  createServerDataSourceAdapter,
  createServerLoader,
  type ServerDataSourceOptions,
} from './server-data-source'

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
 * without moving the file out of `server/utils/`.
 *
 * **Shared server-side data-source utilities (Task 108).**
 * The kind-parsing, `isDataSourceKind` dispatch,
 * missing-config / unsupported-kind error mapping, timeout
 * parsing, and in-flight `pending` coalescing are NOT
 * re-implemented here. They live in
 * `server/utils/server-data-source.ts` and are reused through
 * {@link createServerDataSourceAdapter} + {@link createServerLoader}.
 * This file owns ONLY the feature-specific surface: the
 * `NUXT_AGENTS_*` env var names, the agent Zod schema, and
 * the bundled `sampleAgents` catalog. The agents loader
 * intentionally does NOT ship a CMS branch — selecting
 * `'cms'` raises `DataSourceNotImplementedError('cms',
 * SHIPPED_KINDS)` from the shared utility because the agents
 * feature scope is static + api only (CMS support is a future
 * task).
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
 * is the `pending` reference captured in the per-feature
 * loader's `createServerLoader` closure, which coalesces
 * concurrent in-flight calls: when a call arrives while a
 * previous call is still resolving, it shares the same
 * promise. The `pending` reference is cleared after settle
 * (success or failure), so the next call constructs a new
 * adapter and performs a new fetch. The api is therefore
 * fetched on every call, not "at most once per server
 * lifetime".
 *
 * **Why `process.env` directly (not `useRuntimeConfig`).**
 * `NUXT_AGENTS_API_URL` and `NUXT_AGENTS_API_TIMEOUT_MS` are
 * intentionally NOT declared in `nuxt.config.ts` →
 * `runtimeConfig`. Declaring them in `runtimeConfig` would put
 * them on the `nuxt` runtime config surface (server-only by
 * Nuxt convention, but still a public-ish surface); the
 * `process.env` read (now via the shared `readEnv` helper)
 * keeps them in the loader module only. `runtimeConfig` is
 * reserved for the `leads*` / `NUXT_LEADS_*` configuration
 * that the lead-capture pipeline consumes through
 * `useRuntimeConfig`.
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
 * The shared-utilities options for the agents loader. The
 * `cms` branch is intentionally omitted — the agents feature
 * does not ship CMS support, so the shared utility raises
 * `DataSourceNotImplementedError('cms', SHIPPED_KINDS)` for
 * any `'cms'` request.
 */
const agentsOptions: ServerDataSourceOptions<Agent> = {
  kindEnvName: PROP_ENV_KIND,
  shippedKinds: SHIPPED_KINDS,
  static: {
    data: sampleAgents,
    schema: agentListSchema,
    source: 'app/features/agents/data/agents.ts',
  },
  api: {
    endpointEnvName: PROP_ENV_ENDPOINT,
    timeoutEnvName: PROP_ENV_TIMEOUT_MS,
    schema: agentListSchema,
  },
}

/**
 * Construct the data-source adapter the loader should use.
 *
 * Thin wrapper that delegates to the shared
 * {@link createServerDataSourceAdapter} with the agents
 * options. The kind parsing, the `isDataSourceKind`
 * dispatch, the missing-config / unsupported-kind error
 * mapping, the timeout parsing, and the static / api branch
 * construction are all handled by the shared utility.
 *
 *  - `NUXT_AGENTS_DATA_SOURCE` unset / empty / whitespace /
 *    `'static'` → the bundled static adapter.
 *  - `NUXT_AGENTS_DATA_SOURCE=api` + a non-empty
 *    `NUXT_AGENTS_API_URL` → the api adapter.
 *  - `NUXT_AGENTS_DATA_SOURCE=cms` → raises
 *    {@link DataSourceNotImplementedError} (the contract
 *    exists but no CMS adapter ships for the agents feature).
 *  - Any other non-empty value (e.g. `'graphql'`, `'STATIC'`,
 *    `'API'`) → raises {@link DataSourceNotImplementedError}.
 *
 * Exposed for the unit tests that exercise the static default
 * and the api-configured branch.
 */
export function createAgentsServerAdapter(): DataSourceAdapter<Agent> {
  return createServerDataSourceAdapter(agentsOptions)
}

/**
 * The per-feature in-flight `pending` closure. Created
 * once at module load via the shared `createServerLoader`
 * factory. Concurrent callers share the same in-flight
 * promise; the reference is cleared on settle so the next
 * call constructs a fresh adapter and performs a new fetch.
 */
const agentsLoader = createServerLoader<Agent>(createAgentsServerAdapter)

/**
 * Load the resolved agent list for the current server.
 *
 * Each call constructs a fresh adapter (via
 * {@link createAgentsServerAdapter} → the shared
 * `createServerDataSourceAdapter`) and awaits its
 * `loadAll()`. Concurrent calls are coalesced through the
 * in-flight `pending` promise so a single render produces at
 * most one in-flight fetch; the promise is cleared on
 * settle, so the next call performs a new fetch. A
 * successful API result is NOT retained between calls.
 *
 * The function is safe to call from any server-only context:
 * the Nitro endpoint (`server/api/agents.get.ts`), the
 * sitemap (`server/routes/sitemap.xml.ts`), and the unit tests
 * in `server/utils/agents.test.ts`. It is NOT a Nuxt composable
 * and does not require a Nuxt app context.
 */
export async function loadAgentsServer(): Promise<readonly Agent[]> {
  return agentsLoader.load()
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
  agentsLoader.reset()
}
