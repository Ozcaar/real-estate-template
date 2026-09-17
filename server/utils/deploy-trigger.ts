/**
 * Provider-agnostic external rebuild trigger (Task 128 — Sanity
 * Studio webhooks → rebuild trigger).
 *
 * After a Sanity webhook signature is verified and the
 * delivery is deduplicated, the endpoint POSTs to an
 * externally-configured rebuild URL (a hosting-provider deploy
 * hook, a CI workflow-dispatch endpoint, a serverless receiver,
 * etc.). This module owns the trigger side of the chain.
 *
 * **Provider-agnostic.** The trigger is configured via two
 * env vars (`NUXT_DEPLOY_HOOK_URL` + optional
 * `NUXT_DEPLOY_HOOK_AUTH_HEADER`). The endpoint never names a
 * specific commercial hosting provider; the operator chooses
 * which one to point the URL at. Real deployments target the
 * receiver most appropriate for their stack (a hosting-provider
 * deploy hook for static deployments, a CI workflow-dispatch
 * endpoint for multi-repo setups, an internal webhook
 * receiver for custom pipelines).
 *
 * **Why no provider-specific code here.** Per
 * `docs/COMMERCIAL_DELIVERY.md` and the AGENTS.md guidance,
 * the project ships provider-agnostic code; the
 * agency / operator picks the deploy platform. Hard-coding a
 * GitHub `repository_dispatch` POST or a Vercel deploy-hook
 * shape would lock the template to one vendor and force every
 * downstream deployment to match. The provider-agnostic URL +
 * optional auth header pattern is the documented equivalent of
 * a private Git hook — it lets the receiver decide what to do.
 *
 * **Manual redirect handling.** Sanity's 30-second webhook
 * timeout and the documented Nitro behavior mean a slow or
 * redirecting deploy hook could otherwise consume the entire
 * webhook window. The trigger uses `redirect: 'manual'` (an
 * h3 / undici / Node 18+ `fetch` option) so a 3xx response from
 * the receiver is reported as `opaqRedirect` status 0 — never
 * followed, never carrying credentials forward. The endpoint
 * treats `opaqRedirect` and any non-2xx as a trigger failure
 * and returns 503 (retryable — Sanity retries the delivery,
 * the cache releases the idempotency claim, the retry can
 * re-claim and re-dispatch). This is the documented "never
 * follow an arbitrary redirect with deployment credentials"
 * guarantee.
 *
 * **Bounded timeout.** The trigger uses an `AbortController`
 * with a default 5-second timeout (configurable via
 * `NUXT_DEPLOY_HOOK_TIMEOUT_MS`). The webhook endpoint is
 * faster than Sanity's 30-second delivery timeout, so a slow
 * receiver becomes a 503 / Sanity retry rather than a hung
 * endpoint.
 *
 * **Secret hygiene.** The trigger never logs the request body
 * it sends or the response body it receives. Only the status
 * code (or `timeout` / `error`) is returned to the caller for
 * structured logging.
 */

/**
 * Default outer timeout for the deploy hook POST. The webhook
 * endpoint must be faster than Sanity's 30-second delivery
 * timeout so a slow receiver becomes a 503 / Sanity retry
 * rather than a hung endpoint. 5 seconds is a generous upper
 * bound that still leaves headroom for the signature
 * verification + dispatch path.
 */
export const DEFAULT_TRIGGER_TIMEOUT_MS = 5_000

