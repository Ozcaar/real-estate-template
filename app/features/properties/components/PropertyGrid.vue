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
  }>(),
  {
    emptyMessage: undefined,
    clearFiltersHref: undefined,
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
