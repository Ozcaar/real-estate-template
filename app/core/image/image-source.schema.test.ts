/**
 * Provider-neutral image-source metadata (runtime contract tests).
 *
 * Validates the shape constraints on `ImageSourceMeta` and friends.
 * The boundary regression tests (e.g. `sanity-boundary.test.ts`) check
 * that the schema is not imported by any `app/` service file, but this
 * file is the contract-level coverage for the canonical field shapes
 * and constraint ranges.
 */
import { describe, expect, it } from 'vitest'
import {
  imageAssetMetadataSchema,
  imageCropSchema,
  imageHotspotSchema,
  imageSourceMetaSchema,
} from './image-source.schema'

describe('image-source.schema (provider-neutral metadata contract)', () => {
  describe('imageHotspotSchema', () => {
    it('accepts a normalized focal point', () => {
      // Sanity's hotspot is `{ x, y, width, height }` — all four
      // fields are required (the library uses `hotspot.width` and
      // `hotspot.height` separately to compute the horizontal /
      // vertical focal-region radii when fitting the crop around
      // the focal point).
      const result = imageHotspotSchema.safeParse({ x: 0.5, y: 0.25, width: 0.4, height: 0.4 })
      expect(result.success).toBe(true)
    })

    it('rejects coordinates outside the 0..1 range', () => {
      const result = imageHotspotSchema.safeParse({ x: 1.5, y: 0.5, width: 0.4, height: 0.4 })
      expect(result.success).toBe(false)
    })

    it('rejects non-numeric fields', () => {
      const result = imageHotspotSchema.safeParse({ x: '0.5', y: 0.5, width: 0.4, height: 0.4 })
      expect(result.success).toBe(false)
    })

    it('rejects a hotspot missing the required `width` field', () => {
      // Omitting `width` would make @sanity/image-url emit a
      // `rect=NaN,…` parameter on the CDN URL. The schema
      // rejects it so the mapper drops the hotspot sub-field
      // and falls back to the URL-only path.
      const result = imageHotspotSchema.safeParse({ x: 0.5, y: 0.5, height: 0.4 })
      expect(result.success).toBe(false)
    })
  })

  describe('imageCropSchema', () => {
    it('accepts a 4-fraction crop region', () => {
      const result = imageCropSchema.safeParse({ top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 })
      expect(result.success).toBe(true)
    })

    it('accepts a zero crop (preserve everything)', () => {
      const result = imageCropSchema.safeParse({ top: 0, bottom: 0, left: 0, right: 0 })
      expect(result.success).toBe(true)
    })

    it('rejects fractions outside the 0..1 range', () => {
      const result = imageCropSchema.safeParse({ top: 0, bottom: 0, left: 1.2, right: 0 })
      expect(result.success).toBe(false)
    })
  })

  describe('imageAssetMetadataSchema', () => {
    it('accepts positive dimensions and aspect ratio', () => {
      const result = imageAssetMetadataSchema.safeParse({ width: 800, height: 600, aspectRatio: 4 / 3 })
      expect(result.success).toBe(true)
    })

    it('rejects zero / negative dimensions', () => {
      const zero = imageAssetMetadataSchema.safeParse({ width: 0, height: 600, aspectRatio: 0 })
      expect(zero.success).toBe(false)
      const negative = imageAssetMetadataSchema.safeParse({ width: 800, height: -1, aspectRatio: 1 })
      expect(negative.success).toBe(false)
    })
  })

  describe('imageSourceMetaSchema', () => {
    it('accepts a minimal meta with only the required fields', () => {
      const result = imageSourceMetaSchema.safeParse({
        assetRef: 'image-abc-800x600-jpg',
        assetUrl: 'https://cdn.sanity.io/images/prod/asset.jpeg',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a fully-populated meta with hotspot + crop + metadata', () => {
      const result = imageSourceMetaSchema.safeParse({
        assetRef: 'image-abc-800x600-jpg',
        assetUrl: 'https://cdn.sanity.io/images/prod/asset.jpeg',
        hotspot: { x: 0.5, y: 0.25, width: 0.4, height: 0.4 },
        crop: { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 },
        metadata: { width: 800, height: 600, aspectRatio: 4 / 3 },
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty assetRef', () => {
      const result = imageSourceMetaSchema.safeParse({
        assetRef: '',
        assetUrl: 'https://cdn.sanity.io/images/prod/asset.jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a non-URL assetUrl', () => {
      const result = imageSourceMetaSchema.safeParse({
        assetRef: 'image-abc-800x600-jpg',
        assetUrl: 'not-a-url',
      })
      expect(result.success).toBe(false)
    })
  })
})
