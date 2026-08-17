<script setup lang="ts">
import { computed } from 'vue'
import { developmentsService } from '~/features/developments/services/developments.service'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import type { DevelopmentStatus } from '~/features/developments/types/development.types'
import type { BreadcrumbItem } from '~/types/breadcrumb.types'

/**
 * Development detail page (`/developments/[slug]`).
 *
 * Thin route: it loads the development catalog through the documented
 * async service, looks up the development by slug, raises a proper 404
 * when the slug is unknown, then composes a clean detail layout from
 * existing primitives. The page follows the property / agent detail
 * pages' SEO contract (canonical, `ogType: 'article'`, the
 * development's own image as the social image, `Residence` +
 * `BreadcrumbList` JSON-LD). A related-developments section reuses
 * the development card through a `DevelopmentCard` component (one
 * card per related record, no separate grid component — the catalog
 * has at most a handful of developments, so a 3-card layout does
 * not need a dedicated primitive). A map, a unit availability
 * table, a mortgage calculator, and an inquiry form are intentionally
 * out of scope for this foundation.
 */
const { t } = useI18n()
const site = useSiteConfig()
const route = useRoute()

const slug = computed(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? raw[0] : raw
})

/**
 * Development data source. Loaded through Nuxt's `useAsyncData` so
 * SSR awaits the service's `loadAll()` before rendering the
 * markup. The `developments:detail` key is unique to this page; a
 * future per-development widget that wants its own key should
 * prefix the slug.
 */
const { data: allDevelopments } = await useAsyncData(
  'developments:detail',
  () => developmentsService.loadAll(),
)

const development = computed(() =>
  allDevelopments.value && slug.value
    ? developmentsService.getBySlug(allDevelopments.value, slug.value)
    : undefined,
)

if (!development.value) {
  throw createError({
    statusCode: 404,
    statusMessage: t('developments.detail.notFoundTitle'),
    fatal: true,
  })
}

// `development` is now guaranteed to be defined for the rest of the setup.
const d = development.value

const currency = computed(() => d.currency ?? site.value.agency.currency)
const areaUnit = computed(() =>
  (d.sizeUnit ?? site.value.agency.measurementUnit) === 'imperial' ? 'ft²' : 'm²',
)

const related = computed(() =>
  allDevelopments.value
    ? developmentsService.getRelated(allDevelopments.value, d, 3)
    : [],
)

/**
 * Map a development status to a human-readable label. The mapping is
 * kept inline (rather than on a shared helper) because the development
 * module has its own label namespace (`developments.status.*`) and the
 * `DevelopmentCard` already has the same inline map; promoting this to
 * a helper is a one-key-change either way.
 */
const statusLabelKey = computed<`developments.status.${DevelopmentStatus}`>(() => {
  const map: Record<DevelopmentStatus, string> = {
    'pre-sale': 'developments.status.preSale',
    'under-construction': 'developments.status.underConstruction',
    'ready-to-deliver': 'developments.status.readyToDeliver',
    'sold-out': 'developments.status.soldOut',
  }
  return map[d.status] as `developments.status.${DevelopmentStatus}`
})

/** A non-color-only badge variant for the status. */
const statusVariant = computed<'accent' | 'primary' | 'success' | 'neutral'>(() => {
  switch (d.status) {
    case 'pre-sale':
      return 'accent'
    case 'under-construction':
      return 'primary'
    case 'ready-to-deliver':
      return 'success'
    case 'sold-out':
    default:
      return 'neutral'
  }
})

/** Localized price range. The two values may be equal (single price) or omitted (price on request). */
const hasPrice = computed(() => typeof d.priceFrom === 'number')
const priceText = computed(() => {
  if (typeof d.priceFrom !== 'number') return null
  if (typeof d.priceTo === 'number' && d.priceTo !== d.priceFrom) {
    return { from: d.priceFrom, to: d.priceTo }
  }
  return { from: d.priceFrom, to: null as number | null }
})

/** Localized area range text. */
const areaText = computed(() => {
  if (typeof d.areaFrom !== 'number') return null
  if (typeof d.areaTo === 'number' && d.areaTo !== d.areaFrom) {
    return `${d.areaFrom} – ${d.areaTo} ${areaUnit.value}`
  }
  return `${d.areaFrom} ${areaUnit.value}`
})

/**
 * Detail rows. Each row maps a `features` i18n key to its icon and a
 * `show` predicate. The `<dl>` is gated on `featureRows.length` so a
 * record with no detail data renders a clean page with just the
 * description and the contact card.
 */
const featureRows = computed(() => [
  { key: 'status', icon: 'mdi:progress-tag', show: true, value: t(statusLabelKey.value) },
  { key: 'units', icon: 'mdi:home-city-outline', show: typeof d.units === 'number', value: t('developments.card.units', { count: d.units ?? 0 }) },
  { key: 'bedrooms', icon: 'mdi:bed-outline', show: typeof d.bedrooms === 'number', value: t('developments.card.bedrooms', { count: d.bedrooms ?? 0 }) },
  { key: 'area', icon: 'mdi:ruler-square', show: areaText.value !== null, value: areaText.value ?? '' },
  { key: 'delivery', icon: 'mdi:calendar-clock-outline', show: typeof d.deliveryDate === 'string', value: d.deliveryDate ?? '' },
])

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page uses
 * the development's own `image` as the social image so each project has
 * a unique share preview, and uses `ogType: 'article'` so the social
 * card is marked up correctly (matching the property detail page). The
 * `useSeoMeta` and canonical `useHead` calls stay page-level.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo({
  image: computed(() => d.image),
})

