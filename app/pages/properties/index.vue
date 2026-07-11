<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

// --- Mobile filter collapse -----------------------------------------------
/**
 * On mobile (`< sm`, i.e. viewport width below 640px), the filter form is
 * collapsed by default behind a "Filters" toggle button. On tablet and
 * desktop (`sm+`) the form is always visible and the toggle is hidden.
 *
 * The breakpoint is a `matchMedia('(max-width: 639px)')` listener, matching
 * Tailwind's `sm` breakpoint (640px).
 *
 * **SSR-safe defaults.** Both `isMobile` and `isFilterOpen` start as
 * `false`, so the SSR render — and the no-JS experience — always shows
 * the form. This is critical for users without JavaScript: the form is
 * always visible and always submits natively to `/properties` via its
 * `method="get"` + `action="/properties"` attributes. Without these
 * defaults, the form would be hidden in the SSR HTML (`v-show="false"`
 * via inline `style="display: none"`) and no-JS users on mobile would
 * see an empty page with no way to reach the form.
 *
 * After hydration, `onMounted` runs the media query and corrects the
 * state: on mobile, `isMobile` becomes `true` and the form collapses
 * (`v-show` re-evaluates to `false`); on `sm+`, `isMobile` stays
 * `false` and the form stays visible. This produces a brief
 * (~1-frame) flash on mobile where the form is visible before
 * collapsing, which is the inherent cost of the SSR + media-query
 * approach. Desktop has no flash: the form is visible from the first
 * paint through the last reactive update. The toggle button uses
 * `v-if="isMobile"` so it is not in the DOM on desktop (no
 * "toggle appears and disappears" flicker on first paint).
 *
 * The form's state (selected options, input values) is preserved across
 * collapse/expand because `v-show` toggles `display: none` rather than
 * removing the form from the DOM.
 */
const isFilterOpen = ref(false)

const activeFilterCount = computed(() => {
  let n = 0
  if (formOperation.value) n++
  if (formType.value) n++
  if (formLocation.value) n++
  if (formSort.value !== DEFAULT_SORT) n++
  return n
})

const MOBILE_MQ = '(max-width: 639px)'
const isMobile = ref(false)
let mq: MediaQueryList | null = null

function syncIsMobile(event: MediaQueryListEvent | MediaQueryList) {
  const mobile = event.matches
  isMobile.value = mobile
  // On a transition into the mobile breakpoint, collapse the form so
  // the user sees the post-hydration default (collapsed) on the next
  // paint. On a transition into the desktop breakpoint, leave the
  // toggle state alone — the toggle is hidden on desktop regardless, and
  // the form is always visible there.
  if (mobile) {
    isFilterOpen.value = false
  }
}

onMounted(() => {
  if (typeof window === 'undefined') return
  mq = window.matchMedia(MOBILE_MQ)
  syncIsMobile(mq)
  mq.addEventListener('change', syncIsMobile)
})

onBeforeUnmount(() => {
  if (mq) {
    mq.removeEventListener('change', syncIsMobile)
    mq = null
  }
})

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
    <SectionHeader align="center" :eyebrow="t('nav.properties')" :title="t('properties.page.title')"
      :subtitle="t('properties.page.subtitle')" />

    <button v-if="isMobile" type="button"
      class="mx-auto mt-8 mb-3 flex w-full max-w-5xl items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:hidden"
      :aria-expanded="isFilterOpen ? 'true' : 'false'" aria-controls="filter-form"
      @click="isFilterOpen = !isFilterOpen">
      <span>{{ activeFilterCount > 0 ? t('properties.filters.toggleCount', { count: activeFilterCount }) :
        t('properties.filters.toggle') }}</span>
      <BaseIcon :name="isFilterOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" size="sm" />
    </button>

    <form v-show="!isMobile || isFilterOpen" id="filter-form" method="get" action="/properties"
      class="mx-auto max-w-5xl sm:mt-8" @submit.prevent="applyFilters">
      <div class="grid grid-cols-1 items-end gap-y-3">

        <div class="flex gap-x-3">
          <div class="flex flex-col w-full gap-1">
            <label for="filter-operation" class="text-xs font-medium text-[var(--color-muted)]">
              {{ t('home.search.operationLabel') }}
            </label>
            <select id="filter-operation" v-model="formOperation" name="operation"
              class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
              <option value="">{{ t('home.search.anyOperation') }}</option>
              <option v-for="option in OPERATION_TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </div>

          <div class="flex flex-col w-full gap-1">
            <label for="filter-type" class="text-xs font-medium text-[var(--color-muted)]">
              {{ t('home.search.typeLabel') }}
            </label>
            <select id="filter-type" v-model="formType" name="type"
              class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
              <option value="">{{ t('home.search.anyType') }}</option>
              <option v-for="option in PROPERTY_TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </div>

          <div class="flex flex-col w-full gap-1">
            <label for="filter-location" class="text-xs font-medium text-[var(--color-muted)]">
              {{ t('home.search.locationLabel') }}
            </label>
            <input id="filter-location" v-model="formLocation" name="location" type="search"
              :placeholder="t('home.search.locationPlaceholder')"
              class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
          </div>
        </div>

        <div class="flex flex-col gap-1 mb-3 sm:col-span-2 lg:col-span-4">
          <label for="filter-sort" class="text-xs font-medium text-[var(--color-muted)]">
            {{ t('properties.sort.label') }}
          </label>
          <select id="filter-sort" v-model="formSort" name="sort"
            class="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
            <option value="featured">{{ t('properties.sort.featured') }}</option>
            <option value="price-asc">{{ t('properties.sort.priceAsc') }}</option>
            <option value="price-desc">{{ t('properties.sort.priceDesc') }}</option>
          </select>
        </div>

        <div class="sm:col-span-2 lg:col-span-4">
          <BaseButton type="submit" size="md" block>
            {{ t('home.search.submit') }}
          </BaseButton>
        </div>
      </div>
    </form>

    <div aria-live="polite"
      class="mx-auto mt-6 flex max-w-5xl flex-col items-center gap-2 text-center text-sm text-[var(--color-muted)] sm:flex-row sm:justify-center sm:gap-3">
      <p>
        <span class="font-semibold text-[var(--color-foreground)]">{{ propertiesCount }}</span>
        <span v-if="isFiltered" class="ml-1">
          {{ t('properties.filters.activeLabel') }}
          <span v-if="activeFilterLabel" class="text-[var(--color-foreground)]"> · {{ activeFilterLabel }}</span>
        </span>
      </p>
      <BaseButton v-if="isFiltered" :to="route.path" variant="ghost" size="sm">
        {{ t('properties.filters.clear') }}
      </BaseButton>
    </div>

    <div class="mt-10">
      <PropertyGrid :properties="properties" :empty-message="emptyMessage" :clear-filters-href="route.path" />
    </div>
  </BaseSection>
</template>