/**
 * The structured outcome of a trigger attempt.
 *
 *  - `dispatched`: the trigger received a 2xx response from
 *    the receiver. The receiver is responsible for actually
 *    starting the rebuild.
 *  - `auth_rejected`: the receiver returned a 401 / 403. The
 *    credential is wrong; the operator must rotate
 *    `NUXT_DEPLOY_HOOK_AUTH_HEADER`.
 *  - `not_found`: the receiver returned 404. The hook URL has
 *    drifted; the operator must update `NUXT_DEPLOY_HOOK_URL`.
 *  - `client_error`: the receiver returned a 4xx other than
 *    401 / 403 / 404. The receiver rejected the payload; the
 *    endpoint logs the status and returns 503 so Sanity
 *    retries (the cache releases the idempotency claim so the
 *    retry can re-dispatch).
 *  - `server_error`: the receiver returned 5xx. Transient
 *    failure; the endpoint returns 503 and Sanity retries.
 *  - `redirect_blocked`: the receiver returned a 3xx and the
 *    trigger refused to follow it (the `redirect: 'manual'`
 *    policy). The operator must update the URL to the
 *    canonical destination.
 *  - `timeout`: the request exceeded `timeoutMs`. The operator
 *    should investigate the receiver's latency or shorten the
 *    timeout.
 *  - `network_error`: a transport-layer failure (DNS, TCP,
 *    TLS). The operator should investigate the receiver.
 *  - `missing_config`: `NUXT_DEPLOY_HOOK_URL` is empty. The
 *    endpoint returns 503 (configuration error, not a
 *    transient failure) so Sanity retries — the operator
 *    sees the retry traffic and configures the hook.
 */
export type DeployTriggerOutcome =
  | 'dispatched'
  | 'auth_rejected'
  | 'not_found'
  | 'client_error'
  | 'server_error'
  | 'redirect_blocked'
  | 'timeout'
  | 'network_error'
  | 'missing_config'

/**
 * The structured result of a trigger attempt. The HTTP status
 * code is preserved when available; `body` is intentionally
 * NEVER populated by this module (the trigger never logs the
 * provider response, and the endpoint never exposes it).
 */
export interface DeployTriggerResult {
  readonly outcome: DeployTriggerOutcome
  /** HTTP status code when the receiver returned a response. */
  readonly status: number | null
}

/**
 * The input to {@link triggerDeploy}. Carries only the fields
 * the receiver needs (and never the Sanity body, which may
 * contain PII). The receiver is expected to be idempotent on
 * `idempotencyKey` (a `repository_dispatch` payload would
 * carry the SHA, a Vercel deploy hook would ignore the body).
 */
export interface DeployTriggerInput {
  readonly idempotencyKey: string
  readonly sanityWebhookId: string | null
  readonly sanityDocumentId: string | null
  readonly sanityOperation: string | null
  readonly reason: 'sanity_content_change'
}

/**
 * Resolve the trigger configuration from the environment.
 * Returns `null` when `NUXT_DEPLOY_HOOK_URL` is empty /
 * whitespace — the endpoint treats this as `missing_config`
 * and returns 503. **Sanity retries 503** per its documented
 * policy (any 5xx, including 502 and 503, is retryable;
 * see `docs/SANITY_OPERATIONS.md` §6.7.7); the operator sees
 * the retry traffic and is prompted to configure the hook.
 */
export function readDeployTriggerConfig(env: NodeJS.ProcessEnv = process.env): {
  readonly url: string
  readonly authHeader: string | null
  readonly timeoutMs: number
} | null {
  const url = (env['NUXT_DEPLOY_HOOK_URL'] ?? '').trim()
  if (url === '') return null
  // The auth header is a credential — leading / trailing whitespace
  // is a meaningful part of the secret, not a formatting artifact.
  // We trim ONLY for the "missing / present" decision; the returned
  // value preserves the exact configured bytes (the trigger forwards
  // them verbatim in the `Authorization` header).
  const authRaw = env['NUXT_DEPLOY_HOOK_AUTH_HEADER']
  const authHeader = (typeof authRaw === 'string' && authRaw.trim() !== '') ? authRaw : null
  const timeoutRaw = env['NUXT_DEPLOY_HOOK_TIMEOUT_MS'] ?? ''
  let timeoutMs = DEFAULT_TRIGGER_TIMEOUT_MS
  if (timeoutRaw.trim() !== '') {
    const parsed = Number.parseInt(timeoutRaw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      timeoutMs = parsed
    }
  }
  return { url, authHeader, timeoutMs }
}

/**
 * Map an HTTP status code (from a response with `redirect:
 * 'manual'`) to a {@link DeployTriggerOutcome}. A 3xx response
 * under `redirect: 'manual'` arrives as `status === 0` with
 * `type === 'opaqRedirect'`. The endpoint distinguishes this
 * from a true network error by inspecting the response type.
 *
 * Exported for the test surface so the documented mapping is
 * pinned independently of the `fetch` integration.
 */
