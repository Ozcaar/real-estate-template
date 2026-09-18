/**
 * Provider-neutral image-source metadata types (Task 130).
 *
 * The canonical image contract on the boundary (`Property.coverImage`,
 * `Agent.image`, `Development.image`, …) is a `string` URL — that is the
 * contract the static / api / generic-CMS providers emit, and it is the
 * contract the rendering components consume via `<ResponsiveImage :src>`.
 *
 * Some image CDNs expose editorial metadata that the editor can set in the
 * Studio (Sanity's hotspot + crop being the canonical example). When that
 * metadata is present, the rendering layer can pass it through to the CDN
 * at request time to produce a crop-aware, focal-point-aware URL. The
 * `ImageSourceMeta` interface below is the **provider-neutral** shape that
 * carries that metadata across the boundary:
 *
 * - `assetRef` — the opaque CDN-side identifier of the underlying image
 *   asset (Sanity uses an asset reference like `image-<id>-<dim>-<fmt>`,
 *   but the field is deliberately named `assetRef` and not `sanityRef` so
 *   the same shape can be filled in by any image CDN that exposes an
 *   equivalent concept).
 * - `hotspot` — the editor-picked focal region (Sanity stores it as
 *   `{ x, y, width, height }` where `x` / `y` are the center of the
 *   focal region and `width` / `height` are the **horizontal and
 *   vertical dimensions** of the focal region, all normalized to
 *   `0..1`). `width` and `height` are NOT radii — they are the full
 *   dimensions of the rectangular region. The library derives the
 *   horizontal / vertical focal radii internally as
 *   `hotspot.width * asset.width / 2` and
 *   `hotspot.height * asset.height / 2` when fitting the crop around
 *   the focal point.
 * - `crop` — the editor-picked crop region (Sanity stores it as four
 *   fractions `top` / `bottom` / `left` / `right` in `0..1`; the kept
 *   region is the rectangle between `left..(1-right)` horizontally and
 *   `top..(1-bottom)` vertically).
 * - `metadata` — the asset's intrinsic dimensions; useful for the
 *   frontend to decide whether to upscale, to compute aspect ratios
 *   without a network round-trip, or to skip URL generation when the
 *   asset is smaller than the requested box.
 *
 * **Provider neutrality.** The interface names (`hotspot`, `crop`,
 * `metadata`) match Sanity's documented field names but the type carries
 * no Sanity-specific imports. The mapping is provider-agnostic; the
 * mapping layer (`server/utils/sanity-mappings.ts`) emits this shape on
 * the Sanity branch only. The static / api / http-json providers do NOT
 * emit this field — it stays `undefined` for them — and the rendering
 * components treat `undefined` as "no metadata, fall back to the plain
 * asset URL".
 *
 * **Boundary contract.** This file lives under `app/core/image/` (not
 * under `features/` and not under `data-source/adapters/`) because:
 *
 * - The shape is not feature-specific — every feature with an image field
 *   uses it identically.
 * - The shape is not part of the data-source contract — the static / api
 *   / generic-CMS providers do not emit it, so it would be misleading
 *   to put it inside `data-source/`.
 *
 * **Sanity isolation (Task 130 correction).** The Sanity-aware URL
 * builder lives at `app/core/image/sanity-image-url.ts` and is the only
 * file that imports `@sanity/image-url`. The boundary regression test
 * at `server/utils/sanity-boundary.test.ts` pins `@sanity/image-url` to
 * the canonical Sanity-aware surface (the `app/core/image/` module +
 * the Sanity-specific `<SanityImage>` rendering adapter) and forbids it
 * in `app/features/<feature>/services/` and `app/core/data-source/adapters/`.
 * Generic feature/domain components continue to receive only the
 * canonical `string` URL on the boundary; the Sanity-specific metadata
 * is opt-in via the `<SanityImage>` wrapper.
 */

