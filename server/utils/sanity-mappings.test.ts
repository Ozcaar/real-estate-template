import { describe, expect, it } from 'vitest'
import {
  mapSanityProperty,
  mapSanityAgent,
  mapSanityDevelopment,
} from './sanity-mappings'

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

    it('converts a valid Sanity property document into the boundary shape', () => {
      const result = mapSanityProperty(validPropertyDoc)
      expect(result).toEqual({
        id: 'property-1',
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
      })
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

    it('converts a valid Sanity agent document into the boundary shape', () => {
      const result = mapSanityAgent(validAgentDoc)
      expect(result).toEqual({
        id: 'agent-1',
        name: 'Maria Gonzalez',
        slug: 'maria-gonzalez',
        role: 'Senior Agent',
        bio: 'Ten years of experience.',
        image: 'https://cdn.sanity.io/images/xxx/agent-1.jpg',
        phone: '+52 555 123 4567',
        email: 'maria@example.test',
        whatsapp: '+52 555 123 4567',
        specialties: ['Luxury', 'Investment'],
      })
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

    it('converts a valid Sanity development document into the boundary shape', () => {
      const result = mapSanityDevelopment(validDevelopmentDoc)
      expect(result).toEqual({
        id: 'development-1',
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
      })
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
  })
})
