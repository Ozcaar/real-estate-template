import {
  assertMethod,
  createError,
  defineEventHandler,
  getHeader,
  getRequestIP,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { leadService, type LeadSubmitStatus } from '../services/leads/lead.service'

/**
 * `POST /api/contact` — lead capture endpoint.
 *
 * Transport-level guard rails (this file) plus business logic
 * (`server/services/leads/lead.service.ts`).
 *
 * **Allowed method.** Only `POST`. `GET` / `PUT` / `DELETE`
 * produce a 405 from `assertMethod`. CORS preflight (`OPTIONS`)
 * is **not** handled here — the form is same-origin and does not
 * need it; cross-origin requests are rejected by the browser
 * preflight when they try to send `Content-Type: application/json`.
 *
 * **Content type.** Only `application/json`. Any other type
 * returns 415.
 *
 * **Body size.** The raw body is read as a Buffer and the byte
 * length is checked **before** parsing. A body larger than 16 KB
 * returns 413. The limit is generous — the form's longest
 * plausible payload is a 4000-char message plus 254-char email,
 * 32-char phone, 120-char name, 120-char locale, and a few
 * brackets — well under 4 KB serialized. 16 KB leaves room for
 * legitimate clients without inviting oversized payloads.
 *
 * **Response shape.** The endpoint always returns a JSON body
 * matching one of the documented shapes. Provider details, webhook
 * URLs, secrets, and stack traces are never exposed.
 *
 * **Privacy.** The endpoint never logs the body. The only
 * information it forwards into the rate-limit key is the
 * `x-forwarded-for` IP (when present) and the `user-agent`
 * header. The lead service does not store the IP, and the
 * configured delivery adapter receives only the stamped lead
 * (no IP, no user-agent, no cookies).
 *
 * **Deployment.** This endpoint requires a server-capable Nitro
 * preset (`pnpm build` + `node .output/server/index.mjs`, or any
 * preset that ships a server runtime). A pure static
 * `pnpm generate` deployment does not include server routes and
 * cannot serve `/api/contact`. See `docs/REBRANDING.md` §12.
 */

const MAX_BODY_BYTES = 16 * 1024

function jsonResponse(event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never, status: number, body: unknown) {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
  return body
}

function buildRequestKey(event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never): string {
  // Opaque, per-connection value. The IP is best-effort; behind a
  // trusted proxy `getRequestIP` honors `x-forwarded-for`. The
  // user-agent is truncated to 200 chars to bound the key size.
  // The service uses this key only for the in-memory rate-limit
  // map; the key never leaves the server.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const ua = (getHeader(event, 'user-agent') ?? '').slice(0, 200)
  return `${ip}::${ua}`
}

export default defineEventHandler(async (event) => {
  // Method guard. assertMethod throws an H3Error that Nitro turns
  // into a 405 with an `Allow: POST` header.
  assertMethod(event, 'POST')

  // Content-type guard. Only application/json is accepted.
  const contentType = (getHeader(event, 'content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    return jsonResponse(event, 415, { ok: false, error: 'unsupported_media_type' })
  }

  // Size guard. The raw body is read as a Buffer so the byte
  // length can be checked before any JSON parsing. A body that
  // exceeds the limit returns 413 without ever reaching the
  // schema, the rate limiter, or the delivery adapter.
  const raw = await readRawBody(event, false)
  if (!raw) {
    return jsonResponse(event, 400, { ok: false, error: 'validation', issues: [] })
  }
  if (raw.byteLength > MAX_BODY_BYTES) {
    return jsonResponse(event, 413, { ok: false, error: 'payload_too_large' })
  }

  // JSON parse. A malformed body is a 400 with an empty issues
  // array — the schema re-runs as a safety net.
  let body: unknown
  try {
    body = JSON.parse(raw.toString('utf8'))
  }
  catch {
    return jsonResponse(event, 400, { ok: false, error: 'validation', issues: [] })
  }

  // Business logic. The service handles honeypot, schema
  // validation, rate limiting, lead stamping, and delivery.
  const requestKey = buildRequestKey(event)
  const acceptLanguage = getHeader(event, 'accept-language') ?? ''
  const fallbackLocale = acceptLanguage
    .split(',')[0]
    ?.split('-')[0]
    ?.trim()
    .slice(0, 12) || 'en'

  const result: LeadSubmitStatus = await leadService.submit(
    { body },
    { requestKey, fallbackLocale },
  )

  // Transport mapping. The service's `LeadSubmitStatus` is the
  // contract; the endpoint turns each branch into a status code
  // and a JSON body.
  switch (result.status) {
    case 'ok':
      return jsonResponse(event, 200, { ok: true, id: result.id })
    case 'honeypot':
      // Silent 200. The body intentionally has no `id` field so a
      // bot cannot tell the request was discarded.
      return jsonResponse(event, 200, { ok: true })
    case 'validation':
      return jsonResponse(event, 400, { ok: false, error: 'validation', issues: result.issues })
    case 'rate_limited':
      return jsonResponse(event, 429, { ok: false, error: 'rate_limited' })
    case 'adapter_disabled':
      return jsonResponse(event, 503, { ok: false, error: 'adapter_disabled' })
    case 'delivery':
      return jsonResponse(event, 502, { ok: false, error: 'delivery' })
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = result
      throw createError({ statusCode: 500, statusMessage: 'Unknown lead status' })
    }
  }
})
