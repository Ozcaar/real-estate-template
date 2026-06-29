<script setup lang="ts">
type CardPadding = 'none' | 'sm' | 'md' | 'lg'
type CardShadow = 'none' | 'sm' | 'md' | 'lg'
type CardRadius = 'md' | 'lg' | 'xl'

/**
 * Themed surface card. The optional `media` slot renders edge-to-edge (no
 * padding) for image-first cards; the default slot is padded. All visual
 * tokens come from the active theme.
 */
const props = withDefaults(
  defineProps<{
    as?: string
    padding?: CardPadding
    shadow?: CardShadow
    radius?: CardRadius
    interactive?: boolean
  }>(),
  {
    as: 'div',
    padding: 'md',
    shadow: 'sm',
    radius: 'lg',
    interactive: false,
  },
)

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const shadowClasses: Record<CardShadow, string> = {
  none: '',
  sm: 'shadow-[var(--shadow-sm)]',
  md: 'shadow-[var(--shadow-md)]',
  lg: 'shadow-[var(--shadow-lg)]',
}

const radiusClasses: Record<CardRadius, string> = {
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
}
</script>

<template>
  <component
    :is="as"
    class="overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)]"
    :class="[
      radiusClasses[props.radius],
      shadowClasses[props.shadow],
      interactive ? 'transition-shadow duration-200 hover:shadow-[var(--shadow-md)]' : '',
    ]"
  >
    <div v-if="$slots.media">
      <slot name="media" />
    </div>
    <div v-if="$slots.default" :class="paddingClasses[props.padding]">
      <slot />
    </div>
  </component>
</template>
