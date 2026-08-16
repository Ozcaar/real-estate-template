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

/**
 * Lead source. Distinguishes the general contact form from
 * property-scoped inquiries so delivery adapters (log / webhook /
 * email) can render the right context.
 *
 *  - `'contact'` — `/contact` page submission (no property context).
 *  - `'property_inquiry'` — `/properties/[slug]` inquiry form. The
 *    stamped lead carries an optional `property` reference derived
 *    server-side from a property-catalog lookup keyed on the
 *    body's `property.slug`. Client-supplied title / price / other
 *    metadata are NEVER trusted as authoritative.
 */
export type LeadSource = 'contact' | 'property_inquiry'

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
  /**
   * Optional property context. The form only sends the slug; the
   * server looks up the canonical property record and stamps the
   * delivered lead with a verified `PropertyReference`. A slug
   * that does not match any property in the catalog is accepted
   * (the schema validates the format) but produces a lead without
   * a `property` field — client-supplied metadata is never trusted
   * as authoritative.
   */
  property?: {
    slug: string
  }
}

/**
 * Server-stamped property reference attached to a
 * `source: 'property_inquiry'` lead. Every field here is derived
 * server-side from the property catalog; the client never supplies
 * the title, URL, or any other metadata directly.
 *
 *  - `slug` — canonical identifier (matches the `Property.slug`
 *    field). Stable, URL-safe, used by the agency to look up the
 *    listing.
 *  - `title` — server-derived from the catalog. Safe to render in
 *    emails and webhook payloads (no client-side forgery).
 *  - `url` — server-built path (e.g. `/properties/{slug}`). The
 *    delivery adapter can wrap it in an absolute URL by joining
 *    with the configured site URL; the reference itself stays a
 *    relative path so the catalog stays deployment-agnostic.
 */
export interface PropertyReference {
  slug: string
  title: string
  url: string
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
  /**
   * Property reference attached to a `source: 'property_inquiry'`
   * lead. Undefined for general contact submissions and for
   * property inquiries whose slug does not match any catalog
   * record. The field is omitted entirely (not set to `null`)
   * so the JSON shape matches the existing adapter contract
   * without breaking existing consumers.
   */
  property?: PropertyReference
}