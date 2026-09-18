import { describe, expect, it } from 'vitest'
import {
  mapSanityProperty,
  mapSanityAgent,
  mapSanityDevelopment,
} from './sanity-mappings'
import type { ImageSourceMeta } from '~/core/image/image-source'

/**
 * Tests for the Sanity feature-specific GROQ queries +
 * mapping functions.
 *
 * The mapping functions are the only feature-specific piece of
 * the Sanity CMS path. They convert the GROQ-projected Sanity
 * documents into the canonical boundary shapes (`Property`,
 * `Agent`, `Development`). The boundary Zod schemas validate
 * the mapped result at the adapter boundary — these tests pin
 * the mapping behaviour independently so a regression is
 * caught here without booting a Nitro server.
 *
 * The mapping is defensive: every field is read through a
 * permissive helper that treats missing / empty / wrong-typed
 * values as `undefined`. The default values the mappings
 * apply are placeholders; the boundary schema rejects
 * records that miss a required field with a clear
 * `DataSourceInvalidPayloadError` at the adapter boundary.
 *
 * **Task 130 additions.** The mapper now also reads an
 * optional `*Meta` field per image (asset ref + hotspot +
 * crop + intrinsic dimensions). The mapper's image-meta
 * extraction is defensive: a record whose `*Meta` projection
 * is missing / malformed returns `undefined` and emits the
 * canonical `string` URL unchanged. The tests below pin
 * every documented behaviour:
 *
 *  - Crop + hotspot → `ImageSourceMeta` with both fields.
 *  - Changing the hotspot changes the mapped `ImageSourceMeta`.
 *  - Crop-only → `ImageSourceMeta` with only `crop`.
 *  - Hotspot-only → `ImageSourceMeta` with only `hotspot`.
 *  - No hotspot / crop → `ImageSourceMeta` without either
 *    (the URL-only meta, which downstream code treats as
 *    "use the plain URL").
 *  - Malformed / missing `*Meta` → `undefined` on the boundary
 *    (no crash, canonical `string` URL preserved).
 *  - Property / agent / development images all carry the meta
 *    when present.
 *  - The static / api / generic-CMS paths do NOT emit `*Meta`
 *    (they pass a plain object whose `*Meta` key is absent).
 */

