import { randomUUID } from 'node:crypto'
import { leadInputRefined } from '../../../app/features/leads/schemas/lead.schema'
import type {
  Lead,
  PropertyReference,
} from '../../../app/features/leads/types/lead.types'
import type { TenantLeadsConfig } from '../../utils/lead-config'
import type { LeadDeliveryAdapter } from './delivery-adapter'
import { getAdapter } from './adapters'

/**
 * Server-side lead service.
 *
 * This is the single entry point for processing a contact-form
 * submission. The Nitro endpoint (`server/api/contact.post.ts`)
 * delegates to `submit()` after enforcing the transport-level
 * guards (content type, body size, method).
 *
 * **Pipeline.**
 *
 * 1. Honeypot check. If the honeypot field is non-empty, return a
 *    generic success without delivering or logging anything. The
 *    bot detection is deliberately silent so the request looks
 *    indistinguishable from a real accepted submission.
 * 2. Schema validation. The shared `leadInputRefined` schema
 *    re-runs server-side. A failed parse returns the issues mapped
 *    to field paths. The schema strips unknown keys (including a
 *    client-supplied `source`), so the server is the sole
 *    authority for the `source` value stamped on the lead.
 * 3. Per-process rate limit. Five accepted attempts per 10 minutes
 *    per request key. The key is opaque — a hash of the connection
 *    IP and the user-agent, when available. The map lives in
 *    module scope and is **not** distributed; see the rate-limit
 *    documentation below.
 * 4. Stamp the lead. Server-only fields (`id`, `receivedAt`,
 *    `source`) are added here. The raw IP and user-agent never
 *    reach the adapter.
 *
 *    **Source derivation (Task 101B).** The `source` field is
 *    derived from the **validated body's `property` block**, NOT
 *    from the optional `propertyContext`:
 *
 *    - `body.property` is present (the user submitted a property
 *      inquiry form on `/properties/[slug]`) → `source:
 *      'property_inquiry'`.
 *    - `body.property` is absent (the user submitted the general
 *      contact form on `/contact`) → `source: 'contact'`.
 *
 *    The two concerns are deliberately separated:
 *
 *    - **Source intent** comes from the body's `property` block
 *      (the only client-supplied property field). The schema
 *      validates the slug format at the boundary; the server
 *      derives `source` from `parsed.data.property` so a
 *      well-formed slug — even when the canonical lookup
 *      soft-fails (slug not in catalog, transient loader error)
 *      — still preserves the user's intent.
 *
 *    - **Verified reference** comes from `propertyContext`
 *      (server-derived from the catalog lookup). When the
 *      lookup succeeds, the lead carries `lead.property =
 *      PropertyReference`. When the lookup soft-fails,
 *      `propertyContext` is `undefined` and the lead's
 *      `property` field is omitted — but `source` is still
 *      `'property_inquiry'` so the agency can filter the
 *      inquiry source from general contact submissions.
 *
 *    Client-supplied `title`, `price`, `location`, or any other
 *    property metadata are NEVER trusted as authoritative — the
 *    schema strips unknown fields and the endpoint performs the
 *    catalog lookup.
 *
 *    **Source/property invariant (Task 101C).** A lead with
 *    `source: 'contact'` MUST NOT carry property metadata. The
 *    `lead.property` field is gated on `isPropertyInquiry` (the
 *    body-level intent), so a defensive `propertyContext` that
 *    happens to be supplied without a matching body `property`
 *    block is silently dropped — it cannot turn a general
 *    contact submission into a hybrid that confuses the
 *    agency's downstream filters. The matrix is:
 *
 *    | Body has `property.slug` | `propertyContext` | `source`         | `lead.property`       |
 *    | ----------------------- | ----------------- | ---------------- | --------------------- |
 *    | ✓                       | ✓                 | `property_inquiry` | stamped               |
 *    | ✓                       | ✗ (soft failure)  | `property_inquiry` | omitted                |
 *    | ✗                       | ✗                 | `contact`        | omitted                |
 *    | ✗                       | ✓ (defensive)     | `contact`        | omitted (Task 101C)   |
 *
 * 5. Delivery. The configured adapter (`disabled`, `log`,
 *    `webhook`, or `email`) receives the stamped lead and returns
 *    a `LeadDeliveryResult`. The result is mapped to a transport
 *    status that the endpoint turns into an HTTP response.
 *
 * **Privacy.** The service never logs name, email, phone, message
 * content, cookies, raw IP, or user-agent. Server logs (when emitted
 * by the `log` adapter) contain only the lead id, the source, the
 * presence flags, the message length, and — when a verified
 * property reference is present — the property slug + title. The
 * property slug and title are server-derived catalog metadata, not
 * PII. On soft failure (no `propertyContext`) the log line carries
 * only the lead id, source, presence flags, and message length — the
 * source `'property_inquiry'` is enough for the agency to filter the
 * inquiry without catalog metadata.
 */

