import { createCmsDataSource } from '~/core/data-source/cms-driver'
import { createHttpJsonCmsDriver } from '~/core/data-source/adapters/http-json-cms-driver'
import type { DataSourceAdapter, DataSourceKind } from '~/core/data-source/data-source'
import { propertyListSchema } from '~/features/properties/schemas/property.schema'
import { sampleProperties } from '~/features/properties/data/properties'
import type { Property } from '~/features/properties/types/property.types'
import {
  createServerDataSourceAdapter,
  createServerLoader,
  type ServerDataSourceOptions,
} from './server-data-source'

/**
 * Server-only property loader.
 *
 * The single source of truth for the resolved property list on
 * the server. Owns the `NUXT_PROPERTIES_*` private configuration
 * and the static / api / cms source selection, and exposes the
 * resolved data through two public surfaces:
 *
 *  - {@link loadPropertiesServer} — async, returns the
 *    validated list. Used by the same-origin Nitro endpoint at
 *    `server/api/properties.get.ts` (which the app-side
 *    property service calls via `$fetch`) and by the sitemap
 *    at `server/routes/sitemap.xml.ts` (which imports the
 *    loader directly without going through the Nitro
 *    endpoint).
 *  - {@link createPropertiesServerAdapter} — lower-level
 *    factory that returns a {@link DataSourceAdapter}. Exposed
 *    for the unit tests that exercise the static-default,
 *    api-configured, and cms-configured branches without
 *    booting a Nitro server.
 *
 * **Why a `server/utils/` module.** `server/utils/` is the
 * canonical Nuxt 4 location for server-only utilities: the
 * files are auto-imported by Nitro and bundled exclusively to
 * the server output, never to the client. The api-adapter
 * module and the three `NUXT_PROPERTIES_*` env vars therefore
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
 * `NUXT_PROPERTIES_*` env var names, the property Zod
 * schema, the bundled `sampleProperties` catalog, and the
 * CMS branch's `createHttpJsonCmsDriver` +
 * `createCmsDataSource` wiring. The agents and developments
 * loaders delegate to the same shared utilities without
 * shipping CMS support — they omit the `cms` branch on
 * `propertiesOptions` and the shared utility raises
 * `DataSourceNotImplementedError('cms', shippedKinds)` for
 * them.
 *
 * **Why no Nuxt plugin.** A Nuxt plugin would run on EVERY
 * server request and pre-populate shared state, which couples
 * the property source to the Nuxt request lifecycle and
 * triggers a fetch on routes that do not need properties
 * (e.g. `/about`, `/contact`, `/agents/*`, `/developments/*`).
 * The loader function is a plain async function that runs
 * only when a server route that needs property data calls it
 * (the Nitro endpoint or the sitemap). The `loadAll()` on the
 * property service is invoked only by the home, listing, and
 * detail pages — three routes — so the api fetch happens on
 * demand, not on every request.
 *
 * **No permanent process-lifetime cache.** A successful
 * API result is NOT retained between calls. Each call to
 * {@link loadPropertiesServer} constructs a fresh adapter
 * (via `createPropertiesServerAdapter` → the shared
 * `createServerDataSourceAdapter`) and awaits its
 * `loadAll()`; a later request observes the latest upstream
 * data, not a stale snapshot. The only shared state is the
 * `pending` reference captured in the per-feature loader's
 * `createServerLoader` closure, which coalesces concurrent
 * in-flight calls: when a call arrives while a previous call
 * is still resolving, it shares the same promise. The
 * `pending` reference is cleared after settle (success or
 * failure), so the next call constructs a new adapter and
 * performs a new fetch. The api is therefore fetched on
 * every call, not "at most once per server lifetime".
 *
 * **Why `process.env` directly (not `useRuntimeConfig`).**
 * `NUXT_PROPERTIES_API_URL` and `NUXT_PROPERTIES_API_TIMEOUT_MS`
 * are intentionally NOT declared in `nuxt.config.ts` →
 * `runtimeConfig`. Declaring them in `runtimeConfig` would
 * put them on the `nuxt` runtime config surface (server-only
 * by Nuxt convention, but still a public-ish surface); the
 * `process.env` read (now via the shared `readEnv` helper)
 * keeps them in the loader module only. `runtimeConfig` is
 * reserved for the `leads*` / `NUXT_LEADS_*` configuration
 * that the lead-capture pipeline consumes through
 * `useRuntimeConfig`.
 *
 * **Failure modes.**
 *
 *  - `NUXT_PROPERTIES_DATA_SOURCE` unset / empty / whitespace
 *    is the default — the loader returns the bundled
 *    static adapter.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=static` is an explicit
 *    opt-in to the bundled default.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=api` with an empty /
 *    whitespace `NUXT_PROPERTIES_API_URL` raises
 *    {@link DataSourceMissingConfigError} at the first
 *    loader call so the misconfiguration is fixed at server
 *    startup rather than at first request.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=cms` with an empty /
 *    whitespace `NUXT_PROPERTIES_CMS_URL` raises
 *    {@link DataSourceMissingConfigError}; with a non-empty
 *    endpoint, the loader constructs the CMS adapter (the
 *    simple HTTP/JSON driver + `propertyListSchema` boundary).
 *  - Any other non-empty value (e.g. `'graphql'`, `'STATIC'`,
 *    `'Api'`, `'sanity'`) raises
 *    {@link DataSourceNotImplementedError} naming the
 *    literal env-var value. The type guard
 *    {@link isDataSourceKind} is the source of truth for the
 *    accepted set; case variants and unknown strings are
 *    misconfigurations, not silently-coerced defaults.
 *  - A non-integer `NUXT_PROPERTIES_API_TIMEOUT_MS` or
 *    `NUXT_PROPERTIES_CMS_TIMEOUT_MS` falls back to the
 *    documented default (10 000 ms). The fallback is silent
 *    (no log line) — a malformed timeout is a deployment
 *    misconfiguration, not an operator-facing condition.
 *  - The remote API / CMS returning a non-2xx response, a
 *    JSON parse failure, a timeout, or a payload that fails
 *    {@link propertyListSchema} re-throws the matching
 *    `DataSourceHttpError` / `DataSourceTimeoutError` /
 *    `DataSourceInvalidPayloadError` from the loader's
 *    `await adapter.loadAll()` call. Nitro maps the thrown
 *    error to the route's error state.
 *  - A failed load does NOT retain the failure — the loader
 *    does not memoise successes OR failures. The next call
 *    constructs a new adapter and retries from scratch.
 */

