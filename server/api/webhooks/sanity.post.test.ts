import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeH3Event } from '../../../tests/helpers/h3-event'
import { computeSanitySignature } from '../../utils/sanity-webhook'
import {
  _resetSharedIdempotencyCacheForTests,
  _setSharedIdempotencyCacheForTests,
  createIdempotencyCache,
  getSharedIdempotencyCache,
} from '../../utils/sanity-webhook-dedup'

/**
 * Endpoint tests for `POST /api/webhooks/sanity`.
 *
 * The endpoint is a thin transport:
 *
 *   1. Method guard (`POST` only).
 *   2. Content-type guard (`application/json`).
 *   3. Body-size guard (256 KB cap).
 *   4. Read the Sanity signature + idempotency headers +
 *      dispatch metadata.
 *   5. Verify the signature against the raw body with the
 *      configured secret.
 *   6. Claim the idempotency-key in the in-memory cache.
 *      `claimed` → run the dispatch.
 *      `in_flight` → return 503 (a prior delivery is mid-dispatch).
 *      `duplicate` → return 200 + `duplicate: true` (idempotent ack).
 *   7. Parse the body defensively (a malformed JSON after a
 *      valid signature is a 400 — release the claim so a retry
 *      can re-dispatch).
 *   8. POST to the configured deploy hook URL.
 *   9. Mark the cache entry completed on dispatch success;
 *      release on dispatch failure (any reason — including
 *      missing config). Sanity retries; the next claim succeeds
 *      and re-dispatches.
 *
 * The verifier (`verifySanitySignature`) and the trigger
 * (`triggerDeploy`) are unit-tested in their own files. The
 * endpoint tests focus on the transport mapping, the
 * idempotency-cache integration, the per-tenant secret
 * dispatch, and the failure-safe retry semantics.
 *
 * Every test uses the `tests/helpers/h3-event.ts` `makeH3Event`
 * helper to construct a synthetic H3 event.
 */

const SECRET = 'super-secret-sanity-shared-key-32chars'
const URL = 'https://hooks.example.test/deploy'
// The default timestamp is `Date.now()` (NOT a fixed past value)
// so the verifier's default 5-minute tolerance window accepts
// the signature. Tests that exercise the "past tolerance" path
// override `timestamp` explicitly with a stale value.
const TIMESTAMP = Date.now()

const ENV_SECRET = 'NUXT_SANITY_WEBHOOK_SECRET'
const ENV_DEPLOY_URL = 'NUXT_DEPLOY_HOOK_URL'
const ENV_DEPLOY_AUTH = 'NUXT_DEPLOY_HOOK_AUTH_HEADER'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env[ENV_SECRET] = SECRET
  process.env[ENV_DEPLOY_URL] = URL
  Reflect.deleteProperty(process.env, ENV_DEPLOY_AUTH)
  _resetSharedIdempotencyCacheForTests()
  _setSharedIdempotencyCacheForTests(createIdempotencyCache({ ttlMs: 60_000 }))
})

