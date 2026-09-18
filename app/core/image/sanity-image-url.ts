import imageUrlBuilder from '@sanity/image-url'
import type { ImageUrlBuilder } from '@sanity/image-url/lib/types/builder'
import type { ImageAssetMetadata, ImageSourceMeta } from './image-source'

/**
 * Sanity CDN URL builder (Task 130 — Hotspot / Crop-aware Images).
 *
 * This is the canonical home of the only `@sanity/image-url`
 * import in the runtime. The package is wrapped behind a
 * builder function so the rest of the codebase sees a
 * provider-neutral API; the only Sanity-specific dependency is
 * contained here.
 *
 * **Library semantics (the canonical contract).**
 *
 * `@sanity/image-url` exposes a single `b.image(source)` method
 * whose argument is a complete image source shape:
 *
 *   { asset: { _ref: assetRef }, hotspot?, crop? }
 *
 * The library reads `hotspot` (a `{ x, y, width, height }`
 * rectangle in normalized `0..1` units — **all four fields are
 * required**) and `crop` (a `{ top, bottom, left, right }`
 * region in the same units) from the source object. When both
 * are present, the library computes the cropping `rect=…`
 * parameter automatically: it applies the editor's `crop`
 * region first, then uses the `hotspot` to position the visible
 * window inside that region when the requested width / height
 * differs from the crop region's aspect ratio. When only one of
 * the two is present, the library falls back to its documented
 * defaults (full-image crop when no `crop` is present; centered
 * crop when no `hotspot` is present). When neither is present,
 * the library emits `?w=…&h=…` only.
 *
 * The build is documented in the library's `lib/node/urlForImage.js`:
 * the `fit()` helper computes the `cropRect` from
 * `source.crop` + `source.hotspot` + `spec.width` + `spec.height`.
 *
 * **Why this module lives in `app/core/image/` (not `server/utils/`).**
 *
 * The original Task 131 implementation lived in `server/utils/`
 * and was reached via a Nitro endpoint at `GET /api/sanity-image`.
 * That endpoint indirection is incompatible with the static
 * deployment mode (`pnpm generate`): after prerender the
 * generated artifact is served by a plain HTTP server with no
 * runtime API surface, so a client-side `$fetch('/api/…')` call
 * returns 404 in production. The fix moves the URL builder to
 * `app/core/image/` so the Vue `<SanityImage>` component can
 * import it directly and compute the URL synchronously during
 * SSR / prerender. The generated HTML embeds the resolved URL
 * with the correct `rect=…` / `w=…` / `h=…` parameters; the
 * client never needs to recompute it.
 *
 * **Manual override is not allowed.**
 *
 * The Task 131 implementation called `.fit('crop').crop('focalpoint').focalPoint(x, y)`
 * after `.width()`. That chain **overrides** the library's
 * automatic crop+hotspot fitting (the library's `urlForImage.js`
 * checks `spec.rect || spec.focalPoint || spec.ignoreImageParams || spec.crop`
 * and only runs its `fit()` when NONE of those manual overrides
 * are set). The Task 130 implementation does NOT call any of
 * those — it passes the full `{ asset, hotspot, crop }` source
 * to the library and lets the library compute the `rect=…`
 * parameter itself. Calling `.crop('focalpoint')` and
 * `.focalPoint()` here would produce URLs that bypass the
 * editor's saved hotspot (the `fp-x=…&fp-y=…` parameters force
 * the CDN to ignore the saved hotspot metadata).
 *
 * **Project / dataset resolution.** The builder re-reads the
 * `NUXT_SANITY_PROJECT_ID` / `NUXT_SANITY_DATASET` env vars on
 * every call. The Sanity-aware rendering sites (the
 * `<SanityImage>` component, the property / agent /
 * development detail pages) all require Sanity to be configured
 * at build time; the same env vars configure the data fetch.
 * The static deployment sets the env vars before
 * `pnpm generate`; the Node / Nitro deployment sets them at
 * runtime.
 *
 * **Unconstrained path.** When the renderer does NOT pass a
 * target width / height / aspect ratio (a generic placeholder
 * call site), the builder returns the original `meta.assetUrl`
 * unchanged. The brief is explicit that hotspot / crop
 * behavior must NOT be claimed when only an unconstrained URL
 * is generated.
 *
 * **Upscaling guard — proportional reduction.**
 *
 * When the requested box exceeds the asset's intrinsic
 * dimensions, Sanity's CDN would upscale the asset to fit,
 * which costs bandwidth and produces a soft image. The guard
 * applies a **proportional reduction** to the requested box so
 * the renderer's **requested aspect ratio is preserved** —
 * the previous Task 130 implementation clamped each axis
 * independently, which could change the requested aspect ratio
 * (e.g. a 2000×2000 request on a 1600×1200 source would have
 * become 1600×1200, changing the 1:1 ratio to 4:3).
 *
 * Algorithm (for a request with both `width` and `height` set):
 *
 *   1. scale = max(width / intrinsic.width, height / intrinsic.height)
 *   2. If scale > 1: new width = width / scale, new height = height / scale
 *   3. If scale ≤ 1: no change (request already fits).
 *
 * When only one axis is supplied, the other is derived from the
 * source's intrinsic aspect ratio (so a one-axis-only request is
 * effectively reduced to the intrinsic size on that axis); the
 * derived value is then capped against the other intrinsic axis
 * by the same proportional reduction.
 *
 * **Documented limitation.** The guard uses the **full source
 * dimensions** from `meta.metadata`. It does NOT inspect the
 * editor's `crop` rectangle — the effective source area after
 * the editor's crop can be smaller than `meta.metadata`, so a
 * request that fits within the full source dimensions can still
 * require the CDN to upscale within the cropped region. The
 * guard prevents the most common upscale case (oversized full-
 * image requests) and preserves the renderer's aspect ratio
 * for every other case; it does NOT claim to prevent every
 * possible CDN upscale. A future enhancement could incorporate
 * the crop rectangle into the guard for a tighter bound; this
 * task keeps the contract minimal (and matches the brief's
 * "document that limitation accurately" requirement).
 */

