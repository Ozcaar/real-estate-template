/**
 * Lead module — shared types.
 *
 * The public input contract (`LeadInput`) is intentionally a small subset
 * of what a contact form needs. Server-only fields (`id`, `receivedAt`,
 * `source`) are stamped by the lead service and never reach the client.
 *
 * `Lead` is the **stamped, internal** shape that the delivery adapter
 * receives. It is deliberately not derived from the input schema so
 * future input fields (consent, locale, source-specific metadata) can
 * be added without changing the delivery contract.
 */

export type LeadSource = 'contact'

export interface LeadInput {
  name: string
  email: string
  phone: string
  message: string
  /**
   * Honeypot. The visible form does not render this field for real
   * users; a real human never touches it. Any non-empty value at the
   * server boundary is a bot signal and the lead is silently dropped.
   */
  website: string
  /**
   * Optional locale override supplied by the form. Falls back to the
   * agency's `defaultLocale` when empty. Used only for the stored lead
   * record, never for delivery routing.
   */
  locale: string
}

export interface Lead {
  id: string
  receivedAt: string
  source: LeadSource
  name: string
  email: string
  phone: string
  message: string
  locale: string
}
