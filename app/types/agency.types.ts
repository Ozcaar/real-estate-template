/**
 * Agency configuration.
 *
 * Holds everything that changes between real estate agencies: identity,
 * contact details, social links and which modules are enabled. This data must
 * never be hardcoded inside components — components read it through
 * `useSiteConfig()` or receive it via props.
 */

export type MeasurementUnit = 'metric' | 'imperial'

export interface AgencyContactConfig {
  phone: string
  whatsapp: string
  email: string
  address: string
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
}