const seoTitle = computed(() => `${d.name} | ${siteName}`)
const seoDescription = computed(() => d.description)

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => d.name,
  ogDescription: () => d.description,
  ogType: 'article',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
  twitterTitle: () => d.name,
  twitterDescription: () => d.description,
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
 * `Residence` schema for the development. The schema.org type
 * `Residence` is a subclass of `Place` and is the documented match
 * for a multi-unit residential development (a building or a set of
 * buildings).
 *
 * **`Residence.address` is intentionally omitted.** The
 * `Development` model carries only a free-text `location` string
 * (e.g. `"Valle Oriente, Monterrey"`) and no structured `address`
 * field, so emitting the agency's own `PostalAddress` here would be
 * a factual mismatch — it would put the agency's office address on
 * the development node. The previous version of this page did emit
 * `address: agencyPostalAddress(site.value.agency)`, but a
 * development's `Residence` and an agency's office are distinct
 * `Place` nodes. Until the model grows a `Development.address`, the
 * field is omitted entirely. The visible location is still surfaced
 * via `containedInPlace.Place.name` (the documented schema.org
 * pattern for "this Residence is within that Place"), and via the
 * visible location chip on the page.
 *
 * **`containedInPlace` carries the development's own `location`.**
 * This is a free-text `name` on a `Place` — the same shape used by
 * Google's documentation for "place X is inside place Y" without
 * requiring a structured address on either side.
 *
 * **`numberOfAvailableAccommodation` is emitted only when `units` is
 * set.** Other unit-level fields (`petsAllowed`, `amenityFeature`,
 * etc.) are intentionally omitted: the model does not carry them
 * and emitting a hard-coded value would be worse than omitting.
 *
 * **`offers` uses `AggregateOffer` when a price range is known.**
 * Schema.org defines `AggregateOffer` for "When a single product /
 * service has multiple prices" — exactly the development's "from
 * X to Y" case. The fields used are:
 *
 *   - `lowPrice`  — `Development.priceFrom`
 *   - `highPrice` — `Development.priceTo`
 *   - `priceCurrency` — the resolved currency
 *   - `offerCount`   — the static catalog ships one offer range per
 *                      development, so this is a single value; the
 *                      field is included so consumers that expect
 *                      it (e.g. some Google rich-result testers) do
 *                      not see a missing required field.
 *
 * When only `priceFrom` is set (a single price, no upper bound), the
 * payload falls back to a plain `Offer` with `price` +
 * `priceCurrency`. When neither is set, the `offers` key is omitted
 * entirely (the visible UI already handles the "Price on request"
 * case via the `developments.card.priceOnRequest` copy).
 *
 * The previous version represented the range via
 * `Offer.price: priceFrom` plus
 * `eligibleQuantity: { '@type': 'QuantitativeValue', value: priceTo }`,
 * which is the wrong schema — `eligibleQuantity` describes how many
 * units of a thing a customer can buy, not an upper price bound. The
 * corrected representation is the documented `AggregateOffer`.
 */
const hasPriceRange = computed(
  () => typeof d.priceFrom === 'number' && typeof d.priceTo === 'number' && d.priceTo !== d.priceFrom,
)
const hasSinglePrice = computed(
  () => typeof d.priceFrom === 'number' && (typeof d.priceTo !== 'number' || d.priceTo === d.priceFrom),
)

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Residence',
  ...(canonicalUrl.value ? { '@id': canonicalUrl.value } : {}),
  name: d.name,
  description: d.description,
  ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  image: toAbsoluteUrl(d.image),
  containedInPlace: {
    '@type': 'Place',
    name: d.location,
  },
  ...(typeof d.units === 'number' ? { numberOfAvailableAccommodation: d.units } : {}),
  ...(hasPriceRange.value
    ? {
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: d.priceFrom,
          highPrice: d.priceTo,
          priceCurrency: currency.value,
          offerCount: 1,
        },
      }
    : hasSinglePrice.value
      ? {
          offers: {
            '@type': 'Offer',
            price: d.priceFrom,
            priceCurrency: currency.value,
          },
        }
      : {}),
}))

useJsonLd(jsonLd)

// --- Breadcrumb JSON-LD -------------------------------------------------
/**
 * `BreadcrumbList` schema for the visible breadcrumb trail. The list
 * mirrors the order, labels, and URLs of the `<SeoBreadcrumbs>` rendered
 * at the top of the page exactly. Positions are 1-based, ancestor
 * `item` URLs are absolute via `toAbsoluteUrl`, and the current page's
 * `item` is the page's own canonical URL with a defensive fallback to
 * `toAbsoluteUrl('/developments/${d.slug}')` (which itself returns the
 * relative path when `NUXT_PUBLIC_SITE_URL` is empty — matching the
 * `usePageSeo` contract).
 */
