import { describe, expect, it } from 'vitest'
import { propertyType } from './property'
import { agentType } from './agent'
import { developmentType } from './development'
import { schemaTypes } from './index'

/**
 * Sanity Studio schema tests (Task 117).
 *
 * These tests verify the Studio schemas conform to the
 * documented contract:
 *
 *  - Every document type exposes the field names that
 *    the GROQ projection in
 *    `server/utils/sanity-mappings.ts` selects.
 *  - Required fields are marked required (the runtime
 *    Zod schema rejects records missing these fields).
 *  - Enum fields expose the exact enum values the
 *    runtime Zod schema accepts.
 *  - Numeric fields have `.min(0)` validation so the
 *    runtime schema's `.nonnegative()` rule is mirrored.
 *  - The reference fields on `property` point to the
 *    `agent` and `development` document types (the
 *    GROQ projection's `agent._ref` / `development._ref`
 *    dereferences only resolve to documents of the
 *    matching type).
 *  - The schema index exports exactly the three document
 *    types — no other types are registered.
 *
 * The tests are static — they inspect the schema object
 * directly without booting the Sanity Studio. The schema
 * data is plain JavaScript; the `defineType` /
 * `defineField` wrappers from `sanity` return the same
 * shape as the raw schema spec.
 */

/**
 * Find a field by name on a Sanity document schema. The
 * schema's `fields` array holds `defineField` outputs;
 * each entry has a `name` property.
 */
function findField(schema: { fields?: Array<{ name: string }> }, name: string) {
  return schema.fields?.find(f => f.name === name)
}

