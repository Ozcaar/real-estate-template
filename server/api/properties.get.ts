import { defineEventHandler } from 'h3'
import { loadPropertiesServer } from '../utils/properties'

/**
 * `GET /api/properties` — same-origin Nitro endpoint that
 * serves the resolved public property list.
 *
 * The endpoint is the documented public surface for the
 * app-side property service. The service calls the endpoint
 * via `$fetch` from every property page (home, listing,
 * detail) and from the `useAsyncData` handler that wraps the
 * call so SSR awaits the load before rendering. The endpoint
 * is same-origin — the URL is `/api/properties` on both the
 * server (loopback to the Nitro server) and the client
 * (same-origin HTTP request).
 *
 * **What the endpoint returns.** The validated list from
 * {@link loadPropertiesServer} — the static `sampleProperties`
 * array by default, the remote api response when the
 * configured kind is `'api'`. The Zod parse is the loader's
 * responsibility; the endpoint is a thin transport.
 *
 * **What the endpoint does NOT return.** The configured kind,
 * the API endpoint URL, the timeout, the fetch headers, the
 * raw response body, or any other private configuration. The
 * private `NUXT_PROPERTIES_*` env vars are read exclusively
 * inside `server/utils/properties.ts`; the endpoint emits
 * only the validated public list.
 *
 * **Why the endpoint exists.** Without an endpoint the
 * app-side property service would have to fetch the api
 * directly from the browser, which would require the api URL
 * to live in the client bundle (a privacy leak). Routing the
 * fetch through a same-origin Nitro endpoint keeps the api
 * URL server-only: the client sees `/api/properties`, the
 * server does the actual fetch. The endpoint is also the
 * natural place to add cross-cutting concerns in the future
 * (rate-limiting, response caching, ETag, …) without changing
 * the service signature.
 *
 * **Caching.** The endpoint delegates to
 * {@link loadPropertiesServer}. The loader does NOT retain
 * a permanent process-lifetime cache: each call constructs
 * a fresh adapter and awaits its `loadAll()`, so a later
 * request observes the latest upstream data. Concurrent
 * in-flight calls share a single fetch via an in-flight
 * `pending` promise that is cleared on settle. The
 * endpoint itself does not set a `Cache-Control` header —
 * the data is owned by the operator's deployment, not by
 * the browser. A future task can add an HTTP cache header
 * if a deployment wants to push the `useAsyncData` refetch
 * onto the client.
 *
 * **Failure modes.** The endpoint re-throws any error from
 * {@link loadPropertiesServer}. Nitro maps the thrown error
 * to the route's response: a `DataSourceHttpError` becomes a
 * 5xx response with the error's status code, a
 * `DataSourceTimeoutError` becomes a 504, a
 * `DataSourceInvalidPayloadError` becomes a 502, a
 * `DataSourceMissingConfigError` becomes a 500 (the
 * misconfiguration should be fixed at server startup; the
 * error is logged for the operator). The body is intentionally
 * NOT the raw error message — Nitro emits a minimal JSON
 * envelope that includes the error name and a generic
 * message.
 */
export default defineEventHandler(async () => {
  return await loadPropertiesServer()
})