/** Server-side response shape, transport-status-aware. The endpoint
 *  maps this to an HTTP status and a JSON body. */
export type LeadSubmitStatus =
  | { status: 'ok', id: string }
  | { status: 'honeypot' }
  | { status: 'validation', issues: { path: string, message: string }[] }
  | { status: 'rate_limited' }
  | { status: 'adapter_disabled' }
  | { status: 'delivery' }

export interface LeadSubmitInput {
  body: unknown
  /**
   * Optional verified `PropertyReference` produced by the endpoint's
   * server-side catalog lookup keyed on the body's `property.slug`.
   *
   * The endpoint calls `loadPropertiesServer()` +
   * `propertiesService.getBySlug()` to build this reference from
   * canonical catalog data — never from client-supplied title /
   * price / other metadata. The reference is `undefined` in three
   * soft-failure cases:
   *
   *  - the body has no `property.slug` (the user submitted the
   *    general contact form on `/contact`);
   *  - the slug is not in the catalog (stale page, removed
   *    listing);
   *  - the catalog lookup threw (transient api failure,
   *    timeout, network error).
   *
   * The soft-failure cases are tolerated: the lead is delivered
   * with `source: 'property_inquiry'` but no `property` field.
   * Client-supplied metadata is NEVER trusted as authoritative.
   */
  propertyContext?: PropertyReference
}

export interface LeadSubmitContext {
  /** Opaque request key, supplied by the endpoint. Used by the
   *  rate limiter. Should be a stable per-connection value (the
   *  endpoint derives it from the request IP and user-agent). */
  requestKey: string
  /** Optional locale fallback. The schema's `locale` field
   *  overrides this when present. */
  fallbackLocale: string
  /**
   * Optional per-tenant lead-delivery configuration snapshot
   * (Task 106). When present, the service:
   *
   *  - selects the adapter via `getAdapter(tenantLeadsConfig)` so
   *    a per-tenant `NUXT_LEADS_ADAPTER__<TENANT_ID>` override
   *    wins over the global `NUXT_LEADS_ADAPTER`;
   *  - threads the snapshot into the adapter's `LeadDeliveryInput`
   *    so the webhook / email adapters read the per-tenant
   *    URL / secret / SMTP credentials / from / to instead of
   *    `useRuntimeConfig()`.
   *
   * When absent, the service falls back to the documented
   * single-tenant / no-tenant-context behavior:
   * `getAdapter()` reads `runtimeConfig.leadsAdapter` and the
   * adapters read `useRuntimeConfig()` directly.
   *
   * The snapshot is passed explicitly through the pipeline
   * (rather than stored in module-level mutable state) so
   * concurrent requests for different tenants cannot share
   * adapter configuration.
   */
  tenantLeadsConfig?: TenantLeadsConfig
}

