import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Sanity webhook signature verifier (Task 128 — Sanity Studio webhooks → rebuild trigger).
 *
 * Inbound signature verification for the Sanity Studio webhook
 * integration. Sanity uses the same Stripe-style signed-payload
 * format documented at https://www.sanity.io/docs/webhooks and
 * implemented in `@sanity/webhook`. The verifier is
 * hand-rolled from `node:crypto` so the build does not depend
 * on `@sanity/webhook` (the implementation is < 80 lines and
 * the only surface the project needs is the signature check).
 *
 * **Protocol (verbatim from the Sanity docs).**
 *
 *  - Signature header: `sanity-webhook-signature`
 *  - Header format: `t=<unix-millis>,v1=<base64url-hmac-sha256>`
 *    (the regex matches `t=` followed by the timestamp, then
 *    `,v1=` followed by the signature; the separator may be
 *    `,` or whitespace).
 *  - Signed payload: `${timestamp}.${rawBodyString}` (the raw
 *    UTF-8 stringified request body, not a re-encoded JSON
 *    object — re-encoding can change key ordering or whitespace
 *    and break the signature).
 *  - Algorithm: HMAC-SHA256 over the signed payload, encoded as
 *    base64url (RFC 4648 §5), NOT hex.
 *  - Tolerance: not enforced by Sanity; the verifier checks the
 *    timestamp against `Date.now()` ± {@link DEFAULT_TOLERANCE_MS}
 *    (5 minutes, matching the Stripe convention the Sanity docs
 *    reference).
 *
 * **Why raw body.** The signature is over the exact byte
 * sequence Sanity signed. Reading the body via `readRawBody(event,
 * false)` (which returns a Buffer, not a string) is mandatory —
 * any JSON re-encoding between the wire and the HMAC compute
 * would invalidate the signature for legitimate deliveries.
 *
 * **Why timing-safe comparison.** String `===` is not
 * constant-time: an attacker observing timing can recover the
 * correct prefix character-by-character. `crypto.timingSafeEqual`
 * compares two equal-length Buffers in constant time, so a
 * wrong secret / wrong header format / wrong timestamp returns
 * the same latency profile as a correct secret. The verifier
 * rejects length mismatches BEFORE the timing-safe compare (the
 * `timingSafeEqual` API requires equal-length inputs).
 *
 * **No logging.** The verifier never logs the secret, the
 * expected signature, or the request body. The caller is
 * responsible for any logging and the caller receives only the
 * structured result.
 */

/**
 * Header name Sanity uses for the signed-payload header.
 * Exported so the endpoint and the verifier stay in sync; the
 * test surface also references this constant when constructing
 * synthetic headers.
 */
export const SANITY_SIGNATURE_HEADER = 'sanity-webhook-signature'

/**
 * The `sanity-webhook-id` header identifies the webhook
 * configuration (NOT the delivery). Useful for log correlation
 * when multiple webhooks point at the same endpoint.
 */
export const SANITY_WEBHOOK_ID_HEADER = 'sanity-webhook-id'

/**
 * The IETF `idempotency-key` header carries the per-delivery
 * uniqueness key. Sanity uses at-least-once delivery, so the
 * endpoint must de-duplicate on this header value. The field
 * is intentionally NOT renamed — the standard HTTP header name
 * is the source of truth.
 */
export const SANITY_IDEMPOTENCY_KEY_HEADER = 'idempotency-key'

/**
 * The `sanity-operation` header carries one of `create` / `update` /
 * `delete`. The endpoint may filter on this value (e.g. ignore
 * `delete` events when the agency unpublishes a record).
 */
export const SANITY_OPERATION_HEADER = 'sanity-operation'

/**
 * Other Sanity-supplied informational headers. Captured here
 * for completeness; the endpoint's structured log records
 * these as log fields (the verifier does not consume them).
 */
