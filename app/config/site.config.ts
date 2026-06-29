import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './agencies/default.agency'
import { validateAgencyConfig } from './agencies/agency.schema'
import { defaultI18nLocales } from '~/config/i18n'
import { resolveTheme, themes } from '~/themes'

/**
 * The active agency for this deployment.
 *
 * Swap this import to rebrand the site for a different agency. In later phases
 * this can be resolved from environment variables, a JSON file or an API
 * without touching components.
 *
 * @see docs/REBRANDING.md for the step-by-step rebranding workflow.
 */
const activeAgency = defaultAgencyConfig

/**
 * Validate the active agency at module load. The `themes` registry and the
 * i18n locale list are injected as dependencies so the schema file stays
 * decoupled from `~/themes` and `nuxt.config.ts`. Strict failures throw a
 * `ZodError`; format issues are surfaced once via `console.warn` so a real
 * agency can see what to fix when rebranding.
 */
const { agency: validatedAgency, warnings } = validateAgencyConfig(activeAgency, {
  themes,
  i18nLocales: defaultI18nLocales,
})

for (const warning of warnings) {
  console.warn(`[agency] ${warning}`)
}

export const siteConfig: SiteConfig = {
  agency: validatedAgency,
  theme: resolveTheme(validatedAgency.theme),
}
