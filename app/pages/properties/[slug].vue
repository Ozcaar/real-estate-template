<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { propertyTypeLabelKey, operationTypeLabelKey } from '~/features/properties/constants/property-types'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'
import type { PropertyStatus } from '~/features/properties/types/property.types'

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

const property = computed(() =>
  slug.value ? propertiesService.getBySlug(slug.value) : undefined,
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

const related = computed(() => propertiesService.getRelated(p, 3))

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
</script>

<template>
  <article>
    <BaseSection spacing="lg">
      <div class="mb-6">
        <BaseButton
          to="/properties"
          variant="ghost"
          size="sm"
          class="-ml-3"
        >
          <template #default>
            <span class="inline-flex items-center gap-1">
              <BaseIcon name="mdi:arrow-left" size="sm" />
              {{ t('properties.detail.backToProperties') }}
            </span>
          </template>
        </BaseButton>
      </div>

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
        <BaseHeading :level="2" size="xl" id="related-heading" class="mb-6">
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
