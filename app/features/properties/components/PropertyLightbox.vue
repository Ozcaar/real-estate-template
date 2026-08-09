<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, Keyboard } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/a11y'
import 'swiper/css/keyboard'

/**
 * Accessible fullscreen lightbox for the property gallery (Task 097,
 * v1.1.0 M14). The component is intentionally self-contained: it
 * receives the same `images` / `coverImage` / `title` shape that
 * `PropertyGallery` already exposes and an `initialIndex` so it can
 * open at the gallery's currently-visible slide. Navigation inside
 * the lightbox is reported back to the parent via the standard
 * `update:activeIndex` emit so the gallery's `activeIndex` (the
 * source of truth for the visible counter, the thumbnail
 * `aria-current`, and the Swiper's visual position after close)
 * stays in sync. The component does NOT change the property data
 * model and does NOT introduce any new dependency: the Swiper swipe
 * + A11y + Keyboard modules are the same ones the existing
 * carousel already uses.
 *
 * Behavior contract (every item maps to a Playwright regression
 * case in `tests/e2e/property-lightbox.spec.ts`):
 *
 *  - Opens on demand from a button-like trigger (the gallery's main
 *    image is wrapped in a real `<button type="button">` so keyboard
 *    users can reach it with Tab and activate it with Enter / Space).
 *  - Closes on Escape, on backdrop click, and on the close button.
 *    The dialog's main Swiper is constrained to `max-w-4xl`
 *    (56rem / 896px) and the Swiper container adds `px-4 py-2`
 *    padding so a wide viewport always has a genuinely clickable
 *    backdrop area on the left and right of the image — a real
 *    mouse click on the dark area calls the same `close()`
 *    handler as the close button. The Playwright regression
 *    test in `tests/e2e/property-lightbox.spec.ts` uses a real
 *    `page.mouse.click()` on the visible backdrop area to verify
 *    this contract.
 *  - Traps Tab focus inside the dialog while it is open. The
 *    Tab order is: close → previous → next → (back to close) for the
 *    single-image case, and adds the thumbnail strip on the multi
 *    case. Shift+Tab from the first focusable cycles to the last.
 *  - Restores focus to the trigger element on close (the image
 *    button the user clicked in the gallery).
 *  - Locks background scroll while open. The lock is applied with a
 *    small counter in `useState` so it composes with any other
 *    modal-style surface (a future gallery on /developments, a
 *    future admin dialog) without a head-style merge race.
 *  - Renders a `role="dialog" aria-modal="true"` element with a
 *    translated `aria-label`; the visible counter and the dialog
 *    label together give a screen reader user the same
 *    "Image 3 of 4" information a sighted user gets.
 *  - Reuses the Swiper v12 instance for swipe + drag + arrow-key
 *    navigation inside the lightbox. The Keyboard module is enabled
 *    unconditionally (the carousel's `onlyInViewport: true` is
 *    dropped here because the lightbox is always in the viewport).
 *  - Marks the inactive slides as `aria-hidden` so a screen reader
 *    does not read three copies of the alt text when the user
 *    reaches the dialog.
 *  - Honours `prefers-reduced-motion: reduce` the same way the
 *    carousel does (Swiper `speed: 0`).
 *
 * The lightbox is **always** rendered behind a `<Teleport to="body">`
 * so its `position: fixed` overlay is not clipped by any ancestor
 * that has `overflow: hidden` (the property gallery itself wraps
 * the Swiper in `overflow-hidden` to stop the slide transition from
 * causing horizontal document scrolling). The teleport is also
 * the right place for the `inert` / scroll-lock plumbing.
 */
const props = defineProps<{
  open: boolean
  images: string[]
  coverImage: string
  title: string
  initialIndex: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:activeIndex': [value: number]
}>()

const { t } = useI18n()

const displayImages = computed<string[]>(() => {
  if (props.images && props.images.length > 0) {
    return props.images
  }
  return [props.coverImage]
})

const hasMultiple = computed(() => displayImages.value.length > 1)

const total = computed(() => displayImages.value.length)

/**
 * The active slide inside the lightbox. Initialised from the
 * gallery's `initialIndex` at the moment the dialog opens, and
 * emitted back to the parent via `update:activeIndex` on every
 * slide change so the gallery's `activeIndex` (the source of
 * truth for the visible counter, the thumbnail `aria-current`,
 * and the Swiper's visual position after close) stays in sync.
 *
 * The emit goes through the component instance, not the DOM, so
 * it is unaffected by the `<Teleport to="body">` rendering. The
 * lightbox does not use a `v-model:active-index` round-trip
 * because it owns its own `activeIndex` after the initial open;
 * the emit is one-way (lightbox → parent) and the parent is
 * free to ignore it if it does not need the sync.
 */
