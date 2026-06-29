import type { SeoConfig } from '~/types/site.types'

/**
 * Structural SEO defaults. Human readable titles/descriptions come from i18n
 * and per-page metadata; this only holds branding/structural defaults that a
 * dedicated `useSeo` composable will consume in a later phase.
 *
 * `ogImage` is the absolute fallback used by `usePageSeo()` when neither a
 * page-specific image nor the agency logo is available. It points to a real
 * asset that ships with the template (the agency logo) so the fallback is
 * never a 404; agencies are expected to ship their own logo at this path.
 */
export const defaultSeoConfig: SeoConfig = {
  titleTemplate: '%s',
  ogImage: '/images/logo.svg',
  twitterCard: 'summary_large_image',
}
