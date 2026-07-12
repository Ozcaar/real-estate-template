import type {
  LeadDeliveryAdapter,
  LeadDeliveryInput,
  LeadDeliveryResult,
} from '../delivery-adapter'

/**
 * Redacted log adapter.
 *
 * Writes a **single** `console.info` line per accepted lead. The
 * line carries only the lead id, the source, the field-presence
 * booleans, and the message length. It **never** logs name, email,
 * phone, message content, cookies, raw IP, or user-agent.
 *
 * The `log` adapter is the smallest adapter that works without an
 * external service. It is useful in development and in production
 * where the agency wants the contact form to be live but has not
 * yet wired a real destination. The webhook adapter is the right
 * choice for production; the log adapter is intentionally a
 * redacted, privacy-safe fallback.
 *
 * **No PII in the log line.** A real-estate agency that needs the
 * full lead should configure the webhook adapter and point it at a
 * destination that records the lead under the agency's own data
 * retention policy.
 */
export const logAdapter: LeadDeliveryAdapter = {
  id: 'log',
  async deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult> {
    const { lead } = input
    console.info(
      `[lead] id=${lead.id} source=${lead.source} `
      + `hasName=${Boolean(lead.name)} hasEmail=${Boolean(lead.email)} `
      + `hasPhone=${Boolean(lead.phone)} messageLength=${lead.message.length}`,
    )
    return { ok: true }
  },
}
