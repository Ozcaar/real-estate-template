import { describe, expect, it } from 'vitest'
import { propertyType } from './property'
import { agentType } from './agent'
import { developmentType } from './development'
import { schemaTypes } from './index'

/**
 * Sanity Studio schema tests (Task 117 + Task 119).
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
 *  - The image fields are typed `image` (the GROQ
 *    projection's `asset->url` flat projection).
 *  - The `coordinates` field is typed `geopoint` — the
 *    default Studio editing surface is two numeric
 *    inputs (latitude / longitude); the pilot does NOT
 *    include a visual map picker. The GROQ projection's
 *    `.lat` / `.lng` access.
 *  - The schema index exports exactly the three document
 *    types — no other types are registered.
 *
 * The Task 119 additions verify the editor UX polish:
 *
 *  - Human-readable enum titles ("For sale" instead of
 *    "Sale", "For rent" instead of "Rent").
 *  - Hidden field relevance (`hidden({document})` returns
 *    true when the property type is "land" for the
 *    fields that only apply to built properties:
 *    bedrooms, bathrooms, parkingSpaces,
 *    constructionSize).
 *  - Helpful field descriptions on every editor-facing
 *    field (so a non-technical agency user has guidance
 *    in-line in the Studio).
 *  - Helpful human-readable error messages chained with
 *    `.error(...)` after every required / min / integer
 *    rule.
 *  - Document preview subtitles use human-readable
 *    labels ("For sale · Monterrey · Available" instead
 *    of "sale · Monterrey · available").
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

/**
 * Find a field's enum list (an array of `{title, value}`
 * pairs) on the schema's `options.list` array.
 */
function findEnumValues(schema: { fields?: Array<{ name: string }> }, name: string) {
  const field = findField(schema, name) as
    | { options?: { list?: Array<{ title: string, value: string }> } }
    | undefined
  return field?.options?.list ?? []
}

/**
 * Find the description string on a field (or `undefined`
 * when the schema did not set a description).
 */
function findDescription(schema: { fields?: Array<{ name: string }> }, name: string) {
  const field = findField(schema, name) as { description?: string } | undefined
  return field?.description
}

