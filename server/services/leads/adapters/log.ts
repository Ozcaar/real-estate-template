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
 * booleans, the message length, and — for property inquiries —
 * the property slug + title (server-derived catalog metadata,
 * never client-supplied). It **never** logs name, email, phone,
 * message content, cookies, raw IP, or user-agent.
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
 *
 * **Property context.** For `source: 'property_inquiry'` leads the
 * log line includes the property slug + title so an operator can
 * filter the log stream by listing without having to join against
 * the property catalog. The slug + title are NOT PII — they are
 * public catalog metadata. The URL is intentionally omitted (the
 * catalog can be joined on the slug). The slug + title are
 * defensively escaped (slashes, spaces, double quotes) so the log
 * line stays well-formed even if a future task relaxes the slug
 * regex at the schema layer.
 */

/**
 * Escape a value for safe interpolation into a single-line log.
 * The transformation is intentionally conservative: backslashes
 * are doubled, double quotes are backslash-escaped, and control
 * characters are stripped to a single space. Newlines would
 * split a single log line into two and corrupt the structured
 * output; we collapse them to a space so a malicious catalog
 * value cannot inject a fake log line.
 */
function escapeForLog(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]+/g, ' ')
}

export const logAdapter: LeadDeliveryAdapter = {
  id: 'log',
  async deliver(input: LeadDeliveryInput): Promise<LeadDeliveryResult> {
    const { lead } = input
    const baseLine
      = `[lead] id=${lead.id} source=${lead.source} `
      + `hasName=${Boolean(lead.name)} hasEmail=${Boolean(lead.email)} `
      + `hasPhone=${Boolean(lead.phone)} messageLength=${lead.message.length}`
    const propertyLine = lead.property
      ? ` propertySlug=${escapeForLog(lead.property.slug)} propertyTitle="${escapeForLog(lead.property.title)}"`
      : ''
    console.info(baseLine + propertyLine)
    return { ok: true }
  },
}
