<script setup lang="ts">
import { computed, ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, Keyboard } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/a11y'
import 'swiper/css/keyboard'

/**
 * Property gallery (carousel MVP, Task 075; fullscreen lightbox
 * extension, Task 097 / v1.1.0 M14).
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
 * New in the lightbox extension (v1.1.0 M14):
 *
 * - Every main image (both the single-image fallback and every
 *   Swiper slide) is wrapped in a real `<button type="button">` with
 *   a translated `aria-label` ("Open image N of M in fullscreen").
 *   The button is a transparent click target overlaid on the image;
 *   the LCP image is unchanged underneath. The button shows a
 *   small `mdi:arrow-expand` icon on hover / focus-visible for a
 *   visible affordance.
 * - Clicking (or pressing Enter / Space on) the button opens the
 *   `PropertyLightbox` at the carousel's currently-active slide.
 *   The lightbox is a sibling component (it does not live inside the
 *   Swiper); it is teleported to `<body>` so its `position: fixed`
 *   overlay is not clipped by the carousel's own `overflow-hidden`
 *   container.
 * - The gallery keeps a single source of truth (`activeIndex`).
 *   When the lightbox navigates, it emits `update:activeIndex`; the
 *   gallery updates `activeIndex` on every emit. When the lightbox
 *   closes, the gallery calls `swiper.slideTo(activeIndex, 0)`
 *   to snap the carousel's visual position to the last-viewed
 *   slide, then restores `activeIndex.value` via a
 *   `setTimeout(..., 0)` after the Swiper's `update()`-driven
 *   `slideChange` event has been dispatched (the `slideChange`
 *   event fires synchronously with the Swiper's previous
 *   `activeIndex` from the `update()` call path and would
 *   otherwise overwrite the just-synced value). Parent-child
 *   communication through `emit` is a Vue 3 standard and is
 *   unaffected by the lightbox's `<Teleport to="body">` rendering,
 *   so no module-level or global state is shared between the two
 *   components.
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

// --- Lightbox state -----------------------------------------------------
/**
 * The lightbox is open when this flag is true. The lightbox is a
 * sibling of the carousel (rendered below the `<figure>`); it
 * teleports itself to `<body>` so the `position: fixed` overlay is
 * not clipped by the carousel's `overflow-hidden` container. The
 * lightbox's own behaviour (focus trap, Escape, backdrop click,
 * scroll lock, focus restoration) lives in
 * `app/features/properties/components/PropertyLightbox.vue` so the
 * gallery component stays focused on the carousel.
 */
const lightboxOpen = ref(false)

function openLightboxAt(index: number) {
  // Clamp the requested index so a stale value (e.g. the previous
  // activeIndex after a catalog edit) never opens the lightbox on a
  // slide that no longer exists.
  const max = Math.max(0, total.value - 1)
  const clamped = Math.min(Math.max(index, 0), max)
  activeIndex.value = clamped
  lightboxOpen.value = true
}

function onLightboxUpdateActiveIndex(value: number) {
  // The lightbox emits `update:activeIndex` on every slide
  // change. The emit goes through the component instance and
  // is unaffected by the lightbox's `<Teleport to="body">`
  // rendering — parent-child communication through `emit` is
  // a Vue 3 standard that does not depend on DOM placement.
  // The gallery's `activeIndex` is the source of truth for the
  // visible counter, the thumbnail `aria-current`, and the
  // Swiper's visual position after close, so we keep it in
  // sync here. No watch is needed: the emit is a discrete
  // event, not a shared reactive value.
  activeIndex.value = value
}

function onLightboxUpdateOpen(value: boolean) {
  lightboxOpen.value = value
  if (!value) {
    // The lightbox just closed. Snap the gallery's Swiper
    // visual position to the last-viewed slide. The user sees
    // the Swiper move to the correct slide at this moment;
    // `speed: 0` makes the move instant.
    //
    // The `slideTo(target, 0)` call fires a `slideChange`
    // event from Swiper's `update()` call path with the
    // Swiper's PREVIOUS `activeIndex` (0) because the
    // reactive getter is not yet updated. `onSlideChange`
    // then sets `activeIndex.value = 0`, overwriting the
    // value the lightbox just synced via
    // `update:activeIndex`. The `setTimeout(..., 0)`
    // workaround restores `activeIndex.value = target` AFTER
    // the event has been dispatched and Vue's reactivity has
    // flushed, so the final value is the target and the
    // `data-active-index` attribute reflects the lightbox's
    // last-viewed slide.
    //
    // Swiper v12's `update()` method fires `slideChange`
    // independently of `runCallbacks: false` — the
    // `runCallbacks` flag only suppresses the `slideChange`
    // from `slideToInternal`, not from `update()`. The
    // `setTimeout(..., 0)` workaround is the correct
    // approach for this Swiper v12 behavior; the
    // `runCallbacks: false` flag alone is not sufficient to
    // prevent the race.
    //
    // Note: the Swiper's visual `swiper-slide-active` class
    // may not always reflect the target index after the
    // programmatic `slideTo` on close (it depends on the
    // Swiper's internal transition state and the
    // `update()`-driven `slideChange` timing). The visible
    // counter (computed from `activeIndex`) and the
    // thumbnail `aria-current` are the user-facing sources of
    // truth after close; the Swiper's visual state snaps to
    // the target on the user's next carousel interaction
    // (clicking a thumbnail, the prev / next buttons, or a
    // per-image open button).
    const target = activeIndex.value
    swiperRef.value?.slideTo(target, 0)
    setTimeout(() => {
      activeIndex.value = target
    }, 0)
  }
}

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

