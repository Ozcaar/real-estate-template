/**
 * Agency configuration.
 *
 * Holds everything that changes between real estate agencies: identity,
 * contact details, social links and which modules are enabled. This data must
 * never be hardcoded inside components — components read it through
 * `useSiteConfig()` or receive it via props.
 */

export type MeasurementUnit = 'metric' | 'imperial'

/**
 * Optional schema.org `PostalAddress` companion for the agency contact
 * config. Every field is optional so a rebrand can supply as much or as
 * little as it has, and so an existing agency config that has not been
 * migrated keeps working without changes.
 *
 * The field names match the schema.org `PostalAddress` properties so
 * the JSON-LD builder can spread the object directly into a
 * `PostalAddress` payload without a rename step. The free-text
 * `AgencyContactConfig.address` is the source of truth for the visible
 * UI (footer and contact card); this object only drives the JSON-LD.
 */
export interface AgencyStructuredAddress {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

export interface AgencyContactConfig {
  phone: string
  whatsapp: string
  email: string
  /**
   * Free-text human-readable address. Required, unchanged, and still the
   * source of truth for the visible footer and contact-page address card.
   * The optional `structuredAddress` companion below drives the
   * `PostalAddress` JSON-LD emitted on the home, contact and about
   * pages — the two fields coexist.
   */
  address: string
  /**
   * Optional schema.org `PostalAddress` companion. When present and at
   * least one field is non-empty, the JSON-LD builder emits a
   * `PostalAddress` object on the three agency nodes. When absent or
   * empty, the builder falls back to the plain `address` string above
   * so a rebrand that has not migrated is unaffected.
   */
  structuredAddress?: AgencyStructuredAddress
  businessHours?: string
}

export interface AgencySocialConfig {
  facebook?: string
  instagram?: string
  linkedin?: string
  tiktok?: string
  youtube?: string
}

export interface AgencyModulesConfig {
  properties: boolean
  developments: boolean
  agents: boolean
  blog: boolean
  testimonials: boolean
  contact: boolean
}

/**
 * Lead capture configuration.
 *
 * `enabled` controls whether the visible `/contact` form is
 * interactive. When `false`, the form keeps the historical
 * placeholder behavior (visible notice + permanently disabled
 * submit). When `true`, the form posts to `POST /api/contact`.
 *
 * The active **delivery adapter** is selected at the server via
 * server-only runtime config (`NUXT_LEADS_ADAPTER`,
 * `NUXT_LEADS_WEBHOOK_URL`, `NUXT_LEADS_WEBHOOK_SECRET`). The
 * adapter is treated as **operational** server configuration, not
 * agency branding configuration, and intentionally does not live
 * on `AgencyConfig` — rebrand changes must never require touching
 * a delivery destination.
 */
export interface AgencyLeadsConfig {
  enabled: boolean
}

export interface AgencyConfig {
  /** Unique agency identifier. */
  id: string
  /** Agency display name. */
  name: string
  /** Optional short marketing slogan. */
  slogan?: string
  /** Logo path (served from `public/`). */
  logo: string
  /** Optional favicon path. */
  favicon?: string
  /** Id of the theme this agency uses. */
  theme: string
  /** Default locale code. */
  defaultLocale: string
  /** Locale codes the agency supports. */
  availableLocales: string[]
  /** ISO 4217 currency code used to format prices (e.g. `USD`, `MXN`). */
  currency: string
  /** Measurement unit used for areas. */
  measurementUnit: MeasurementUnit
  contact: AgencyContactConfig
  social: AgencySocialConfig
  modules: AgencyModulesConfig
  leads: AgencyLeadsConfig
}