const PROP_ENV_KIND = 'NUXT_PROPERTIES_DATA_SOURCE'
const PROP_ENV_ENDPOINT = 'NUXT_PROPERTIES_API_URL'
const PROP_ENV_TIMEOUT_MS = 'NUXT_PROPERTIES_API_TIMEOUT_MS'
const PROP_ENV_CMS_URL = 'NUXT_PROPERTIES_CMS_URL'
const PROP_ENV_CMS_TIMEOUT_MS = 'NUXT_PROPERTIES_CMS_TIMEOUT_MS'

/**
 * The kinds the loader ships with.
 *
 * `'static'` is the bundled default; `'api'` is the real
 * HTTP adapter; `'cms'` is the simple HTTP/JSON CMS
 * provider adapter (Task 103). Anything else (e.g.
 * `'graphql'`, `'STATIC'`, `'sanity'`) is rejected at
 * construction via the shared utility's `isDataSourceKind`
 * type guard and surfaced as
 * {@link DataSourceNotImplementedError} so the
 * misconfiguration is fixed at server startup rather than
 * silently shipping the bundled static data.
 */
const SHIPPED_KINDS: readonly DataSourceKind[] = ['static', 'api', 'cms'] as const

/**
 * The shared-utilities options for the properties loader.
 *
 * Holds the env-var names + boundary schema + bundled data +
 * CMS builder wiring. Module-level (the env vars are NOT
 * read here — the shared utility's `readEnv` reads them
 * fresh on every adapter construction, so a test that flips
 * `process.env` between calls sees the new value on the next
 * adapter construction).
 */