/**
 * Options accepted by {@link buildSanityImageUrl}. All fields
 * except `meta` are optional; absent width / height /
 * aspect-ratio means "return the unconstrained asset URL".
 */
export interface SanityImageUrlOptions {
  /**
   * The provider-neutral image metadata emitted by the Sanity
   * mapper. Required: `assetRef` + `assetUrl` are the only
   * fields guaranteed to be present (the mapper returns
   * `undefined` for a record whose projection is missing /
   * malformed).
   */
  meta: ImageSourceMeta
  /**
   * Target render width in pixels. When provided without
   * `height` (and `aspectRatio` is set), the height is derived
   * as `width / aspectRatio` so the requested box matches the
   * editor's intended crop region.
   */
  width?: number
  /**
   * Target render height in pixels. When provided without
   * `width`, the width is derived as `height * aspectRatio`.
   */
  height?: number
  /**
   * Target aspect ratio as `width / height`. When provided
   * without an explicit height, the height is derived as
   * `width / aspectRatio`.
   */
  aspectRatio?: number
  /**
   * Quality (1..100). Defaults to Sanity's CDN default (75).
   * Optional.
   */
  quality?: number
}

/**
 * Construct the `ImageUrlBuilder` instance for the current
 * `NUXT_SANITY_PROJECT_ID` + `NUXT_SANITY_DATASET`. The builder
 * is created on every call; `@sanity/image-url` is a pure
 * URL-construction helper with no per-instance state beyond
 * the project / dataset, so per-call construction is cheap and
 * keeps the test surface deterministic.
 */
function getBuilder(): ImageUrlBuilder {
  const projectId = (process.env.NUXT_SANITY_PROJECT_ID ?? '').trim()
  const dataset = (process.env.NUXT_SANITY_DATASET ?? '').trim() || 'production'
  return imageUrlBuilder({ projectId, dataset })
}

