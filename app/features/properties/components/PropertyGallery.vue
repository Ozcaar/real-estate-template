<script setup lang="ts">
import { computed, ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, Keyboard } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/a11y'
import 'swiper/css/keyboard'

/**
 * Property gallery (carousel MVP, Task 075).
 *
 * Replaces the static thumbnail strip with a Swiper 12 carousel while
 * preserving the contract of the previous implementation:
 *
 * - Same props: `images`, `coverImage`, `title`.
 * - Same `displayImages` behaviour: uses `images` when non-empty, falls
 *   back to `[coverImage]` when it is.
 * - Same cover-image fallback.
 * - Same single-image behaviour: a single image renders without
 *   thumbnails, arrows, or counter.
 * - Same first-image LCP contract: the SSR HTML contains the first
 *   image with `loading="eager"` and `fetchpriority="high"`.
 *
 * New in the carousel build:
 *
 * - Swipe and drag navigation (touch + mouse drag) via Swiper.
 * - Custom real `<button type="button">` previous and next controls
 *   that call `swiper.slidePrev()` / `swiper.slideNext()` directly.
 *   No loop, no rewind. The `disabled` attribute is set on the
 *   native `<button>` at the boundaries.
 * - Keyboard navigation (arrow keys) enabled only when the carousel is
 *   in the viewport (Swiper's `onlyInViewport: true`).
 * - A translated image counter ("Image 2 of 3") rendered as a plain
 *   `<p>` for sighted users. Swiper's own `aria-live` notification
 *   element (`wrapperLiveRegion: true` by default) is the single
 *   screen-reader announcement source — the visible counter has no
 *   `aria-live` so it does not compete with Swiper.
 * - The existing thumbnail strip is preserved as a custom `<ul>` of
 *   `<button>` elements. Clicking a thumbnail calls `swiper.slideTo(i)`
 *   and updates `aria-current="true"` on the active thumbnail.
 * - Swiper's A11y module is configured with the translated
 *   prev / next / first / last messages and a `slideLabelMessage`
 *   that uses Swiper's own `{{index}}` / `{{slidesLength}}`
 *   placeholders (NOT Vue-i18n placeholders — Swiper performs the
 *   replacement at runtime).
 * - `prefers-reduced-motion: reduce` sets Swiper's `speed` to 0 via
 *   VueUse's `usePreferredReducedMotion` composable.
 *
 * Swiper modules imported: `A11y`, `Keyboard`. The `Navigation`
 * module is NOT imported — the custom prev / next buttons call
 * `slidePrev()` / `slideNext()` directly. The `Thumbs`, `Pagination`,
 * `Autoplay`, `Zoom`, and modal-related modules are not imported.
 *
 * SSR / LCP strategy:
 *
 * - The first image is rendered in the SSR HTML via a `<ClientOnly>`
 *   `#fallback` slot. The slot is a plain `ResponsiveImage` with
 *   `loading="eager"` and `fetchpriority="high"`. After hydration the
 *   Swiper replaces it. The same URL is used on both sides, so the
 *   browser cache prevents a duplicate download.
 * - The gallery itself is NOT wrapped in `<ClientOnly>` — only the
 *   Swiper portion. The counter, custom prev / next controls and
 *   thumbnail strip are rendered on the server too (their state is
 *   the initial `activeIndex = 0`).
 * - When `hasMultiple` is false the Swiper is not rendered at all;
 *   the gallery falls back to a single `ResponsiveImage` with the
 *   LCP attributes.
 */
const props = defineProps<{
  images: string[]
  coverImage: string
  title: string
}>()

const { t } = useI18n()

const displayImages = computed<string[]>(() => {
  if (props.images && props.images.length > 0) {
    return props.images
  }
  return [props.coverImage]
})

const hasMultiple = computed(() => displayImages.value.length > 1)

// Main Swiper instance, captured on the `@swiper` event.
const swiperRef = ref<SwiperInstance | null>(null)

const activeIndex = ref(0)

const total = computed(() => displayImages.value.length)