const activeIndex = ref(0)
const swiperRef = ref<SwiperInstance | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)

/** Element that had focus before the dialog opened. Restored on close. */
const previouslyFocused = ref<HTMLElement | null>(null)

/**
 * Counter of open fullscreen lightboxes. Body scroll is locked when
 * the count is > 0. The counter pattern lets a future "open from
 * gallery AND from a video overlay" use case compose without a
 * head-style merge race against the mobile menu (which uses
 * `useHead({ htmlAttrs: { style: 'overflow:hidden' } })` on the
 * `<html>` element, a different target).
 */
const openCount = useState<number>('property-lightbox-open-count', () => 0)

/** Focusable-element selector for the focus trap. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableInDialog(): HTMLElement[] {
  const root = dialogRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

function close() {
  emit('update:open', false)
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  // The focus trap works in two layers:
  //
  //  1. If focus has somehow left the dialog (e.g. the user
  //     clicked a thumbnail in the carousel, then opened the
  //     lightbox — the focus restoration path puts focus on the
  //     close button, but a future regression could leave it
  //     elsewhere), pull it back to the first focusable on the
  //     very next Tab. The handler runs on `keydown`, so calling
  //     `preventDefault` stops the browser's default Tab from
  //     moving focus further out of the dialog.
  //  2. If focus is on the first / last focusable and the user
  //     presses Shift+Tab / Tab, wrap to the opposite end. The
  //     standard focus-trap pattern from `AppMobileMenu`.
  //
  // The lightbox does not use `inert` on the page background
  // (the layout is not modified), so the trap has to be
  // defensive: any Tab that would leave the dialog is
  // intercepted and the focus is pulled back in.
  const focusables = getFocusableInDialog()
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const inDialog = dialogRef.value?.contains(document.activeElement) ?? false
  const active = document.activeElement
  if (!inDialog) {
    // Focus has escaped the dialog. Pull it back to the first
    // focusable so the next Tab is inside the dialog.
    event.preventDefault()
    first.focus()
    return
  }
  if (event.shiftKey) {
    if (active === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }
})

const isOpen = toRef(props, 'open')

/**
 * Body scroll lock via the `useState` counter. We mutate
 * `document.body.style.overflow` directly (rather than through
 * `useHead({ htmlAttrs: { style: ... } })`) so we do not race with
 * the mobile menu's head-style merge on `<html>`. The two
 * surfaces target different elements and can coexist: when both
 * are open, the `<html>` element has `overflow:hidden` from the
 * mobile menu, AND the `<body>` element has `overflow:hidden` from
 * the lightbox counter. When the lightbox closes first, the body
 * is restored; the html remains locked by the mobile menu until
 * it too closes.
 */
