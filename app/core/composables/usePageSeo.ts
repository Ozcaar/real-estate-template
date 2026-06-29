import { computed, type MaybeRef, toValue } from 'vue'
import { useI18n, useRoute, useRuntimeConfig } from '#imports'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { defaultSeoConfig } from '~/config/seo'

/**
 * Page-level SEO helper.
 *
 * Centralizes the pieces of page SEO that are identical across every page:
 * site-URL normalization, the absolute-URL builder, the canonical URL,
 * the Open Graph / Twitter social images, the Twitter card default, the
 * active Open Graph locale, and the agency name used as `og:site_name`.
 *
 * This composable does **not** call `useSeoMeta` and does **not** call
 * `useHead`. Each page remains responsible for its own `useSeoMeta` and
 * canonical `useHead` calls so page-specific options (for example
 * `ogType: 'article'` on the property detail page, or the property's own
 * cover image as the social image) stay readable at the call site instead
 * of being hidden behind a generic option bag.
 *
 * JSON-LD is intentionally **not** included here — it is page-specific
 * (e.g. `RealEstateAgent` on the home page, `ItemList` / `RealEstateListing`
 * on the listing and detail pages) and should be emitted by each page
 * directly via its own `useHead({ script: [...] })` call.
 *
 * The composable is deliberately **not** added to the Nuxt auto-import
 * `imports.dirs` in `nuxt.config.ts`. Page SEO is a page-only concern;
 * keeping the explicit import prevents it from leaking into every
 * component's global scope.
 */
export interface UsePageSeoOptions {
  /**
   * Optional social image path. Accepts a string or a ref/computed so a
   * per-record page (e.g. the property detail page) can pass its own
   * `coverImage`. When omitted, the agency logo is used.
   */
  image?: MaybeRef<string | undefined>
}

export interface UsePageSeoResult {
  /**
   * The normalized site URL (`runtimeConfig.public.siteUrl` with any
   * trailing slash stripped). Empty string when not configured.
   */
  siteUrl: ReturnType<typeof computed<string>>
  /**
   * Convert a public path or absolute URL to an absolute URL when
   * possible. Returns the input unchanged when empty or already
   * absolute, or when no site URL is configured.
   */
  toAbsoluteUrl: (path: string) => string
  /**
   * Canonical URL for the current route (absolute, query string
   * preserved). `null` when no site URL is configured so callers can
   * skip the canonical link / `og:url` tags in that case.
   */
  canonicalUrl: ReturnType<typeof computed<string | null>>
  /**
   * Absolute social image URL for Open Graph. Falls back to the
   * `defaultSeoConfig.ogImage` placeholder when the resolved source
   * is empty.
   */
  ogImage: ReturnType<typeof computed<string>>
  /**
   * Absolute social image URL for Twitter. Falls back to the
   * `defaultSeoConfig.ogImage` placeholder when the resolved source
   * is empty.
   */
  twitterImage: ReturnType<typeof computed<string>>
  /**
   * Twitter card type. Sourced from `defaultSeoConfig.twitterCard` so a
   * single config change propagates to every page.
   */
  twitterCard: string
  /**
   * Open Graph locale. The short code (`en` / `es`) for now; a future
   * task can map this to the full BCP-47 form (`en_US`, `es_ES`).
   */
  ogLocale: ReturnType<typeof computed<string>>
  /**
   * Agency display name, used as the `og:site_name` value.
   */
  siteName: string
}

export function usePageSeo(options: UsePageSeoOptions = {}): UsePageSeoResult {
  const { locale } = useI18n()
  const route = useRoute()
  const config = useRuntimeConfig()
  const site = useSiteConfig()

  // Strip any trailing slash so concatenation with `route.path` (which
  // already starts with `/`) never produces `//`.
  const siteUrl = computed(() =>
    (config.public.siteUrl ?? '').replace(/\/+$/, ''),
  )

  function toAbsoluteUrl(path: string): string {
    if (!path) return path
    if (/^https?:\/\//i.test(path)) return path
    const base = siteUrl.value
    if (!base) return path
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
  }

  const canonicalUrl = computed(() => {
    const base = siteUrl.value
    if (!base) return null
    return `${base}${route.path}`
  })

  const imageSource = computed(() => toValue(options.image) ?? site.value.agency.logo)
  const ogImage = computed(() => toAbsoluteUrl(imageSource.value || defaultSeoConfig.ogImage))
  const twitterImage = computed(() => toAbsoluteUrl(imageSource.value || defaultSeoConfig.ogImage))

  return {
    siteUrl,
    toAbsoluteUrl,
    canonicalUrl,
    ogImage,
    twitterImage,
    twitterCard: defaultSeoConfig.twitterCard,
    ogLocale: computed(() => locale.value),
    siteName: site.value.agency.name,
  }
}