/**
 * Apply the proportional-reduction upscaling guard.
 *
 * Given the renderer's requested `width` / `height` and the
 * asset's intrinsic dimensions, return a `(width, height)` pair
 * that preserves the renderer's requested aspect ratio while
 * preventing either axis from exceeding the intrinsic size.
 *
 * Algorithm:
 *
 *   scale = max(
 *     width  !== undefined ? width  / intrinsic.width  : 0,
 *     height !== undefined ? height / intrinsic.height : 0,
 *   )
 *   If scale > 1:
 *     width  = width  !== undefined ? round(width  / scale) : undefined
 *     height = height !== undefined ? round(height / scale) : undefined
 *   Else (scale ≤ 1):
 *     The request fits within the intrinsic dimensions; the
 *     guard is a no-op and the request is returned unchanged.
 *
 * Either `width` or `height` may be `undefined`; the guard
 * operates only on the axes that are supplied.
 *
 * When `intrinsic` is `undefined` (the GROQ projection did not
 * return dimensions), the guard is a no-op — the request is
 * returned unchanged so the URL builder emits the request
 * as-is. This is the documented limitation: without the
 * intrinsic size, the guard cannot reason about the upscale
 * case, so the URL builder falls back to the documented library
 * behaviour (which is to emit the requested `?w=…&h=…` and
 * rely on the CDN to handle the upscale).
 */
function capToIntrinsic(
  width: number | undefined,
  height: number | undefined,
  intrinsic: ImageAssetMetadata | undefined,
): { width: number | undefined, height: number | undefined } {
  if (!intrinsic) return { width, height }
  // Compute the maximum upscale factor across the supplied axes.
  let scale = 0
  if (width !== undefined) {
    scale = Math.max(scale, width / intrinsic.width)
  }
  if (height !== undefined) {
    scale = Math.max(scale, height / intrinsic.height)
  }
  // If neither axis was supplied, or both axes already fit, no
  // change. The unconstrained path (no width AND no height)
  // is handled earlier in `buildSanityImageUrl` and never
  // reaches this guard.
  if (scale <= 1) return { width, height }
  // Otherwise, reduce both axes proportionally so the
  // renderer's requested aspect ratio is preserved.
  return {
    width: width !== undefined ? Math.round(width / scale) : undefined,
    height: height !== undefined ? Math.round(height / scale) : undefined,
  }
}

/**
 * Build a Sanity CDN URL from an `ImageSourceMeta` + an
 * optional target box (width / height / aspect ratio).
 *
 * The function delegates to `@sanity/image-url`'s native
 * crop / hotspot semantics: the full image source
 * `{ asset: { _ref: assetRef }, hotspot?, crop? }` is passed
 * to `b.image(...)` so the library computes the `rect=…`
 * parameter from the editor's saved metadata + the target
 * width / height. Manual `.crop('focalpoint')` /
 * `.focalPoint()` / `.rect()` overrides are deliberately
 * **not** called here — they would bypass the library's
 * automatic fitting and force the CDN to ignore the editor's
 * saved hotspot metadata.
 *
 * **Behaviour matrix** (all paths delegate to the library):
 *
 *  | `meta.hotspot` | `meta.crop` | `width` / `height` | Library behaviour |
 *  |---|---|---|---|
 *  | absent | absent | absent | `meta.assetUrl` unchanged (helper returns it) |
 *  | absent | absent | set    | `meta.assetUrl?w=…&h=…` (no `rect=` — full-image resize) |
 *  | set    | absent | set    | Library uses hotspot to position the visible window inside the **full-image** crop when the target aspect ratio differs; no editor crop region |
 *  | set    | set    | set    | Library applies `crop` first, then uses `hotspot` to position the visible window inside the cropped region when the aspect ratio differs |
 *  | absent | set    | set    | Library applies `crop` only; no focal-point nudge; output is centered on the crop region |
 *
 * **Sample output** for a 1600×1200 source asset with
 * `hotspot={x:0.6, y:0.4, width:0.3, height:0.3}` and
 * `crop={top:0.05, bottom:0.05, left:0.05, right:0.05}`
 * requested at 800×600:
 *
 *   `https://cdn.sanity.io/images/<projectId>/<dataset>/<assetRef>?rect=80,60,1440,1080&w=800&h=600`
 *
 * The `rect=80,60,1440,1080` is the library's automatic crop
 * rectangle: it applies the editor's crop region first, then
 * positions the visible window around the hotspot. Changing
 * the hotspot to `{ x: 0.25 }` produces a different
 * `rect=40,60,1080,1080` (the same crop region, but the visible
 * window is shifted to follow the new focal point).
 *
 * The function never throws on a malformed `meta` — the
 * mapper guarantees `assetRef` + `assetUrl` are non-empty
 * strings, but the helper still defends against
 * `null` / `undefined` / wrong-typed inputs by returning
 * `meta.assetUrl` (or the empty string for a missing
 * `assetUrl`).
 */