describe('server/utils/sanity-mappings', () => {
  describe('sanityPropertyQuery + mapSanityProperty', () => {
    const validPropertyDoc = {
      _id: 'property-1',
      title: 'Casa Moderna',
      slug: 'casa-moderna',
      description: 'A modern house in the city.',
      operationType: 'sale',
      propertyType: 'house',
      price: 1_500_000,
      currency: 'USD',
      location: 'Polanco',
      city: 'Mexico City',
      state: 'CDMX',
      country: 'Mexico',
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 1,
      sizeUnit: 'metric',
      constructionSize: 250,
      landSize: 300,
      images: [
        'https://cdn.sanity.io/images/xxx/property-1-image-1.jpg',
        'https://cdn.sanity.io/images/xxx/property-1-image-2.jpg',
      ],
      coverImage: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
      amenities: ['Pool', 'Garden', 'Garage'],
      agentId: 'agent-1',
      developmentId: 'development-1',
      coordinates: { lat: 19.4326, lng: -99.1332 },
      status: 'available',
      featured: true,
    }

    const validCoverImageMeta = {
      assetRef: 'image-cover-1600x1200-jpg',
      assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
      hotspot: { x: 0.6, y: 0.4, width: 0.4, height: 0.4 },
      crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
      metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 },
    }

    const validImagesMeta = [
      {
        assetRef: 'image-1-1600x1200-jpg',
        assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-image-1.jpg',
        hotspot: { x: 0.5, y: 0.5, width: 0.4, height: 0.4 },
        metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 },
      },
      {
        assetRef: 'image-2-1600x1200-jpg',
        assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-image-2.jpg',
        crop: { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 },
        metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 },
      },
    ]

    it('converts a valid Sanity property document into the boundary shape (Task 130 — meta omitted)', () => {
      const result = mapSanityProperty(validPropertyDoc)
      expect(result.id).toBe('property-1')
      expect(result.title).toBe('Casa Moderna')
      expect(result.slug).toBe('casa-moderna')
      expect(result.coverImage).toBe('https://cdn.sanity.io/images/xxx/property-1-cover.jpg')
      expect(result.images).toEqual([
        'https://cdn.sanity.io/images/xxx/property-1-image-1.jpg',
        'https://cdn.sanity.io/images/xxx/property-1-image-2.jpg',
      ])
      expect(result.coverImageMeta).toBeUndefined()
      expect(result.imagesMeta).toBeUndefined()
    })

    it('extracts `slug.current` when the GROQ projection returns an object', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        slug: { current: 'slug-from-object', _type: 'slug' },
      })
      expect(result.slug).toBe('slug-from-object')
    })

    it('returns undefined for missing optional fields', () => {
      const result = mapSanityProperty({
        _id: 'p2',
        title: 'P2',
        slug: 'p2',
        description: 'D',
        operationType: 'sale',
        propertyType: 'house',
        price: 100,
        currency: 'USD',
        location: 'L',
        city: 'C',
        state: 'S',
        country: 'Co',
        coverImage: 'https://example.test/cover.jpg',
        status: 'available',
        featured: false,
      })
      expect(result.bedrooms).toBeUndefined()
      expect(result.bathrooms).toBeUndefined()
      expect(result.constructionSize).toBeUndefined()
      expect(result.landSize).toBeUndefined()
      expect(result.sizeUnit).toBe('metric')
      expect(result.images).toEqual([])
      expect(result.amenities).toEqual([])
      expect(result.agentId).toBeUndefined()
      expect(result.developmentId).toBeUndefined()
      expect(result.coordinates).toBeUndefined()
      expect(result.coverImageMeta).toBeUndefined()
      expect(result.imagesMeta).toBeUndefined()
    })

    it('defaults missing agentId / developmentId to undefined', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        agentId: null,
        developmentId: '',
      })
      expect(result.agentId).toBeUndefined()
      expect(result.developmentId).toBeUndefined()
    })

    it('coerces an invalid operationType to "sale"', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        operationType: 'unknown',
      })
      expect(result.operationType).toBe('sale')
    })

    it('coerces an invalid propertyType to "house"', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        propertyType: 'castle',
      })
      expect(result.propertyType).toBe('house')
    })

    it('coerces an invalid status to "available"', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        status: 'pending',
      })
      expect(result.status).toBe('available')
    })

    it('coerces an invalid sizeUnit to "metric"', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        sizeUnit: 'stones',
      })
      expect(result.sizeUnit).toBe('metric')
    })

    it('treats `null` as a missing document', () => {
      const result = mapSanityProperty(null)
      expect(result.id).toBe('')
      expect(result.title).toBe('')
      expect(result.featured).toBe(false)
    })

    it('filters non-string entries from images and amenities', () => {
      const result = mapSanityProperty({
        ...validPropertyDoc,
        images: ['good', null, 42, 'also-good'],
        amenities: ['valid', undefined, 100, 'also-valid'],
      })
      expect(result.images).toEqual(['good', 'also-good'])
      expect(result.amenities).toEqual(['valid', 'also-valid'])
    })

    describe('image metadata (Task 130)', () => {
      it('emits coverImageMeta when the GROQ projection includes hotspot + crop + metadata', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: validCoverImageMeta,
        })
        expect(result.coverImageMeta).toEqual<ImageSourceMeta>({
          assetRef: 'image-cover-1600x1200-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
          hotspot: { x: 0.6, y: 0.4, width: 0.4, height: 0.4 },
          crop: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
          metadata: { width: 1600, height: 1200, aspectRatio: 4 / 3 },
        })
      })

      it('emits imagesMeta[] when the GROQ projection includes per-image hotspot / crop / metadata', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          imagesMeta: validImagesMeta,
        })
        expect(result.imagesMeta).toHaveLength(2)
        expect(result.imagesMeta?.[0]?.assetRef).toBe('image-1-1600x1200-jpg')
        expect(result.imagesMeta?.[0]?.hotspot).toEqual({ x: 0.5, y: 0.5, width: 0.4, height: 0.4 })
        expect(result.imagesMeta?.[1]?.assetRef).toBe('image-2-1600x1200-jpg')
        expect(result.imagesMeta?.[1]?.crop).toEqual({ top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 })
      })

      it('changing the hotspot changes the mapped ImageSourceMeta', () => {
        const a = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: { ...validCoverImageMeta, hotspot: { x: 0.25, y: 0.5, width: 0.4, height: 0.4 } },
        })
        const b = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: { ...validCoverImageMeta, hotspot: { x: 0.75, y: 0.5, width: 0.4, height: 0.4 } },
        })
        expect(a.coverImageMeta?.hotspot?.x).toBe(0.25)
        expect(b.coverImageMeta?.hotspot?.x).toBe(0.75)
        expect(a.coverImageMeta?.hotspot).not.toEqual(b.coverImageMeta?.hotspot)
      })

      it('crop-only meta (no hotspot) is preserved on the boundary', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            crop: { top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 },
          },
        })
        expect(result.coverImageMeta?.crop).toEqual({ top: 0.1, bottom: 0.1, left: 0.05, right: 0.05 })
        expect(result.coverImageMeta?.hotspot).toBeUndefined()
      })

      it('hotspot-only meta (no crop) is preserved on the boundary', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            hotspot: { x: 0.5, y: 0.5, width: 0.3, height: 0.3 },
          },
        })
        expect(result.coverImageMeta?.hotspot).toEqual({ x: 0.5, y: 0.5, width: 0.3, height: 0.3 })
        expect(result.coverImageMeta?.crop).toBeUndefined()
      })

      it('image without hotspot / crop still emits a meta with assetRef + assetUrl', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
          },
        })
        expect(result.coverImageMeta).toEqual({
          assetRef: 'image-cover-1600x1200-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
        })
      })

      it('malformed coverImageMeta does not crash the mapper (assetRef missing → meta dropped)', () => {
        // No assetRef → the whole meta is dropped.
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: '',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            hotspot: { x: '0.5', y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        expect(result.coverImageMeta).toBeUndefined()
        // The canonical coverImage URL is preserved.
        expect(result.coverImage).toBe('https://cdn.sanity.io/images/xxx/property-1-cover.jpg')
      })

      it('wrong-typed hotspot drops the hotspot but keeps the meta', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            hotspot: { x: '0.5', y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        // Permissive: drop the wrong-typed hotspot, keep the
        // meta so the renderer can use the URL-only path.
        expect(result.coverImageMeta).toEqual({
          assetRef: 'image-cover-1600x1200-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
        })
        expect(result.coverImageMeta?.hotspot).toBeUndefined()
        expect(result.coverImage).toBe('https://cdn.sanity.io/images/xxx/property-1-cover.jpg')
      })

      it('out-of-range hotspot coordinates drop the hotspot but keep the meta', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            // hotspot.x is outside the 0..1 range
            hotspot: { x: 1.5, y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        // Permissive: drop the invalid hotspot, keep the meta
        // with assetRef + assetUrl so the renderer can still
        // emit the URL-only fallback.
        expect(result.coverImageMeta).toEqual({
          assetRef: 'image-cover-1600x1200-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
        })
        expect(result.coverImageMeta?.hotspot).toBeUndefined()
      })

      it('degenerate crop (left + right >= 1) drops the crop but keeps the meta', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          coverImageMeta: {
            assetRef: 'image-cover-1600x1200-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
            crop: { top: 0, bottom: 0, left: 0.5, right: 0.5 },
          },
        })
        expect(result.coverImageMeta).toEqual({
          assetRef: 'image-cover-1600x1200-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/property-1-cover.jpg',
        })
        expect(result.coverImageMeta?.crop).toBeUndefined()
      })

      it('partial imagesMeta (one valid, one malformed) drops only the malformed entry', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          imagesMeta: [
            validImagesMeta[0],
            { assetRef: '', assetUrl: 'https://cdn.sanity.io/images/xxx/x.jpg' },
          ],
        })
        expect(result.imagesMeta).toHaveLength(1)
        expect(result.imagesMeta?.[0]?.assetRef).toBe('image-1-1600x1200-jpg')
      })

      it('imagesMeta absent → imagesMeta undefined (canonical URL-only path)', () => {
        const result = mapSanityProperty(validPropertyDoc)
        expect(result.imagesMeta).toBeUndefined()
        // images[] is still populated; the rendering layer
        // uses the plain URL.
        expect(result.images).toEqual([
          'https://cdn.sanity.io/images/xxx/property-1-image-1.jpg',
          'https://cdn.sanity.io/images/xxx/property-1-image-2.jpg',
        ])
      })

      it('all-malformed imagesMeta → imagesMeta undefined', () => {
        const result = mapSanityProperty({
          ...validPropertyDoc,
          imagesMeta: [
            { assetRef: '', assetUrl: 'https://cdn.sanity.io/images/x.jpg' },
            { assetRef: '', assetUrl: '' },
          ],
        })
        expect(result.imagesMeta).toBeUndefined()
      })
    })
  })

  describe('sanityAgentQuery + mapSanityAgent', () => {
    const validAgentDoc = {
      _id: 'agent-1',
      name: 'Maria Gonzalez',
      slug: 'maria-gonzalez',
      role: 'Senior Agent',
      bio: 'Ten years of experience.',
      image: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
      phone: '+52 555 123 4567',
      email: 'maria@example.test',
      whatsapp: '+52 555 123 4567',
      specialties: ['Luxury', 'Investment'],
    }

    it('converts a valid Sanity agent document into the boundary shape (Task 130 — meta omitted)', () => {
      const result = mapSanityAgent(validAgentDoc)
      expect(result.image).toBe('https://cdn.sanity.io/images/xxx/agent-1.jpg')
      expect(result.imageMeta).toBeUndefined()
    })

    it('returns undefined for missing optional fields', () => {
      const result = mapSanityAgent({
        _id: 'a2',
        name: 'A2',
        slug: 'a2',
        role: 'R',
        bio: 'B',
        image: 'https://example.test/a2.jpg',
      })
      expect(result.phone).toBeUndefined()
      expect(result.email).toBeUndefined()
      expect(result.whatsapp).toBeUndefined()
      expect(result.specialties).toBeUndefined()
      expect(result.imageMeta).toBeUndefined()
    })

    it('extracts `slug.current` when the GROQ projection returns an object', () => {
      const result = mapSanityAgent({
        ...validAgentDoc,
        slug: { current: 'slug-from-object', _type: 'slug' },
      })
      expect(result.slug).toBe('slug-from-object')
    })

    it('treats `null` as a missing document', () => {
      const result = mapSanityAgent(null)
      expect(result.id).toBe('')
      expect(result.name).toBe('')
    })

    describe('image metadata (Task 130)', () => {
      it('emits imageMeta with hotspot + metadata', () => {
        const result = mapSanityAgent({
          ...validAgentDoc,
          imageMeta: {
            assetRef: 'image-agent-600x600-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
            hotspot: { x: 0.5, y: 0.4, width: 0.3, height: 0.3 },
            metadata: { width: 600, height: 600, aspectRatio: 1 },
          },
        })
        expect(result.imageMeta?.assetRef).toBe('image-agent-600x600-jpg')
        expect(result.imageMeta?.hotspot).toEqual({ x: 0.5, y: 0.4, width: 0.3, height: 0.3 })
        expect(result.imageMeta?.metadata?.aspectRatio).toBe(1)
      })

      it('changing the agent hotspot changes the mapped ImageSourceMeta', () => {
        const a = mapSanityAgent({
          ...validAgentDoc,
          imageMeta: {
            assetRef: 'image-agent-600x600-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
            hotspot: { x: 0.3, y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        const b = mapSanityAgent({
          ...validAgentDoc,
          imageMeta: {
            assetRef: 'image-agent-600x600-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
            hotspot: { x: 0.7, y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        expect(a.imageMeta?.hotspot?.x).toBe(0.3)
        expect(b.imageMeta?.hotspot?.x).toBe(0.7)
      })

      it('malformed imageMeta (string hotspot) drops the hotspot but keeps the meta', () => {
        const result = mapSanityAgent({
          ...validAgentDoc,
          imageMeta: {
            assetRef: 'image-agent-600x600-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
            hotspot: { x: '0.5', y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        // Permissive: the wrong-typed hotspot is dropped, but
        // the meta's assetRef + assetUrl are still valid and
        // the rendering layer can fall back to the URL-only
        // path.
        expect(result.imageMeta).toEqual({
          assetRef: 'image-agent-600x600-jpg',
          assetUrl: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
        })
        expect(result.imageMeta?.hotspot).toBeUndefined()
        expect(result.image).toBe('https://cdn.sanity.io/images/xxx/agent-1.jpg')
      })
    })
  })

  describe('sanityDevelopmentQuery + mapSanityDevelopment', () => {
    const validDevelopmentDoc = {
      _id: 'development-1',
      name: 'Torres del Sol',
      slug: 'torres-del-sol',
      status: 'under-construction',
      location: 'Cancún',
      description: 'A modern residential development.',
      image: 'https://cdn.sanity.io/images/xxx/development-1.jpg',
      priceFrom: 250_000,
      priceTo: 800_000,
      currency: 'USD',
      sizeUnit: 'metric',
      units: 120,
      bedrooms: 2,
      areaFrom: 65,
      areaTo: 180,
      deliveryDate: '2025-12-01',
      featured: true,
    }

    it('converts a valid Sanity development document into the boundary shape (Task 130 — meta omitted)', () => {
      const result = mapSanityDevelopment(validDevelopmentDoc)
      expect(result.image).toBe('https://cdn.sanity.io/images/xxx/development-1.jpg')
      expect(result.imageMeta).toBeUndefined()
    })

    it('returns undefined for missing optional fields', () => {
      const result = mapSanityDevelopment({
        _id: 'd2',
        name: 'D2',
        slug: 'd2',
        status: 'pre-sale',
        location: 'L',
        description: 'D',
        image: 'https://example.test/d2.jpg',
      })
      expect(result.priceFrom).toBeUndefined()
      expect(result.priceTo).toBeUndefined()
      expect(result.currency).toBeUndefined()
      expect(result.units).toBeUndefined()
      expect(result.bedrooms).toBeUndefined()
      expect(result.areaFrom).toBeUndefined()
      expect(result.areaTo).toBeUndefined()
      expect(result.deliveryDate).toBeUndefined()
      expect(result.featured).toBeUndefined()
      expect(result.imageMeta).toBeUndefined()
    })

    it('coerces an invalid status to "pre-sale"', () => {
      const result = mapSanityDevelopment({
        ...validDevelopmentDoc,
        status: 'unknown',
      })
      expect(result.status).toBe('pre-sale')
    })

    it('coerces an invalid sizeUnit to "metric"', () => {
      const result = mapSanityDevelopment({
        ...validDevelopmentDoc,
        sizeUnit: 'furlongs',
      })
      expect(result.sizeUnit).toBe('metric')
    })

    it('treats `null` as a missing document', () => {
      const result = mapSanityDevelopment(null)
      expect(result.id).toBe('')
      expect(result.name).toBe('')
    })

    describe('image metadata (Task 130)', () => {
      it('emits imageMeta with hotspot + crop + metadata', () => {
        const result = mapSanityDevelopment({
          ...validDevelopmentDoc,
          imageMeta: {
            assetRef: 'image-dev-1920x1080-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/development-1.jpg',
            hotspot: { x: 0.6, y: 0.5, width: 0.4, height: 0.4 },
            crop: { top: 0.05, bottom: 0.05, left: 0.1, right: 0.1 },
            metadata: { width: 1920, height: 1080, aspectRatio: 16 / 9 },
          },
        })
        expect(result.imageMeta?.assetRef).toBe('image-dev-1920x1080-jpg')
        expect(result.imageMeta?.hotspot).toEqual({ x: 0.6, y: 0.5, width: 0.4, height: 0.4 })
        expect(result.imageMeta?.crop).toEqual({ top: 0.05, bottom: 0.05, left: 0.1, right: 0.1 })
      })

      it('changing the development hotspot changes the mapped ImageSourceMeta', () => {
        const a = mapSanityDevelopment({
          ...validDevelopmentDoc,
          imageMeta: {
            assetRef: 'image-dev-1920x1080-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/development-1.jpg',
            hotspot: { x: 0.2, y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        const b = mapSanityDevelopment({
          ...validDevelopmentDoc,
          imageMeta: {
            assetRef: 'image-dev-1920x1080-jpg',
            assetUrl: 'https://cdn.sanity.io/images/xxx/development-1.jpg',
            hotspot: { x: 0.8, y: 0.5, width: 0.4, height: 0.4 },
          },
        })
        expect(a.imageMeta?.hotspot?.x).toBe(0.2)
        expect(b.imageMeta?.hotspot?.x).toBe(0.8)
      })

      it('malformed imageMeta (no assetUrl) is rejected', () => {
        const result = mapSanityDevelopment({
          ...validDevelopmentDoc,
          imageMeta: {
            assetRef: 'image-dev-1920x1080-jpg',
            assetUrl: '',
          },
        })
        expect(result.imageMeta).toBeUndefined()
        expect(result.image).toBe('https://cdn.sanity.io/images/xxx/development-1.jpg')
      })
    })
  })

  describe('provider-neutral contract (Task 130)', () => {
    it('static / API / generic-CMS sources do NOT emit *Meta (canonical string-only contract)', () => {
      // A static-data record shape: the canonical string URL
      // is set but no `*Meta` key is present.
      const staticRecord = {
        _id: 's1',
        title: 'S1',
        slug: 's1',
        description: 'D',
        operationType: 'sale',
        propertyType: 'house',
        price: 0,
        currency: 'USD',
        location: 'L',
        city: 'C',
        state: 'S',
        country: 'Co',
        coverImage: '/images/properties/s1.svg',
        status: 'available',
        featured: false,
      }
      const result = mapSanityProperty(staticRecord)
      expect(result.coverImage).toBe('/images/properties/s1.svg')
      expect(result.coverImageMeta).toBeUndefined()
      expect(result.imagesMeta).toBeUndefined()
    })
  })
})
