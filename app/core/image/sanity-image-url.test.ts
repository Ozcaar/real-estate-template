/**
 * Sanity CDN URL builder tests (Task 130 — Hotspot / Crop-aware Images).
 *
 * The test surface is the documented behaviour matrix
 * (with `meta.hotspot` carrying the full Sanity
 * `{ x, y, width, height }` shape):
 *
 *  - crop + hotspot (canonical) → the library computes a
 *    `rect=…` from the editor's saved metadata + the target
 *    width / height. The hotspot's center changes the
 *    rectangle (x-axis shift).
 *  - hotspot-only (no crop) → library uses the hotspot to
 *    position the visible window inside the **full-image**
 *    crop when the aspect ratio differs. The rect is the
 *    hotspot-bounded rectangle.
 *  - crop-only (no hotspot) → library applies the crop only;
 *    no focal-point nudge; the rect is the crop rectangle
 *    sized to the target box.
 *  - no hotspot, no crop + target box → `?w=…&h=…` only.
 *  - no target box → `meta.assetUrl` unchanged. Hotspot
 *    behavior must NOT be claimed on an unconstrained URL.
 *  - **upscaling guard applies proportional reduction** to
 *    preserve the renderer's aspect ratio (the previous
 *    Task 130 implementation clamped each axis
 *    independently — that approach changed the requested
 *    aspect ratio, e.g. a 2000×2000 request on a 1600×1200
 *    source would have become 1600×1200, changing the 1:1
 *    ratio to 4:3). The current algorithm reduces both
 *    axes by the same factor so the requested aspect
 *    ratio is preserved through every branch.
 *  - the unconstrained path, the malformed meta path, and
 *    the project / dataset resolution path.
 *
 * The `width` field of the hotspot is REQUIRED — Sanity's
 * hotspot is `{ x, y, width, height }` where `width` and
 * `height` are the **horizontal and vertical dimensions** of
 * the focal region (NOT radii — the library derives the
 * focal radii internally as `hotspot.width * asset.width / 2`
 * and `hotspot.height * asset.height / 2`). A hotspot that
 * lacks `width` produces a `rect=NaN,…` on the CDN URL. The
 * mapper rejects such hotspots (drops the sub-field) and the
 * URL builder falls back to the URL-only path.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildSanityImageUrl, sanityImageUrlFor } from './sanity-image-url'
import type { ImageSourceMeta } from './image-source'

const PROJECT_ID = 'projtest'
const DATASET = 'production'

function setEnv(projectId: string, dataset: string): void {
  process.env.NUXT_SANITY_PROJECT_ID = projectId
  process.env.NUXT_SANITY_DATASET = dataset
}

function clearEnv(): void {
  delete process.env.NUXT_SANITY_PROJECT_ID
  delete process.env.NUXT_SANITY_DATASET
}

function makeMeta(overrides: Partial<ImageSourceMeta> = {}): ImageSourceMeta {
  return {
    assetRef: 'image-abc123-1600x1200-jpg',
    assetUrl: 'https://cdn.sanity.io/images/projtest/production/abc123-1600x1200.jpg',
    ...overrides,
  }
}

describe('buildSanityImageUrl — Sanity CDN URL builder (Task 130)', () => {
  beforeEach(() => {
    setEnv(PROJECT_ID, DATASET)
  })

  afterEach(() => {
    clearEnv()
  })

  describe('crop + hotspot (the canonical case)', () => {
    it('emits the focal-point-aware URL with width + height; library computes the rect', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta({
          // Required shape: x, y, width, height — all four fields.
          hotspot: { x: 0.6, y: 0.4, width: 0.3, height: 0.3 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
        }),
        width: 800,
        height: 600,
      })
      // The library computes the rect from crop + hotspot +
      // target dimensions. For a 1600x1200 source with
      // crop {0.05,0.05,0.05,0.05}, the kept crop region is
      // x=[80, 1520], y=[60, 1140] → 1440x1080 (aspect 4:3).
      // The target 800x600 is also 4:3 (same as the crop
      // region); the library emits the full crop region
      // without hotspot nudge. Expected:
      // rect=80,60,1440,1080.
      expect(url).toContain('cdn.sanity.io/images/projtest/production/abc123-1600x1200.jpg')
      expect(url).toContain('rect=80,60,1440,1080')
      expect(url).toContain('w=800')
      expect(url).toContain('h=600')
      // The library does NOT emit `fit=crop` or `crop=focalpoint`
      // — those are manual override flags that bypass the
      // automatic crop+hotspot fitting. They must NOT appear.
      expect(url).not.toContain('fit=crop')
      expect(url).not.toContain('crop=focalpoint')
      // And no `fp-x` / `fp-y` override either — the
      // editor-picked hotspot is read from the asset, not
      // passed as a URL parameter.
      expect(url).not.toContain('fp-x=')
      expect(url).not.toContain('fp-y=')
    })

    it('changing the hotspot changes the calculated rect for constrained aspect ratios', () => {
      // Use target aspect that differs from the crop region's
      // aspect so the hotspot nudge actually moves the rect.
      // crop {0.05,0.05,0.05,0.05} on a 1600x1200 source → crop
      // region 1440x1080 (aspect 4:3). Target 800x800 (1:1)
      // forces the library to re-frame around the hotspot.
      const urlA = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.25, y: 0.5, width: 0.3, height: 0.3 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
        }),
        width: 800,
        height: 800,
      })
      const urlB = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.75, y: 0.5, width: 0.3, height: 0.3 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
        }),
        width: 800,
        height: 800,
      })
      // Different hotspots produce different rect= values
      // when the target aspect ratio differs from the crop
      // region's aspect ratio.
      expect(urlA).not.toBe(urlB)
      const rectA = urlA.match(/rect=([^&]+)/)?.[1]
      const rectB = urlB.match(/rect=([^&]+)/)?.[1]
      expect(rectA).toBeDefined()
      expect(rectB).toBeDefined()
      expect(rectA).not.toBe(rectB)
      // The left coordinate of the rect shifts with the
      // hotspot — x=0.25 produces a leftward-shifted rect,
      // x=0.75 produces a rightward-shifted rect.
      const leftA = Number(rectA!.split(',')[0])
      const leftB = Number(rectB!.split(',')[0])
      expect(leftB).toBeGreaterThan(leftA)
    })

    it('crop + hotspot with target aspect different from crop region aspect (1:1 target, 4:3 crop)', () => {
      // Source 1600x1200, crop {0.05,0.05,0.05,0.05} → kept
      // region 1440x1080 (4:3). Target 800x800 (1:1) — the
      // library re-frames the crop region around the hotspot.
      // Expected: rect=420,60,1080,1080 (crop top+bottom = 1080,
      // crop left+right → 1080 → 1:1, hotspot x=0.6*1600=960,
      // center 540 from crop left 80 → final left=80+(1440-1080)/2
      // adjusting for hotspot → 420).
      const url = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.6, y: 0.4, width: 0.3, height: 0.3 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
        }),
        width: 800,
        height: 800,
      })
      expect(url).toContain('rect=420,60,1080,1080')
      expect(url).toContain('w=800')
      expect(url).toContain('h=800')
    })
  })

  describe('crop-only (no hotspot)', () => {
    it('library applies the crop only; no focal-point nudge', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta({
          crop: { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 },
        }),
        width: 800,
        height: 600,
      })
      // The rect is the crop region sized to the target box
      // (no hotspot nudge). The library picks the smaller
      // of (crop width / target aspect, crop height * target
      // aspect).
      expect(url).toContain('rect=')
      expect(url).toContain('w=800')
      expect(url).toContain('h=600')
      // No focal-point override parameters.
      expect(url).not.toContain('fp-x=')
      expect(url).not.toContain('fp-y=')
    })

    it('a degenerate crop (no hotspot) still emits the documented crop region', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta({
          crop: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
        width: 800,
        height: 600,
      })
      // Crop {0,0,0,0} keeps the entire source. With 800x600
      // target and a 1600x1200 source, no rect is needed
      // (no actual cropping happens). The library emits
      // `?w=800&h=600` without rect.
      expect(url).not.toContain('rect=')
      expect(url).toContain('w=800')
      expect(url).toContain('h=600')
    })
  })

  describe('hotspot-only (no crop) — receives the library centered default', () => {
    it('library centers the crop on the hotspot when the aspect ratio differs', () => {
      // Source 1600x1200 (4:3); requested 800x800 (1:1). The
      // library computes a rect that frames the visible
      // window around the hotspot. Expected: rect=200,0,1200,1200.
      const url = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
        }),
        width: 800,
        height: 800,
      })
      expect(url).toContain('rect=200,0,1200,1200')
      expect(url).toContain('w=800')
      expect(url).toContain('h=800')
    })

    it('hotspot-only when target aspect matches source aspect: no rect (library full-image resize)', () => {
      // Source 1600x1200 (4:3); requested 800x600 (4:3). The
      // aspect ratios match; the library emits `?w=800&h=600`
      // without a rect parameter (no cropping needed).
      const url = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
        }),
        width: 800,
        height: 600,
      })
      expect(url).not.toContain('rect=')
      expect(url).toContain('w=800')
      expect(url).toContain('h=600')
    })
  })

  describe('no hotspot, no crop', () => {
    it('emits only w / h — no rect / no fp-x / no fp-y / no fit / no crop flags', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 400,
        height: 300,
      })
      expect(url).toContain('w=400')
      expect(url).toContain('h=300')
      // Brief: hotspot behavior must not be claimed when the
      // asset has no hotspot / crop. The URL therefore does
      // not carry any of the focal-point flags.
      expect(url).not.toContain('rect=')
      expect(url).not.toContain('fit=')
      expect(url).not.toContain('crop=')
      expect(url).not.toContain('fp-x=')
      expect(url).not.toContain('fp-y=')
    })
  })

  describe('unconstrained path', () => {
    it('returns the asset URL unchanged when no width / height / aspectRatio is given', () => {
      const meta = makeMeta({
        hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
        crop: { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 },
      })
      const url = buildSanityImageUrl({ meta })
      // The brief is explicit: hotspot / crop behavior must
      // NOT be claimed on an unconstrained URL. The CDN
      // therefore receives the asset URL unchanged.
      expect(url).toBe(meta.assetUrl)
      expect(url).not.toContain('w=')
      expect(url).not.toContain('h=')
      expect(url).not.toContain('rect=')
      expect(url).not.toContain('fp-x=')
    })

    it('returns the asset URL unchanged when width=0 / height=0', () => {
      const meta = makeMeta({ hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 } })
      const url = buildSanityImageUrl({ meta, width: 0, height: 0 })
      expect(url).toBe(meta.assetUrl)
    })
  })

  describe('aspect-ratio shortcut', () => {
    it('derives the height from width + aspectRatio when height is absent', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 800,
        aspectRatio: 16 / 9,
      })
      expect(url).toContain('w=800')
      expect(url).toContain('h=450')
    })

    it('derives the width from height + aspectRatio when width is absent', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        height: 450,
        aspectRatio: 16 / 9,
      })
      expect(url).toContain('w=800')
      expect(url).toContain('h=450')
    })
  })

    describe('upscaling guard — proportional reduction preserves the renderer aspect ratio', () => {
    // The previous Task 130 implementation clamped each axis
    // independently, which could change the renderer's
    // requested aspect ratio (e.g. a 2000×2000 request on a
    // 1600×1200 source would have become 1600×1200, changing
    // the 1:1 ratio to 4:3). The corrected algorithm applies
    // proportional reduction: both axes are reduced by the same
    // factor so the renderer's aspect ratio is preserved.
    //
    // Algorithm: scale = max(width / intrinsic.width, height /
    // intrinsic.height); if scale > 1: width /= scale, height /= scale.

    it('square oversized request on a landscape source preserves 1:1', () => {
      // 2000x2000 (1:1) on 1600x1200 (4:3) source.
      //   scale = max(2000/1600, 2000/1200) = max(1.25, 1.667) = 1.667
      //   new w = round(2000 / 1.667) = 1200
      //   new h = round(2000 / 1.667) = 1200
      // Reduced to 1200x1200 (1:1 preserved, not 1600x1200 / 4:3).
      const url = buildSanityImageUrl({
        meta: makeMeta({ metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 } }),
        width: 2000,
        height: 2000,
      })
      expect(url).toContain('w=1200')
      expect(url).toContain('h=1200')
    })

    it('portrait oversized request preserves the requested ratio (asymmetric upscale)', () => {
      // 800x2000 (1:2.5) on 1600x1200 (4:3) source.
      //   scale = max(800/1600, 2000/1200) = max(0.5, 1.667) = 1.667
      //   new w = round(800 / 1.667) = 480
      //   new h = round(2000 / 1.667) = 1200
      // Reduced to 480x1200; original ratio 800/2000 = 0.4; new
      // ratio 480/1200 = 0.4 — preserved.
      const url = buildSanityImageUrl({
        meta: makeMeta({ metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 } }),
        width: 800,
        height: 2000,
      })
      expect(url).toContain('w=480')
      expect(url).toContain('h=1200')
    })

    it('both axes already fit within the intrinsic dimensions: unchanged', () => {
      // 400x300 (4:3) on 1600x1200 (4:3) source — both
      // smaller than intrinsic, so the guard is a no-op.
      const url = buildSanityImageUrl({
        meta: makeMeta({ metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 } }),
        width: 400,
        height: 300,
      })
      expect(url).toContain('w=400')
      expect(url).toContain('h=300')
    })

    it('one-axis-only request still caps proportionally (aspect-ratio shortcut)', () => {
      // 2000 alone (no height) on 1600x1200 source. The
      // aspect-ratio shortcut derives height = round(2000 /
      // (1600/1200)) = 1500. Both axes exceed intrinsic.
      //   scale = max(2000/1600, 1500/1200) = max(1.25, 1.25) = 1.25
      //   new w = round(2000 / 1.25) = 1600
      //   new h = round(1500 / 1.25) = 1200
      // Reduced to 1600x1200 (the intrinsic dimensions); the
      // original 1.333 (4:3) ratio is preserved.
      const url = buildSanityImageUrl({
        meta: makeMeta({ metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 } }),
        width: 2000,
        aspectRatio: 1600 / 1200,
      })
      expect(url).toContain('w=1600')
      expect(url).toContain('h=1200')
    })

    it('hotspot crop still respects the editor focal point after proportional reduction', () => {
      // 2000x2000 (1:1) on 1600x1200 source with hotspot +
      // crop. After proportional reduction to 1200x1200, the
      // library still computes a non-empty rect that reflects
      // the editor's hotspot position relative to the crop
      // region. This proves the guard preserves the native
      // crop+hotspot fitting behaviour.
      const url = buildSanityImageUrl({
        meta: makeMeta({
          hotspot: { x: 0.6, y: 0.4, width: 0.3, height: 0.3 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
          metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 },
        }),
        width: 2000,
        height: 2000,
      })
      expect(url).toContain('w=1200')
      expect(url).toContain('h=1200')
      // The library emits a rect= that reflects the editor's
      // saved hotspot + crop on the reduced box. For the
      // canonical 1200x1200 reduced box (the 4:3 crop region
      // at 1440x1080 has been proportionally reduced to fit
      // the 1:1 target — 1080x1080 — with the hotspot
      // x=0.6 / y=0.4 nudging the visible window), the
      // library emits the same rect= as the canonical 800x800
      // case at lines 154–162: `rect=420,60,1080,1080`.
      // Pinning the exact value documents that the proportional
      // reduction preserves the native crop+hotspot fitting.
      expect(url).toContain('rect=420,60,1080,1080')
    })

    it('no-op when meta.metadata is absent (documented limitation)', () => {
      // When the GROQ projection does not return the asset's
      // intrinsic dimensions, the guard cannot reason about
      // upscale and the request is passed through unchanged.
      // This is the documented limitation: the guard prevents
      // the most common upscale case (oversized full-image
      // requests) and preserves the renderer's aspect ratio for
      // every other case; it does NOT claim to prevent every
      // possible CDN upscale.
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 2000,
        height: 1500,
      })
      expect(url).toContain('w=2000')
      expect(url).toContain('h=1500')
    })
  })

  describe('quality', () => {
    it('honours the explicit quality parameter', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 800,
        height: 600,
        quality: 90,
      })
      expect(url).toContain('q=90')
    })

    it('omits the quality parameter when not set', () => {
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 800,
        height: 600,
      })
      expect(url).not.toContain('q=')
    })
  })

  describe('defensive fallbacks', () => {
    it('returns an empty string for a meta without assetUrl', () => {
      // The mapper never produces this shape but the helper is
      // exposed and may be called by future code; defensive
      // fallback prevents a broken <img src>.
      const url = buildSanityImageUrl({
        meta: { assetRef: '', assetUrl: '' },
        width: 800,
        height: 600,
      })
      expect(url).toBe('')
    })
  })

  describe('project + dataset resolution', () => {
    it('uses the configured projectId + dataset in the CDN path', () => {
      setEnv('otherproj', 'staging')
      const url = buildSanityImageUrl({
        meta: makeMeta(),
        width: 400,
        height: 300,
      })
      // The assetRef stays the same (it's the GROQ projection
      // of `asset->_ref`), but the CDN URL prefix is the
      // configured project + dataset.
      expect(url).toContain('cdn.sanity.io/images/otherproj/staging/')
    })
  })
})

describe('sanityImageUrlFor — wrapper', () => {
  beforeEach(() => {
    setEnv(PROJECT_ID, DATASET)
  })

  afterEach(() => {
    clearEnv()
  })

  it('is the convenience form used by the <SanityImage> wrapper', () => {
    // Use a target aspect ratio that differs from the source
    // aspect ratio so the library emits a `rect=` parameter
    // (otherwise the hotspot nudge is a no-op and the URL
    // has only `w=…&h=…`).
    const url = sanityImageUrlFor(
      makeMeta({ hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 } }),
      800,
      800,
      undefined,
    )
    expect(url).toContain('w=800')
    expect(url).toContain('h=800')
    expect(url).toContain('rect=')
  })

  it('returns the asset URL unchanged when no width / height is passed', () => {
    const meta = makeMeta({ hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 } })
    const url = sanityImageUrlFor(meta)
    expect(url).toBe(meta.assetUrl)
  })
})