afterEach(() => {
  for (const key of [ENV_SECRET, ENV_DEPLOY_URL, ENV_DEPLOY_AUTH]) {
    Reflect.deleteProperty(process.env, key)
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
  _resetSharedIdempotencyCacheForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface InvokeOptions {
  /** Override the body (defaults to a small JSON document). */
  body?: string | Buffer
  /** Override the signature header. */
  signature?: string
  /** Override the idempotency key header. */
  idempotencyKey?: string
  /** Override the timestamp used in the signature. */
  timestamp?: number
  /** Override the host header (for per-tenant secret lookup). */
  host?: string
  /** Override the secret the signature was computed with. */
  signedWith?: string
  /** Override the webhook-id header. */
  webhookId?: string
  /** Override the document-id header. */
  documentId?: string
  /** Override the operation header. */
  operation?: string
  /** Override content-type. */
  contentType?: string
  /** Method override (default `POST`). */
  method?: string
}

interface InvokeResult {
  status: number
  body: unknown
  headers: Record<string, string>
  /** The fetch mock's invocation list, when fetch was stubbed. */
  fetchCalls: Array<[string, RequestInit]>
}

async function invoke(opts: InvokeOptions = {}): Promise<InvokeResult> {
  const bodyBuf = typeof opts.body === 'string'
    ? Buffer.from(opts.body, 'utf8')
    : opts.body ?? Buffer.from('{"_type":"property","_id":"p1"}', 'utf8')
  const ts = opts.timestamp ?? TIMESTAMP
  const secret = opts.signedWith ?? SECRET
  // When the caller did NOT pass an explicit signature, compute
  // one from the body + secret + timestamp. When the caller
  // DID pass a signature, use it as-is (for the malformed /
  // missing / wrong-secret cases).
  const signature = opts.signature ?? computeSanitySignature(bodyBuf, ts, secret)

  const headers: Record<string, string> = {
    'content-type': opts.contentType ?? 'application/json',
    'host': opts.host ?? 'example.test',
  }
  if (signature !== '__missing__') {
    headers['sanity-webhook-signature'] = `t=${ts},v1=${signature}`
  }
  if (opts.idempotencyKey !== '__missing__') {
    headers['idempotency-key'] = opts.idempotencyKey ?? 'sanity-idem-key-001'
  }
  if (opts.webhookId !== undefined) headers['sanity-webhook-id'] = opts.webhookId
  if (opts.documentId !== undefined) headers['sanity-document-id'] = opts.documentId
  if (opts.operation !== undefined) headers['sanity-operation'] = opts.operation

  const { event, getResponse } = makeH3Event({
    method: opts.method ?? 'POST',
    headers,
    body: bodyBuf,
  })
  // Dynamic import so the handler resolves with the current
  // process.env snapshot. The handler reads `process.env`
  // directly (never `useRuntimeConfig`), so a fresh import per
  // test is sufficient.
  const mod = await import('./sanity.post')
  const body = await mod.default(event)
  const { status, headers: resHeaders } = getResponse()

  // Pull the call list off the global fetch stub if any.
  const fetchImpl = (globalThis as { fetch?: unknown }).fetch as
    | { mock?: { calls: Array<[string, RequestInit]> } }
    | undefined
  const fetchCalls = fetchImpl?.mock?.calls ?? []

  return { status, body, headers: resHeaders, fetchCalls }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/sanity — happy path', () => {
  it('returns 200 and dispatches on a valid signature', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke()
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
    expect(result.headers['content-type']).toMatch(/^application\/json/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('forwards the documented dispatch metadata to the deploy hook', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    await invoke({
      idempotencyKey: 'idem-meta',
      webhookId: 'webhook-1',
      documentId: 'doc-1',
      operation: 'create',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = (fetchImpl.mock.calls[0] ?? []) as [string, RequestInit]
    expect(calledUrl).toBe(URL)
    expect(calledInit.method).toBe('POST')
    expect(calledInit.redirect).toBe('manual')
    const body = JSON.parse(calledInit.body as string)
    expect(body).toEqual({
      reason: 'sanity_content_change',
      idempotencyKey: 'idem-meta',
      sanityWebhookId: 'webhook-1',
      sanityDocumentId: 'doc-1',
      sanityOperation: 'create',
    })
    const headers = calledInit.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['authorization']).toBeUndefined()
  })

  it('includes the Authorization header when NUXT_DEPLOY_HOOK_AUTH_HEADER is set', async () => {
    process.env[ENV_DEPLOY_AUTH] = 'Bearer secret-deploy-token'
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    await invoke()
    const [, calledInit] = (fetchImpl.mock.calls[0] ?? []) as [string, RequestInit]
    const headers = calledInit.headers as Record<string, string>
    expect(headers['authorization']).toBe('Bearer secret-deploy-token')
  })
})

describe('POST /api/webhooks/sanity — transport guards', () => {
  it('returns 415 when Content-Type is not application/json', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ contentType: 'text/plain' })
    expect(result.status).toBe(415)
    expect(result.body).toEqual({ ok: false, error: 'unsupported_media_type' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 413 when the raw body exceeds the 256 KB cap', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const oversized = JSON.stringify({ data: 'x'.repeat(300 * 1024) })
    const result = await invoke({ body: oversized })
    expect(result.status).toBe(413)
    expect(result.body).toEqual({ ok: false, error: 'payload_too_large' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 400 when the raw body is empty', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ body: '' })
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ ok: false, error: 'malformed_payload' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 405 for a non-POST method', async () => {
    // `assertMethod` throws an H3Error with statusCode 405.
    // The handler does not catch the throw — Nitro / h3 turns
    // it into a 405 response with an `Allow: POST` header.
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    let caught: unknown
    try {
      await invoke({ method: 'GET' })
    }
    catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect((caught as { statusCode?: number }).statusCode).toBe(405)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/sanity — signature verification', () => {
  it('returns 401 when the signature header is missing', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ signature: '__missing__' })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ ok: false, error: 'invalid_signature' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 401 on a malformed signature header', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ signature: 'garbage' })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ ok: false, error: 'invalid_signature' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 401 when the secret is wrong', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ signedWith: 'wrong-secret' })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ ok: false, error: 'invalid_signature' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 401 when the body has been tampered with (raw-body integrity)', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    // Sign a small body, then send a larger body that includes
    // the signed bytes followed by extra junk.
    const signedBody = Buffer.from('{"_type":"property"}', 'utf8')
    const signature = computeSanitySignature(signedBody, TIMESTAMP, SECRET)
    const tamperedBody = Buffer.concat([signedBody, Buffer.from(' ', 'utf8')])
    const result = await invoke({
      body: tamperedBody,
      signature,
      timestamp: TIMESTAMP,
    })
    expect(result.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 401 when the timestamp is past the tolerance window', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    // Use a 2023 timestamp — well outside the 5-minute
    // tolerance from any wall-clock now() during the test.
    const result = await invoke({ timestamp: 1_700_000_000_000 })
    expect(result.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 401 when the secret env var is empty (missing_secret)', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    Reflect.deleteProperty(process.env, ENV_SECRET)
    const result = await invoke({ timestamp: Date.now() })
    expect(result.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/sanity — idempotency', () => {
  it('returns 400 when the idempotency-key header is missing', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({
      timestamp: Date.now(),
      idempotencyKey: '__missing__',
    })
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ ok: false, error: 'missing_idempotency_key' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns 503 dispatch_in_flight when a duplicate delivery arrives during in-flight dispatch', async () => {
    // Simulate an in-flight dispatch by pre-claiming the key
    // BEFORE the duplicate arrives. The endpoint sees the
    // key in `claimed` state and returns 503 so Sanity keeps
    // retrying — NOT a 200 (which would be a permanent
    // ack that could lose the event if the first dispatch
    // later failed).
    const fetchImpl = vi.fn(async () => {
      // The first dispatch's fetch hangs forever (we cancel
      // the test before it resolves). For the duplicate we
      // want to test, we don't need the fetch to ever settle.
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchImpl)

    // Pre-claim the idempotency key (simulating a prior
    // delivery that has not yet completed its dispatch).
    const cache = getSharedIdempotencyCacheForTest()
    cache.tryClaim('idem-in-flight', Date.now())

    const result = await invoke({
      timestamp: Date.now(),
      idempotencyKey: 'idem-in-flight',
    })
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ ok: false, error: 'dispatch_in_flight' })
    // The duplicate did NOT trigger a second dispatch.
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Failure-safe retry / idempotency semantics (Task 129 regression surface).
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/sanity — failure-safe retry semantics', () => {
  it('first event + successful trigger → completed (200 + cache marked completed)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-success' }

    const first = await invoke(opts)
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // The cache must have transitioned the entry to completed —
    // a subsequent replay observes `duplicate`.
    const cache = getSharedIdempotencyCacheForTest()
    expect(cache.stateOf('idem-success', Date.now())).toBe('completed')
  })

  it('second delivery after success → duplicate 200, no second trigger', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-completed-replay' }

    const first = await invoke(opts)
    expect(first.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // Replay — same idempotency key, same signature, same body.
    const second = await invoke(opts)
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ ok: true, duplicate: true })
    // The dispatch was NOT invoked a second time.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('trigger timeout → key released → Sanity retry invokes the trigger again', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => {
      throw abortError
    })
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-timeout-retry' }

    // First delivery: timeout → 503 (retryable).
    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_timeout' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    // The endpoint released the key — the cache no longer
    // holds it.
    const cache = getSharedIdempotencyCacheForTest()
    expect(cache.stateOf('idem-timeout-retry', Date.now())).toBeNull()

    // Sanity retries with the same key. The retry can
    // re-claim and re-dispatch.
    const second = await invoke(opts)
    // Status code matches the dispatch outcome — the retry
    // is a fresh claim, not a duplicate.
    expect(second.status).toBe(503)
    expect(second.body).toEqual({ ok: false, error: 'dispatch_timeout' })
    // The retry invoked the trigger again.
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('trigger 5xx → key released → Sanity retry invokes the trigger again', async () => {
    let callCount = 0
    const fetchImpl = vi.fn(async () => {
      callCount += 1
      // First call: 503. Second call (retry): 200.
      return new Response('{}', { status: callCount === 1 ? 503 : 200 })
    })
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-5xx-retry' }

    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_server_error' })

    const second = await invoke(opts)
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('trigger auth rejection (401) → key released → Sanity retry invokes the trigger again', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-auth-retry' }

    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_auth_rejected' })

    // The retry re-claims (auth failures are not a free pass —
    // a fixed deploy-hook credential lets the retry succeed).
    const second = await invoke(opts)
    expect(second.status).toBe(503)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('trigger receiver 4xx (404 not_found) → key released → Sanity retry invokes the trigger again', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-404-retry' }

    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_not_found' })

    const second = await invoke(opts)
    expect(second.status).toBe(503)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('trigger redirect_blocked → key released → Sanity retry invokes the trigger again', async () => {
    const stubResponse = new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.test' } })
    Object.defineProperty(stubResponse, 'type', { value: 'opaqRedirect', configurable: true })
    const fetchImpl = vi.fn(async () => stubResponse)
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-redirect-retry' }

    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_redirect_blocked' })

    const second = await invoke(opts)
    expect(second.status).toBe(503)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('missing trigger config → key not permanently consumed (a Sanity retry after the operator configures the hook succeeds)', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    Reflect.deleteProperty(process.env, ENV_DEPLOY_URL)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-missing-config' }

    const first = await invoke(opts)
    expect(first.status).toBe(503)
    expect(first.body).toEqual({ ok: false, error: 'dispatch_missing_config' })
    expect(fetchImpl).not.toHaveBeenCalled()

    // The endpoint released the key — even though the first
    // delivery saw a configuration error, a Sanity retry
    // can re-claim (after the operator wires the hook).
    const cache = getSharedIdempotencyCacheForTest()
    expect(cache.stateOf('idem-missing-config', Date.now())).toBeNull()

    // The operator wires the hook between retries.
    process.env[ENV_DEPLOY_URL] = URL
    const fetchImplAfter = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImplAfter)
    const second = await invoke(opts)
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ ok: true })
    expect(fetchImplAfter).toHaveBeenCalledTimes(1)
  })

  it('in-flight duplicate cannot cause permanent event loss', async () => {
    // The endpoint must NEVER acknowledge an in-flight duplicate
    // as success. Sanity retries with the same key; if the
    // first dispatch later succeeds, the retry becomes a
    // `duplicate` (200); if it fails, the retry re-claims
    // and re-dispatches. No event loss either way.
    //
    // The test pins BOTH branches:
    //
    //  Branch A — first dispatch succeeds, retry is `duplicate` 200.
    //  Branch B — first dispatch fails, retry re-claims and
    //              re-dispatches (status matches the new outcome).
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-inflight-loss' }

    // Branch A — first dispatch succeeds.
    const fetchImplA = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImplA)
    // Pre-claim the key (the prior delivery's dispatch is
    // already mid-flight when the duplicate arrives).
    const cache = getSharedIdempotencyCacheForTest()
    cache.tryClaim(opts.idempotencyKey, Date.now())
    const duplicate = await invoke(opts)
    expect(duplicate.status).toBe(503)
    expect(duplicate.body).toEqual({ ok: false, error: 'dispatch_in_flight' })
    // The duplicate did NOT trigger a second dispatch.
    expect(fetchImplA).not.toHaveBeenCalled()
    // The first dispatch completes (markCompleted) → the
    // retry becomes a `duplicate` 200.
    cache.markCompleted(opts.idempotencyKey, Date.now())
    const retryA = await invoke(opts)
    expect(retryA.status).toBe(200)
    expect(retryA.body).toEqual({ ok: true, duplicate: true })

    // Branch B — first dispatch fails. Use a fresh cache so
    // the previous branch's state doesn't leak.
    _resetSharedIdempotencyCacheForTests()
    _setSharedIdempotencyCacheForTests(createIdempotencyCache({ ttlMs: 60_000 }))
    const fetchImplB = vi.fn(async () => new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchImplB)
    const cacheB = getSharedIdempotencyCacheForTest()
    cacheB.tryClaim('idem-inflight-loss-B', Date.now())
    const duplicateB = await invoke({ timestamp: Date.now(), idempotencyKey: 'idem-inflight-loss-B' })
    expect(duplicateB.status).toBe(503)
    expect(duplicateB.body).toEqual({ ok: false, error: 'dispatch_in_flight' })
    expect(fetchImplB).not.toHaveBeenCalled()
    // The first dispatch fails (release) → the retry can
    // re-claim and re-dispatch.
    cacheB.release('idem-inflight-loss-B', Date.now())
    const retryB = await invoke({ timestamp: Date.now(), idempotencyKey: 'idem-inflight-loss-B' })
    // The retry re-dispatches (the mock still returns 500,
    // so the retry itself fails — but the trigger WAS
    // invoked, proving no permanent event loss).
    expect(retryB.status).toBe(503)
    expect(retryB.body).toEqual({ ok: false, error: 'dispatch_server_error' })
    expect(fetchImplB).toHaveBeenCalledTimes(1)
  })

  it('completed duplicate does not dispatch twice (cache holds the completed state across deliveries)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const opts = { timestamp: Date.now(), idempotencyKey: 'idem-completed-double-fire' }

    // First delivery.
    await invoke(opts)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // Second delivery (replay of the completed event).
    await invoke(opts)
    await invoke(opts)
    await invoke(opts)
    // The trigger was invoked exactly once across four
    // deliveries — the cache marks the entry completed after
    // the first success and short-circuits the rest.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/webhooks/sanity — dispatch outcomes map to 503 (retryable)', () => {
  // Under the failure-safe retry semantics, every dispatch
  // failure is 503 (retryable) so Sanity retries with the
  // same idempotency-key. The endpoint releases the cache
  // entry on every failure so the retry can re-claim.
  const failureCases: Array<{ status: number; outcome: string, fetcherImpl: () => Promise<Response> }> = [
    { status: 400, outcome: 'dispatch_client_error', fetcherImpl: () => new Response('{}', { status: 400 }) },
    { status: 401, outcome: 'dispatch_auth_rejected', fetcherImpl: () => new Response('{}', { status: 401 }) },
    { status: 403, outcome: 'dispatch_auth_rejected', fetcherImpl: () => new Response('{}', { status: 403 }) },
    { status: 404, outcome: 'dispatch_not_found', fetcherImpl: () => new Response('{}', { status: 404 }) },
    { status: 500, outcome: 'dispatch_server_error', fetcherImpl: () => new Response('{}', { status: 500 }) },
    { status: 503, outcome: 'dispatch_server_error', fetcherImpl: () => new Response('{}', { status: 503 }) },
  ]

  for (const { status, outcome, fetcherImpl } of failureCases) {
    it(`returns 503 with \`${outcome}\` when the receiver returns ${status}`, async () => {
      const fetchImpl = vi.fn(fetcherImpl)
      vi.stubGlobal('fetch', fetchImpl)
      const result = await invoke({ timestamp: Date.now() })
      expect(result.status).toBe(503)
      expect(result.body).toEqual({ ok: false, error: outcome })
    })
  }

  it('returns 503 with `dispatch_timeout` when the fetch rejects with an AbortError', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => {
      throw abortError
    })
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ timestamp: Date.now() })
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ ok: false, error: 'dispatch_timeout' })
  })

  it('returns 503 with `dispatch_network_error` when the fetch rejects with a non-abort error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ timestamp: Date.now() })
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ ok: false, error: 'dispatch_network_error' })
  })

  it('returns 503 with `dispatch_redirect_blocked` when the receiver returns opaqRedirect (redirects not followed)', async () => {
    const stubResponse = new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.test' } })
    Object.defineProperty(stubResponse, 'type', { value: 'opaqRedirect', configurable: true })
    const fetchImpl = vi.fn(async () => stubResponse)
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({ timestamp: Date.now() })
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ ok: false, error: 'dispatch_redirect_blocked' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns 503 with `dispatch_missing_config` when NUXT_DEPLOY_HOOK_URL is unset', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    Reflect.deleteProperty(process.env, ENV_DEPLOY_URL)
    const result = await invoke({ timestamp: Date.now() })
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ ok: false, error: 'dispatch_missing_config' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/sanity — secret hygiene', () => {
  it('does not log the raw body, the secret, or the provider response body', async () => {
    const fetchImpl = vi.fn(async () => new Response('PROVIDER-SECRET-RESPONSE-BODY', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await invoke({
      body: '{"name":"PII-IN-BODY"}',
      timestamp: Date.now(),
    })
    const allCalls = [...consoleInfoSpy.mock.calls, ...consoleErrorSpy.mock.calls]
    for (const call of allCalls) {
      expect(JSON.stringify(call)).not.toContain('PROVIDER-SECRET-RESPONSE-BODY')
      expect(JSON.stringify(call)).not.toContain('PII-IN-BODY')
      expect(JSON.stringify(call)).not.toContain(SECRET)
    }
  })

  it('uses the per-tenant secret override when NUXT_SANITY_WEBHOOK_SECRET__<TENANT_ID> is set', async () => {
    const tenantSecret = 'per-tenant-secret-32chars-aaaaaaaaa'
    // The endpoint derives the tenant id from the host header:
    // `acme.example.test` → `acme-example-test` (lowercased, periods
    // become dashes) → `ACME-EXAMPLE-TEST` (uppercased) →
    // `ACME_EXAMPLE_TEST` (non-alphanumeric → underscore). The
    // per-tenant env var name follows that final normalization.
    process.env['NUXT_SANITY_WEBHOOK_SECRET__ACME_EXAMPLE_TEST'] = tenantSecret
    Reflect.deleteProperty(process.env, ENV_SECRET)

    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({
      timestamp: Date.now(),
      host: 'acme.example.test',
      signedWith: tenantSecret,
      idempotencyKey: 'idem-tenant-secret',
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
  })

  it('falls back to the global secret when no per-tenant override matches', async () => {
    process.env['NUXT_SANITY_WEBHOOK_SECRET__SOME_OTHER_TENANT'] = 'per-tenant-secret-32chars-aaaaaaaaa'
    // Global secret is the default SECRET (set in beforeEach).

    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchImpl)
    const result = await invoke({
      timestamp: Date.now(),
      host: 'unknown-tenant.example.test',
      idempotencyKey: 'idem-global-fallback',
    })
    expect(result.status).toBe(200)
  })
})

describe('POST /api/webhooks/sanity — malformed body after valid signature', () => {
  it('returns 400 when the body is not parseable JSON (release the claim so a retry can re-dispatch)', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    // Sign the malformed bytes — the verifier accepts them
    // because the signature matches; the JSON.parse defensive
    // check is what rejects them.
    const ts = Date.now()
    const body = Buffer.from('not-valid-json{', 'utf8')
    const signature = computeSanitySignature(body, ts, SECRET)
    const result = await invoke({
      body,
      signature,
      timestamp: ts,
      idempotencyKey: 'idem-malformed',
    })
    expect(result.status).toBe(400)
    expect(result.body).toEqual({ ok: false, error: 'malformed_payload' })
    expect(fetchImpl).not.toHaveBeenCalled()
    // The endpoint released the claim — a future Sanity
    // retry with a corrected payload can re-dispatch.
    const cache = getSharedIdempotencyCacheForTest()
    expect(cache.stateOf('idem-malformed', Date.now())).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test-only helper: surface the shared cache to assertions.
// ---------------------------------------------------------------------------
//
// The endpoint reads `process.env` and `getSharedIdempotencyCache()`
// internally; the tests above need to inspect the shared cache
// state (e.g., `stateOf(key)`) after each call. This helper
// avoids touching the internal module-level binding.

function getSharedIdempotencyCacheForTest(): ReturnType<typeof getSharedIdempotencyCache> {
  return getSharedIdempotencyCache()
}
