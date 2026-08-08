<script setup lang="ts">
import type { Property } from '../types/property.types'

/**
 * Responsive grid of {@link PropertyCard}s. Presentational: receives the list
 * via props and renders an accessible empty state (i18n) when there is none.
 *
 * When the grid is empty and `clearFiltersHref` is provided, the empty state
 * also renders a "Clear filters" link to the supplied href so the user can
 * recover from a filter that yields no results without scrolling back to the
 * top of the page.
 */
withDefaults(
  defineProps<{
    properties: Property[]
    emptyMessage?: string
    clearFiltersHref?: string
    /**
     * Heading level passed down to every {@link PropertyCard}. Defaults
     * to `3` for the home-page "Featured properties" section (which
     * wraps the grid in an `<h2>` section title). The `/properties`
     * listing page passes `2` because the cards are direct children
     * of the `<h1>` page title and the listing has no h2 wrapper.
     */
    headingLevel?: 2 | 3
  }>(),
  {
    emptyMessage: undefined,
    clearFiltersHref: undefined,
    headingLevel: 3,
  },
)
</script>

<template>
  <div
    v-if="properties.length"
    class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
  >
    <PropertyCard
      v-for="property in properties"
      :key="property.id"
      :property="property"
      :heading-level="headingLevel"
    />
  </div>
  <div
    v-else
    class="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-muted)]"
  >
    <p>{{ emptyMessage ?? $t('common.empty') }}</p>
    <BaseButton
      v-if="clearFiltersHref"
      :to="clearFiltersHref"
      variant="ghost"
      size="sm"
      class="mt-4"
    >
      {{ $t('properties.filters.clear') }}
    </BaseButton>
  </div>
</template>