export const leadService = {
  async submit(
    { body, propertyContext }: LeadSubmitInput,
    ctx: LeadSubmitContext,
  ): Promise<LeadSubmitStatus> {
    // 1. Honeypot check. The schema already rejects non-empty
    //    values, but we want the silent-discard path to be a
    //    structured "honeypot" result that the endpoint maps to a
    //    generic 200 without ever calling the adapter.
    if (
      body
      && typeof body === 'object'
      && (body as Record<string, unknown>).website
      && typeof (body as Record<string, unknown>).website === 'string'
      && (body as Record<string, unknown>).website !== ''
    ) {
      return { status: 'honeypot' }
    }

    // 2. Schema validation. The schema strips unknown keys, so a
    //    client-supplied `source` (or any other undeclared field)
    //    cannot reach `parsed.data.source` and cannot influence
    //    the stamped lead.
    const parsed = leadInputRefined.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: typeof issue.path[0] === 'string' ? issue.path[0] : '',
        message: issue.message,
      }))
      return { status: 'validation', issues }
    }

    // 3. Per-process rate limit.
    if (!checkRateLimit(ctx.requestKey)) {
      return { status: 'rate_limited' }
    }

    // 4. Stamp the lead. Server-only fields are populated here.
    //
    //    **Source intent comes from the body** (Task 101B):
    //    `parsed.data.property` is the only signal for whether
    //    the user submitted a property inquiry form. The slug
    //    inside the block has already been format-validated by
    //    the schema; the catalog lookup is a separate concern
    //    that does NOT affect the source.
    //
    //    **Verified reference comes from `propertyContext`**:
    //    when the endpoint's catalog lookup succeeded, the
    //    reference is stamped on the lead; when it soft-failed
    //    (slug not in catalog, transient loader error), the
    //    reference is omitted and the lead carries only the
    //    source + the user-typed fields.
    //
    //    **Source/property invariant (Task 101C).** The
    //    `lead.property` field is gated on BOTH `isPropertyInquiry`
    //    AND `propertyContext`. A `contact` lead MUST NOT carry
    //    property metadata — even if a defensive `propertyContext`
    //    is supplied without a matching body intent, the
    //    reference is silently dropped. The matrix:
    //
    //    | isPropertyInquiry | propertyContext | lead.source     | lead.property |
    //    | ----------------- | ---------------- | ---------------- | ------------- |
    //    | ✓                 | ✓                | property_inquiry | stamped      |
    //    | ✓                 | ✗                | property_inquiry | omitted      |
    //    | ✗                 | ✓                | contact          | omitted      |
    //    | ✗                 | ✗                | contact          | omitted      |
    const isPropertyInquiry = parsed.data.property !== undefined
    const lead: Lead = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      source: isPropertyInquiry ? 'property_inquiry' : 'contact',
      name: parsed.data.name,
      email: parsed.data.email ?? '',
      phone: parsed.data.phone ?? '',
      message: parsed.data.message,
      locale: parsed.data.locale || ctx.fallbackLocale,
      // The property field is stamped ONLY when the body
      // signals a property inquiry AND a verified reference
      // exists. A defensive `propertyContext` without a
      // matching body intent is silently dropped so the
      // agency's downstream filters never see a hybrid
      // `contact` lead with property metadata.
      ...(isPropertyInquiry && propertyContext ? { property: propertyContext } : {}),
    }

    // 5. Delivery. The adapter is selected per-request via the
    //    active tenant's lead configuration (Task 106). When
    //    the contact endpoint threads a `tenantLeadsConfig`
    //    snapshot into the context, `getAdapter(snapshot)` reads
    //    the per-tenant `NUXT_LEADS_ADAPTER__<TENANT_ID>` (or the
    //    snapshot's `adapterId` field) and returns the matching
    //    adapter. The snapshot is then passed to the adapter
    //    through the input so the adapter reads the per-tenant
    //    URL / secret / SMTP credentials / from / to — never
    //    `useRuntimeConfig()`.
    //
    //    When the snapshot is absent (the single-tenant / no-tenant
    //    context path), the service falls back to the documented
    //    global config behavior.
    const adapter: LeadDeliveryAdapter = getAdapter(ctx.tenantLeadsConfig)
    const result = await adapter.deliver({ lead, tenantLeadsConfig: ctx.tenantLeadsConfig })

    if (result.ok) {
      return { status: 'ok', id: lead.id }
    }

    if (result.errorCode === 'disabled') {
      return { status: 'adapter_disabled' }
    }

    // transport / auth / rate_limited / unsupported all map to a
    // generic 502 at the endpoint level. The endpoint logs the
    // specific errorCode server-side; the client never sees it.
    return { status: 'delivery' }
  },
}

/* ------------------------------------------------------------------ *
 * Per-process rate limit
 * ------------------------------------------------------------------ */

/**
 * Module-level sliding-window rate limiter.
 *
 * **5 accepted attempts per 10 minutes per request key.** The key is
 * supplied by the endpoint and is opaque to the service (it should
 * be a stable per-connection value derived from the IP and
 * user-agent).
 *
 * **In-memory and per-process.** This is **not** distributed
 * protection. A multi-process deployment (PM2 cluster, Cloudflare
 * Workers isolates) shares no state between instances; a determined
 * attacker can multiply their effective rate by the number of
 * processes. The limit is a defense-in-depth layer for the MVP, not
 * a guarantee. A future v1.x task can move the rate limiter to a
 * Nitro storage driver backed by an external KV.
 *
 * **No setInterval.** The map is cleaned opportunistically during
 * each `checkRateLimit` call. A periodic timer is avoided because
 * it would prevent the process from exiting cleanly during local
 * development.
 *
 * **Counts only accepted submissions.** Validation failures,
 * honeypot trips, and rate-limited rejections do not consume budget
 * — the budget is the count of submissions that *would* be
 * delivered. A bot that posts invalid bodies still gets a 400 but
 * does not count against the window.
 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5

interface RateLimitEntry {
  /** Timestamps of accepted attempts within the window, ascending. */
  attempts: number[]
}

const rateLimitMap: Map<string, RateLimitEntry> = new Map()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS

  // Opportunistic global cleanup. While we have the lock on the map
  // we evict expired entries; the cap is small (one entry per
  // unique request key) and the operation is O(n) over the map,
  // which is fine at MVP scale.
  for (const [entryKey, entry] of rateLimitMap) {
    entry.attempts = entry.attempts.filter((t) => t > cutoff)
    if (entry.attempts.length === 0) {
      rateLimitMap.delete(entryKey)
    }
  }

  const existing = rateLimitMap.get(key)
  if (!existing) {
    rateLimitMap.set(key, { attempts: [now] })
    return true
  }
  if (existing.attempts.length >= RATE_LIMIT_MAX) {
    return false
  }
  existing.attempts.push(now)
  return true
}