const propertiesOptions: ServerDataSourceOptions<Property> = {
  kindEnvName: PROP_ENV_KIND,
  shippedKinds: SHIPPED_KINDS,
  static: {
    data: sampleProperties,
    schema: propertyListSchema,
    source: 'app/features/properties/data/properties.ts',
  },
  api: {
    endpointEnvName: PROP_ENV_ENDPOINT,
    timeoutEnvName: PROP_ENV_TIMEOUT_MS,
    schema: propertyListSchema,
  },
  cms: {
    endpointEnvName: PROP_ENV_CMS_URL,
    timeoutEnvName: PROP_ENV_CMS_TIMEOUT_MS,
    schema: propertyListSchema,
    /**
     * Construct the CMS adapter from the resolved endpoint
     * + timeout + schema + source. This is the only
     * feature-specific piece of the CMS branch — the agents
     * and developments loaders do not supply a `build`
     * because they intentionally do not ship CMS support.
     */
    build: ({ endpoint, timeoutMs, schema, source }) => {
      const driver = createHttpJsonCmsDriver<Property>({
        endpoint,
        source,
        timeoutMs,
      })
      return createCmsDataSource<Property>({
        driver,
        schema,
        source,
      })
    },
  },
}

/**
 * Construct the data-source adapter the loader should use.
 *
 * Thin wrapper that delegates to the shared
 * {@link createServerDataSourceAdapter} with the properties
 * options. The kind parsing, the `isDataSourceKind`
 * dispatch, the missing-config / unsupported-kind error
 * mapping, the timeout parsing, and the static / api / cms
 * branch construction are all handled by the shared utility
 * — this wrapper exists so the public surface stays a
 * `createPropertiesServerAdapter()` call site (the agents
 * and developments loaders follow the same pattern).
 *
 *  - `NUXT_PROPERTIES_DATA_SOURCE` unset / empty /
 *    whitespace / `'static'` → the bundled static adapter.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=api` + a non-empty
 *    `NUXT_PROPERTIES_API_URL` → the api adapter.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=cms` + a non-empty
 *    `NUXT_PROPERTIES_CMS_URL` → the CMS adapter.
 *  - `NUXT_PROPERTIES_DATA_SOURCE=cms` + an empty /
 *    whitespace endpoint → {@link DataSourceMissingConfigError}.
 *  - Any other non-empty value (e.g. `'graphql'`,
 *    `'STATIC'`, `'API'`) → raises
 *    {@link DataSourceNotImplementedError} naming the
 *    unknown kind.
 *
 * Exposed for the unit tests that exercise the static
 * default, the api-configured branch, and the
 * cms-configured branch.
 */
export function createPropertiesServerAdapter(): DataSourceAdapter<Property> {
  return createServerDataSourceAdapter(propertiesOptions)
}

/**
 * The per-feature in-flight `pending` closure. Created
 * once at module load via the shared `createServerLoader`
 * factory. Concurrent callers share the same in-flight
 * promise; the reference is cleared on settle so the next
 * call constructs a fresh adapter and performs a new fetch.
 */
const propertiesLoader = createServerLoader<Property>(createPropertiesServerAdapter)

/**
 * Load the resolved property list for the current server.
 *
 * Each call constructs a fresh adapter (via
 * {@link createPropertiesServerAdapter} → the shared
 * `createServerDataSourceAdapter`) and awaits its
 * `loadAll()`. Concurrent calls are coalesced through the
 * in-flight `pending` promise so a single render produces at
 * most one in-flight fetch; the promise is cleared on
 * settle, so the next call performs a new fetch. A
 * successful API result is NOT retained between calls.
 *
 * The function is safe to call from any server-only context:
 * the Nitro endpoint (`server/api/properties.get.ts`), the
 * sitemap (`server/routes/sitemap.xml.ts`), and the unit
 * tests in `server/utils/properties.test.ts`. It is NOT a
 * Nuxt composable and does not require a Nuxt app context.
 */
export async function loadPropertiesServer(): Promise<readonly Property[]> {
  return propertiesLoader.load()
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
export function _resetPropertiesServerCacheForTests(): void {
  propertiesLoader.reset()
}

/**
 * Re-export the `DataSourceKind` type so the public surface
 * for tests that exercise `createPropertiesServerAdapter`
 * stays unchanged from the pre-consolidation loader (the
 * prior file imported `DataSourceKind` from the contract
 * for use in its `SHIPPED_KINDS` literal; the literal is
 * now local, but the re-export keeps any future test that
 * imports the type from this module working).
 */
export type { DataSourceKind } from '~/core/data-source/data-source'