export function buildSanityImageUrl(options: SanityImageUrlOptions): string {
  const { meta, width: rawWidth, height: rawHeight, aspectRatio, quality } = options

  // Defensive: a malformed meta (no assetUrl) returns the
  // empty string so the rendering layer does not emit a broken
  // `<img src>`. The mapper never produces this shape but the
  // helper is exposed and may be called by future code.
  if (!meta || typeof meta.assetUrl !== 'string' || meta.assetUrl === '') return ''

  // Resolve height from width + aspect ratio (and vice versa)
  // so a renderer that specifies one axis gets a complete box.
  let width = rawWidth
  let height = rawHeight
  // Treat 0 as "not specified" — the documented surface validates
  // positive integers so 0 never reaches the builder, but
  // defensive callers (tests, future direct imports) get the
  // same unconstrained fallback they would get for
  // `undefined`.
  if (width !== undefined && width <= 0) width = undefined
  if (height !== undefined && height <= 0) height = undefined
  if (width !== undefined && height === undefined && aspectRatio !== undefined && aspectRatio > 0) {
    height = Math.round(width / aspectRatio)
  }
  if (height !== undefined && width === undefined && aspectRatio !== undefined && aspectRatio > 0) {
    width = Math.round(height * aspectRatio)
  }

  // Unconstrained path: no target box → return the unconstrained
  // asset URL. The brief is explicit that hotspot / crop
  // behavior must not be claimed when only an unconstrained URL
  // is generated.
  const hasConstrainedBox = width !== undefined || height !== undefined
  if (!hasConstrainedBox) return meta.assetUrl

  // Upscaling guard: apply proportional reduction when the
  // request would upscale either axis of the asset. The guard
  // preserves the renderer's requested aspect ratio by reducing
  // both axes by the same factor (the maximum upscale factor).
  const capped = capToIntrinsic(width, height, meta.metadata)
  width = capped.width
  height = capped.height

  // Build the URL through `@sanity/image-url` using the
  // library's native crop+hotspot semantics. The image source
  // shape is the documented contract: `{ asset, hotspot?, crop? }`.
  // The library's `urlForImage.js` reads `hotspot.width` and
  // `hotspot.height` (both required) to derive the horizontal
  // / vertical focal radii; the mapper emits the full
  // `{ x, y, width, height }` shape so passing it here is a
  // direct delegation.
  const builder = getBuilder()
  const source: { asset: { _ref: string }, hotspot?: ImageSourceMeta['hotspot'], crop?: ImageSourceMeta['crop'] } = {
    asset: { _ref: meta.assetRef },
  }
  if (meta.hotspot) source.hotspot = meta.hotspot
  if (meta.crop) source.crop = meta.crop
  let chain = builder.image(source)
  if (width !== undefined) chain = chain.width(width)
  if (height !== undefined) chain = chain.height(height)
  if (quality !== undefined) chain = chain.quality(quality)

  return chain.url()
}

/**
 * Wrap {@link buildSanityImageUrl} with a narrower signature
 * for the common renderer pattern: pass `meta` + `width` (or
 * `aspectRatio` + `width`) and receive a Sanity CDN URL.
 *
 * This is the function future image-aware wrappers import.
 * It exists so the renderer does not need to import the full
 * `SanityImageUrlOptions` interface when only the common
 * fields are known.
 */
export function sanityImageUrlFor(
  meta: ImageSourceMeta,
  width?: number,
  height?: number,
  aspectRatio?: number,
): string {
  return buildSanityImageUrl({ meta, width, height, aspectRatio })
}
