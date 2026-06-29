<script setup lang="ts">
import { computed } from 'vue'
import { propertiesService } from '~/features/properties/services/properties.service'
import { propertyTypeLabelKey, operationTypeLabelKey } from '~/features/properties/constants/property-types'

/**
 * Property detail page (`/properties/[slug]`).
 *
 * Thin route: it looks up the property by slug through the documented
 * service, raises a proper 404 when the slug is unknown or the property is
 * hidden, then composes a clean detail layout from existing primitives. No
 * gallery carousel, map, mortgage calculator, or inquiry form — those are
 * intentionally out of scope for this foundation.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
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
  site.value.agency.measurementUnit === 'imperial' ? 'ft²' : 'm²',
)

const featureRows = computed(() => [
  { key: 'bedrooms', value: p.bedrooms, icon: 'mdi:bed-outline', show: Boolean(p.bedrooms) },
  { key: 'bathrooms', value: p.bathrooms, icon: 'mdi:shower', show: Boolean(p.bathrooms) },
  { key: 'parking', value: p.parkingSpaces, icon: 'mdi:car-outline', show: Boolean(p.parkingSpaces) },
  { key: 'area', value: areaSize.value ? `${areaSize.value} ${areaUnit.value}` : null, icon: 'mdi:ruler-square', show: Boolean(areaSize.value) },
])

// --- SEO ----------------------------------------------------------------
/**
 * Property-specific SEO. Mirrors the home/listing-page pattern: agency +
 * i18n for human-readable strings, `runtimeConfig.public.siteUrl` for
 * absolute URLs, and a graceful fallback to relative paths when the env
 * var is not configured. The property's own cover image is used for
 * `og:image` / `twitter:image` so each listing has a unique share preview.
 */
const siteUrl = computed(() => config.public.siteUrl.replace(/\/+$/, ''))

function toAbsoluteUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = siteUrl.value
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const canonicalUrl = computed(() => {
  const base = siteUrl.value
  if (!base) return null
  return `${base}${route.path}`
})

const ogImage = computed(() => toAbsoluteUrl(p.coverImage))
const twitterImage = computed(() => toAbsoluteUrl(p.coverImage))

useSeoMeta({
  title: () => `${p.title} | ${site.value.agency.name}`,
  description: () => p.description,
  ogTitle: () => p.title,
  ogDescription: () => p.description,
  ogType: 'article',
  ogImage: () => ogImage.value,
  ogSiteName: () => site.value.agency.name,
  ogLocale: () => locale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard: 'summary_large_image',
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
        <ResponsiveImage
          :src="p.coverImage"
          :alt="p.title"
          ratio="4/3"
          rounded="xl"
          sizes="100vw lg:50vw"
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
    </BaseSection>
  </article>
</template>