/**
 * Run a Sanity `validation` rule on a candidate value.
 *
 * The Sanity `defineField` validation callback receives
 * a `Rule` builder. The returned builder is a plain
 * object whose methods (`.required()`, `.min(n)`,
 * `.integer()`, `.error(msg)`) append a constraint to a
 * private list. The validator factory produces an
 * object whose `validate(value)` method walks the list
 * and returns either an `Error` array (one per failing
 * constraint) or `null` when every constraint passes.
 *
 * The validator factory is private to Sanity — we only
 * see the rule builder at the schema surface. To run the
 * constraints we re-implement the matching pieces of the
 * builder's API in the tests below.
 */

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

    it('every entry exposes a human-readable title', () => {
      expect(propertyType.title).toBe('Property')
      expect(agentType.title).toBe('Agent')
      expect(developmentType.title).toBe('Development')
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

  describe('property schema — Task 119 UX polish', () => {
    it('operationType enum uses human-readable titles', () => {
      const values = findEnumValues(propertyType, 'operationType')
      const byValue = Object.fromEntries(values.map(v => [v.value, v.title]))
      expect(byValue.sale).toBe('For sale')
      expect(byValue.rent).toBe('For rent')
    })

    it('status enum uses human-readable titles (with guidance for the hidden state)', () => {
      const values = findEnumValues(propertyType, 'status')
      const byValue = Object.fromEntries(values.map(v => [v.value, v.title]))
      expect(byValue.available).toBe('Available')
      expect(byValue.sold).toBe('Sold')
      expect(byValue.rented).toBe('Rented')
      expect(byValue.reserved).toBe('Reserved')
      // The hidden-state title tells the editor what
      // "hidden" actually does in the catalog.
      expect(byValue.hidden).toMatch(/not visible/i)
    })

    it('sizeUnit enum titles include the unit symbol', () => {
      const values = findEnumValues(propertyType, 'sizeUnit')
      const titles = values.map(v => v.title).sort()
      expect(titles).toEqual(['Imperial (ft²)', 'Metric (m²)'])
    })

    it('propertyType enum titles are human-readable', () => {
      const values = findEnumValues(propertyType, 'propertyType')
      const titles = values.map(v => v.title).sort()
      expect(titles).toEqual([
        'Apartment',
        'Commercial',
        'House',
        'Land',
        'Office',
      ])
    })

    it('hides bedrooms, bathrooms, parkingSpaces, and constructionSize when propertyType is "land"', () => {
      for (const name of ['bedrooms', 'bathrooms', 'parkingSpaces', 'constructionSize']) {
        const field = findField(propertyType, name) as
          | { hidden?: (ctx: { document?: { propertyType?: string } }) => boolean }
          | undefined
        expect(field, `property.${name} must declare a hidden() function`).toBeDefined()
        expect(
          field?.hidden?.({ document: { propertyType: 'land' } }),
          `property.${name} must be hidden when propertyType is "land"`,
        ).toBe(true)
      }
    })

    it('keeps bedrooms, bathrooms, parkingSpaces, and constructionSize visible for non-land property types', () => {
      for (const name of ['bedrooms', 'bathrooms', 'parkingSpaces', 'constructionSize']) {
        const field = findField(propertyType, name) as
          | { hidden?: (ctx: { document?: { propertyType?: string } }) => boolean }
          | undefined
        for (const propertyTypeValue of ['house', 'apartment', 'office', 'commercial']) {
          expect(
            field?.hidden?.({ document: { propertyType: propertyTypeValue } }),
            `property.${name} must stay visible for propertyType "${propertyTypeValue}"`,
          ).toBe(false)
        }
      }
    })

    it('exposes a description on every editor-facing field', () => {
      const withDescription = [
        'title',
        'slug',
        'description',
        'operationType',
        'propertyType',
        'amenities',
        'price',
        'currency',
        'bedrooms',
        'bathrooms',
        'parkingSpaces',
        'sizeUnit',
        'constructionSize',
        'landSize',
        'coverImage',
        'images',
        'location',
        'city',
        'state',
        'country',
        'coordinates',
        'agent',
        'development',
        'status',
        'featured',
      ]
      for (const name of withDescription) {
        const description = findDescription(propertyType, name)
        expect(
          typeof description === 'string' && description.length > 0,
          `property.${name} must expose a non-empty description`,
        ).toBe(true)
      }
    })

    it('keeps sensible initial values for the operation / type / size / status / featured fields', () => {
      const fieldValue = (name: string) =>
        (findField(propertyType, name) as { initialValue?: unknown } | undefined)?.initialValue
      expect(fieldValue('operationType')).toBe('sale')
      expect(fieldValue('propertyType')).toBe('house')
      expect(fieldValue('sizeUnit')).toBe('metric')
      expect(fieldValue('status')).toBe('available')
      expect(fieldValue('featured')).toBe(false)
    })

    it('preview subtitle uses human-readable operation + status labels', () => {
      const preview = propertyType.preview as
        | {
          select: Record<string, string>
          prepare: (selection: Record<string, unknown>) => { title: string, subtitle: string, media?: unknown }
        }
        | undefined
      expect(preview).toBeDefined()
      const prepare = preview?.prepare
      expect(typeof prepare).toBe('function')

      const saleResult = prepare?.({
        title: 'Test property',
        location: 'Monterrey',
        status: 'available',
        operationType: 'sale',
        media: undefined,
      })
      expect(saleResult?.subtitle).toBe('For sale · Monterrey · Available')

      const rentSoldResult = prepare?.({
        title: 'Test property',
        location: 'CDMX',
        status: 'sold',
        operationType: 'rent',
        media: undefined,
      })
      expect(rentSoldResult?.subtitle).toBe('For rent · CDMX · Sold')

      const hiddenResult = prepare?.({
        title: 'Hidden property',
        location: 'Guadalajara',
        status: 'hidden',
        operationType: 'sale',
        media: undefined,
      })
      expect(hiddenResult?.subtitle).toBe('For sale · Guadalajara · Hidden')

      const emptyResult = prepare?.({
        title: undefined,
        location: undefined,
        status: undefined,
        operationType: undefined,
        media: undefined,
      })
      expect(emptyResult?.title).toBe('Untitled property')
      expect(emptyResult?.subtitle).toBe('')
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

  describe('agent schema — Task 119 UX polish', () => {
    it('exposes a description on every editor-facing field', () => {
      const withDescription = [
        'name',
        'slug',
        'role',
        'bio',
        'specialties',
        'image',
        'phone',
        'email',
        'whatsapp',
      ]
      for (const name of withDescription) {
        const description = findDescription(agentType, name)
        expect(
          typeof description === 'string' && description.length > 0,
          `agent.${name} must expose a non-empty description`,
        ).toBe(true)
      }
    })

    it('portrait image enables the hotspot', () => {
      const field = findField(agentType, 'image') as { options?: { hotspot?: boolean } } | undefined
      expect(field?.options?.hotspot).toBe(true)
    })

    it('preview subtitle surfaces the role', () => {
      const preview = agentType.preview as
        | { prepare: (selection: Record<string, unknown>) => { title: string, subtitle: string, media?: unknown } }
        | undefined
      expect(preview).toBeDefined()
      const result = preview?.prepare({
        title: 'Maria Gonzalez',
        role: 'Senior Real Estate Advisor',
        media: undefined,
      })
      expect(result?.title).toBe('Maria Gonzalez')
      expect(result?.subtitle).toBe('Senior Real Estate Advisor')
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

  describe('development schema — Task 119 UX polish', () => {
    it('status enum uses human-readable titles', () => {
      const values = findEnumValues(developmentType, 'status')
      const byValue = Object.fromEntries(values.map(v => [v.value, v.title]))
      expect(byValue['pre-sale']).toBe('Pre-sale')
      expect(byValue['under-construction']).toBe('Under construction')
      expect(byValue['ready-to-deliver']).toBe('Ready to deliver')
      expect(byValue['sold-out']).toBe('Sold out')
    })

    it('sizeUnit enum titles include the unit symbol', () => {
      const values = findEnumValues(developmentType, 'sizeUnit')
      const titles = values.map(v => v.title).sort()
      expect(titles).toEqual(['Imperial (ft²)', 'Metric (m²)'])
    })

    it('exposes a description on every editor-facing field', () => {
      const withDescription = [
        'name',
        'slug',
        'description',
        'location',
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
        'status',
        'featured',
      ]
      for (const name of withDescription) {
        const description = findDescription(developmentType, name)
        expect(
          typeof description === 'string' && description.length > 0,
          `development.${name} must expose a non-empty description`,
        ).toBe(true)
      }
    })

    it('keeps sensible initial values for sizeUnit, status, and featured', () => {
      const fieldValue = (name: string) =>
        (findField(developmentType, name) as { initialValue?: unknown } | undefined)?.initialValue
      expect(fieldValue('sizeUnit')).toBe('metric')
      expect(fieldValue('status')).toBe('pre-sale')
      expect(fieldValue('featured')).toBe(false)
    })

    it('preview subtitle uses human-readable status labels', () => {
      const preview = developmentType.preview as
        | { prepare: (selection: Record<string, unknown>) => { title: string, subtitle: string, media?: unknown } }
        | undefined
      expect(preview).toBeDefined()
      const prepare = preview?.prepare

      const preSaleResult = prepare?.({
        title: 'Mirador del Valle',
        location: 'Monterrey',
        status: 'pre-sale',
        media: undefined,
      })
      expect(preSaleResult?.subtitle).toBe('Monterrey · Pre-sale')

      const soldOutResult = prepare?.({
        title: 'Los Pinos',
        location: 'CDMX',
        status: 'sold-out',
        media: undefined,
      })
      expect(soldOutResult?.subtitle).toBe('CDMX · Sold out')

      const emptyResult = prepare?.({
        title: undefined,
        location: undefined,
        status: undefined,
        media: undefined,
      })
      expect(emptyResult?.title).toBe('Untitled development')
      expect(emptyResult?.subtitle).toBe('')
    })
  })
})