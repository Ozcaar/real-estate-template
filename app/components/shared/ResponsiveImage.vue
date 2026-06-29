<script setup lang="ts">
type ImageRatio = '1/1' | '4/3' | '3/2' | '16/9' | 'auto'
type ImageRounded = 'none' | 'md' | 'lg' | 'xl' | 'full'

/**
 * Responsive image wrapper around Nuxt Image with a consistent aspect ratio,
 * rounding and `object-cover` behavior to avoid layout shift. `alt` is required
 * for accessibility.
 *
 * ## Loading and fetch priority
 *
 * The wrapper exposes two props that together control how the browser fetches
 * the image. Both have safe defaults that work for the common case, but
 * above-the-fold LCP images should override both:
 *
 * - `loading` (default `'lazy'`) — `lazy` defers the network request until
 *   the image is near the viewport; `eager` starts the download immediately.
 *   Below-the-fold images (catalog cards, related properties, agents,
 *   testimonials, etc.) should keep the default `lazy` so the browser does
 *   not start downloading them until they scroll into view.
 * - `fetchpriority` (default `'auto'`) — `auto` lets the browser decide;
 *   `high` tells the browser the image is an LCP candidate and should be
 *   prioritized ahead of other resources; `low` de-prioritizes below-the-fold
 *   prefetch candidates.
 *
 * For LCP images (the home hero, the property detail cover, the future
 * development detail cover), set BOTH `loading="eager"` (to override the
 * wrapper's `lazy` default) and `fetchpriority="high"` (to override the
 * browser's `auto` default). The two attributes work together:
 * `fetchpriority="high"` tells the browser to start the request early,
 * `loading="eager"` tells the browser not to wait for the image to scroll
 * into view. See `docs/REBRANDING.md` Section 12 for the full LCP
 * pattern, the rationale, and the current call sites on the home hero
 * (`app/features/home/components/HomeHero.vue`) and the property detail
 * cover (wrapped by `app/features/properties/components/PropertyGallery.vue`).
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
