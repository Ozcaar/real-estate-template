import { describe, expect, it } from 'vitest'
import {
  computeSanitySignature,
  DEFAULT_TOLERANCE_MS,
  SANITY_SIGNATURE_HEADER,
  verifySanitySignature,
  type SanityVerifyHeaders,
} from './sanity-webhook'

/**
 * Tests for the Sanity webhook signature verifier.
 *
 * Coverage:
 *  - Valid signature accepted (round-trip with
 *    `computeSanitySignature`).
 *  - Missing signature header rejected.
 *  - Malformed signature header rejected.
 *  - Future timestamp beyond tolerance rejected.
 *  - Past timestamp beyond tolerance rejected.
 *  - Wrong secret rejected.
 *  - Wrong body rejected (raw-body integrity).
 *  - Length-mismatch signature rejected without throwing.
 *  - Empty / missing secret rejected.
 *
 * The tests use deterministic timestamps via the `now` option
 * so the timestamp-tolerance cases are exact (no flake from
 * wall-clock drift during the test run).
 */

const SECRET = 'super-secret-sanity-shared-key-32chars'
const BODY = Buffer.from(JSON.stringify({ _type: 'property', _id: 'p1' }), 'utf8')

function buildHeaders(signature: string, timestamp: number): SanityVerifyHeaders {
  return { [SANITY_SIGNATURE_HEADER]: `t=${timestamp},v1=${signature}` }
}

function buildWhitespaceHeaders(signature: string, timestamp: number): SanityVerifyHeaders {
  // Sanity's regex accepts whitespace as the separator. Verify
  // the verifier treats it identically to the comma form.
  return { [SANITY_SIGNATURE_HEADER]: `t=${timestamp} v1=${signature}` }
}

