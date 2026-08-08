<script setup lang="ts">
import { computed } from 'vue'
import type { Development, DevelopmentStatus } from '../types/development.types'

/**
 * Development card. Presentational only: it receives a typed
 * `Development` and never fetches data. Every optional field is guarded by
 * a `v-if` so a partial record renders gracefully.
 *
 * The card now deep-links to `/developments/[slug]`: the title is a
 * `NuxtLink` to the development's own page, and a primary "View details"
 * CTA duplicates that target for users who scan the card visually. The
 * secondary "Contact" CTA still routes to `/contact` for users who
 * would rather skip the detail page. Both targets are exposed via the
 * existing `BaseButton` `to` prop pattern.
 *
 * The `headingLevel` prop accepts 2 or 3 (default 3, matching the
 * behavior the M10 audit relied on for the home-page "Featured
 * developments" section). Callers that wrap the grid in a section
 * title (the home page) keep the default; a listing that lacks a
 * section wrapper can pass `:heading-level="2"` to maintain a valid
 * h1 → h2 heading hierarchy.
 */
const props = withDefaults(
  defineProps<{
    development: Development
    headingLevel?: 2 | 3
  }>(),
  { headingLevel: 3 },
)

const { t } = useI18n()
const site = useSiteConfig()

const statusLabelKey = computed<`developments.status.${DevelopmentStatus}`>(() => {
  const map: Record<DevelopmentStatus, string> = {
    'pre-sale': 'developments.status.preSale',
    'under-construction': 'developments.status.underConstruction',
    'ready-to-deliver': 'developments.status.readyToDeliver',
    'sold-out': 'developments.status.soldOut',
  }
  return map[props.development.status] as `developments.status.${DevelopmentStatus}`
})

/**
 * Map a raw development status to a non-color-only `BaseBadge` variant.
 * Each variant is paired with a text label so meaning is never conveyed
 * by color alone (per the documented accessibility guideline).
 */
const statusVariant = computed<'accent' | 'primary' | 'success' | 'neutral'>(() => {
  switch (props.development.status) {
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

const currency = computed(() => props.development.currency ?? site.value.agency.currency)
const areaUnit = computed(() =>
  (props.development.sizeUnit ?? site.value.agency.measurementUnit) === 'imperial' ? 'ft²' : 'm²',
)

const hasPrice = computed(() => typeof props.development.priceFrom === 'number')
</script>

<template>
  <BaseCard
    padding="none"
    radius="lg"
    shadow="sm"
    class="flex h-full flex-col overflow-hidden"
  >
    <template #media>
      <ResponsiveImage
        :src="development.image"
        :alt="development.name"
        ratio="3/2"
        rounded="none"
        sizes="100vw sm:50vw lg:33vw"
      />
    </template>

    <div class="flex flex-1 flex-col p-5">
      <div class="flex flex-wrap items-center gap-2">
        <BaseBadge :variant="statusVariant" size="sm">
          {{ t(statusLabelKey) }}
        </BaseBadge>
        <BaseBadge variant="neutral" size="sm">
          {{ development.location }}
        </BaseBadge>
      </div>

      <BaseHeading :level="headingLevel" size="md" class="mt-3">
        <NuxtLink
          :to="`/developments/${development.slug}`"
          class="hover:text-[var(--color-primary)]"
        >
          {{ development.name }}
        </NuxtLink>
      </BaseHeading>

      <p class="mt-2 text-sm text-[var(--color-muted)]">
        {{ development.description }}
      </p>

      <p
        v-if="hasPrice"
        class="mt-4 text-xl font-bold text-[var(--color-foreground)]"
      >
        <span class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {{ t('developments.card.from') }}
        </span>
        <CurrencyText
          :amount="development.priceFrom ?? 0"
          :currency="currency"
          class="ml-2"
        />
        <span
          v-if="development.priceTo && development.priceTo !== development.priceFrom"
          class="ml-2 text-sm font-normal text-[var(--color-muted)]"
        >
          –
          <CurrencyText
            :amount="development.priceTo"
            :currency="currency"
            class="ml-1"
          />
        </span>
      </p>
      <p
        v-else
        class="mt-4 text-sm italic text-[var(--color-muted)]"
      >
        {{ t('developments.card.priceOnRequest') }}
      </p>

      <ul
        v-if="development.units || development.bedrooms || development.areaFrom || development.deliveryDate"
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-foreground)]"
      >
        <li v-if="development.units" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:home-city-outline" size="sm" />
          <span>{{ t('developments.card.units', { count: development.units }) }}</span>
        </li>
        <li v-if="development.bedrooms" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:bed-outline" size="sm" />
          <span>{{ t('developments.card.bedrooms', { count: development.bedrooms }) }}</span>
        </li>
        <li v-if="development.areaFrom" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:ruler-square" size="sm" />
          <span>
            {{ development.areaTo && development.areaTo !== development.areaFrom
              ? t('developments.card.areaTo', { size: `${development.areaTo} ${areaUnit}` })
              : t('developments.card.areaFrom', { size: `${development.areaFrom} ${areaUnit}` }) }}
          </span>
        </li>
        <li v-if="development.deliveryDate" class="flex items-center gap-1.5">
          <BaseIcon name="mdi:calendar-clock-outline" size="sm" />
          <span>{{ t('developments.card.delivery') }}: {{ development.deliveryDate }}</span>
        </li>
      </ul>

      <div class="mt-auto flex flex-col gap-2 pt-4">
        <BaseButton
          :to="`/developments/${development.slug}`"
          size="md"
          block
        >
          {{ t('common.viewDetails') }}
        </BaseButton>
        <BaseButton to="/contact" size="md" block variant="outline">
          {{ t('common.contact') }}
        </BaseButton>
      </div>
    </div>
  </BaseCard>
</template>
