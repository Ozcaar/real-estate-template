<script setup lang="ts">
import { computed } from 'vue'
import type { Property } from '../types/property.types'
import {
  operationTypeLabelKey,
  propertyTypeLabelKey,
  propertyStatusLabelKey,
} from '../constants/property-types'

/**
 * Image-first, theme-aware property card. Presentational only: it receives a
 * typed `property` and never fetches data. Visual hierarchy follows
 * `docs/DESIGN.md`: image → price → title → location → key features → details.
 *
 * The `headingLevel` prop lets the caller pick the semantic level of the
 * card title. The default (`3`) preserves the home-page behavior where
 * the cards sit under an `<h2>` section title (e.g. "Featured properties").
 * The `/properties` listing page passes `2` because it has no section
 * wrapper — the cards are direct children of the `<h1>` page title and
 * skipping straight to `<h3>` would break the heading hierarchy.
 */
const props = withDefaults(
  defineProps<{
    property: Property
    headingLevel?: 2 | 3
  }>(),
  { headingLevel: 3 },
)

const { t } = useI18n()
const site = useSiteConfig()

const detailLink = computed(() => `/properties/${props.property.slug}`)

const areaSize = computed(
  () => props.property.constructionSize ?? props.property.landSize,
)
const areaUnit = computed(() =>
  (props.property.sizeUnit ?? site.value.agency.measurementUnit) === 'imperial' ? 'ft²' : 'm²',
)

// Only surface a status chip when it adds information (not for plain
// "available"); map each status to a non-color-only, legible badge variant.
const statusVariant = computed(() => {
  switch (props.property.status) {
    case 'reserved':
      return 'warning'
    case 'sold':
    case 'rented':
      return 'neutral'
    default:
      return 'neutral'
  }
})
const showStatus = computed(() => props.property.status !== 'available')
</script>

<template>
  <BaseCard padding="none" radius="lg" shadow="sm" interactive class="group relative flex flex-col">
    <template #media>
      <div class="relative">
        <ResponsiveImage
          :src="property.coverImage"
          :alt="property.title"
          ratio="4/3"
          rounded="none"
          sizes="100vw sm:50vw xl:33vw"
        />
        <div class="absolute left-3 top-3 flex flex-wrap gap-2">
          <BaseBadge variant="primary" size="sm">
            {{ t(operationTypeLabelKey(property.operationType)) }}
          </BaseBadge>
          <BaseBadge v-if="showStatus" :variant="statusVariant" size="sm">
            {{ t(propertyStatusLabelKey(property.status)) }}
          </BaseBadge>
        </div>
      </div>
    </template>

    <div class="flex flex-1 flex-col p-5">
      <p class="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {{ t(propertyTypeLabelKey(property.propertyType)) }}
      </p>

      <p class="mt-1 text-xl font-bold text-[var(--color-foreground)]">
        <CurrencyText :amount="property.price" :currency="property.currency">
          <template v-if="property.operationType === 'rent'" #suffix>
            {{ t('properties.perMonth') }}
          </template>
        </CurrencyText>
      </p>

      <BaseHeading :level="headingLevel" size="md" class="mt-2">
        <NuxtLink
          :to="detailLink"
          class="after:absolute after:inset-0 after:content-[''] hover:text-[var(--color-primary)]"
        >
          {{ property.title }}
        </NuxtLink>
      </BaseHeading>

      <p class="mt-1 flex items-center gap-1 text-sm text-[var(--color-muted)]">
        <BaseIcon name="mdi:map-marker-outline" size="sm" />
        <span>{{ property.location }}, {{ property.city }}</span>
      </p>

      <ul
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-foreground)]"
      >
        <li v-if="property.bedrooms" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:bed-outline" size="sm" :label="t('properties.features.bedrooms')" />
          <span>{{ property.bedrooms }}</span>
        </li>
        <li v-if="property.bathrooms" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:shower" size="sm" :label="t('properties.features.bathrooms')" />
          <span>{{ property.bathrooms }}</span>
        </li>
        <li v-if="property.parkingSpaces" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:car-outline" size="sm" :label="t('properties.features.parking')" />
          <span>{{ property.parkingSpaces }}</span>
        </li>
        <li v-if="areaSize" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:ruler-square" size="sm" :label="t('properties.features.area')" />
          <span>{{ areaSize }} {{ areaUnit }}</span>
        </li>
      </ul>

      <span
        class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]"
      >
        {{ t('common.viewDetails') }}
        <BaseIcon name="mdi:arrow-right" size="sm" class="transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  </BaseCard>
</template>
