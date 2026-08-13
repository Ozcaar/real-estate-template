<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { propertyTypeLabelKey, operationTypeLabelKey } from '~/features/properties/constants/property-types'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import type { PropertyStatus } from '~/features/properties/types/property.types'
import type { BreadcrumbItem } from '~/types/breadcrumb.types'

/**
 * Property detail page (`/properties/[slug]`).
 *
 * Thin route: it looks up the property by slug through the documented
 * service, raises a proper 404 when the slug is unknown or the property is
 * hidden, then composes a clean detail layout from existing primitives. The
 * media section uses `PropertyGallery` for the main photo set and a related-
 * properties section reuses `PropertyGrid` with results from
 * `propertiesService.getRelated`. A map, a mortgage calculator, and an
 * inquiry form are intentionally out of scope for this foundation.
 */
const { t } = useI18n()
const site = useSiteConfig()
const route = useRoute()

const slug = computed(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? raw[0] : raw
})

/**
 * Property data source. Loaded through Nuxt's `useAsyncData` so
 * SSR awaits the adapter's `loadAll()` before rendering the
 * markup. The `properties:detail` key is unique to this page; a
 * future per-property widget that wants its own key should prefix
 * the slug.
 */
const { data: allProperties } = await useAsyncData(
  'properties:detail',
  () => propertiesService.loadAll(),
)

const property = computed(() =>
  allProperties.value && slug.value
    ? propertiesService.getBySlug(allProperties.value, slug.value)
    : undefined,
)

if (!property.value) {
  throw createError({
    statusCode: 404,
    statusMessage: t('properties.detail.notFoundTitle'),
    fatal: true,
  })
}

// `property` is now guaranteed to be defined for the rest of the setup.
const p = property.value

const areaSize = computed(() => p.constructionSize ?? p.landSize)
const areaUnit = computed(() =>
  (p.sizeUnit ?? site.value.agency.measurementUnit) === 'imperial' ? 'ft²' : 'm²',
)

const related = computed(() =>
  allProperties.value
    ? propertiesService.getRelated(allProperties.value, p, 3)
    : [],
)

const featureRows = computed(() => [
  { key: 'bedrooms', value: p.bedrooms, icon: 'mdi:bed-outline', show: Boolean(p.bedrooms) },
  { key: 'bathrooms', value: p.bathrooms, icon: 'mdi:shower', show: Boolean(p.bathrooms) },
  { key: 'parking', value: p.parkingSpaces, icon: 'mdi:car-outline', show: Boolean(p.parkingSpaces) },
  { key: 'area', value: areaSize.value ? `${areaSize.value} ${areaUnit.value}` : null, icon: 'mdi:ruler-square', show: Boolean(areaSize.value) },
])

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page uses
 * the property's own `coverImage` as the social image so each listing has
 * a unique share preview, and uses `ogType: 'article'` (the only record
 * page in the app) so the social card is marked up correctly. The
 * `useSeoMeta` and canonical `useHead` calls stay page-level.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo({
  image: computed(() => p.coverImage),
})

useSeoMeta({
  title: () => `${p.title} | ${siteName}`,
  description: () => p.description,
  ogTitle: () => p.title,
  ogDescription: () => p.description,
  ogType: 'article',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
  twitterTitle: () => p.title,
  twitterDescription: () => p.description,
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
 * `RealEstateListing` schema for this property.
 *
 * The data model does not carry a structured `address` field (only
 * free-text `location` + `city` + `state` + `country`) and the agency
 * may not have reliable coordinates, so the schema deliberately omits
 * `address` and `geo` — emitting a vague `PostalAddress` or a guessed
 * geo coordinate would hurt SEO more than omitting them. When a future
 * task adds a structured `Property.address` (e.g. via a CMS), this
 * schema is the place to wire it in.
 *
 * The area unit for `floorSize` is resolved as
 * `property.sizeUnit ?? agency.measurementUnit` so a record can opt
 * out of the agency default (matching the per-record unit already
 * supported in the UI). The UN/CEFACT unit codes are `MTK` (m²) and
 * `FTK` (ft²).
 *
 * Availability is mapped from `PropertyStatus` to a schema.org
 * `ItemAvailability` value. The `hidden` branch is unreachable on
 * this page (the route returns 404 for hidden properties) but is
 * included for exhaustiveness.
 */
function mapStatusToSchemaAvailability(status: PropertyStatus): string {
  const map: Record<PropertyStatus, string> = {
    available: 'https://schema.org/InStock',
    reserved: 'https://schema.org/LimitedAvailability',
    sold: 'https://schema.org/SoldOut',
    rented: 'https://schema.org/SoldOut',
    hidden: 'https://schema.org/Discontinued',
  }
  return map[status]
}

const areaUnitCode = computed(() =>
  (p.sizeUnit ?? site.value.agency.measurementUnit) === 'imperial' ? 'FTK' : 'MTK',
)

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  ...(canonicalUrl.value ? { '@id': canonicalUrl.value } : {}),
  name: p.title,
  description: p.description,
  ...(canonicalUrl.value ? { url: canonicalUrl.value } : {}),
  image: toAbsoluteUrl(p.coverImage),
  offers: {
    '@type': 'Offer',
    price: p.price,
    priceCurrency: p.currency,
    availability: mapStatusToSchemaAvailability(p.status),
  },
  ...(p.bedrooms !== undefined ? { numberOfBedrooms: p.bedrooms } : {}),
  ...(p.bathrooms !== undefined ? { numberOfBathrooms: p.bathrooms } : {}),
  ...(p.constructionSize !== undefined
    ? {
        floorSize: {
          '@type': 'QuantitativeValue',
          value: p.constructionSize,
          unitCode: areaUnitCode.value,
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
 * `toAbsoluteUrl('/properties/${p.slug}')` (which itself returns the
 * relative path when `NUXT_PUBLIC_SITE_URL` is empty — matching the
 * `usePageSeo` contract).
 *
 * This is a third `<script type="application/ld+json">` block on the
 * page, registered through the same `useJsonLd` composable as the
 * `RealEstateListing` and the related-properties `ItemList` blocks. No
 * `@graph` wrapper is needed: Google parses multiple scripts on the
 * same page independently, and the `BreadcrumbList` is a distinct
 * schema.org entity from the listing and the related `ItemList`.
 */
const breadcrumbItems = computed<BreadcrumbItem[]>(() => [
  { label: t('nav.home'), to: '/' },
  { label: t('nav.properties'), to: '/properties' },
  { label: p.title },
])

const breadcrumbJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbItems.value.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: index === breadcrumbItems.value.length - 1
      ? (canonicalUrl.value ?? toAbsoluteUrl(`/properties/${p.slug}`))
      : toAbsoluteUrl(item.to ?? ''),
  })),
}))