export function outcomeForStatus(status: number): DeployTriggerOutcome {
  if (status >= 200 && status < 300) return 'dispatched'
  if (status === 401 || status === 403) return 'auth_rejected'
  if (status === 404) return 'not_found'
  if (status >= 400 && status < 500) return 'client_error'
  if (status >= 500 && status < 600) return 'server_error'
  return 'client_error'
}

/**
 * The default `fetch` implementation. The endpoint uses the
 * platform `fetch` (Node 18+ / Nitro runtime) so no third-party
 * HTTP client is required. Exposed for the test surface so the
 * tests can inject a `vi.fn()` mock without monkey-patching
 * the global `fetch`.
 */
export type FetchFn = typeof fetch

/**
 * Trigger an external rebuild by POSTing to the configured
 * deploy hook URL.
 *
 * **Pure of side effects outside `fetch`.** The function does
 * not log, does not mutate module-level state, and does not
 * throw. Every error path returns a structured
 * {@link DeployTriggerResult} the caller maps to an HTTP status.
 *
 * **Manual redirect handling.** `fetch(..., { redirect: 'manual' })`
 * is the documented guarantee that the trigger never follows
 * an arbitrary redirect with the deploy credentials attached.
 * A 3xx response surfaces as `redirect_blocked`.
 *
 * **Bounded timeout.** `AbortController` + `setTimeout` cancel
 * the request after `timeoutMs`. The endpoint catches the
 * `AbortError` (or any other rejection) and maps it to
 * `timeout`.
 *
 * **Idempotent body.** The payload sent to the receiver
 * carries only the dispatch metadata the receiver needs to
 * identify the trigger (the idempotency key, the Sanity
 * operation type, the document id when present). The Sanity
 * body itself is never forwarded — the receiver does not need
 * it (it triggers a rebuild, which fetches the new content
 * upstream).
 */
export async function triggerDeploy(
  input: DeployTriggerInput,
  options: {
    readonly config?: { readonly url: string, readonly authHeader: string | null, readonly timeoutMs: number } | null
    readonly fetchImpl?: FetchFn
  } = {},
): Promise<DeployTriggerResult> {
  const config = options.config !== undefined ? options.config : readDeployTriggerConfig()
  if (config === null) {
    return { outcome: 'missing_config', status: null }
  }

  const fetchImpl: FetchFn = options.fetchImpl ?? fetch

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  timer.unref?.()

  let response: Response
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'real-estate-template/sanity-webhook-trigger',
    }
    if (config.authHeader !== null) {
      headers['authorization'] = config.authHeader
    }
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        sanityWebhookId: input.sanityWebhookId,
        sanityDocumentId: input.sanityDocumentId,
        sanityOperation: input.sanityOperation,
      }),
      redirect: 'manual',
      signal: controller.signal,
    })
  }
  catch (err) {
    clearTimeout(timer)
    if (isAbortError(err)) {
      return { outcome: 'timeout', status: null }
    }
    return { outcome: 'network_error', status: null }
  }
  clearTimeout(timer)

  // Under `redirect: 'manual'`, a 3xx response arrives with
  // status 0 and type 'opaqRedirect'. We refuse to follow it
  // (the documented "never follow an arbitrary redirect with
  // deployment credentials" guarantee).
  if (response.type === 'opaqRedirect') {
    return { outcome: 'redirect_blocked', status: 0 }
  }

  // Best-effort body discard. The body is never read or logged;
  // this exists only to release the connection back to the
  // pool. Catch and ignore any body-read failure.
  try {
    await response.body?.cancel()
  }
  catch {
    // ignore
  }

  return { outcome: outcomeForStatus(response.status), status: response.status }
}

/**
 * Detect an `AbortError` from any of the standard error shapes
 * (DOMException with `name === 'AbortError'`, or a plain Error
 * whose message includes `'aborted'`). The pattern avoids the
 * `instanceof` pitfall when the error crosses a realm boundary
 * (a worker, an undici subprocess).
 */
function isAbortError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false
  const name = (err as { name?: unknown }).name
  if (typeof name === 'string' && name === 'AbortError') return true
  const message = (err as { message?: unknown }).message
  if (typeof message === 'string' && /abort/i.test(message)) return true
  return false
}
