<script setup lang="ts">
import type { Property } from '../types/property.types'

/**
 * Responsive grid of {@link PropertyCard}s. Presentational: receives the list
 * via props and renders an accessible empty state (i18n) when there is none.
 */
withDefaults(
  defineProps<{
    properties: Property[]
    emptyMessage?: string
  }>(),
  {
    emptyMessage: undefined,
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
  <p
    v-else
    class="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-muted)]"
  >
    {{ emptyMessage ?? $t('common.empty') }}
  </p>
</template>
