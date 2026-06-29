<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'

/**
 * Properties listing page (`/properties`).
 *
 * Thin route: it loads the visible property catalog through the documented
 * service, composes the reusable page header and {@link PropertyGrid}, and
 * sets page-level SEO metadata. No filtering, sorting, pagination, or map
 * view is implemented in this initial foundation — the grid renders the full
 * visible catalog so the route resolves correctly for every CTA that already
 * points to it (home hero, featured section "view all", home search submit,
 * location deep-links, etc.).
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
const route = useRoute()

const properties = propertiesService.getAll()

const propertiesCount = computed(() => properties.length)

// --- SEO ----------------------------------------------------------------
/**
 * Same pattern as the home page: agency + i18n for human-readable strings,
 * `runtimeConfig.public.siteUrl` for absolute URLs (canonical, `og:url`,
 * social image), and a graceful fallback to relative paths when the env
 * var is not configured. No JSON-LD here — a `CollectionPage` / `ItemList`
 * schema can be added later when filtering/pagination lands.
 */
const siteUrl = computed(() => config.public.siteUrl.replace(/\/+$/, ''))

function toAbsoluteUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = siteUrl.value
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const seoTitle = computed(() =>
  t('properties.seo.title', { agencyName: site.value.agency.name }),
)
const seoDescription = computed(() => t('properties.seo.description'))

const canonicalUrl = computed(() => {
  const base = siteUrl.value
  if (!base) return null
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
  twitterCard: 'summary_large_image',
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => twitterImage.value,
})

useHead({
  link: [
    ...(canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : []),
  ],
})

// Page-level helpers for the visible header.
const emptyMessage = computed(
  () => `${t('properties.empty.title')} — ${t('properties.empty.description')}`,
)
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('nav.properties')"
      :title="t('properties.page.title')"
      :subtitle="t('properties.page.subtitle')"
    />

    <p
      v-if="propertiesCount"
      class="mx-auto mt-6 max-w-5xl text-center text-sm text-[var(--color-muted)]"
    >
      {{ propertiesCount }}
    </p>

    <div class="mt-10">
      <PropertyGrid
        :properties="properties"
        :empty-message="emptyMessage"
      />
    </div>
  </BaseSection>
</template>