function applyScrollLock() {
  if (typeof document === 'undefined') return
  if (openCount.value > 0) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

watch(
  isOpen,
  async (next) => {
    if (next) {
      const clamped = clampIndex(props.initialIndex)
      activeIndex.value = clamped
      openCount.value += 1
      applyScrollLock()
      previouslyFocused.value
        = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      // Place focus on the close button so Escape works
      // immediately and Tab enters the dialog at a predictable
      // spot. `nextTick` is enough for the teleport target to be
      // in the DOM.
      closeBtnRef.value?.focus()
      // Bring the Swiper to the captured initial slide. The
      // `initialSlide` prop is consumed on mount only, so we
      // also call `slideTo` to handle the "open the lightbox
      // while the gallery is already on slide 3" case (the
      // Swiper was just mounted with `initial-slide: 0`).
      // `runCallbacks: false` prevents `slideChange` from firing
      // here (the lightbox's `activeIndex` is the source of
      // truth and we just synced it from `initialIndex`; we do
      // not want the Swiper to overwrite it with the previous
      // `activeIndex`).
      swiperRef.value?.slideTo(clamped, 0, false)
    } else {
      const target = previouslyFocused.value
      previouslyFocused.value = null
      if (openCount.value > 0) openCount.value -= 1
      applyScrollLock()
      await nextTick()
      if (target && document.contains(target)) target.focus()
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  // If the component is torn down while the dialog is open (e.g.
  // the route changes mid-lightbox), make sure the body scroll
  // lock is released so the rest of the app does not stay
  // un-scrollable.
  if (openCount.value > 0) {
    openCount.value -= 1
    applyScrollLock()
  }
})

function clampIndex(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  const max = Math.max(0, total.value - 1)
  if (raw < 0) return 0
  if (raw > max) return max
  return Math.floor(raw)
}

const isFirst = computed(() => activeIndex.value <= 0)
const isLast = computed(() => activeIndex.value >= total.value - 1)

function onSwiper(swiper: SwiperInstance) {
  swiperRef.value = swiper
  activeIndex.value = swiper.activeIndex ?? 0
}

function onSlideChange(swiper: SwiperInstance) {
  const next = swiper.activeIndex ?? 0
  if (next !== activeIndex.value) {
    activeIndex.value = next
    // Emit to the parent so the gallery's `activeIndex` stays
    // in sync with the lightbox. The parent uses the value to
    // (a) drive the visible counter and thumbnail `aria-current`
    // while the lightbox is open, and (b) call
    // `slideTo(activeIndex.value, 0)` on close to snap the
    // Swiper's visual position to the last-viewed slide. The
    // emit goes through the component instance and is
    // unaffected by the `<Teleport to="body">` mounting.
    emit('update:activeIndex', next)
  }
}

function prev() {
  if (isFirst.value) return
  swiperRef.value?.slidePrev()
}

function next() {
  if (isLast.value) return
  swiperRef.value?.slideNext()
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

/**
 * Per-slide alt text. The `alt` on the rendered `<img>` is
 * "Image N of M: <title>" so a screen reader reaching the
 * current image gets both the position and the property
 * context. Inactive slides are still rendered (Swiper needs them
 * for the transition) but they are marked `aria-hidden="true"`
 * via the wrapper so a screen reader does not hear three copies
 * of the alt text.
 */
function imageAlt(index: number): string {
  return t('properties.detail.gallery.lightbox.imageAlt', {
    n: index + 1,
    total: total.value,
    title: props.title,
  })
}

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

const prefersReducedMotion = usePreferredReducedMotion()
const swiperSpeed = computed(() => (prefersReducedMotion.value === true ? 0 : 300))

const dialogLabel = computed(() =>
  t('properties.detail.gallery.lightbox.dialogLabel', { title: props.title }),
)
</script>

<template>
  <!--
    The Teleport target is `<body>` so the `position: fixed`
    overlay is not clipped by the gallery's own `overflow-hidden`
    container. The `v-if` keeps the dialog out of the DOM
    entirely when closed (no `display: none` trap, no leftover
    inert subtree). A `<Transition>` would also be valid here but
    the focus-restoration path is more predictable with a plain
    v-if / v-else + teleport pair.
  -->
  <Teleport to="body">
    <div
      v-if="open"
      ref="dialogRef"
      class="fixed inset-0 z-[100] flex flex-col bg-black/85 text-white"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogLabel"
      data-testid="property-lightbox"
    >
      <header class="relative z-10 flex items-center justify-end p-4">
        <button
          ref="closeBtnRef"
          type="button"
          :aria-label="t('properties.detail.gallery.lightbox.close')"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          data-testid="property-lightbox-close"
          @click="close"
        >
          <BaseIcon name="mdi:close" size="md" />
        </button>
      </header>

      <!--
        Main image area. The Swiper is rendered with
        `flex-1` so it fills the remaining vertical space. The
        `:initial-slide` is `activeIndex` at the moment of mount;
        the `watch` block on `props.open` also calls
        `swiperRef.value?.slideTo(activeIndex.value, 0, false)`
        to handle the case where the Swiper was just mounted
        (initial-slide is consumed on mount only).

        The Swiper's max-width is `max-w-4xl` (56rem / 896px)
        rather than the gallery's `max-w-6xl` (72rem / 1152px)
        so a wide viewport always has a genuinely clickable
        backdrop area on the left and right of the image. The
        `py-2` adds a small vertical gap between the image and
        the header / footer controls. Together these keep the
        "click on the dark area to close" affordance real for
        every viewport >= ~640px.

        Backdrop-click handling. The image-area container is a
        `flex flex-1` element that fills the dialog's available
        width. Its empty area (left and right of the centered
        Swiper) is the visible "dark area" a user clicks to
        close the lightbox. A click on the container itself
        fires the `@click="close"` handler; a click on the
        Swiper wrapper (the inner `<div class="w-full max-w-4xl"
        @click.stop>`) stops propagation so the Swiper's own
        navigation handlers are not preempted by a close. The
        `data-testid="property-lightbox-image-area"` is the
        stable target for the Playwright regression test.
      -->
      <div
        class="relative z-10 flex flex-1 items-center justify-center px-4 py-2"
        data-testid="property-lightbox-image-area"
        @click="close"
      >
        <div class="w-full max-w-4xl" @click.stop>
          <Swiper
            :modules="[A11y, Keyboard]"
            :slides-per-view="1"
            :space-between="0"
            :loop="false"
            :rewind="false"
            :keyboard="{ enabled: true, onlyInViewport: false }"
            :a11y="a11yOptions"
            :speed="swiperSpeed"
            :initial-slide="clampIndex(initialIndex)"
            class="w-full"
            data-testid="property-lightbox-swiper"
            @swiper="onSwiper"
            @slide-change="onSlideChange"
          >
          <SwiperSlide
            v-for="(src, index) in displayImages"
            :key="`lightbox:${src}:${index}`"
            :aria-hidden="index !== activeIndex ? 'true' : undefined"
            :data-testid="`property-lightbox-slide-${index}`"
          >
            <div class="flex h-full items-center justify-center">
              <ResponsiveImage
                :src="src"
                :alt="imageAlt(index)"
                ratio="auto"
                rounded="none"
                sizes="100vw"
                loading="eager"
                fetchpriority="high"
              />
            </div>
          </SwiperSlide>
          </Swiper>
        </div>
      </div>

      <!--
        Footer: previous / next controls + counter. Mirrors the
        existing carousel's controls so the user sees the same
        affordance in both contexts. Hidden when the gallery has
        a single image (no point in showing "previous" / "next"
        when there is nowhere to go).
      -->
      <footer
        v-if="hasMultiple"
        class="relative z-10 flex items-center justify-between gap-3 p-4"
      >
        <button
          type="button"
          :disabled="isFirst"
          :aria-label="t('properties.detail.gallery.previous')"
          class="inline-flex h-10 items-center gap-1 rounded-full bg-white/10 px-4 text-sm text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="property-lightbox-prev"
          @click="prev"
        >
          <BaseIcon name="mdi:chevron-left" size="sm" />
          <span>{{ t('properties.detail.gallery.previous') }}</span>
        </button>

        <!--
          The visible counter. No `aria-live` here: the screen
          reader announcement of "Image 3 of 4" comes from
          Swiper's `.swiper-notification` element (with
          `wrapperLiveRegion: true` by default) when the user
          navigates with a swipe or a prev/next click. Keyboard
          arrow keys inside the Swiper also trigger the same
          notification. A second `aria-live` on the counter
          would race with that announcement and has been
          deliberately avoided.
        -->
        <p
          class="text-sm text-white/80"
          data-testid="property-lightbox-counter"
        >
          {{ counterText }}
        </p>

        <button
          type="button"
          :disabled="isLast"
          :aria-label="t('properties.detail.gallery.next')"
          class="inline-flex h-10 items-center gap-1 rounded-full bg-white/10 px-4 text-sm text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="property-lightbox-next"
          @click="next"
        >
          <span>{{ t('properties.detail.gallery.next') }}</span>
          <BaseIcon name="mdi:chevron-right" size="sm" />
        </button>
      </footer>

      <!--
        Thumbnail strip in the lightbox. Mirrors the existing
        gallery's thumbnail strip so a user who wants to jump
        to a specific image has the same affordance in the
        lightbox as in the carousel. Hidden on a single-image
        gallery (no thumbnail strip in the carousel either).
      -->
      <div
        v-if="hasMultiple"
        class="relative z-10 flex flex-wrap justify-center gap-2 px-4 pb-4"
        :aria-label="t('properties.detail.gallery.thumbnails')"
      >
        <button
          v-for="(src, index) in displayImages"
          :key="`lightbox-thumb:${src}:${index}`"
          type="button"
          class="block overflow-hidden rounded-[var(--radius-md)] border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          :class="index === activeIndex
            ? 'border-white opacity-100'
            : 'border-transparent opacity-60 hover:opacity-100'"
          :aria-label="thumbLabel(index)"
          :aria-current="index === activeIndex ? 'true' : undefined"
          :data-testid="`property-lightbox-thumb-${index}`"
          @click="swiperRef?.slideTo(index)"
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
      </div>
    </div>
  </Teleport>
</template>