const isFirst = computed(() => activeIndex.value <= 0)
const isLast = computed(() => activeIndex.value >= total.value - 1)

/**
 * A11y options passed to Swiper. The `slideLabelMessage` uses Swiper's
 * own `{{index}}` / `{{slidesLength}}` placeholder syntax — Swiper
 * performs the replacement at runtime. The i18n key stores the
 * template with Vue-i18n-style `{n}` and `{t}` placeholders (so the
 * `unplugin-vue-i18n` build step does not flag the message as raw
 * text); the component substitutes them with Swiper's `{{index}}` and
 * `{{slidesLength}}` at runtime before passing the string to Swiper.
 *
 * `itemRoleDescriptionMessage` is intentionally omitted: Swiper's
 * default behaviour sets the slide's `aria-label` to the
 * `slideLabelMessage` interpolated value (e.g. "Image 1 of 3"), which
 * is already a complete and unambiguous label. The parent carousel's
 * `aria-roledescription` (from `containerRoleDescriptionMessage`) tells
 * the screen reader this is a carousel, so no per-slide role
 * description is needed. This keeps the single live announcement
 * channel (Swiper's `swiper-notification` element) free of competing
 * role descriptions.
 */
const a11yOptions = computed(() => ({
  containerRoleDescriptionMessage: t('properties.detail.gallery.ariaLabel'),
  slideRole: 'group',
  prevSlideMessage: t('properties.detail.gallery.previous'),
  nextSlideMessage: t('properties.detail.gallery.next'),
  firstSlideMessage: t('properties.detail.gallery.first'),
  lastSlideMessage: t('properties.detail.gallery.last'),
  slideLabelMessage: t('properties.detail.gallery.slideLabel', {
    n: '{{index}}',
    t: '{{slidesLength}}',
  }),
}))

/**
 * `usePreferredReducedMotion` from VueUse is already wired via
 * `imports.dirs` in `nuxt.config.ts` (it appears in
 * `.nuxt/types/imports.d.ts`). When the user prefers reduced motion,
 * Swiper's transition speed is set to 0 so slide changes are
 * instantaneous; otherwise the default 300 ms transition is used.
 */
const prefersReducedMotion = usePreferredReducedMotion()
const swiperSpeed = computed(() => (prefersReducedMotion.value === true ? 0 : 300))

function onSwiper(swiper: SwiperInstance) {
  swiperRef.value = swiper
  activeIndex.value = swiper.activeIndex ?? 0
}

function onSlideChange(swiper: SwiperInstance) {
  activeIndex.value = swiper.activeIndex ?? 0
}

function goTo(index: number) {
  swiperRef.value?.slideTo(index)
}

function thumbLabel(index: number): string {
  return t('properties.detail.gallery.viewImage', {
    n: index + 1,
    total: total.value,
  })
}

const counterText = computed(() =>
  t('properties.detail.gallery.counter', {
    n: activeIndex.value + 1,
    total: total.value,
  }),
)
</script>

