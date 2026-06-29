<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
type BadgeSize = 'sm' | 'md'

/**
 * Small label / status chip. Colors are derived entirely from theme tokens.
 * Brand variants are solid; status variants use a tinted (soft) background via
 * `color-mix` so they stay legible on any theme without dedicated foreground
 * tokens.
 */
const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant
    size?: BadgeSize
  }>(),
  {
    variant: 'neutral',
    size: 'sm',
  },
)

const variantStyles: Record<BadgeVariant, Record<string, string>> = {
  primary: { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' },
  secondary: { backgroundColor: 'var(--color-secondary)', color: 'var(--color-secondary-foreground)' },
  accent: { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-foreground)' },
  neutral: { backgroundColor: 'var(--color-surface-muted)', color: 'var(--color-foreground)' },
  success: { backgroundColor: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success)' },
  warning: { backgroundColor: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', color: 'var(--color-warning)' },
  error: { backgroundColor: 'color-mix(in srgb, var(--color-error) 14%, transparent)', color: 'var(--color-error)' },
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

const badgeStyle = computed(() => variantStyles[props.variant])
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-[var(--radius-full)] font-medium whitespace-nowrap"
    :class="sizeClasses[props.size]"
    :style="badgeStyle"
  >
    <slot />
  </span>
</template>
