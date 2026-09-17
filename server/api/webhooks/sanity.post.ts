import {
  assertMethod,
  createError,
  defineEventHandler,
  getHeader,
  getRequestHeader,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { triggerDeploy, type DeployTriggerOutcome } from '../../utils/deploy-trigger'
import {
  getSharedIdempotencyCache,
  type IdempotencyClaimResult,
} from '../../utils/sanity-webhook-dedup'
import {
  SANITY_DATASET_HEADER,
  SANITY_DOCUMENT_ID_HEADER,
  SANITY_IDEMPOTENCY_KEY_HEADER,
  SANITY_OPERATION_HEADER,
  SANITY_PROJECT_ID_HEADER,
  SANITY_SIGNATURE_HEADER,
  SANITY_TRANSACTION_ID_HEADER,
  SANITY_TRANSACTION_TIME_HEADER,
  SANITY_WEBHOOK_ID_HEADER,
  verifySanitySignature,
} from '../../utils/sanity-webhook'

/**
 * `POST /api/webhooks/sanity` — Sanity Studio webhook receiver
 * (Task 129 — failure-safe retries + idempotency).
 *
 * **Deployment requirement.** This endpoint requires a
 * server-capable Nitro preset (`pnpm build` + a runtime that
 * ships the Nitro server). A pure static `pnpm generate`
 * deployment does NOT include server routes and CANNOT serve
 * `/api/webhooks/sanity`. The static deployment's webhook flow
 * is documented separately — see `docs/SANITY_OPERATIONS.md` §
 * 6.7 Sanity webhook integration (Static deployment).
 *
 * **Why a Nitro endpoint exists at all.** The v1.1.0 M17 / M20
 * Nitro data-source contract already re-fetches the remote
 * catalog on every request, so a Node/Nitro deployment's
 * staleness window is "next request after the Sanity change".
 * A webhook receiver still adds value under Nitro for:
 *
 *  - **Verified event receipt.** The endpoint verifies every
 *    inbound Sanity signature before any side effect runs.
 *  - **Observability.** A structured log line per webhook (id,
 *    operation, document id, dispatch outcome) without ever
 *    logging the body, the secret, or the provider response.
 *  - **Failure-safe deduplication.** Sanity uses at-least-once
 *    delivery; the endpoint de-duplicates on the
 *    `idempotency-key` header so a replayed delivery does not
 *    trigger a second rebuild **and** a failed dispatch never
 *    permanently consumes the key (the next Sanity retry can
 *    re-claim and re-dispatch). See
 *    `server/utils/sanity-webhook-dedup.ts` for the lifecycle.
 *  - **External rebuild dispatch.** The endpoint POSTs to an
 *    externally-configured deploy hook (a hosting-provider
 *    deploy hook, a CI workflow-dispatch endpoint, etc.) so
 *    the rebuild happens within seconds of the Sanity change.
 *  - **Future cache-prewarming.** A future task may add an
 *    in-process warm-up call to the data-source loader here
 *    so the request right after the publish sees the new
 *    content without waiting for the cold GROQ round-trip.
 *
 * **Idempotency lifecycle.** The endpoint follows the
 * claim / complete / release contract documented in
 * `server/utils/sanity-webhook-dedup.ts`:
 *
 *  1. `tryClaim(idempotencyKey)` returns:
 *      - `claimed` → the key is new. Run the dispatch.
 *      - `in_flight` → a prior delivery is mid-dispatch. Return
 *        503 so Sanity retries; do NOT acknowledge the duplicate
 *        as success (the first dispatch may still fail).
 *      - `duplicate` → a prior delivery completed
 *        successfully. Return 200 + `duplicate: true`.
 *  2. On dispatch success → `markCompleted(idempotencyKey)`.
 *  3. On dispatch failure (any reason — missing config, auth
 *     rejected, 4xx, 5xx, redirect blocked, timeout, network
 *     error) → `release(idempotencyKey)` so the next Sanity
 *     retry can re-claim and re-dispatch. **A failed dispatch
 *     NEVER permanently consumes the key.**
 *
 * **Security.** The endpoint verifies the Sanity signature
 * against the **raw** request body (the Buffer from
 * `readRawBody(event, false)`) — re-parsing the JSON before
 * computing the HMAC would invalidate the signature for
 * legitimate deliveries. An empty secret returns 401; a
 * missing / malformed / stale / mismatched signature returns
 * 401. The endpoint never logs the secret, the raw body, or
 * the provider response body.
 *
 * **Deterministic status codes.** The endpoint maps every
 * failure mode to a stable, documented HTTP status:
 *
 *  - `200` — signature verified, dedup claimed, dispatch
 *    accepted by the receiver.
 *  - `200` — duplicate delivery of an already-completed
 *    event (idempotent ack; the rebuild was already triggered).
 *  - `400` — missing `idempotency-key` header or malformed JSON
 *    body.
 *  - `401` — signature verification failed (missing /
 *    malformed / stale / mismatched).
 *  - `405` — method other than POST.
 *  - `413` — body exceeds the documented size cap.
 *  - `415` — content-type other than `application/json`.
 *  - `503` — three distinct cases, all retryable so Sanity
 *    keeps trying:
 *      - `dispatch_in_flight` — a prior delivery with the same
 *        key is mid-dispatch; the retry will succeed or fail
 *        based on the prior dispatch's outcome.
 *      - `dispatch_missing_config` — `NUXT_DEPLOY_HOOK_URL` is
 *        not configured. The operator must wire the hook; the
 *        retry traffic makes the gap visible.
 *      - All seven documented receiver-failure codes
 *        (`dispatch_auth_rejected`, `dispatch_not_found`,
 *        `dispatch_client_error`, `dispatch_server_error`,
 *        `dispatch_redirect_blocked`, `dispatch_timeout`,
 *        `dispatch_network_error`) — any failure where the
 *        external receiver did not accept the rebuild trigger.
 *        Each maps to `503` because Sanity retries **any 5xx**
 *        per its documented policy — see §6.7.7. **All 7
 *        of these outcomes release the cache claim** so the
 *        next Sanity retry can re-claim and re-dispatch.
 *
 * **No provider response body exposed.** The endpoint returns
 * a minimal JSON body `{ ok: true }` on success,
 * `{ ok: true, duplicate: true }` on a completed-event replay,
 * or `{ ok: false, error: '<code>' }` on every failure. The
 * provider's status code is preserved in the server log only.
 *
 * **Sanity's documented retry policy** (<https://www.sanity.io/docs/webhooks>):
 *
 *  - **2xx is treated as success** — no retry.
 *  - **4xx (except 429) is treated as undeliverable** — Sanity
 *    does NOT retry. The endpoint's `400` / `401` / `405` /
 *    `413` / `415` mappings are permanent rejects under this rule.
 *  - **429 is retried** per Sanity's policy.
 *  - **Any 5xx, including 502 and 503, is retried** per
 *    Sanity's policy. Sanity retries **twice** at approximately
 *    **30-second intervals**.
 *
 * The endpoint's mapping honours this contract:
 *
 *  - Success paths (`200`) and idempotent acks (`200
 *    duplicate`) match Sanity's "success" branch — no retry.
 *  - Transport-level failures (`503` for `dispatch_in_flight`
 *    or `dispatch_missing_config`) and the seven
 *    retryable-receiver-failure codes listed above match
 *    Sanity's "5xx" branch — Sanity retries with the same
 *    `idempotency-key`. **All 9 of these `503` outcomes release
 *    the cache claim** so the retry can re-claim and
 *    re-dispatch.
 *  - Permanent rejects (`401` invalid signature, `400` missing
 *    idempotency key, `413` body too large, `415` wrong
 *    content-type) match Sanity's "4xx" branch — Sanity
 *    does not retry.
 *
 * **The original Task 129 bug, restated for the operator.** The
 * failure the refactor addressed was that **a failed dispatch
 * left the idempotency-key entry in the cache in a state that
 * prevented a later Sanity retry from re-dispatching**. The fix
 * is the three-state `claim / complete / release` lifecycle:
 * on every dispatch failure the endpoint calls
 * `cache.release(key)`, which deletes the entry so the next
 * Sanity retry with the same `idempotency-key` sees an empty
 * cache and re-claims + re-dispatches. **The bug was NOT that
 * Sanity does not retry on 502** — Sanity's published policy
 * is that any 5xx (including 502) is retryable. The bug was
 * the dedup cache permanently consuming the entry on failure.
 * The status-code change from `502` to `503` aligns the
 * contract with Sanity's actual retry policy; the lifecycle
 * change is the correctness fix.
 *
 * **Reconciliation.** Sanity's webhook does NOT guarantee
 * synchronization outside its retry window. The 30-second
 * retry interval × 2 retries (per Sanity's docs) gives a
 * best-case coverage of ~60 seconds from the original publish.
 * Beyond that window — receiver outage, secret rotation, env
 * var misconfiguration, process restart before markCompleted
 * runs — the operator must reconcile the production site by
 * running a manual `pnpm generate` + deploy or by republishing
 * the affected documents in the Studio. The dedup cache
 * bounds in-memory state; it is NOT a synchronization
 * guarantee. See `docs/SANITY_OPERATIONS.md` §6.7.8 for the
 * documented reconciliation procedure.
 */

const MAX_BODY_BYTES = 256 * 1024

// Note: `setResponseStatus(event, ...)` and `setResponseHeader(event, ...)`
// accept any H3Event; the helper signatures mirror
// `server/api/contact.post.ts:99-103` so the contract is identical
// across endpoints. The helpers take an `unknown` typed argument
// so the cast inside `jsonResponse` does the explicit narrowing.

function jsonResponse(event: unknown, status: number, body: unknown) {
  setResponseStatus(event as Parameters<typeof setResponseStatus>[0], status)
  setResponseHeader(event as Parameters<typeof setResponseHeader>[0], 'content-type', 'application/json; charset=utf-8')
  return body
}

/**
 * Map a deploy-trigger outcome to the endpoint's documented
 * HTTP status. The mapping is the canonical "endpoint / status
 * code contract" the operator documents in
 * `docs/SANITY_OPERATIONS.md`.
 *
 * Every failure outcome maps to **503** (retryable) under the
 * failure-safe retry semantics: a failed dispatch releases
 * the idempotency claim so a Sanity retry can re-attempt. The
 * `dispatched` outcome maps to **200** so Sanity marks the
 * delivery as successful and stops retrying.
 *
 * The `error` string returned alongside the status is a stable,
 * machine-readable code the operator's log aggregator can
 * parse. The response body never leaks the provider's response
 * body or the secret.
 */
function dispatchOutcomeToStatus(outcome: DeployTriggerOutcome): { status: number, error: string } {
  switch (outcome) {
    case 'dispatched':
      return { status: 200, error: '' }
    case 'auth_rejected':
      return { status: 503, error: 'dispatch_auth_rejected' }
    case 'not_found':
      return { status: 503, error: 'dispatch_not_found' }
    case 'client_error':
      return { status: 503, error: 'dispatch_client_error' }
    case 'server_error':
      return { status: 503, error: 'dispatch_server_error' }
    case 'redirect_blocked':
      return { status: 503, error: 'dispatch_redirect_blocked' }
    case 'timeout':
      return { status: 503, error: 'dispatch_timeout' }
    case 'network_error':
      return { status: 503, error: 'dispatch_network_error' }
    case 'missing_config':
      // 503 — the operator has not yet wired the deploy hook.
      // Sanity treats 5xx as transient and retries, so the
      // operator sees the retry traffic and is prompted to
      // configure the hook.
      return { status: 503, error: 'dispatch_missing_config' }
    default: {
      const _exhaustive: never = outcome
      throw createError({ statusCode: 500, statusMessage: `Unknown dispatch outcome: ${String(_exhaustive)}` })
    }
  }
}

/**
 * Returned to the caller when `tryClaim` returns `in_flight`. A
 * retryable 503 — Sanity retries with the same key; the
 * in-flight dispatch's eventual outcome (success → markCompleted
 * → next retry is `duplicate` 200; failure → release → next
 * retry is `claimed` + re-dispatch) determines the eventual
 * delivery status. No event loss.
 */
function inFlightResponse(event: unknown): unknown {
  return jsonResponse(event, 503, { ok: false, error: 'dispatch_in_flight' })
}

export default defineEventHandler(async (event) => {
  // Method guard. Sanity webhooks are configurable HTTP-method-
  // wise; the docs default to POST. Pin to POST for the
  // recorded contract — the endpoint rejects other methods
  // before any body read.
  assertMethod(event, 'POST')

  // Content-type guard. Sanity always sends
  // `content-type: application/json`. A defensive check is
  // cheap and rejects misconfigured clients early.
  const contentType = (getHeader(event, 'content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    return jsonResponse(event, 415, { ok: false, error: 'unsupported_media_type' })
  }

  // Size guard. The Sanity projection body can include the
  // full document; 256 KB is a generous upper bound for a
  // single Property / Agent / Development record (the largest
  // documented feature schema is a few KB). A body that
  // exceeds the cap returns 413 before any signature work.
  const raw = await readRawBody(event, false)
  if (!raw) {
    return jsonResponse(event, 400, { ok: false, error: 'malformed_payload' })
  }
  if (raw.byteLength > MAX_BODY_BYTES) {
    return jsonResponse(event, 413, { ok: false, error: 'payload_too_large' })
  }

  // Read the headers the verifier and the dispatch need. The
  // headers are read BEFORE signature verification so a
  // missing signature header returns 401 without consuming a
  // secret-compare cycle.
  const headers = {
    [SANITY_SIGNATURE_HEADER]: getRequestHeader(event, SANITY_SIGNATURE_HEADER),
    [SANITY_IDEMPOTENCY_KEY_HEADER]: getRequestHeader(event, SANITY_IDEMPOTENCY_KEY_HEADER),
    [SANITY_WEBHOOK_ID_HEADER]: getRequestHeader(event, SANITY_WEBHOOK_ID_HEADER),
    [SANITY_DOCUMENT_ID_HEADER]: getRequestHeader(event, SANITY_DOCUMENT_ID_HEADER),
    [SANITY_OPERATION_HEADER]: getRequestHeader(event, SANITY_OPERATION_HEADER),
    [SANITY_DATASET_HEADER]: getRequestHeader(event, SANITY_DATASET_HEADER),
    [SANITY_PROJECT_ID_HEADER]: getRequestHeader(event, SANITY_PROJECT_ID_HEADER),
    [SANITY_TRANSACTION_ID_HEADER]: getRequestHeader(event, SANITY_TRANSACTION_ID_HEADER),
    [SANITY_TRANSACTION_TIME_HEADER]: getRequestHeader(event, SANITY_TRANSACTION_TIME_HEADER),
  }

  // Read the per-tenant webhook secret from the deployment's
  // secret manager. The default is `NUXT_SANITY_WEBHOOK_SECRET`;
  // multi-tenant deployments override per-tenant via
  // `NUXT_SANITY_WEBHOOK_SECRET__<TENANT_ID>`.
  //
  // The endpoint reads `process.env` directly (not
  // `useRuntimeConfig`) so the secret never enters the public
  // runtime config the client bundle can read. Multi-tenant
  // per-host resolution matches the existing
  // `server/utils/lead-config.ts` / `tenant-context.ts` pattern.
  const host = (getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host') ?? '')
    .split(',')[0]?.trim() ?? ''
  const tenantId = deriveTenantIdFromHost(host)
  const secret = readTenantWebhookSecret(tenantId)

  // Verify the signature against the raw body. A missing
  // secret is treated identically to a missing signature —
  // both are configuration errors and the endpoint does not
  // distinguish between them in the response (only in the
  // log).
  const verifyResult = verifySanitySignature(headers, raw, secret)
  if (!verifyResult.ok) {
    logStructured('sanity_webhook_signature_rejected', {
      reason: verifyResult.reason,
      tenantId,
      host,
      webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
      documentId: headers[SANITY_DOCUMENT_ID_HEADER] ?? null,
      operation: headers[SANITY_OPERATION_HEADER] ?? null,
    })
    return jsonResponse(event, 401, { ok: false, error: 'invalid_signature' })
  }

  // Idempotency. Sanity's at-least-once delivery means a
  // replayed delivery would otherwise trigger a second
  // rebuild. The cache is documented as in-memory only —
  // see `server/utils/sanity-webhook-dedup.ts` for the
  // multi-instance / multi-process limitations and the
  // claim / complete / release lifecycle.
  const idempotencyKey = headers[SANITY_IDEMPOTENCY_KEY_HEADER]
  if (typeof idempotencyKey !== 'string' || idempotencyKey === '') {
    logStructured('sanity_webhook_rejected', {
      reason: 'missing_idempotency_key',
      tenantId,
      host,
      webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
    })
    return jsonResponse(event, 400, { ok: false, error: 'missing_idempotency_key' })
  }

  const cache = getSharedIdempotencyCache()
  const claim: IdempotencyClaimResult = cache.tryClaim(idempotencyKey)

  if (claim === 'duplicate') {
    logStructured('sanity_webhook_duplicate', {
      tenantId,
      host,
      idempotencyKey,
      webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
      documentId: headers[SANITY_DOCUMENT_ID_HEADER] ?? null,
      operation: headers[SANITY_OPERATION_HEADER] ?? null,
    })
    // Idempotent ack. The first delivery already triggered
    // the dispatch and marked the entry completed; this
    // replay returns the same success shape so Sanity marks
    // the delivery as successful and does not retry.
    return jsonResponse(event, 200, { ok: true, duplicate: true })
  }

  if (claim === 'in_flight') {
    logStructured('sanity_webhook_in_flight', {
      tenantId,
      host,
      idempotencyKey,
      webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
      documentId: headers[SANITY_DOCUMENT_ID_HEADER] ?? null,
      operation: headers[SANITY_OPERATION_HEADER] ?? null,
    })
    // A prior delivery with the same idempotency-key is
    // mid-dispatch. Returning 503 keeps Sanity retrying
    // until the prior dispatch completes (success →
    // markCompleted → the retry becomes a `duplicate` 200;
    // failure → release → the retry re-claims and
    // re-dispatches). **Never** acknowledge an in-flight
    // duplicate as success: a sub-second ack on a flaky
    // in-process task could permanently lose the event if
    // the original dispatch later fails.
    return inFlightResponse(event)
  }

  // claim === 'claimed' from here on. The endpoint now owns
  // the lifecycle for this idempotency-key: it MUST call
  // either markCompleted (success) or release (any failure)
  // before returning, otherwise the entry sits in `claimed`
  // state until the TTL elapses and a future Sanity retry
  // sees it as `in_flight`. (The endpoint below always does
  // one or the other; the TTL is a defence-in-depth bound.)

  // Verify the body is parseable JSON. The signature check
  // already accepted the bytes; this is a defensive sanity
  // check that catches the rare case where a delivery passes
  // HMAC verification but the body is not valid JSON (the
  // trigger does not parse the body, but a downstream log
  // consumer might).
  try {
    JSON.parse(raw.toString('utf8'))
  }
  catch {
    logStructured('sanity_webhook_malformed_body', {
      tenantId,
      host,
      idempotencyKey,
      webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
    })
    // The dispatch did not run, so there is no failed
    // dispatch to release from. The 400 is a permanent reject
    // (Sanity does NOT retry on 4xx) and the cache entry is
    // released so a hypothetical replay with the same key
    // (e.g., a manually-republished webhook) is not blocked.
    cache.release(idempotencyKey)
    return jsonResponse(event, 400, { ok: false, error: 'malformed_payload' })
  }

  // Dispatch the external rebuild trigger. The trigger is
  // configured via `NUXT_DEPLOY_HOOK_URL` (+ optional
  // `NUXT_DEPLOY_HOOK_AUTH_HEADER`); the endpoint never names
  // a specific provider.
  const dispatch = await triggerDeploy({
    idempotencyKey,
    sanityWebhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
    sanityDocumentId: headers[SANITY_DOCUMENT_ID_HEADER] ?? null,
    sanityOperation: headers[SANITY_OPERATION_HEADER] ?? null,
    reason: 'sanity_content_change',
  })

  // Failure-safe lifecycle close. A failed dispatch releases
  // the idempotency claim so the next Sanity retry can
  // re-claim and re-dispatch. A successful dispatch marks
  // the entry completed so subsequent replays return
  // `duplicate` (idempotent ack).
  if (dispatch.outcome === 'dispatched') {
    cache.markCompleted(idempotencyKey)
  }
  else {
    cache.release(idempotencyKey)
  }

  logStructured('sanity_webhook_dispatched', {
    tenantId,
    host,
    idempotencyKey,
    webhookId: headers[SANITY_WEBHOOK_ID_HEADER] ?? null,
    documentId: headers[SANITY_DOCUMENT_ID_HEADER] ?? null,
    operation: headers[SANITY_OPERATION_HEADER] ?? null,
    dataset: headers[SANITY_DATASET_HEADER] ?? null,
    projectId: headers[SANITY_PROJECT_ID_HEADER] ?? null,
    transactionId: headers[SANITY_TRANSACTION_ID_HEADER] ?? null,
    transactionTime: headers[SANITY_TRANSACTION_TIME_HEADER] ?? null,
    outcome: dispatch.outcome,
    status: dispatch.status,
    lifecycle: dispatch.outcome === 'dispatched' ? 'completed' : 'released',
  })

  const { status, error } = dispatchOutcomeToStatus(dispatch.outcome)
  if (status === 200) {
    return jsonResponse(event, 200, { ok: true })
  }
  return jsonResponse(event, status, { ok: false, error })
})

/**
 * Map the request hostname to a tenant id. Step 1: lowercase
 * the host, strip the port, replace non-alphanumeric characters
 * with `-`. Step 2 (in {@link readTenantWebhookSecret})
 * uppercases the result and replaces `-` with `_` to match the
 * per-tenant env-var naming convention (`NUXT_*__<TENANT_ID>`)
 * used by `server/utils/lead-config.ts`. A blank host returns
 * `''` (the global fallback).
 */
function deriveTenantIdFromHost(host: string): string {
  return host.toLowerCase().split(':')[0]!.replace(/[^a-z0-9-]/g, '-')
}

/**
 * Read the per-tenant webhook secret, falling back to the
 * global `NUXT_SANITY_WEBHOOK_SECRET` when no per-tenant
 * override is configured. The naming convention (`NUXT_*__<TENANT_ID>`,
 * uppercased tenant id with non-alphanumeric replaced by `_`)
 * matches the existing per-tenant dispatcher in
 * `server/utils/lead-config.ts:readTenantLeadEnv`.
 *
 * The secret is read via `process.env` directly — never via
 * `useRuntimeConfig` — so the value never enters the public
 * runtime config the client bundle can read.
 *
 * Whitespace-only is treated as "missing". A credential field
 * preserves the exact configured value (leading / trailing
 * whitespace in a secret is meaningful) but a fallback to the
 * global value still requires the global to be non-empty.
 */
function readTenantWebhookSecret(tenantId: string): string {
  const upperTenant = tenantId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const tenantKey = `NUXT_SANITY_WEBHOOK_SECRET__${upperTenant}`
  const tenantRaw = process.env[tenantKey]
  if (typeof tenantRaw === 'string' && tenantRaw.trim() !== '') {
    return tenantRaw
  }
  const global = process.env['NUXT_SANITY_WEBHOOK_SECRET'] ?? ''
  return global
}

/**
 * Structured log helper. The endpoint never logs the raw
 * body, the signature header, the secret, or the provider
 * response body — only the documented fields below. The log
 * shape is the operator's audit trail for "what did the webhook
 * endpoint do?" and the canonical reference for the
 * observability contract documented in
 * `docs/SANITY_OPERATIONS.md`.
 */
function logStructured(event: string, fields: Record<string, unknown>): void {
  // `console.info` is the canonical structured-log sink for
  // the Nuxt server output (paired with the platform's log
  // aggregator). The shape is deliberately flat — the operator's
  // log aggregator can parse a single line of JSON without
  // a schema.
  try {
    console.info(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }))
  }
  catch {
    // Logging must never throw out of the request path.
  }
}
