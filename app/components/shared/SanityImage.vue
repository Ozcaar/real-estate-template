<script setup lang="ts">
import { computed } from 'vue'
import type { ImageSourceMeta } from '~/core/image/image-source'
import { buildSanityImageUrl } from '~/core/image/sanity-image-url'

type ImageRatio = '1/1' | '4/3' | '3/2' | '16/9' | 'auto'
type ImageRounded = 'none' | 'md' | 'lg' | 'xl' | 'full'

/**
 * Sanity-aware image wrapper (Task 130 — Hotspot / Crop-aware Images).
 *
 * Sibling to `app/components/shared/ResponsiveImage.vue`.
 * The two wrappers share the same visual contract (aspect
 * ratio, rounded corners, `object-cover`) but differ in how
 * they source the URL:
 *
 *  - `ResponsiveImage` accepts a plain `src: string` URL.
 *    Use it for static-asset images (`/images/...svg`,
 *    `/images/...jpg`), HTTP-API images (a remote URL), and
 *    generic-CMS images (a remote URL with no metadata).
 *    These sources never carry editorial hotspot / crop
 *    metadata, so the wrapper renders the URL as-is.
 *  - `SanityImage` accepts a `meta: ImageSourceMeta` carrying
 *    the Sanity asset reference, the editor-picked hotspot
 *    (`{ x, y, width, height }` — all four fields required
 *    by `@sanity/image-url`'s native `fit()` calculation), the
 *    editor-picked crop region, and the asset's intrinsic
 *    dimensions. The wrapper computes the Sanity CDN URL
 *    synchronously via the `@sanity/image-url` builder at
 *    `app/core/image/sanity-image-url.ts`, then renders the
 *    returned URL through the same `<NuxtImg>` chain as
 *    `ResponsiveImage`.
 *
 * **Provider-neutral contract.** The `meta` shape lives at
 * `app/core/image/image-source.ts` — it has no Sanity type
 * names. A future image-CDN provider that exposes a
 * `crop` + `hotspot` concept can populate the same shape and
 * a future sibling wrapper (or this one, extended) will
 * render the URL. Generic feature/domain components
 * (`app/features/<feature>/components/`, `app/components/ui/`,
 * `app/components/layout/`) continue to receive only the
 * canonical `string` URL on the boundary.
 *
 * **Static + Node/Nitro parity.** The URL is computed in a
 * pure `computed()` that runs in the SSR / prerender pass.
 * For `pnpm generate`, the resolved URL is embedded in the
 * generated HTML and no runtime API is required. For
 * `pnpm build` + `node .output/server/index.mjs`, the same
 * `computed()` runs at render time on the server. In both
 * cases the client receives a finished URL — no `$fetch`
 * round-trip, no `useAsyncData` promise, no
 * `/api/sanity-image` dependency.
 *
 * **Fallback behaviour.**
 *  - When `meta` is `undefined` (static / API / generic-CMS
 *    sources, or Sanity records where the editor did not pick
 *    a hotspot / crop), the wrapper falls back to the plain
 *    `src` URL. This is the same code path the static catalog
 *    and the API adapter take — the wrapper degrades
 *    gracefully to the URL-only contract.
 *  - When the builder returns the empty string (e.g. the
 *    meta's `assetUrl` is empty — the mapper never produces
 *    this shape but the helper defends against it), the
 *    wrapper falls back to the plain `src` URL.
 *
 * **Target box.** The wrapper takes `width` + `aspectRatio`
 * (or `width` + `height`) to communicate the renderer-side
 * intent to the CDN. The builder derives the missing axis
 * from the aspect ratio and passes the full
 * `{ asset, hotspot?, crop? }` source to `@sanity/image-url`,
 * which computes the `rect=…` parameter itself. When
 * neither `width` nor `height` nor `aspectRatio` is set, the
 * builder returns `meta.assetUrl` unchanged — the brief is
 * explicit that hotspot / crop behavior must NOT be claimed
 * on an unconstrained URL.
 *
 * **Why the synchronous `computed()` is correct.** The URL
 * builder is a pure function of (projectId, dataset, meta,
 * width, height, aspectRatio, quality). None of those change
 * between SSR / prerender and client hydration, so the
 * computed value is identical on both sides — there is no
 * client-side recomputation that could drift from the SSR
 * output.
 */
