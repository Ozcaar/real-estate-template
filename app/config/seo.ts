import type { SeoConfig } from '~/types/site.types'

/**
 * Structural SEO defaults. Human readable titles/descriptions come from i18n
 * and per-page metadata; this only holds branding/structural defaults that a
 * dedicated `useSeo` composable will consume in a later phase.
 */
export const defaultSeoConfig: SeoConfig = {
  titleTemplate: '%s',
  ogImage: '/images/og-default.jpg',
  twitterCard: 'summary_large_image',
}
