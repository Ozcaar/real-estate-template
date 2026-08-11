import type { AgencyConfig } from '~/types/agency.types'
import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './agencies/default.agency'
import { validateAgencyConfig } from './agencies/agency.schema'
import { defaultI18nLocales } from '~/config/i18n'
import { resolveTheme, themes } from '~/themes'

/**
 * Build a {@link SiteConfig} from a validated {@link AgencyConfig}.
 *
 * The shared helper used both by the default `siteConfig` constant
 * and by the per-request tenant resolver in
 * `app/config/agencies/registry.ts`. Validation runs once per call
 * and format issues are surfaced via `console.warn` with a tag
 * prefix that identifies the agency id (so a misconfigured tenant
 * is easy to spot in the server logs).
 *
 * The `themes` registry and the i18n locale list are injected as
 * dependencies so the schema file stays decoupled from `~/themes`
 * and `nuxt.config.ts`. Strict failures throw a `ZodError`; format
 * issues are surfaced once per call via `console.warn`.
 */
export function buildSiteConfig(agency: AgencyConfig): SiteConfig {
  const { agency: validated, warnings } = validateAgencyConfig(agency, {
    themes,
    i18nLocales: defaultI18nLocales,
  })

  for (const warning of warnings) {
    console.warn(`[agency:${validated.id}] ${warning}`)
  }

  return {
    agency: validated,
    theme: resolveTheme(validated.theme),
  }
}

/**
 * The default site configuration.
 *
 * Bundled as the seed value for `useState('site-config')` so the
 * composable falls back to a known-good SiteConfig when the
 * tenancy plugin has not run (a unit test, a client-side context
 * before the plugin, or a `pnpm generate` static export). The
 * multi-tenant foundation in `app/config/agencies/registry.ts`
 * resolves the active agency per request on the server, so this
 * constant is only the **fallback**, not the runtime source of
 * truth.
 *
 * @see docs/REBRANDING.md for the step-by-step rebranding workflow.
 * @see app/config/agencies/registry.ts for the multi-tenant
 *   registry and the hostname-to-agency resolver.
 */
export const siteConfig: SiteConfig = buildSiteConfig(defaultAgencyConfig)