const props = withDefaults(
  defineProps<{
    /** Plain asset URL fallback when `meta` is absent. */
    src: string
    /** Provider-neutral image metadata (Sanity asset ref + hotspot + crop + dimensions). */
    meta?: ImageSourceMeta
    /** Alt text for accessibility. Required. */
    alt: string
    /** Target render aspect ratio (CSS). Drives the wrapper's `aspect-*` class. */
    ratio?: ImageRatio
    /** Rounded corner preset. */
    rounded?: ImageRounded
    /** CSS `sizes` hint passed through to `<NuxtImg>` for srcset generation. */
    sizes?: string
    /** Loading strategy (`lazy` / `eager`). */
    loading?: 'lazy' | 'eager'
    /** Fetch priority hint (`auto` / `high` / `low`). */
    fetchpriority?: 'high' | 'low' | 'auto'
    /** Target render width in pixels (passed to the Sanity CDN). */
    width?: number
    /** Target render height in pixels (optional; derived from `aspectRatio` when absent). */
    height?: number
    /** Target aspect ratio (`width / height`). Passed to the Sanity CDN. */
    aspectRatio?: number
    /** Quality (1..100). Passed to the Sanity CDN. */
    quality?: number
  }>(),
  {
    meta: undefined,
    ratio: '4/3',
    rounded: 'lg',
    sizes: undefined,
    loading: 'lazy',
    fetchpriority: 'auto',
    width: undefined,
    height: undefined,
    aspectRatio: undefined,
    quality: undefined,
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

/**
 * Resolve the crop-aware URL synchronously.
 *
 * The `computed()` runs once during SSR / prerender; the
 * resolved value is embedded in the rendered HTML so the
 * client receives a finished URL on hydration — no
 * `$fetch` round-trip, no `useAsyncData` promise, no
 * `/api/sanity-image` dependency. This is what makes the
 * static deployment (`pnpm generate`) work: after prerender
 * the generated artifact is served by a plain HTTP server
 * with no runtime API surface.
 *
 * When `meta` is `undefined`, the builder short-circuits
 * (returns `meta.assetUrl` unchanged when the meta is
 * present + unconstrained, or `''` for a missing meta) — the
 * `effectiveSrc` computed below falls back to `props.src`
 * for both cases. When the meta is present and the builder
 * returns a non-empty URL, that URL is the crop-aware Sanity
 * CDN URL with the `rect=…` parameter the library computed.
 */
const resolvedUrl = computed<string>(() => {
  if (!props.meta) return ''
  return buildSanityImageUrl({
    meta: props.meta,
    width: props.width,
    height: props.height,
    aspectRatio: props.aspectRatio,
    quality: props.quality,
  })
})

/**
 * The effective `src` for `<NuxtImg>`. Falls back to the
 * plain `src` when:
 *  - `meta` is `undefined` (static / API / generic-CMS path).
 *  - the builder returned an empty string (defensive).
 *  - no `width` / `height` / `aspectRatio` is set AND
 *    `meta.assetUrl` is empty (unreachable in practice).
 */
const effectiveSrc = computed<string>(() => {
  const url = resolvedUrl.value
  if (url && url !== '') return url
  return props.src
})
</script>

<template>
  <div
    class="relative overflow-hidden bg-[var(--color-surface-muted)]"
    :class="[ratioClasses[props.ratio], roundedClasses[props.rounded]]"
  >
    <NuxtImg
      :src="effectiveSrc"
      :alt="alt"
      :sizes="sizes"
      :loading="loading"
      :fetchpriority="fetchpriority"
      class="h-full w-full object-cover"
    />
  </div>
</template>
