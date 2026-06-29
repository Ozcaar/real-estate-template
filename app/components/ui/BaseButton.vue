<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Theme-aware button primitive. Variants and sizes map to CSS theme tokens,
 * never to hardcoded brand colors.
 *
 * Renders in this priority:
 *  1. `<a>` when `href` is provided (external links, `tel:`, `mailto:`).
 *  2. `NuxtLink` when `to` is provided (internal navigation).
 *  3. native `<button>` otherwise (form actions).
 *
 * A single-root template avoids the Vue 3 fragment-component attribute
 * fallthrough problem, which silently drops non-prop attributes such as
 * `href` and can produce confusing runtime warnings.
 */
const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    to?: string
    href?: string
    target?: '_blank' | '_self' | '_parent' | '_top'
    rel?: string
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    to: undefined,
    href: undefined,
    target: undefined,
    rel: undefined,
    type: 'button',
    block: false,
    disabled: false,
  },
)

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90',
  secondary:
    'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:opacity-90',
  outline:
    'border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]',
  ghost:
    'bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-[opacity,background-color,color] duration-200 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  variantClasses[props.variant],
  sizeClasses[props.size],
  props.block ? 'w-full' : '',
])

// External links (`href` provided) default to safe `rel` attributes. Callers
// can override `rel` explicitly when needed.
const computedRel = computed(() => {
  if (props.rel) return props.rel
  if (props.target === '_blank') return 'noopener noreferrer'
  return undefined
})
</script>

<template>
  <a
    v-if="href"
    :href="href"
    :target="target"
    :rel="computedRel"
    :class="classes"
  >
    <slot />
  </a>
  <NuxtLink
    v-else-if="to"
    :to="to"
    :class="classes"
  >
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="disabled"
    :class="classes"
  >
    <slot />
  </button>
</template>