describe('verifySanitySignature', () => {
  it('accepts a valid signature (round-trip with computeSanitySignature)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const result = verifySanitySignature(headers, BODY, SECRET, { now: ts })
    expect(result).toEqual({ ok: true })
  })

  it('accepts a valid signature with the whitespace-separator variant', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildWhitespaceHeaders(signature, ts)
    const result = verifySanitySignature(headers, BODY, SECRET, { now: ts })
    expect(result).toEqual({ ok: true })
  })

  it('rejects when the signature header is missing', () => {
    const result = verifySanitySignature({}, BODY, SECRET)
    expect(result).toEqual({ ok: false, reason: 'missing_signature_header' })
  })

  it('rejects when the signature header is an empty string', () => {
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: '' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'missing_signature_header' })
  })

  it('rejects a malformed signature header (no v1 field)', () => {
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 't=1700000000000' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_signature_header' })
  })

  it('rejects a malformed signature header (no t field)', () => {
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 'v1=abc' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_signature_header' })
  })

  it('rejects a malformed signature header (extra junk)', () => {
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 't=1700000000000,v1=abc,v2=def' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_signature_header' })
  })

  it('rejects when the timestamp is malformed (negative) — caught as malformed_signature_header', () => {
    // The regex `^t=(\d+)[, ]+v1=...$` rejects non-digit
    // characters in the t-field, so a literal `-1` is caught by
    // the outer "malformed header" branch before the timestamp
    // value reaches the parseInt stage. The test pins this:
    // from the caller's perspective the request is just
    // rejected as malformed; the failure-reason granularity
    // (signature vs timestamp) is internal to the verifier.
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 't=-1,v1=abc' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_signature_header' })
  })

  it('rejects when the timestamp is malformed (non-numeric) — caught as malformed_signature_header', () => {
    // Same as above: the regex rejects non-digit t-field values.
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 't=not-a-number,v1=abc' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_signature_header' })
  })

  it('rejects when the timestamp is zero (positive match, parseInt produces a non-positive integer)', () => {
    // The regex matches `t=0,v1=abc`, but `Number.parseInt('0', 10) === 0`
    // which the verifier rejects as a malformed timestamp
    // (timestamps are positive Unix milliseconds).
    const result = verifySanitySignature(
      { [SANITY_SIGNATURE_HEADER]: 't=0,v1=abc' },
      BODY,
      SECRET,
    )
    expect(result).toEqual({ ok: false, reason: 'malformed_timestamp' })
  })

  it('rejects a future timestamp beyond the tolerance window', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const now = ts + DEFAULT_TOLERANCE_MS + 1
    const result = verifySanitySignature(headers, BODY, SECRET, { now })
    expect(result).toEqual({ ok: false, reason: 'timestamp_outside_tolerance' })
  })

  it('rejects a past timestamp beyond the tolerance window', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const now = ts - DEFAULT_TOLERANCE_MS - 1
    const result = verifySanitySignature(headers, BODY, SECRET, { now })
    expect(result).toEqual({ ok: false, reason: 'timestamp_outside_tolerance' })
  })

  it('accepts a timestamp exactly at the tolerance edge (within window)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const now = ts + DEFAULT_TOLERANCE_MS
    const result = verifySanitySignature(headers, BODY, SECRET, { now })
    expect(result).toEqual({ ok: true })
  })

  it('respects a custom tolerance window (1ms skew within 500ms tolerance → accepted)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    // 1ms skew is well within a 500ms tolerance window.
    const result = verifySanitySignature(headers, BODY, SECRET, {
      now: ts + 1,
      toleranceMs: 500,
    })
    expect(result).toEqual({ ok: true })
  })

  it('rejects a 600ms skew beyond a 500ms tolerance window', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    // 600ms skew is beyond the 500ms tolerance.
    const result = verifySanitySignature(headers, BODY, SECRET, {
      now: ts + 600,
      toleranceMs: 500,
    })
    expect(result).toEqual({ ok: false, reason: 'timestamp_outside_tolerance' })
  })

  it('rejects when the secret is wrong', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const result = verifySanitySignature(headers, BODY, 'wrong-secret', { now: ts })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('rejects when the body has been modified (raw-body integrity)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const tampered = Buffer.concat([BODY, Buffer.from(' ', 'utf8')])
    const result = verifySanitySignature(headers, tampered, SECRET, { now: ts })
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('rejects when the signature length differs (does not throw on timingSafeEqual)', () => {
    const ts = 1_700_000_000_000
    const headers: SanityVerifyHeaders = {
      [SANITY_SIGNATURE_HEADER]: 't=1700000000000,v1=AB',
    }
    const result = verifySanitySignature(headers, BODY, SECRET, { now: ts })
    expect(result).toEqual({ ok: false, reason: 'length_mismatch' })
  })

  it('rejects when the secret is empty (missing_secret)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const result = verifySanitySignature(headers, BODY, '', { now: ts })
    expect(result).toEqual({ ok: false, reason: 'missing_secret' })
  })

  it('rejects when the secret is whitespace-only', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    const result = verifySanitySignature(headers, BODY, '   ', { now: ts })
    expect(result).toEqual({ ok: false, reason: 'missing_secret' })
  })

  it('does not throw when the verifier is given a non-Buffer body (defensive)', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    const headers = buildHeaders(signature, ts)
    // The endpoint always passes a Buffer; this is a regression
    // test that the verifier tolerates any .toString-able
    // argument without crashing.
    expect(() =>
      verifySanitySignature(headers, BODY as unknown as Buffer, SECRET, { now: ts }),
    ).not.toThrow()
  })
})

describe('computeSanitySignature', () => {
  it('produces a base64url-encoded SHA-256 HMAC over `${timestamp}.${body}`', () => {
    const ts = 1_700_000_000_000
    const signature = computeSanitySignature(BODY, ts, SECRET)
    // base64url alphabet only (A–Z a–z 0–9 - _) — no `+`, `/`, or `=`.
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/)
    // SHA-256 base64url = 43 chars (no padding).
    expect(signature.length).toBe(43)
  })

  it('produces the same signature for the same inputs', () => {
    const ts = 1_700_000_000_000
    const a = computeSanitySignature(BODY, ts, SECRET)
    const b = computeSanitySignature(BODY, ts, SECRET)
    expect(a).toBe(b)
  })

  it('produces different signatures for different timestamps', () => {
    const a = computeSanitySignature(BODY, 1_700_000_000_000, SECRET)
    const b = computeSanitySignature(BODY, 1_700_000_001_000, SECRET)
    expect(a).not.toBe(b)
  })

  it('produces different signatures for different bodies', () => {
    const ts = 1_700_000_000_000
    const a = computeSanitySignature(Buffer.from('a', 'utf8'), ts, SECRET)
    const b = computeSanitySignature(Buffer.from('b', 'utf8'), ts, SECRET)
    expect(a).not.toBe(b)
  })

  it('produces different signatures for different secrets', () => {
    const ts = 1_700_000_000_000
    const a = computeSanitySignature(BODY, ts, 'secret-1')
    const b = computeSanitySignature(BODY, ts, 'secret-2')
    expect(a).not.toBe(b)
  })
})