useJsonLd(breadcrumbJsonLd)

// --- Related-properties JSON-LD -----------------------------------------
/**
 * `ItemList` of `ListItem` for the visible related properties section.
 * Mirrors the catalog page's pattern exactly — each `ListItem` carries a
 * `position` (1-N, matching the visible order), a canonical `url`, and
 * the property's `name` as the list title. The section is gated on
 * `related.length > 0` in the template, so when there are no related
 * properties the payload emits an empty `itemListElement: []` (a valid
 * but inert `ItemList` — Google handles empty lists gracefully). The
 * existing `RealEstateListing` payload is unaffected; the two scripts
 * share the head but have different top-level `@type`s and do not
 * collide. The `ListItem.url` values are the related property's own
 * canonical URLs (e.g. `/properties/{slug}`), distinct from the current
 * page's `RealEstateListing.url`.
 */
const relatedJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: related.value.map((property, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: toAbsoluteUrl(`/properties/${property.slug}`),
    name: property.title,
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
        <PropertyGallery
          :images="p.images"
          :cover-image="p.coverImage"
          :title="p.title"
        />

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <BaseBadge variant="primary" size="sm">
              {{ t(operationTypeLabelKey(p.operationType)) }}
            </BaseBadge>
            <BaseBadge variant="neutral" size="sm">
              {{ t(propertyTypeLabelKey(p.propertyType)) }}
            </BaseBadge>
          </div>

          <BaseHeading :level="1" size="3xl" class="mt-4">
            {{ p.title }}
          </BaseHeading>

          <p class="mt-2 flex items-center gap-1 text-sm text-[var(--color-muted)]">
            <BaseIcon name="mdi:map-marker-outline" size="sm" />
            <span>{{ p.location }}, {{ p.city }}, {{ p.state }}</span>
          </p>

          <p class="mt-6 text-3xl font-bold text-[var(--color-foreground)]">
            <CurrencyText :amount="p.price" :currency="p.currency">
              <template v-if="p.operationType === 'rent'" #suffix>
                {{ t('properties.perMonth') }}
              </template>
            </CurrencyText>
          </p>

          <dl
            v-if="featureRows.some(f => f.show)"
            class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
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
                    {{ t(`properties.detail.featuresLabels.${row.key}`) }}
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
            {{ t('properties.detail.description') }}
          </BaseHeading>
          <p class="text-base text-[var(--color-foreground)] sm:text-lg">
            {{ p.description }}
          </p>

          <div v-if="p.amenities.length" class="mt-10">
            <BaseHeading :level="2" size="xl" class="mb-4">
              {{ t('properties.detail.amenities') }}
            </BaseHeading>
            <ul class="flex flex-wrap gap-2">
              <li v-for="amenity in p.amenities" :key="amenity">
                <BaseBadge variant="neutral" size="md">
                  {{ amenity }}
                </BaseBadge>
              </li>
            </ul>
          </div>
        </div>

        <aside>
          <BaseCard padding="md" radius="lg" shadow="sm">
            <BaseHeading :level="3" size="md">
              {{ t('properties.detail.contactTitle') }}
            </BaseHeading>
            <p class="mt-2 text-sm text-[var(--color-muted)]">
              {{ t('properties.detail.contactDescription') }}
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
          {{ t('properties.detail.similar.title') }}
        </BaseHeading>
        <PropertyGrid
          :properties="related"
          :empty-message="t('properties.detail.similar.empty')"
        />
      </section>
    </BaseSection>
  </article>
</template>
