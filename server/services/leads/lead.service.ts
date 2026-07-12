import { randomUUID } from 'node:crypto'
import { leadInputRefined } from '../../../app/features/leads/schemas/lead.schema'
import type { Lead } from '../../../app/features/leads/types/lead.types'
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
 *    to field paths.
 * 3. Per-process rate limit. Five accepted attempts per 10 minutes
 *    per request key. The key is opaque — a hash of the connection
 *    IP and the user-agent, when available. The map lives in
 *    module scope and is **not** distributed; see the rate-limit
 *    documentation below.
 * 4. Stamp the lead. Server-only fields (`id`, `receivedAt`,
 *    `source`) are added here. The raw IP and user-agent never
 *    reach the adapter.
 * 5. Delivery. The configured adapter (`disabled`, `log`, or
 *    `webhook`) receives the stamped lead and returns a
 *    `LeadDeliveryResult`. The result is mapped to a transport
 *    status that the endpoint turns into an HTTP response.
 *
 * **Privacy.** The service never logs name, email, phone, message
 * content, cookies, raw IP, or user-agent. Server logs (when emitted
 * by the `log` adapter) contain only the lead id, the source, the
 * presence flags, and the message length.
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
}

export interface LeadSubmitContext {
  /** Opaque request key, supplied by the endpoint. Used by the
   *  rate limiter. Should be a stable per-connection value (the
   *  endpoint derives it from the request IP and user-agent). */
  requestKey: string
  /** Optional locale fallback. The schema's `locale` field
   *  overrides this when present. */
  fallbackLocale: string
}

export const leadService = {
  async submit(
    { body }: LeadSubmitInput,
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

    // 2. Schema validation.
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
    const lead: Lead = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      source: 'contact',
      name: parsed.data.name,
      email: parsed.data.email ?? '',
      phone: parsed.data.phone ?? '',
      message: parsed.data.message,
      locale: parsed.data.locale || ctx.fallbackLocale,
    }

    // 5. Delivery.
    const adapter: LeadDeliveryAdapter = getAdapter()
    const result = await adapter.deliver({ lead })

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