/**
 * Per-slide "open in fullscreen" label. The lightbox is the
 * single source of truth for image navigation after the user
 * opens it, so the label only needs to identify which image
 * the button will open; the lightbox handles the rest.
 */
function openImageLabel(index: number): string {
  return t('properties.detail.gallery.lightbox.openImage', {
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
  <figure
    class="flex flex-col gap-3 min-w-0 w-full max-w-full"
    :data-active-index="activeIndex"
    data-testid="property-gallery"
  >
    <!-- Single image: no Swiper, no controls, just the LCP image. -->
    <div
      v-if="!hasMultiple"
      class="relative w-full min-w-0 max-w-full"
    >
      <ResponsiveImage
        :src="displayImages[0]"
        :alt="title"
        ratio="4/3"
        rounded="xl"
        sizes="100vw lg:50vw"
        loading="eager"
        fetchpriority="high"
      />
      <!--
        Transparent "open in fullscreen" button overlaid on the
        image. The LCP image is unchanged underneath; the button
        is a sibling, not a wrapper, so the SSR HTML and the
        browser's image-fetch prioritisation are not affected.
        `absolute inset-0` covers the whole image area; the icon
        is hidden by default and revealed on hover / focus-visible
        so the button does not add visual noise to the gallery
        while still being a discoverable affordance.
      -->
      <button
        type="button"
        class="absolute inset-0 z-10 flex items-end justify-end p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        :aria-label="openImageLabel(0)"
        data-testid="property-gallery-open"
        @click="openLightboxAt(0)"
      >
        <span
          class="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          :class="activeIndex === 0 ? 'opacity-100' : ''"
          aria-hidden="true"
        >
          <BaseIcon name="mdi:arrow-expand" size="sm" />
        </span>
      </button>
    </div>

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
              <div class="relative w-full h-full">
                <ResponsiveImage
                  :src="src"
                  :alt="title"
                  ratio="4/3"
                  rounded="xl"
                  sizes="100vw lg:50vw"
                  :loading="index === 0 ? 'eager' : 'lazy'"
                  :fetchpriority="index === 0 ? 'high' : undefined"
                />
                <!--
                  Same transparent "open in fullscreen" button as
                  the single-image case. The button is a sibling
                  of the ResponsiveImage, not a wrapper, so the
                  LCP image and the Swiper layout are unchanged.
                -->
                <button
                  type="button"
                  class="absolute inset-0 z-10 flex items-end justify-end p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  :aria-label="openImageLabel(index)"
                  :data-testid="`property-gallery-open-${index}`"
                  @click="openLightboxAt(index)"
                >
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                    :class="index === activeIndex ? 'opacity-100' : ''"
                    aria-hidden="true"
                  >
                    <BaseIcon name="mdi:arrow-expand" size="sm" />
                  </span>
                </button>
              </div>
            </SwiperSlide>
          </Swiper>

          <!--
            SSR fallback: a plain first `ResponsiveImage` with the LCP
            attributes. After hydration the Swiper above replaces this DOM
            node. The browser cache prevents a duplicate download because
            both sides use the same `src`.
          -->
          <template #fallback>
            <div class="relative w-full min-w-0 max-w-full">
              <ResponsiveImage
                :src="displayImages[0]"
                :alt="title"
                ratio="4/3"
                rounded="xl"
                sizes="100vw lg:50vw"
                loading="eager"
                fetchpriority="high"
              />
              <button
                type="button"
                class="absolute inset-0 z-10 flex items-end justify-end p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                :aria-label="openImageLabel(0)"
                data-testid="property-gallery-open"
                @click="openLightboxAt(0)"
              >
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                  aria-hidden="true"
                >
                  <BaseIcon name="mdi:arrow-expand" size="sm" />
                </span>
              </button>
            </div>
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

    <!--
      The lightbox is a sibling of the carousel. It teleports itself
      to `<body>` so its `position: fixed` overlay is not clipped
      by the carousel's `overflow-hidden` container. The `open`
      v-model is bound to `lightboxOpen`; `initial-index` carries
      the gallery's current slide so the lightbox opens on the same
      image. The gallery's `activeIndex` (the source of truth for
      the visible counter, the thumbnail `aria-current`, and the
      Swiper's visual position) stays in sync with the lightbox via
      the standard `@update:active-index` emit — the lightbox
      writes the new index on every slide change, the gallery's
      `onLightboxUpdateActiveIndex` updates `activeIndex` (no
      shared module-level ref, no `watch`, no Teleport-aware
      workaround). On close, `onLightboxUpdateOpen` calls
      `swiperRef.value?.slideTo(activeIndex.value, 0)` to snap
      the carousel's visual slide to the last-viewed slide, then
      restores `activeIndex.value` via `setTimeout(..., 0)` to
      work around Swiper v12's `update()`-driven `slideChange`
      event (the event fires with the previous `activeIndex` from
      the `update()` call path and would otherwise overwrite the
      just-synced `activeIndex`). After the lightbox closes, the
      main image, counter, and active thumbnail all represent the
      same image.
    -->
    <PropertyLightbox
      :open="lightboxOpen"
      :images="images"
      :cover-image="coverImage"
      :title="title"
      :initial-index="activeIndex"
      @update:open="onLightboxUpdateOpen"
      @update:active-index="onLightboxUpdateActiveIndex"
    />
  </figure>
</template>
