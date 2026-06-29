import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './agencies/default.agency'
import { resolveTheme } from '~/themes'

/**
 * The active agency for this deployment.
 *
 * Swap this import to rebrand the site for a different agency. In later phases
 * this can be resolved from environment variables, a JSON file or an API
 * without touching components.
 */
const activeAgency = defaultAgencyConfig

export const siteConfig: SiteConfig = {
  agency: activeAgency,
  theme: resolveTheme(activeAgency.theme),
}