<template>
  <!--
    The root `<figure>` is a direct child of the property-detail
    `lg:grid-cols-2` grid. CSS grid items default to `min-width: auto`,
    which lets a child's intrinsic width (here: the Swiper's slides)
    expand the column beyond its `1fr` share and push the right column
    off-screen. `min-w-0` lets the grid item shrink to its content's
    minimum width; `w-full` + `max-w-full` force the gallery to fill the
    column without exceeding it. The same three classes are repeated
    on the Swiper wrapper and the `<Swiper>` root below — each level
    of the containment chain applies them so a single `display: contents`
    ancestor or a future refactor cannot silently remove them.
  -->
  <figure class="flex flex-col gap-3 min-w-0 w-full max-w-full">
    <!-- Single image: no Swiper, no controls, just the LCP image. -->
    <ResponsiveImage
      v-if="!hasMultiple"
      :src="displayImages[0]"
      :alt="title"
      ratio="4/3"
      rounded="xl"
      sizes="100vw lg:50vw"
      loading="eager"
      fetchpriority="high"
    />

    <!-- Multiple images: Swiper carousel with custom controls and thumbnails. -->
    <template v-else>
      <!--
        The wrapper around `<ClientOnly>` applies the same containment
        classes plus `overflow-hidden` so the Swiper's internal
        overflow (slides that extend slightly beyond the container
        during transitions) cannot cause horizontal document scrolling.
        The SSR fallback inside `<ClientOnly>` automatically inherits the
        same constrained width.
      -->
      <div class="w-full min-w-0 max-w-full overflow-hidden">
        <ClientOnly>
          <Swiper
            :modules="[A11y, Keyboard]"
            :slides-per-view="1"
            :space-between="0"
            :loop="false"
            :rewind="false"
            :keyboard="{ enabled: true, onlyInViewport: true }"
            :a11y="a11yOptions"
            :speed="swiperSpeed"
            :initial-slide="0"
            class="property-gallery-swiper w-full min-w-0 max-w-full overflow-hidden"
            @swiper="onSwiper"
            @slide-change="onSlideChange"
          >
            <SwiperSlide
              v-for="(src, index) in displayImages"
              :key="`${src}:${index}`"
            >
              <ResponsiveImage
                :src="src"
                :alt="title"
                ratio="4/3"
                rounded="xl"
                sizes="100vw lg:50vw"
                :loading="index === 0 ? 'eager' : 'lazy'"
                :fetchpriority="index === 0 ? 'high' : undefined"
              />
            </SwiperSlide>
          </Swiper>

          <!--
            SSR fallback: a plain first `ResponsiveImage` with the LCP
            attributes. After hydration the Swiper above replaces this DOM
            node. The browser cache prevents a duplicate download because
            both sides use the same `src`.
          -->
          <template #fallback>
            <ResponsiveImage
              :src="displayImages[0]"
              :alt="title"
              ratio="4/3"
              rounded="xl"
              sizes="100vw lg:50vw"
              loading="eager"
              fetchpriority="high"
            />
          </template>
        </ClientOnly>
      </div>

      <!-- Custom prev / next controls + visible counter. -->
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          :disabled="isFirst"
          :aria-label="t('properties.detail.gallery.previous')"
          class="inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          @click="swiperRef?.slidePrev()"
        >
          <BaseIcon name="mdi:chevron-left" size="sm" />
          <span>{{ t('properties.detail.gallery.previous') }}</span>
        </button>

        <!--
          Visible counter for sighted users. No `aria-live` here:
          Swiper's own `aria-live` notification element
          (`wrapperLiveRegion: true` by default) is the single screen
          reader announcement source, and a competing `aria-live` on
          the counter would race with it.
        -->
        <p class="text-sm text-[var(--color-muted)]">
          {{ counterText }}
        </p>

        <button
          type="button"
          :disabled="isLast"
          :aria-label="t('properties.detail.gallery.next')"
          class="inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          @click="swiperRef?.slideNext()"
        >
          <span>{{ t('properties.detail.gallery.next') }}</span>
          <BaseIcon name="mdi:chevron-right" size="sm" />
        </button>
      </div>

      <!-- Thumbnail strip: existing UX preserved. -->
      <ul
        class="flex flex-wrap gap-2"
        :aria-label="t('properties.detail.gallery.thumbnails')"
      >
        <li
          v-for="(src, index) in displayImages"
          :key="`thumb:${src}:${index}`"
        >
          <button
            type="button"
            class="block overflow-hidden rounded-[var(--radius-md)] border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            :class="index === activeIndex
              ? 'border-[var(--color-primary)] opacity-100'
              : 'border-transparent opacity-70 hover:opacity-100'"
            :aria-label="thumbLabel(index)"
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="goTo(index)"
          >
            <ResponsiveImage
              :src="src"
              alt=""
              ratio="1/1"
              rounded="none"
              sizes="80px"
              loading="lazy"
            />
          </button>
        </li>
      </ul>
    </template>
  </figure>
</template>
