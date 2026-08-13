<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { PROPERTY_TYPE_OPTIONS } from '~/features/properties/constants/property-types'
import { homeLocations } from '~/features/home/data/locations'
import { homeTestimonials } from '~/features/home/data/testimonials'
import { homeStats } from '~/features/home/data/stats'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { agencyPostalAddress } from '~/core/utils/postal-address'

/**
 * Home page. Stays thin: it loads route-level data, sets SEO metadata and
 * composes home feature sections. All heavy UI and business logic live in the
 * section components and feature services.
 */
const { t } = useI18n()
const site = useSiteConfig()

const modules = computed(() => site.value.agency.modules)

/**
 * Property data source. Loaded through Nuxt's `useAsyncData` so SSR
 * awaits the adapter's `loadAll()` before rendering the markup.
 * `loadAll()` resolves to the bundled sample data when the configured
 * `NUXT_PROPERTIES_DATA_SOURCE` is `'static'` (the default) and to
 * the API response when the kind is `'api'` — the rest of the page
 * is source-agnostic. The `home:featured-properties` key is unique
 * to this page so the payload never collides with the listing /
 * detail pages' own loads.
 */
const { data: allProperties } = await useAsyncData(
  'home:featured-properties',
  () => propertiesService.loadAll(),
)

/**
 * Featured showcase. Three items — small enough to stay a single,
 * scannable row on `xl` screens and aligned with the 3-column
 * `PropertyGrid`. Reads from the loaded data so the showcase is
 * empty until `loadAll()` resolves; on the default static build
 * the resolve is on the next microtask so the SSR HTML already
 * carries the full markup.
 */
const featuredProperties = computed(() =>
  allProperties.value ? propertiesService.getFeatured(allProperties.value, 3) : [],
)
const categories = PROPERTY_TYPE_OPTIONS

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks (siteUrl, canonicalUrl, og/twitter image,
 * twitterCard, ogLocale, siteName) are sourced from the shared
 * `usePageSeo` composable so the boilerplate (trailing-slash strip,
 * absolute-URL helper, canonical pattern) lives in one place. This page
 * still owns the `useSeoMeta` call (for page-specific title/description
 * and `ogType: 'website'`) and the canonical `useHead` call.
 */
const { toAbsoluteUrl, canonicalUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

const seoTitle = computed(() =>
  t('home.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('home.seo.description'))

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
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
 * The `@id` is the agency home page URL so the contact page's
 * `mainEntity.RealEstateAgent` and this one resolve to the same node
 * in Google's knowledge graph. Page-specific on purpose — not part of
 * `usePageSeo`.
 */
const jsonLd = computed(() => {
  const agency = site.value.agency
  const sameAs = Object.values(agency.social)
    .filter((url): url is string => Boolean(url))
    .map(url => (url.startsWith('http') ? url : `https://${url}`))

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': toAbsoluteUrl('/'),
    name: agency.name,
    logo: toAbsoluteUrl(agency.logo),
    image: toAbsoluteUrl(agency.logo),
    telephone: agency.contact.phone,
    email: agency.contact.email,
    address: agencyPostalAddress(agency),
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