export const SANITY_TRANSACTION_ID_HEADER = 'sanity-transaction-id'
export const SANITY_TRANSACTION_TIME_HEADER = 'sanity-transaction-time'
export const SANITY_DATASET_HEADER = 'sanity-dataset'
export const SANITY_DOCUMENT_ID_HEADER = 'sanity-document-id'
export const SANITY_PROJECT_ID_HEADER = 'sanity-project-id'

/**
 * Default replay-protection tolerance (5 minutes).
 *
 * **Important.** The signature protocol itself (the
 * `t=<unix-ms>,v1=<base64url-hmac-sha256>` header format and the
 * HMAC-SHA256 over `${timestamp}.${rawBody}`) is Sanity's
 * contract — the verifier implements it byte-for-byte. The
 * **tolerance window** is a project-level replay-protection
 * policy, NOT a requirement of Sanity's protocol: Sanity's
 * reference `@sanity/webhook` library does NOT enforce a
 * tolerance window at all, and Sanity's delivery infrastructure
 * makes no clock-skew guarantees beyond the documented 30-second
 * retry interval.
 *
 * The 5-minute default matches the Stripe convention Sanity's
 * docs reference (the same convention the canonical
 * `webhook-toolkit` library applies) and the realistic
 * clock-skew envelope between Sanity's delivery infrastructure
 * and a Nitro endpoint behind a CDN. Operators can override via
 * the documented `NUXT_SANITY_WEBHOOK_TOLERANCE_MS` env var when
 * an unusual deployment requires a wider (or tighter) window.
 *
 * **Distinct from the dedup TTL.** The signature tolerance is a
 * **security boundary** (rejects replay attempts older than the
 * window). The dedup TTL (`NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS`)
 * is an **operational courtesy** (recognizes a replayed
 * delivery as "already dispatched" without re-invoking the
 * trigger). The two env vars are deliberately independent so an
 * operator can tighten one without relaxing the other.
 */
export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000

/**
 * Reasons the verifier can reject a request. Each value is a
 * stable, lowercase, machine-readable code the caller maps to
 * an HTTP status. The codes never leak the secret or the
 * expected signature.
 */
export type SanityVerifyFailure =
  | 'missing_signature_header'
  | 'malformed_signature_header'
  | 'malformed_timestamp'
  | 'timestamp_outside_tolerance'
  | 'length_mismatch'
  | 'signature_mismatch'
  | 'missing_secret'

/**
 * The structured verifier result. `ok: true` means the
 * signature was verified against the raw body with the supplied
 * secret; `ok: false` carries the failure reason. The caller
 * branches on `ok` and never inspects the raw header or the
 * secret on the failure path (the failure reason is sufficient
 * for logging and for the HTTP status mapping).
 */
export type SanityVerifyResult =
  | { readonly ok: true }
  | { readonly ok: false, readonly reason: SanityVerifyFailure }

/**
 * The minimal header-shaped object the verifier accepts. H3's
 * `getRequestHeader` returns `string | undefined`, which is
 * exactly the shape the verifier needs. Keeping the input
 * loose (instead of typing against `H3Event`) keeps the
 * verifier a pure helper — it has no H3 dependency, no
 * Nitro dependency, and can be unit-tested without booting
 * the framework.
 */
export interface SanityVerifyHeaders {
  readonly [key: string]: string | undefined
}

/**
 * Decode a Sanity signature header into its component parts.
 *
 * Returns `{ ok: false }` for missing or malformed input. The
 * caller treats the malformed case as a signature failure
 * (the verifier never accepts an unparseable header — it
 * silently falls back to "invalid request" so the caller does
 * not have to distinguish between "header absent" and "header
 * present but garbage" at the call site).
 *
 * Accepts both `,` and whitespace separators (Sanity's docs
 * document the comma separator; the `@sanity/webhook` regex
 * accepts either).
 */
