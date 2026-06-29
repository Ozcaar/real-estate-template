<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '~/core/utils/currency-format'

/**
 * Renders a monetary amount formatted for the active locale. Generic and
 * business-agnostic: it receives the `amount` and `currency` via props (e.g.
 * from a property) and reads only the locale from i18n. An optional suffix slot
 * is useful for "/ month" style labels on rentals.
 */
const props = withDefaults(
  defineProps<{
    amount: number
    currency: string
    maximumFractionDigits?: number
  }>(),
  {
    maximumFractionDigits: 0,
  },
)

const { locale } = useI18n()

const formatted = computed(() =>
  formatCurrency(props.amount, {
    currency: props.currency,
    locale: locale.value,
    maximumFractionDigits: props.maximumFractionDigits,
  }),
)
</script>

<template>
  <span class="inline-flex items-baseline gap-1 whitespace-nowrap">
    <span>{{ formatted }}</span>
    <span v-if="$slots.suffix" class="text-sm font-normal text-[var(--color-muted)]">
      <slot name="suffix" />
    </span>
  </span>
</template>
