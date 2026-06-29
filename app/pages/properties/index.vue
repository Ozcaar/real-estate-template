<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { operationTypeLabelKey, propertyTypeLabelKey } from '~/features/properties/constants/property-types'

/**
 * Properties listing page (`/properties`).
 *
 * Thin route: it reads optional `operation`, `type` and `location` query
 * params (matching the shape produced by `HomeSearchBar`, `HomeCategories`
 * and `HomeLocations`), filters the visible catalog through the documented
 * service, and composes the page header and {@link PropertyGrid}. When no
 * params are present it falls back to the full visible catalog.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
const route = useRoute()

/**
 * Coerce a raw `useRoute().query` value (which can be `string | string[] |
 * null | undefined`) into a single normalized string. Vue Router never
 * produces `string[]` for a single-param route, but the type allows it
 * (e.g. when navigating to a URL like `?type=house&type=apartment`), so we
 * guard against it explicitly.
 */
function pickQueryValue(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

const filters = computed(() => ({
  operation: pickQueryValue(route.query.operation),
  type: pickQueryValue(route.query.type),
  location: pickQueryValue(route.query.location),
}))

const totalVisible = computed(() => propertiesService.getAll().length)
const properties = computed(() => propertiesService.filter(filters.value))
const propertiesCount = computed(() => properties.value.length)
const isFiltered = computed(() => propertiesCount.value !== totalVisible.value)

// Build a localized, human-readable description of the active filters for
// the visible count line. Falls back to a plain count when no filter is
// active.
const activeFilterLabel = computed(() => {
  const parts: string[] = []
  const op = filters.value.operation
  const ty = filters.value.type
  const lo = filters.value.location
  if (op) parts.push(t(operationTypeLabelKey(op as 'sale' | 'rent')))
  if (ty) parts.push(t(propertyTypeLabelKey(ty as 'house' | 'apartment' | 'land' | 'commercial' | 'office')))
  if (lo) parts.push(lo)
  return parts.length ? parts.join(' · ') : ''
})

// --- SEO ----------------------------------------------------------------
/**
 * Same pattern as the home page: agency + i18n for human-readable strings,
 * `runtimeConfig.public.siteUrl` for absolute URLs (canonical, `og:url`,
 * social image), and a graceful fallback to relative paths when the env
 * var is not configured. The canonical URL intentionally drops the query
 * string so all filtered variants point to the canonical `/properties` URL.
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

    <div
      class="mx-auto mt-6 flex max-w-5xl flex-col items-center gap-2 text-center text-sm text-[var(--color-muted)] sm:flex-row sm:justify-center sm:gap-3"
    >
      <p>
        <span class="font-semibold text-[var(--color-foreground)]">{{ propertiesCount }}</span>
        <span v-if="isFiltered" class="ml-1">
          {{ t('properties.filters.activeLabel') }}
          <span v-if="activeFilterLabel" class="text-[var(--color-foreground)]"> · {{ activeFilterLabel }}</span>
        </span>
      </p>
      <BaseButton
        v-if="isFiltered"
        :to="route.path"
        variant="ghost"
        size="sm"
      >
        {{ t('properties.filters.clear') }}
      </BaseButton>
    </div>

    <div class="mt-10">
      <PropertyGrid
        :properties="properties"
        :empty-message="emptyMessage"
      />
    </div>
  </BaseSection>
</template>