function decodeSignatureHeader(header: string | undefined):
  | { readonly ok: true, readonly timestamp: number, readonly signature: string }
  | { readonly ok: false, readonly reason: SanityVerifyFailure }
{
  if (typeof header !== 'string' || header === '') {
    return { ok: false, reason: 'missing_signature_header' }
  }
  const match = header.match(/^t=(\d+)[, ]+v1=([A-Za-z0-9_-]+)$/)
  if (!match) {
    return { ok: false, reason: 'malformed_signature_header' }
  }
  const timestamp = Number.parseInt(match[1]!, 10)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, reason: 'malformed_timestamp' }
  }
  return { ok: true, timestamp, signature: match[2]! }
}

/**
 * Compute the expected Sanity signature for a raw body.
 *
 * Exposed for the test surface (round-trip a known payload /
 * known secret → known signature → decode → assert). NOT
 * re-exported outside this module. Uses `node:crypto` for the
 * HMAC and Node's standard library base64url encoding
 * (Buffer.toString('base64url') is stable from Node 16+).
 */
export function computeSanitySignature(
  rawBody: Buffer,
  timestamp: number,
  secret: string,
): string {
  // The signed payload is `${timestamp}.${stringifiedBody}` —
  // the raw body decoded as UTF-8 (Sanity always sends
  // application/json so UTF-8 is the canonical encoding).
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`
  return createHmac('sha256', secret).update(signedPayload).digest('base64url')
}

/**
 * Verify a Sanity webhook request against a known secret.
 *
 * Pure function. Reads the signature header from `headers`,
 * recomputes the expected signature over the raw body, and
 * compares with `crypto.timingSafeEqual` after a length check.
 *
 * Returns a structured result. The verifier NEVER throws and
 * NEVER logs. A failure is the common case for unauthenticated
 * probes / replay attempts / clock-skew edge cases; the caller
 * treats every `ok: false` branch as a 401.
 *
 * **Length check.** `timingSafeEqual` requires equal-length
 * Buffers and throws otherwise. A wrong-length signature is a
 * guaranteed mismatch; the verifier rejects it explicitly so
 * the timing-safe compare only runs against equal-length
 * inputs.
 *
 * **Empty / whitespace secret.** A misconfiguration that
 * reaches this verifier means `NUXT_SANITY_WEBHOOK_SECRET`
 * (or its per-tenant override) is empty. The verifier rejects
 * this explicitly with `missing_secret` so the operator's log
 * surfaces the misconfiguration without exposing any
 * signature data.
 */
export function verifySanitySignature(
  headers: SanityVerifyHeaders,
  rawBody: Buffer,
  secret: string,
  options: { readonly now?: number, readonly toleranceMs?: number } = {},
): SanityVerifyResult {
  // Whitespace-only is treated as "missing" so an operator who
  // configured `NUXT_SANITY_WEBHOOK_SECRET=` (empty) or
  // `NUXT_SANITY_WEBHOOK_SECRET=   ` (whitespace) is treated the
  // same way (a misconfiguration, not a real secret). A real
  // configured secret with a space at the start or end is rare
  // in practice and indistinguishable from a misconfiguration
  // at the operator-facing log surface.
  if (typeof secret !== 'string' || secret.trim() === '') {
    return { ok: false, reason: 'missing_secret' }
  }

  const decoded = decodeSignatureHeader(headers[SANITY_SIGNATURE_HEADER])
  if (!decoded.ok) {
    return decoded
  }

  const now = options.now ?? Date.now()
  const toleranceMs = options.toleranceMs ?? DEFAULT_TOLERANCE_MS
  const skew = Math.abs(now - decoded.timestamp)
  if (skew > toleranceMs) {
    return { ok: false, reason: 'timestamp_outside_tolerance' }
  }

  const expected = computeSanitySignature(rawBody, decoded.timestamp, secret)
  const expectedBuf = Buffer.from(expected, 'base64url')
  const providedBuf = Buffer.from(decoded.signature, 'base64url')

  // Length-mismatch is a guaranteed failure. Skip the
  // timing-safe compare entirely — equal-length comparison
  // would throw on unequal inputs.
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'length_mismatch' }
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, reason: 'signature_mismatch' }
  }

  return { ok: true }
}
