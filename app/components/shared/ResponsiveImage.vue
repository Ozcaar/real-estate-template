<script setup lang="ts">
type ImageRatio = '1/1' | '4/3' | '3/2' | '16/9' | 'auto'
type ImageRounded = 'none' | 'md' | 'lg' | 'xl' | 'full'

/**
 * Responsive image wrapper around Nuxt Image with a consistent aspect ratio,
 * rounding and `object-cover` behavior to avoid layout shift. `alt` is required
 * for accessibility.
 */
const props = withDefaults(
  defineProps<{
    src: string
    alt: string
    ratio?: ImageRatio
    rounded?: ImageRounded
    sizes?: string
    loading?: 'lazy' | 'eager'
    fetchpriority?: 'high' | 'low' | 'auto'
  }>(),
  {
    ratio: '4/3',
    rounded: 'lg',
    sizes: undefined,
    loading: 'lazy',
    fetchpriority: 'auto',
  },
)

const ratioClasses: Record<ImageRatio, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/2': 'aspect-[3/2]',
  '16/9': 'aspect-video',
  auto: '',
}

const roundedClasses: Record<ImageRounded, string> = {
  none: '',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  full: 'rounded-[var(--radius-full)]',
}
</script>

<template>
  <div
    class="relative overflow-hidden bg-[var(--color-surface-muted)]"
    :class="[ratioClasses[props.ratio], roundedClasses[props.rounded]]"
  >
    <NuxtImg
      :src="src"
      :alt="alt"
      :sizes="sizes"
      :loading="loading"
      :fetchpriority="fetchpriority"
      class="h-full w-full object-cover"
    />
  </div>
</template>