const breadcrumbItems = computed<BreadcrumbItem[]>(() => [
  { label: t('nav.home'), to: '/' },
  { label: t('nav.developments'), to: '/developments' },
  { label: d.name },
])

const breadcrumbJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbItems.value.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: index === breadcrumbItems.value.length - 1
      ? (canonicalUrl.value ?? toAbsoluteUrl(`/developments/${d.slug}`))
      : toAbsoluteUrl(item.to ?? ''),
  })),
}))

useJsonLd(breadcrumbJsonLd)

// --- Related-developments JSON-LD ---------------------------------------
/**
 * `ItemList` of `ListItem` for the visible related-developments section.
 * Mirrors the property detail page's pattern exactly — each `ListItem`
 * carries a `position` (1-N, matching the visible order), a canonical
 * `url`, and the development's `name` as the list title. The section
 * is gated on `related.length > 0` in the template, so when there are
 * no related developments the payload emits an empty `itemListElement: []`
 * (a valid but inert `ItemList` — Google handles empty lists gracefully).
 */
const relatedJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: related.value.map((development, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: toAbsoluteUrl(`/developments/${development.slug}`),
    name: development.name,
  })),
}))

useJsonLd(relatedJsonLd)
</script>

<template>
  <article>
    <BaseSection spacing="lg">
      <SeoBreadcrumbs
        :items="breadcrumbItems"
        class="mb-6"
      />

      <div class="grid items-start gap-10 lg:grid-cols-2">
        <ResponsiveImage
          :src="d.image"
          :alt="d.name"
          ratio="3/2"
          rounded="xl"
          sizes="100vw lg:50vw"
          loading="eager"
          fetchpriority="high"
        />

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge :variant="statusVariant" size="sm">
              {{ t(statusLabelKey) }}
            </BaseBadge>
            <BaseBadge variant="neutral" size="sm">
              {{ d.location }}
            </BaseBadge>
          </div>

          <BaseHeading :level="1" size="3xl" class="mt-4">
            {{ d.name }}
          </BaseHeading>

          <p v-if="hasPrice" class="mt-6 text-3xl font-bold text-[var(--color-foreground)]">
            <span class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
              {{ t('developments.card.from') }}
            </span>
            <CurrencyText
              :amount="priceText!.from"
              :currency="currency"
              class="ml-2"
            />
            <span
              v-if="priceText!.to"
              class="ml-2 text-base font-normal text-[var(--color-muted)]"
            >
              –
              <CurrencyText
                :amount="priceText!.to"
                :currency="currency"
                class="ml-1"
              />
            </span>
          </p>

          <dl
            v-if="featureRows.some(f => f.show)"
            class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <template v-for="row in featureRows" :key="row.key">
              <div v-if="row.show" class="flex items-start gap-2">
                <span
                  class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
                >
                  <BaseIcon :name="row.icon" size="md" />
                </span>
                <div>
                  <dt class="text-xs text-[var(--color-muted)]">
                    {{ t(`developments.detail.features.${row.key}`) }}
                  </dt>
                  <dd class="text-base font-semibold text-[var(--color-foreground)]">
                    {{ row.value }}
                  </dd>
                </div>
              </div>
            </template>
          </dl>
        </div>
      </div>

      <div class="mt-12 grid items-start gap-10 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <BaseHeading :level="2" size="xl" class="mb-4">
            {{ t('developments.detail.description') }}
          </BaseHeading>
          <p class="text-base text-[var(--color-foreground)] sm:text-lg">
            {{ d.description }}
          </p>
        </div>

        <aside>
          <BaseCard padding="md" radius="lg" shadow="sm">
            <BaseHeading :level="3" size="md">
              {{ t('developments.detail.contact.title', { name: d.name }) }}
            </BaseHeading>
            <p class="mt-2 text-sm text-[var(--color-muted)]">
              {{ t('developments.detail.contact.description') }}
            </p>
            <div class="mt-4 flex flex-col gap-2">
              <BaseButton to="/contact" size="md" block>
                {{ t('nav.contact') }}
              </BaseButton>
              <BaseButton
                v-if="site.agency.contact.phone"
                :href="`tel:${site.agency.contact.phone}`"
                size="md"
                variant="outline"
                block
              >
                <BaseIcon name="mdi:phone-outline" size="sm" />
                {{ site.agency.contact.phone }}
              </BaseButton>
            </div>
          </BaseCard>
        </aside>
      </div>

      <section
        v-if="related.length"
        aria-labelledby="related-heading"
        class="mt-12 border-t border-[var(--color-border)] pt-12"
      >
        <BaseHeading id="related-heading" :level="2" size="xl" class="mb-6">
          {{ t('developments.detail.similar.title') }}
        </BaseHeading>
        <div
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          <DevelopmentCard
            v-for="item in related"
            :key="item.id"
            :development="item"
            :heading-level="3"
          />
        </div>
      </section>
    </BaseSection>
  </article>
</template>
