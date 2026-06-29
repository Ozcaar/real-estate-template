import type { SiteConfig } from '~/types/site.types'
import { siteConfig } from '~/config/site.config'

/**
 * Access the active site configuration (agency + theme).
 *
 * Backed by `useState` so the value is SSR-safe and can be replaced at runtime
 * in later phases (env / JSON / API driven multi-tenant) without changing the
 * components that consume it.
 */
export function useSiteConfig() {
  return useState<SiteConfig>('site-config', () => siteConfig)
}
