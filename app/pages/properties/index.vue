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
import { paginate, parsePageParam } from '~/core/utils/paginate'

/**
 * Properties listing page (`/properties`).
 *
 * Thin route: it reads optional `operation`, `type`, `location`,
 * `sort` and `page` query params (matching the shape produced by
 * `HomeSearchBar`, `HomeCategories`, `HomeLocations` and
 * `BasePagination`), filters and sorts the visible catalog through the
 * documented service, paginates the result through a small generic
 * utility, and composes the page header, {@link PropertyGrid} and
 * {@link BasePagination}. When no params are present it falls back to
 * the full visible catalog sorted by `featured` first on page 1.
 *
 * **Pagination model.** The page reads `?page=` and runs it through
 * {@link parsePageParam} (which coerces missing / empty / zero /
 * negative / decimal / array / non-numeric values to `1`). The
 * effective page is then clamped inside {@link paginate} against the
 * resolved `totalPages`, so a `?page=99` on a 3-page result set
 * silently renders page 3 instead of 404 or an empty grid. The
 * component renders nothing when `totalPages <= 1` — for the current
 * 6-record placeholder catalog, no control is visible at all.
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

/** Number of properties per page. Standard for a 3-col property grid. */
const PAGE_SIZE = 12

const filters = computed(() => ({
  operation: pickQueryValue(route.query.operation),
  type: pickQueryValue(route.query.type),
  location: pickQueryValue(route.query.location),
}))

const formSort = ref<PropertySort>(DEFAULT_SORT)

const totalVisible = computed(() => propertiesService.getAll().length)

/**
 * Full filtered + sorted list, BEFORE pagination. `filteredCount` is
 * what the status line renders — the user always sees the total
 * number of matching properties, not just the count on the current
 * page. `propertiesService.filter()` is unchanged; pagination is a
 * page-layer concern.
 */
const filtered = computed(() => propertiesService.filter(filters.value, formSort.value))
const filteredCount = computed(() => filtered.value.length)

/**
 * Page number comes from the URL — there is no separate `formPage`
 * ref because the URL is the single source of truth. The form's
 * submit handler (`applyFilters`) builds a fresh query object that
 * does NOT include `page`, so submitting the form always resets to
 * page 1. The "Clear filters" button navigates to bare `/properties`
 * with no query, which also strips `?page=N`.
 */
const formPage = computed(() => parsePageParam(route.query.page))

const paginated = computed(() => paginate(filtered.value, formPage.value, PAGE_SIZE))
const properties = computed(() => paginated.value.items)
const currentPage = computed(() => paginated.value.page)
const totalPages = computed(() => paginated.value.totalPages)

const isFiltered = computed(() => filteredCount.value !== totalVisible.value)

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
 * **Hydration model.** Three independent booleans drive the markup:
 *
 * - `isHydrated` — flips to `true` from inside `onMounted`. It is `false`
 *   during SSR and during the brief window before the client takes over,
 *   so the SSR HTML never renders the mobile-only toggle and never
 *   hides the form. Without this gate, a JS-enabled mobile user would
 *   see a ~1-frame flash where the form is visible and the toggle is
 *   missing before the media query resolves.
 * - `isMobile` — bound to `window.matchMedia('(max-width: 639px)')`. It
 *   starts as `false` so SSR and no-JS clients always behave like a
 *   desktop viewport (form visible, no toggle). After hydration it
 *   reflects the real breakpoint and updates on every resize.
 * - `isFilterOpen` — drives the mobile-only collapse. It starts as
 *   `false` so post-hydration mobile users see a collapsed form with a
 *   visible toggle. Crossing the breakpoint into mobile from `sm+`
 *   resets it back to `false`; crossing back into `sm+` leaves the
 *   state alone because the form is always visible on `sm+` regardless
 *   of `isFilterOpen`.
 *
 * The form uses `v-show` (not `v-if`) so its DOM and selected values
 * are preserved when the form is collapsed and re-opened.
 *
 * **No-JavaScript fallback.** The `<form>` keeps its native
 * `method="get"` + `action="/properties"` attributes. On a no-JS
 * client `isHydrated` stays `false` forever, `isMobile` stays `false`,
 * the toggle button is never rendered, and the form is always visible
 * and natively submittable — exactly what the SSR HTML delivers.
 *
 * The toggle button is gated on `v-if="isHydrated && isMobile"` so it
 * is only in the DOM after the client has taken over AND the viewport
 * is in the mobile range. It never appears in the SSR HTML, so the
 * no-JS experience cannot land on a non-functional toggle.
 *
 * The breakpoint is `matchMedia('(max-width: 639px)')`, matching
 * Tailwind's `sm` breakpoint (640px).
 */
