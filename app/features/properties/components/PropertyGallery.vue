<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Property gallery MVP.
 *
 * Renders a main image plus an accessible thumbnail strip when more than one
 * image is available. Consumes `Property.images` (the full photo set) and
 * falls back to `[Property.coverImage]` when the array is empty, so a record
 * that only declares a cover image still renders.
 *
 * Keyboard / a11y: each thumbnail is a real `<button type="button">` (Enter
 * and Space activate it for free) with a translated `aria-label` and an
 * `aria-current="true"` marker on the active one. The main image carries
 * the property title as `alt` text; thumbnails are decorative (`alt=""`)
 * because the wrapping button already names them.
 *
 * The main image is the LCP element of the detail page, so it always uses
 * `loading="eager"` + `fetchpriority="high"`. Thumbnails load lazily.
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

const activeIndex = ref(0)

// Reset the active image if the underlying image set changes (defensive: the
// detail page renders one property at a time, but this keeps the component
// safe if it is later reused with dynamic data).
watch(
  () => props.images,
  () => {
    activeIndex.value = 0
  },
)

const activeSrc = computed(
  () => displayImages.value[activeIndex.value] ?? props.coverImage,
)

function selectImage(index: number) {
  activeIndex.value = index
}

function thumbLabel(index: number) {
  return t('properties.detail.gallery.viewImage', {
    n: index + 1,
    total: displayImages.value.length,
  })
}
</script>

<template>
  <figure class="flex flex-col gap-3">
    <ResponsiveImage
      :src="activeSrc"
      :alt="title"
      ratio="4/3"
      rounded="xl"
      sizes="100vw lg:50vw"
      loading="eager"
      fetchpriority="high"
    />
    <ul
      v-if="hasMultiple"
      class="flex flex-wrap gap-2"
      :aria-label="t('properties.detail.gallery.thumbnails')"
    >
      <li v-for="(src, index) in displayImages" :key="src + ':' + index">
        <button
          type="button"
          class="block overflow-hidden rounded-[var(--radius-md)] border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          :class="index === activeIndex
            ? 'border-[var(--color-primary)] opacity-100'
            : 'border-transparent opacity-70 hover:opacity-100'"
          :aria-label="thumbLabel(index)"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="selectImage(index)"
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
  </figure>
</template>