/**
 * Normalized focal-point coordinates on a 0..1 grid.
 *
 * Sanity's `hotspot` field stores `{ x, y, width, height }`:
 *
 *  - `x` — horizontal center of the focal region, normalized to `0..1`
 *    (left = 0, right = 1).
 *  - `y` — vertical center of the focal region, normalized to `0..1`
 *    (top = 0, bottom = 1).
 *  - `width` — **horizontal dimension** of the focal region, normalized
 *    to `0..1`. NOT a radius — the full horizontal size of the
 *    rectangular region the editor picked. The URL builder passes
 *    the full shape to `@sanity/image-url`'s `b.image(...)`; the
 *    library derives the horizontal focal radius internally as
 *    `hotspot.width * asset.width / 2` and uses it to centre the
 *    visible window inside the editor's crop region.
 *  - `height` — **vertical dimension** of the focal region, normalized
 *    to `0..1`. Same derivation as `width` for the vertical axis.
 *
 * All four values must lie in `[0, 1]`. A hotspot whose `x + width > 1`
 * or `y + height > 1` extends past the source's edge; the library
 * clamps the result. The mapper rejects out-of-range coordinates and
 * falls back to the URL-only meta on a malformed hotspot.
 */
export interface ImageHotspot {
  /** Horizontal center, normalized to `0..1` (left = 0, right = 1). */
  x: number
  /** Vertical center, normalized to `0..1` (top = 0, bottom = 1). */
  y: number
  /**
   * Horizontal dimension of the focal region, normalized to
   * `0..1`. NOT a radius — the full horizontal size of the
   * rectangular focal region the editor picked. Required:
   * omitting `width` makes `@sanity/image-url` produce a
   * `rect=NaN,…` query parameter on the CDN URL because the
   * library's `urlForImage.js` reads both `hotspot.width` and
   * `hotspot.height` to compute the horizontal / vertical focal
   * radii when fitting the crop around the focal point.
   */
  width: number
  /**
   * Vertical dimension of the focal region, normalized to `0..1`.
   * NOT a radius — the full vertical size of the rectangular
   * focal region. Required for the same reason as `width`.
   */
  height: number
}

/**
 * Editor-defined crop region as four fractions of the source image
 * dimensions, each in `0..1`. The kept region is the rectangle bounded
 * horizontally by `left..(1 - right)` and vertically by
 * `top..(1 - bottom)`.
 *
 * The shape matches Sanity's `crop` field directly. All four values
 * must lie in `[0, 1]`; the kept region's width is
 * `1 - left - right` and its height is `1 - top - bottom`. A
 * degenerate region (width or height ≤ 0) means the crop is
 * "preserve everything" — Sanity's editor UI does not expose this,
 * so a mapper that encounters it should treat the crop as absent.
 */
export interface ImageCrop {
  /** Top edge inset, normalized to `0..1`. */
  top: number
  /** Bottom edge inset, normalized to `0..1`. */
  bottom: number
  /** Left edge inset, normalized to `0..1`. */
  left: number
  /** Right edge inset, normalized to `0..1`. */
  right: number
}

/**
 * Intrinsic asset dimensions. Always present when the CDN exposes them;
 * `width` and `height` are in pixels.
 */
export interface ImageAssetMetadata {
  width: number
  height: number
  /**
   * Aspect ratio as `width / height`. Computed at the mapper level
   * (`width / height`) so the frontend never has to derive it; if a
   * future provider stores it explicitly it can be filled in here.
   */
  aspectRatio: number
}

/**
 * Provider-neutral image-source metadata.
 *
 * Optional on the boundary. When `undefined`, the rendering layer
 * uses the plain asset URL and ignores all crop / hotspot semantics.
 *
 * The mapper that produces this shape (currently the Sanity mapper in
 * `server/utils/sanity-mappings.ts`) is the only place that knows
 * which provider the metadata came from. The components downstream
 * read `assetRef`, `hotspot`, `crop`, `metadata` and pass them through
 * to a provider-specific URL builder (currently
 * `app/core/image/sanity-image-url.ts`, which is the only consumer of
 * `@sanity/image-url`).
 */
export interface ImageSourceMeta {
  /**
   * CDN-side identifier of the asset. For Sanity this is the asset
   * reference like `image-<id>-<dim>-<fmt>`; for other CDNs it would
   * be the equivalent opaque identifier. The URL builder is the only
   * code that needs to know what format this takes.
   */
  assetRef: string
  /** Original asset URL (the un-rewritten URL on the CDN). */
  assetUrl: string
  /**
   * Editor-picked focal point. Absent when the editor did not pick one.
   * Carries the full Sanity hotspot shape (`{ x, y, width, height }`)
   * so the URL builder can pass it directly to the library.
   */
  hotspot?: ImageHotspot
  /** Editor-picked crop region. Absent when the editor did not pick one. */
  crop?: ImageCrop
  /** Intrinsic dimensions of the source asset. Absent when the CDN does not expose them. */
  metadata?: ImageAssetMetadata
}
