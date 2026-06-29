<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { PROPERTY_TYPE_OPTIONS } from '~/features/properties/constants/property-types'
import { homeLocations } from '~/features/home/data/locations'
import { homeTestimonials } from '~/features/home/data/testimonials'
import { homeStats } from '~/features/home/data/stats'
import { defaultSeoConfig } from '~/config/seo'

/**
 * Home page. Stays thin: it loads route-level data, sets SEO metadata and
 * composes home feature sections. All heavy UI and business logic live in the
 * section components and feature services.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
const route = useRoute()

const modules = computed(() => site.value.agency.modules)

// Static MVP data, resolved through the feature service so the source can be
// swapped for an API later without touching this page. The featured showcase
// is intentionally small (3 items) so it stays a single, scannable row on
// `xl` screens and aligns with the 3-column grid used by `PropertyGrid`.
const featuredProperties = propertiesService.getFeatured(3)
const categories = PROPERTY_TYPE_OPTIONS

// --- SEO ----------------------------------------------------------------
/**
 * SEO metadata is sourced from the agency config + i18n so a rebrand is a
 * single-file change. `defaultSeoConfig` (see `app/config/seo.ts`) provides
 * the structural defaults (twitter card type, fallback OG image) and the
 * agency config provides the brand-specific values (name, logo, contact).
 *
 * When `runtimeConfig.public.siteUrl` is set (via `NUXT_PUBLIC_SITE_URL`),
 * the page also emits a canonical link, an `og:url`, and absolute image
 * URLs. When it is empty (default for local development and pre-deployment),
 * the relative paths from the agency config are used as a graceful fallback
 * so the app still builds and renders meaningful metadata.
 */
const siteUrl = computed(() => config.public.siteUrl.replace(/\/+$/, ''))

/** Convert a public-path or absolute URL to an absolute URL when possible. */
function toAbsoluteUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = siteUrl.value
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const seoTitle = computed(() =>
  t('home.seo.title', { agencyName: site.value.agency.name }),
)
const seoDescription = computed(() => t('home.seo.description'))

const canonicalUrl = computed(() => {
  const base = siteUrl.value
  if (!base) return null
  // `useRoute().path` already includes the leading slash; `siteUrl` has its
  // trailing slash stripped, so the concatenation is a clean absolute URL.
  return `${base}${route.path}`
})

const ogImage = computed(() => toAbsoluteUrl(site.value.agency.logo))
const twitterImage = computed(() => toAbsoluteUrl(site.value.agency.logo))

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogSiteName: () => site.value.agency.name,
  ogLocale: () => locale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard: defaultSeoConfig.twitterCard,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => twitterImage.value,
})

useHead({
  link: [
    // Emit the canonical link only when a base site URL is configured; when
    // it is empty we deliberately omit the tag instead of emitting a
    // self-referential relative URL that would confuse crawlers.
    ...(canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : []),
  ],
})

/**
 * JSON-LD structured data for the agency. Kept minimal and derived entirely
 * from existing config so a rebrand stays a one-file change. `sameAs` links
 * are normalized to absolute URLs (the stored values may omit the protocol).
 * `logo` and `image` are also made absolute when `siteUrl` is configured.
 */
const jsonLd = computed(() => {
  const agency = site.value.agency
  const sameAs = Object.values(agency.social)
    .filter((url): url is string => Boolean(url))
    .map(url => (url.startsWith('http') ? url : `https://${url}`))

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agency.name,
    logo: toAbsoluteUrl(agency.logo),
    image: toAbsoluteUrl(agency.logo),
    telephone: agency.contact.phone,
    email: agency.contact.email,
    address: agency.contact.address,
    sameAs,
    ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  }
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: () => JSON.stringify(jsonLd.value),
    },
  ],
})
</script>

<template>
  <div>
    <HomeHero />

    <HomePropertySearch v-if="modules.properties" />

    <HomeFeaturedProperties
      v-if="modules.properties"
      :properties="featuredProperties"
    />

    <HomeServices />

    <HomeCategories v-if="modules.properties" :categories="categories" />

    <HomeLocations v-if="modules.properties" :locations="homeLocations" />

    <HomeAbout :stats="homeStats" />

    <HomeTestimonials
      v-if="modules.testimonials"
      :testimonials="homeTestimonials"
    />

    <HomeContactCta v-if="modules.contact" />
  </div>
</template>
