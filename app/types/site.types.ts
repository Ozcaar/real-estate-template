import type { AgencyConfig, AgencyModulesConfig } from './agency.types'
import type { ThemeConfig } from './theme.types'

/**
 * The resolved site configuration consumed across the app: the active agency
 * plus its resolved theme tokens.
 */
export interface SiteConfig {
  agency: AgencyConfig
  theme: ThemeConfig
}

/**
 * A single navigation entry. `labelKey` is an i18n key (never raw text) and
 * `module` optionally ties the item to an agency module so navigation can be
 * filtered by what is enabled.
 */
export interface NavItem {
  labelKey: string
  to: string
  module?: keyof AgencyModulesConfig
}

/**
 * Non-textual SEO defaults. Human readable strings (titles, descriptions) live
 * in i18n; this only holds structural/branding defaults.
 */
export interface SeoConfig {
  /** Title template, `%s` is replaced by the page title. */
  titleTemplate: string
  /** Default Open Graph / fallback share image. */
  ogImage: string
  /** Twitter card type. */
  twitterCard: 'summary' | 'summary_large_image'
}