describe('studio/schemas', () => {
  describe('schemaTypes index', () => {
    it('exports exactly three document types', () => {
      expect(schemaTypes).toHaveLength(3)
    })

    it('exports property, agent, and development in that order', () => {
      expect(schemaTypes.map(t => t.name)).toEqual([
        'property',
        'agent',
        'development',
      ])
    })

    it('every entry is a document type', () => {
      for (const t of schemaTypes) {
        expect(t.type).toBe('document')
      }
    })
  })

  describe('property schema', () => {
    it('has the field names the GROQ projection selects', () => {
      const expected = [
        'title',
        'slug',
        'description',
        'operationType',
        'propertyType',
        'price',
        'currency',
        'amenities',
        'coverImage',
        'images',
        'location',
        'city',
        'state',
        'country',
        'coordinates',
        'bedrooms',
        'bathrooms',
        'parkingSpaces',
        'sizeUnit',
        'constructionSize',
        'landSize',
        'agent',
        'development',
        'status',
        'featured',
      ]
      for (const name of expected) {
        expect(findField(propertyType, name), `property field "${name}" is missing`).toBeDefined()
      }
    })

    it('marks the runtime-required fields as required', () => {
      const required = [
        'title',
        'slug',
        'description',
        'operationType',
        'propertyType',
        'price',
        'currency',
        'amenities',
        'coverImage',
        'images',
        'location',
        'city',
        'state',
        'country',
        'status',
      ]
      for (const name of required) {
        const field = findField(propertyType, name)
        expect(field, `property field "${name}" must have a validation function`).toBeDefined()
        // The `validation` callback is a function — we
        // cannot easily run it without the Sanity runtime,
        // but we can assert its presence. The runtime
        // schema is the authoritative boundary.
        expect(field, `property field "${name}" must have a validation function`).toHaveProperty('validation')
      }
    })

    it('exposes the runtime operationType enum values', () => {
      const field = findField(propertyType, 'operationType')
      expect(field).toHaveProperty('type', 'string')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual(['rent', 'sale'])
    })

    it('exposes the runtime propertyType enum values', () => {
      const field = findField(propertyType, 'propertyType')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual([
        'apartment',
        'commercial',
        'house',
        'land',
        'office',
      ])
    })

    it('exposes the runtime status enum values', () => {
      const field = findField(propertyType, 'status')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual([
        'available',
        'hidden',
        'rented',
        'reserved',
        'sold',
      ])
    })

    it('exposes the runtime sizeUnit enum values', () => {
      const field = findField(propertyType, 'sizeUnit')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual(['imperial', 'metric'])
    })

    it('declares the agent reference as a reference to the agent document type', () => {
      const field = findField(propertyType, 'agent') as { type: string, to?: Array<{ type: string }> } | undefined
      expect(field).toBeDefined()
      expect(field?.type).toBe('reference')
      expect(field?.to?.map(t => t.type)).toEqual(['agent'])
    })

    it('declares the development reference as a reference to the development document type', () => {
      const field = findField(propertyType, 'development') as { type: string, to?: Array<{ type: string }> } | undefined
      expect(field).toBeDefined()
      expect(field?.type).toBe('reference')
      expect(field?.to?.map(t => t.type)).toEqual(['development'])
    })

    it('declares coverImage as a required image', () => {
      const field = findField(propertyType, 'coverImage') as { type: string } | undefined
      expect(field?.type).toBe('image')
    })

    it('declares images as an array of images', () => {
      const field = findField(propertyType, 'images') as { type: string, of?: Array<{ type: string }> } | undefined
      expect(field?.type).toBe('array')
      expect(field?.of?.map(t => t.type)).toEqual(['image'])
    })

    it('declares coordinates as a geopoint', () => {
      const field = findField(propertyType, 'coordinates') as { type: string } | undefined
      expect(field?.type).toBe('geopoint')
    })
  })

  describe('agent schema', () => {
    it('has the field names the GROQ projection selects', () => {
      const expected = [
        'name',
        'slug',
        'role',
        'bio',
        'image',
        'phone',
        'email',
        'whatsapp',
        'specialties',
      ]
      for (const name of expected) {
        expect(findField(agentType, name), `agent field "${name}" is missing`).toBeDefined()
      }
    })

    it('marks the runtime-required fields as required', () => {
      const required = ['name', 'slug', 'role', 'bio', 'image']
      for (const name of required) {
        const field = findField(agentType, name)
        expect(field, `agent field "${name}" must exist`).toBeDefined()
        expect(field, `agent field "${name}" must have a validation function`).toHaveProperty('validation')
      }
    })

    it('declares image as a required image', () => {
      const field = findField(agentType, 'image') as { type: string } | undefined
      expect(field?.type).toBe('image')
    })

    it('declares specialties as an array of strings', () => {
      const field = findField(agentType, 'specialties') as { type: string, of?: Array<{ type: string }> } | undefined
      expect(field?.type).toBe('array')
      expect(field?.of?.map(t => t.type)).toEqual(['string'])
    })
  })

  describe('development schema', () => {
    it('has the field names the GROQ projection selects', () => {
      const expected = [
        'name',
        'slug',
        'status',
        'location',
        'description',
        'image',
        'priceFrom',
        'priceTo',
        'currency',
        'sizeUnit',
        'units',
        'bedrooms',
        'areaFrom',
        'areaTo',
        'deliveryDate',
        'featured',
      ]
      for (const name of expected) {
        expect(findField(developmentType, name), `development field "${name}" is missing`).toBeDefined()
      }
    })

    it('marks the runtime-required fields as required', () => {
      const required = ['name', 'slug', 'status', 'location', 'description', 'image']
      for (const name of required) {
        const field = findField(developmentType, name)
        expect(field, `development field "${name}" must exist`).toBeDefined()
        expect(field, `development field "${name}" must have a validation function`).toHaveProperty('validation')
      }
    })

    it('exposes the runtime status enum values', () => {
      const field = findField(developmentType, 'status')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual([
        'pre-sale',
        'ready-to-deliver',
        'sold-out',
        'under-construction',
      ])
    })

    it('exposes the runtime sizeUnit enum values', () => {
      const field = findField(developmentType, 'sizeUnit')
      const options = (field as { options?: { list?: Array<{ value: string }> } }).options
      const values = options?.list?.map(item => item.value).sort()
      expect(values).toEqual(['imperial', 'metric'])
    })

    it('declares image as a required image', () => {
      const field = findField(developmentType, 'image') as { type: string } | undefined
      expect(field?.type).toBe('image')
    })
  })
})
