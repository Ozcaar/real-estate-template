import {
  assertMethod,
  createError,
  defineEventHandler,
  getHeader,
  getRequestIP,
  getRequestHeader,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { leadService, type LeadSubmitStatus } from '../services/leads/lead.service'
import { propertiesService } from '../../app/features/properties/services/properties.service'
import { resolveTenantLeadsConfig } from '../utils/lead-config'
import { loadPropertiesServer } from '../utils/properties'
import type { PropertyReference } from '../../app/features/leads/types/lead.types'

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
 * 32-char phone, 120-char name, 120-char locale, a property
 * slug of up to 120 chars, and a few brackets — well under 4 KB
 * serialized. 16 KB leaves room for legitimate clients without
 * inviting oversized payloads.
 *
 * **Property inquiry context (Task 101B).** When the validated
 * body carries an optional `property: { slug }` block (sent by
 * the `/properties/[slug]` inquiry form), the endpoint:
 *
 *  1. Reads the slug from the body (the ONLY client-supplied
 *     property field — title, price, location, and any other
 *     metadata are NEVER trusted as authoritative).
 *  2. Looks up the canonical property record server-side via
 *     the server-only property loader + `propertiesService.getBySlug`.
 *  3. Builds a verified `PropertyReference` (`slug`, `title`,
 *     `url`) and passes it to the service as `propertyContext`.
 *
 * **The source `property_inquiry` is preserved independently
 * of whether the lookup succeeded:**
 *
 *  - **Successful lookup.** The lead is stamped with
 *    `source: 'property_inquiry'` AND `lead.property =
 *    PropertyReference`.
 *  - **Property not found** (slug not in catalog). The lead is
 *    stamped with `source: 'property_inquiry'` and NO `property`
 *    field — the agency sees the inquiry source but no catalog
 *    metadata. The form submission is still accepted so a
 *    stale page does not 404 the user.
 *  - **Transient loader failure** (api endpoint unreachable,
 *    DNS error, timeout). Same as above: the lead is stamped
 *    with `source: 'property_inquiry'` and NO `property`
 *    field. The contact form does NOT take down — the loader
 *    is wrapped in `try/catch` and the lead is delivered
 *    without property context.
 *
 * The service derives `isPropertyInquiry` from the **validated
 * body's `property` block**, NOT from `propertyContext`. The
 * schema's `z.object(...)` strips unknown keys (including a
 * client-supplied `source`), so a forged source value cannot
 * reach `lead.source`. The server is the sole authority for the
 * source value stamped on the lead.
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

/**
 * Read the request hostname for tenant resolution.
 *
 * Honors `x-forwarded-host` first (a CDN / load balancer
 * rewrites the host header at the edge), then falls back to
 * `host`. Both are lowercased and trimmed for stable matching
 * against the registry's `hosts` lists. Mirrors the same
 * helper the sitemap and robots routes use so a multi-tenant
 * deployment sees one consistent host resolution across the
 * three Nitro routes.
 */
function readHost(event: Parameters<typeof defineEventHandler>[0]): string {
  const fwd = getRequestHeader(event, 'x-forwarded-host')
  const host = getRequestHeader(event, 'host')
  return (fwd ?? host ?? '').split(',')[0]?.trim() ?? ''
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

/**
 * Look up a property by slug and build the server-derived
 * `PropertyReference`. The reference carries only what the
 * delivery adapters need: the canonical slug (for agency-side
 * filtering), the server-verified title (so the email subject
 * and webhook payload reflect the listing the user actually
 * saw), and the canonical URL path (so the agency can click
 * through to the listing from their inbox).
 *
 * Returns `undefined` when the slug is empty, when the catalog
 * lookup throws, or when the slug does not match any catalog
 * record. The endpoint accepts the form submission in every
 * case. The lead is still stamped with `source: 'property_inquiry'`
 * because the **source is derived from the body's `property.slug`
 * in the service**, not from this function's return value —
 * the soft-failure cases preserve the inquiry source so the
 * agency can filter "this was a property inquiry" from "this
 * was a general contact submission".
 */
async function buildPropertyContext(slug: string | undefined): Promise<PropertyReference | undefined> {
  if (!slug) return undefined
  try {
    const properties = await loadPropertiesServer()
    const property = propertiesService.getBySlug(properties, slug)
    if (!property) return undefined
    return {
      slug: property.slug,
      title: property.title,
      url: `/properties/${property.slug}`,
    }
  }
  catch {
    // A misconfigured api endpoint or transient upstream failure
    // must NOT take down the contact form. The lead is delivered
    // without property context; the agency's webhook / email
    // payload simply lacks the `property` field.
    return undefined
  }
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

  // Extract the property slug before delegating to the service.
  // The shape is intentionally untyped here so a malformed body
  // is handled by the schema in the service, not by a separate
  // pre-check. The slug is the only field the endpoint reads from
  // the raw body; everything else is validated by the service.
  const propertySlug = (() => {
    if (body && typeof body === 'object') {
      const property = (body as Record<string, unknown>).property
      if (property && typeof property === 'object') {
        const slug = (property as Record<string, unknown>).slug
        if (typeof slug === 'string') return slug
      }
    }
    return undefined
  })()

  const propertyContext = await buildPropertyContext(propertySlug)

  // Per-tenant lead-delivery configuration (Task 106). The
  // endpoint resolves the active tenant from the request
  // hostname (same source the sitemap + robots use) and asks
  // the per-tenant resolver for a `TenantLeadsConfig`
  // snapshot. The snapshot is passed explicitly through the
  // lead pipeline; the service threads it into the adapter
  // input so the adapter reads URL / secret / SMTP fields
  // from the snapshot, NOT from `useRuntimeConfig()`. This
  // keeps concurrent requests for different tenants from
  // sharing adapter configuration.
  const tenantLeadsConfig = resolveTenantLeadsConfig(readHost(event))

  const result: LeadSubmitStatus = await leadService.submit(
    { body, propertyContext },
    { requestKey, fallbackLocale, tenantLeadsConfig },
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