const isHydrated = ref(false)
const isFilterOpen = ref(false)
const isMobile = ref(false)

const activeFilterCount = computed(() => {
  let n = 0
  if (formOperation.value) n++
  if (formType.value) n++
  if (formLocation.value) n++
  if (formSort.value !== DEFAULT_SORT) n++
  return n
})

const MOBILE_MQ = '(max-width: 639px)'
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
  // Flip the hydration gate last so the first client-side render uses
  // the real `isMobile` value, not the SSR default.
  isHydrated.value = true
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
 * `ItemList` of the properties visible on the current page. Uses the
 * same `paginated` computed the page renders so the structured data
 * matches the visible cards. Positions are global, 1-based, and stable
 * across pages: `(currentPage - 1) * PAGE_SIZE + index + 1`. The
 * first item on page 2 (size 12) is position 13, the last item on
 * page 3 (with 6 items) is position 30, etc. The `agency.modules.properties`
 * gate is enforced by the route itself (the page is not rendered when
 * the module is disabled), so the JSON-LD can be emitted
 * unconditionally.
 */
const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: paginated.value.items.map((property, index) => ({
    '@type': 'ListItem',
    position: (currentPage.value - 1) * PAGE_SIZE + index + 1,
    url: toAbsoluteUrl(`/properties/${property.slug}`),
    name: property.title,
  })),
}))

useJsonLd(jsonLd)

/**
 * Query values that every generated `BasePagination` link must
 * preserve. The component itself drops `undefined` / `''` entries and
 * omits `?page=1`, so the caller is only responsible for stripping
 * the default sort (a small domain-specific decision the component
 * is not aware of). On the bare `/properties` URL this object is
 * empty and the component falls back to plain `?page=N` links.
 */
const preservedQuery = computed<Record<string, string | undefined>>(() => {
  const q: Record<string, string | undefined> = {}
  if (filters.value.operation) q.operation = filters.value.operation
  if (filters.value.type) q.type = filters.value.type
  if (filters.value.location) q.location = filters.value.location
  if (formSort.value !== DEFAULT_SORT) q.sort = formSort.value
  return q
})

// Page-level helpers for the visible header.
const emptyMessage = computed(
  () => `${t('properties.empty.title')} — ${t('properties.empty.description')}`,
)
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      :level="1"
      align="center"
      :eyebrow="t('nav.properties')"
      :title="t('properties.page.title')"
      :subtitle="t('properties.page.subtitle')"
    />

    <button
      v-if="isHydrated && isMobile"
      type="button"
      class="mx-auto mt-8 mb-3 flex w-full max-w-5xl items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:hidden"
      :aria-expanded="isFilterOpen ? 'true' : 'false'"
      aria-controls="filter-form"
      @click="isFilterOpen = !isFilterOpen"
    >
      <span>{{ activeFilterCount > 0 ? t('properties.filters.toggleCount', { count: activeFilterCount }) :
        t('properties.filters.toggle') }}</span>
      <BaseIcon :name="isFilterOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" size="sm" />
    </button>

    <form
      v-show="!isHydrated || !isMobile || isFilterOpen"
      id="filter-form"
      method="get"
      action="/properties"
      class="mx-auto max-w-5xl sm:mt-8"
      @submit.prevent="applyFilters"
    >
      <div class="grid grid-cols-1 items-end gap-y-3">

        <div class="flex gap-x-3">
          <div class="flex flex-col w-full gap-1">
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
              <option v-for="option in OPERATION_TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </div>

          <div class="flex flex-col w-full gap-1">
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
              <option v-for="option in PROPERTY_TYPE_OPTIONS" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </div>

          <div class="flex flex-col w-full gap-1">
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
        </div>

        <div class="flex flex-col gap-1 mb-3 sm:col-span-2 lg:col-span-4">
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

        <div class="sm:col-span-2 lg:col-span-4">
          <BaseButton type="submit" size="md" block>
            {{ t('home.search.submit') }}
          </BaseButton>
        </div>
      </div>
    </form>

    <div
      aria-live="polite"
      class="mx-auto mt-6 flex max-w-5xl flex-col items-center gap-2 text-center text-sm text-[var(--color-muted)] sm:flex-row sm:justify-center sm:gap-3"
    >
      <p>
        <span class="font-semibold text-[var(--color-foreground)]">{{ filteredCount }}</span>
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
      <PropertyGrid
        :properties="properties"
        :empty-message="emptyMessage"
        :clear-filters-href="route.path"
        :heading-level="2"
      />
    </div>

    <BasePagination
      :current-page="currentPage"
      :total-pages="totalPages"
      :base-path="route.path"
      :query="preservedQuery"
    />
  </BaseSection>
</template>
