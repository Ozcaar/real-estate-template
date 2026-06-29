<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { propertiesService, isPropertySort, type PropertySort } from '~/features/properties/services/properties.service'
import {
  OPERATION_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  operationTypeLabelKey,
  propertyTypeLabelKey,
} from '~/features/properties/constants/property-types'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'

/**
 * Properties listing page (`/properties`).
 *
 * Thin route: it reads optional `operation`, `type`, `location` and
 * `sort` query params (matching the shape produced by `HomeSearchBar`,
 * `HomeCategories` and `HomeLocations`), filters and sorts the visible
 * catalog through the documented service, and composes the page header
 * and {@link PropertyGrid}. When no params are present it falls back to
 * the full visible catalog sorted by `featured` first.
 */
const { t } = useI18n()
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

const DEFAULT_SORT: PropertySort = 'featured'

const filters = computed(() => ({
  operation: pickQueryValue(route.query.operation),
  type: pickQueryValue(route.query.type),
  location: pickQueryValue(route.query.location),
}))

const formSort = ref<PropertySort>(DEFAULT_SORT)

const totalVisible = computed(() => propertiesService.getAll().length)
const properties = computed(() => propertiesService.filter(filters.value, formSort.value))
const propertiesCount = computed(() => properties.value.length)
const isFiltered = computed(() => propertiesCount.value !== totalVisible.value)

// Build a localized, human-readable description of the active filters for
// the visible count line. Falls back to a plain count when no filter is
// active. The location value is the only field that displays raw user
// input (operation and type are enum values that resolve through i18n),
// so it is the only one that needs a defensive length cap to keep the
// status line visually clean for very long query strings.
const LOCATION_LABEL_MAX = 100
const activeFilterLabel = computed(() => {
  const parts: string[] = []
  const op = filters.value.operation
  const ty = filters.value.type
  const lo = filters.value.location
  if (op) parts.push(t(operationTypeLabelKey(op as 'sale' | 'rent')))
  if (ty) parts.push(t(propertyTypeLabelKey(ty as 'house' | 'apartment' | 'land' | 'commercial' | 'office')))
  if (lo) {
    parts.push(lo.length > LOCATION_LABEL_MAX
      ? `${lo.slice(0, LOCATION_LABEL_MAX)}…`
      : lo)
  }
  return parts.length ? parts.join(' · ') : ''
})

// --- Filter form --------------------------------------------------------
/**
 * Local form state for the in-page filter form. Pre-fills from the current
 * `route.query` (so the form always reflects the URL state) and re-syncs
 * whenever the query changes externally (e.g. when a deep link from the
 * home page navigates to a filtered URL). On submit, builds a query object
 * containing only non-empty / non-default values and pushes the bare
 * `/properties` path with that query. The filter and sort logic in
 * `propertiesService.filter` is unchanged — the form is a pure UI layer
 * over the existing query shape.
 *
 * The `<form>` is a real HTML form with `method="get"` and `action="/properties"`
 * so it still works without JavaScript (the browser will build the query
 * string from the named controls). The `@submit.prevent` handler is the
 * JS-only path that strips empty / default values for a cleaner URL.
 */
const formOperation = ref('')
const formType = ref('')
const formLocation = ref('')

function syncFormFromQuery() {
  formOperation.value = pickQueryValue(route.query.operation) ?? ''
  formType.value = pickQueryValue(route.query.type) ?? ''
  formLocation.value = pickQueryValue(route.query.location) ?? ''
  const sort = pickQueryValue(route.query.sort)
  formSort.value = isPropertySort(sort) ? sort : DEFAULT_SORT
}

syncFormFromQuery()
watch(() => route.query, syncFormFromQuery)

function applyFilters() {
  const query: Record<string, string> = {}
  if (formOperation.value) query.operation = formOperation.value
  if (formType.value) query.type = formType.value
  if (formLocation.value) query.location = formLocation.value
  if (formSort.value !== DEFAULT_SORT) query.sort = formSort.value
  navigateTo({ path: route.path, query })
}

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page owns
 * the `useSeoMeta` call (for the page-specific title/description) and
 * the canonical `useHead` call. The canonical URL intentionally drops the
 * query string so all filtered variants point to the canonical
 * `/properties` URL.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

const seoTitle = computed(() =>
  t('properties.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('properties.seo.description'))

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
    ...(canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : []),
  ],
})

// --- JSON-LD ------------------------------------------------------------
/**
 * `ItemList` of the visible properties. Uses the same `properties`
 * computed the page renders (`propertiesService.filter(filters.value)`)
 * so the structured data matches the visible cards. The `agency.modules.properties`
 * gate is enforced by the route itself (the page is not rendered when
 * the module is disabled), so the JSON-LD can be emitted unconditionally.
 */
const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: properties.value.map((property, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: toAbsoluteUrl(`/properties/${property.slug}`),
    name: property.title,
  })),
}))

useJsonLd(jsonLd)

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

    <form
      method="get"
      action="/properties"
      class="mx-auto mt-8 max-w-5xl"
      @submit.prevent="applyFilters"
    >
      <div class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="flex flex-col gap-1">
          <label
            for="filter-operation"
            class="text-xs font-medium text-[var(--color-muted)]"
          >
            {{ t('home.search.operationLabel') }}
          </label>
          <select
            id="filter-operation"
            v-model="formOperation"
            name="operation"
            class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="">{{ t('home.search.anyOperation') }}</option>
            <option
              v-for="option in OPERATION_TYPE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ t(option.labelKey) }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="filter-type"
            class="text-xs font-medium text-[var(--color-muted)]"
          >
            {{ t('home.search.typeLabel') }}
          </label>
          <select
            id="filter-type"
            v-model="formType"
            name="type"
            class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="">{{ t('home.search.anyType') }}</option>
            <option
              v-for="option in PROPERTY_TYPE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ t(option.labelKey) }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="filter-location"
            class="text-xs font-medium text-[var(--color-muted)]"
          >
            {{ t('home.search.locationLabel') }}
          </label>
          <input
            id="filter-location"
            v-model="formLocation"
            name="location"
            type="search"
            :placeholder="t('home.search.locationPlaceholder')"
            class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
        </div>

        <div>
          <BaseButton type="submit" size="md" block>
            {{ t('home.search.submit') }}
          </BaseButton>
        </div>

        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <label
            for="filter-sort"
            class="text-xs font-medium text-[var(--color-muted)]"
          >
            {{ t('properties.sort.label') }}
          </label>
          <select
            id="filter-sort"
            v-model="formSort"
            name="sort"
            class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="featured">{{ t('properties.sort.featured') }}</option>
            <option value="price-asc">{{ t('properties.sort.priceAsc') }}</option>
            <option value="price-desc">{{ t('properties.sort.priceDesc') }}</option>
          </select>
        </div>
      </div>
    </form>

    <div
      aria-live="polite"
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
        :clear-filters-href="route.path"
      />
    </div>
  </BaseSection>
</template>
