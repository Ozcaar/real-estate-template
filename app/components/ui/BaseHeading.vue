<script setup lang="ts">
import { computed } from 'vue'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
type HeadingSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

/**
 * Typography helper. Renders a semantic `h1`–`h6` (controlled by `level`) while
 * letting visual size be set independently via `size`. Uses the theme heading
 * font token, or the serif token when `serif` is set (luxury/editorial themes).
 */
const props = withDefaults(
  defineProps<{
    level?: HeadingLevel
    size?: HeadingSize
    serif?: boolean
  }>(),
  {
    level: 2,
    size: undefined,
    serif: false,
  },
)

const sizeByLevel: Record<HeadingLevel, HeadingSize> = {
  1: '3xl',
  2: '2xl',
  3: 'xl',
  4: 'lg',
  5: 'md',
  6: 'sm',
}

const sizeClasses: Record<HeadingSize, string> = {
  sm: 'text-base font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-2xl font-bold',
  xl: 'text-3xl font-bold tracking-tight',
  '2xl': 'text-3xl font-bold tracking-tight sm:text-4xl',
  '3xl': 'text-4xl font-bold tracking-tight sm:text-5xl',
}

const tag = computed(() => `h${props.level}`)
const resolvedSize = computed(() => props.size ?? sizeByLevel[props.level])
const fontStyle = computed(() => ({
  fontFamily: props.serif ? 'var(--font-serif)' : 'var(--font-heading)',
}))
</script>

<template>
  <component :is="tag" :class="sizeClasses[resolvedSize]" :style="fontStyle">
    <slot />
  </component>
</template>
