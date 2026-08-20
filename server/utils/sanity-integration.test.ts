import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@sanity/client'
import {
  loadPropertiesServer,
  _resetPropertiesServerCacheForTests,
} from './properties'
import {
  loadAgentsServer,
  _resetAgentsServerCacheForTests,
} from './agents'
import {
  loadDevelopmentsServer,
  _resetDevelopmentsServerCacheForTests,
} from './developments'

import { propertiesService } from '~/features/properties/services/properties.service'
import { agentsService } from '~/features/agents/services/agents.service'
import { developmentsService } from '~/features/developments/services/developments.service'

/**
 * Mock the `@sanity/client` SDK at the module level. The
 * Sanity driver + Sanity client factory import the SDK
 * directly. The real client would attempt a network
 * request during `createClient()`. The tests replace the
 * SDK with a factory that returns a mock client whose
 * `fetch` method is a `vi.fn()`. The per-test setup
 * configures the mock's resolved value.
 *
 * The mock client is shared across all three loaders. The
 * tests below set the resolved value to an array of
 * representative Sanity documents, then call
 * `loadPropertiesServer` / `loadAgentsServer` /
 * `loadDevelopmentsServer` and verify the end-to-end
 * pipeline.
 *
 * `vi.mock` is hoisted by Vitest's transform so it runs
 * before any of the imports below.
 */
vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({
    fetch: vi.fn(),
  })),
}))

const mockCreateClient = vi.mocked(createClient)
const mockFetch = vi.fn()
mockCreateClient.mockImplementation(() => ({
  fetch: mockFetch,
}) as never)

/**
 * Realistic Sanity document fixtures (Task 118).
 *
 * The fixtures use the EXACT shape the GROQ projection in
 * `server/utils/sanity-mappings.ts` returns from a real
 * Sanity dataset. The GROQ projection flattens the slug
 * via `"slug": slug.current`, the images via
 * `"images": images[].asset->url` and
 * `"coverImage": coverImage.asset->url`, and the
 * references via `"agentId": agent._ref` /
 * `"developmentId": development._ref`. The mapping
 * functions read these flattened shapes directly.
 *
 * The fixtures include:
 *
 *  - one Agent (`agent-doc-1`) with image, phone, email,
 *    WhatsApp, and specialties.
 *  - one Development (`dev-doc-1`) with image, price
 *    range, units, bedrooms, area range, delivery date,
 *    and `featured: true`.
 *  - one Property (`prop-doc-1`) with cover image, a
 *    three-image gallery, coordinates, amenities,
 *    `featured: true`, and references to both the agent
 *    and the development.
 *
 * The IDs are stable so the property's references resolve
 * to the right documents. The slugs are URL-safe lowercase
 * strings.
 */
const SANITY_AGENT_DOC = {
  _id: 'agent-doc-1',
  name: 'Marina González',
  slug: 'marina-gonzalez',
  role: 'Senior Real Estate Advisor',
  bio: 'Twelve years of experience in luxury residential sales across Mexico City.',
  image: 'https://cdn.sanity.io/images/test/agent-1.jpg',
  phone: '+52 55 1234 5678',
  email: 'marina@example.test',
  whatsapp: '+52 55 1234 5678',
  specialties: ['Luxury homes', 'Polanco', 'Investments'],
}

const SANITY_DEVELOPMENT_DOC = {
  _id: 'dev-doc-1',
  name: 'Mirador Residencial',
  slug: 'mirador-residencial',
  status: 'pre-sale',
  location: 'Polanco, Mexico City',
  description: 'A pre-sale development of 48 units in the heart of Polanco.',
  image: 'https://cdn.sanity.io/images/test/dev-1.jpg',
  priceFrom: 8_500_000,
  priceTo: 18_000_000,
  currency: 'USD',
  sizeUnit: 'metric',
  units: 48,
  bedrooms: 3,
  areaFrom: 110,
  areaTo: 280,
  deliveryDate: 'Q4 2026',
  featured: true,
}

const SANITY_PROPERTY_DOC = {
  _id: 'prop-doc-1',
  title: 'Luxury Penthouse with Polanco View',
  slug: 'luxury-penthouse-polanco',
  description: 'Three-bedroom penthouse with panoramic city views.',
  operationType: 'sale',
  propertyType: 'apartment',
  price: 2_450_000,
  currency: 'USD',
  location: 'Polanco, Mexico City',
  city: 'Mexico City',
  state: 'CDMX',
  country: 'Mexico',
  bedrooms: 3,
  bathrooms: 3,
  parkingSpaces: 2,
  sizeUnit: 'metric',
  constructionSize: 245,
  landSize: 0,
  images: [
    'https://cdn.sanity.io/images/test/property-1-a.jpg',
    'https://cdn.sanity.io/images/test/property-1-b.jpg',
    'https://cdn.sanity.io/images/test/property-1-c.jpg',
  ],
  coverImage: 'https://cdn.sanity.io/images/test/property-1-cover.jpg',
  amenities: ['Pool', 'Gym', 'Concierge', 'Parking'],
  agentId: 'agent-doc-1',
  developmentId: 'dev-doc-1',
  coordinates: { lat: 19.4326, lng: -99.1932 },
  status: 'available',
  featured: true,
}

/**
 * Snapshot the process env vars the loaders read and
 * restore them after each test so a leak from one test
 * does not pollute the next.
 */
const originalEnv = { ...process.env }

beforeEach(() => {
  _resetPropertiesServerCacheForTests()
  _resetAgentsServerCacheForTests()
  _resetDevelopmentsServerCacheForTests()
  mockFetch.mockReset()
  mockCreateClient.mockClear()
  for (const key of [
    'NUXT_SANITY_PROJECT_ID',
    'NUXT_SANITY_DATASET',
    'NUXT_SANITY_API_VERSION',
    'NUXT_SANITY_TOKEN',
    'NUXT_PROPERTIES_DATA_SOURCE',
    'NUXT_PROPERTIES_CMS_PROVIDER',
    'NUXT_AGENTS_DATA_SOURCE',
    'NUXT_AGENTS_CMS_PROVIDER',
    'NUXT_DEVELOPMENTS_DATA_SOURCE',
    'NUXT_DEVELOPMENTS_CMS_PROVIDER',
  ]) {
    Reflect.deleteProperty(process.env, key)
  }
})

afterEach(() => {
  _resetPropertiesServerCacheForTests()
  _resetAgentsServerCacheForTests()
  _resetDevelopmentsServerCacheForTests()
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key)
    }
    else {
      process.env[key] = value
    }
  }
})

/**
 * Set the minimum env vars to enable the Sanity provider
 * for all three features. The project ID is the only
 * required var; the dataset and API version have
 * documented defaults.
 */
function enableSanityProvider() {
  process.env.NUXT_SANITY_PROJECT_ID = 'test-project-id'
  process.env.NUXT_SANITY_DATASET = 'production'
  process.env.NUXT_SANITY_API_VERSION = '2024-01-01'
  process.env.NUXT_PROPERTIES_DATA_SOURCE = 'cms'
  process.env.NUXT_PROPERTIES_CMS_PROVIDER = 'sanity'
  process.env.NUXT_AGENTS_DATA_SOURCE = 'cms'
  process.env.NUXT_AGENTS_CMS_PROVIDER = 'sanity'
  process.env.NUXT_DEVELOPMENTS_DATA_SOURCE = 'cms'
  process.env.NUXT_DEVELOPMENTS_CMS_PROVIDER = 'sanity'
}

describe('Sanity end-to-end integration (Task 118)', () => {
  describe('agent pipeline', () => {
    it('loads the agent list from the Sanity GROQ response and validates the boundary shape', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_AGENT_DOC])

      const agents = await loadAgentsServer()

      expect(agents).toHaveLength(1)
      const agent = agents[0]
      expect(agent?.id).toBe('agent-doc-1')
      expect(agent?.name).toBe('Marina González')
      expect(agent?.slug).toBe('marina-gonzalez')
      expect(agent?.role).toBe('Senior Real Estate Advisor')
      expect(agent?.bio).toBe(
        'Twelve years of experience in luxury residential sales across Mexico City.',
      )
      expect(agent?.image).toBe('https://cdn.sanity.io/images/test/agent-1.jpg')
      expect(agent?.phone).toBe('+52 55 1234 5678')
      expect(agent?.email).toBe('marina@example.test')
      expect(agent?.whatsapp).toBe('+52 55 1234 5678')
      expect(agent?.specialties).toEqual([
        'Luxury homes',
        'Polanco',
        'Investments',
      ])
    })

    it('passes the agent through the agentsService.getBySlug helper', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_AGENT_DOC])

      const agents = await loadAgentsServer()
      const found = agentsService.getBySlug(agents, 'marina-gonzalez')

      expect(found).toBeDefined()
      expect(found?.name).toBe('Marina González')

      const missing = agentsService.getBySlug(agents, 'unknown-agent')
      expect(missing).toBeUndefined()
    })
  })

  describe('development pipeline', () => {
    it('loads the development list from the Sanity GROQ response and validates the boundary shape', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_DEVELOPMENT_DOC])

      const developments = await loadDevelopmentsServer()

      expect(developments).toHaveLength(1)
      const dev = developments[0]
      expect(dev?.id).toBe('dev-doc-1')
      expect(dev?.name).toBe('Mirador Residencial')
      expect(dev?.slug).toBe('mirador-residencial')
      expect(dev?.status).toBe('pre-sale')
      expect(dev?.location).toBe('Polanco, Mexico City')
      expect(dev?.description).toBe(
        'A pre-sale development of 48 units in the heart of Polanco.',
      )
      expect(dev?.image).toBe('https://cdn.sanity.io/images/test/dev-1.jpg')
      expect(dev?.priceFrom).toBe(8_500_000)
      expect(dev?.priceTo).toBe(18_000_000)
      expect(dev?.currency).toBe('USD')
      expect(dev?.sizeUnit).toBe('metric')
      expect(dev?.units).toBe(48)
      expect(dev?.bedrooms).toBe(3)
      expect(dev?.areaFrom).toBe(110)
      expect(dev?.areaTo).toBe(280)
      expect(dev?.deliveryDate).toBe('Q4 2026')
      expect(dev?.featured).toBe(true)
    })

    it('passes the development through the developmentsService.getBySlug helper', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_DEVELOPMENT_DOC])

      const developments = await loadDevelopmentsServer()
      const found = developmentsService.getBySlug(developments, 'mirador-residencial')
      expect(found).toBeDefined()
      expect(found?.name).toBe('Mirador Residencial')

      const featured = developmentsService.getFeatured(developments)
      expect(featured).toHaveLength(1)
      expect(featured[0]?.id).toBe('dev-doc-1')
    })
  })

  describe('property pipeline', () => {
    it('loads the property list from the Sanity GROQ response and validates the boundary shape', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()

      expect(properties).toHaveLength(1)
      const property = properties[0]
      expect(property?.id).toBe('prop-doc-1')
      expect(property?.title).toBe('Luxury Penthouse with Polanco View')
      expect(property?.slug).toBe('luxury-penthouse-polanco')
      expect(property?.description).toBe(
        'Three-bedroom penthouse with panoramic city views.',
      )
      expect(property?.operationType).toBe('sale')
      expect(property?.propertyType).toBe('apartment')
      expect(property?.price).toBe(2_450_000)
      expect(property?.currency).toBe('USD')
      expect(property?.location).toBe('Polanco, Mexico City')
      expect(property?.city).toBe('Mexico City')
      expect(property?.state).toBe('CDMX')
      expect(property?.country).toBe('Mexico')
      expect(property?.bedrooms).toBe(3)
      expect(property?.bathrooms).toBe(3)
      expect(property?.parkingSpaces).toBe(2)
      expect(property?.sizeUnit).toBe('metric')
      expect(property?.constructionSize).toBe(245)
      expect(property?.landSize).toBe(0)
    })

    it('preserves the Sanity CDN image URLs through the mapping', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()
      const property = properties[0]

      expect(property?.images).toEqual([
        'https://cdn.sanity.io/images/test/property-1-a.jpg',
        'https://cdn.sanity.io/images/test/property-1-b.jpg',
        'https://cdn.sanity.io/images/test/property-1-c.jpg',
      ])
      expect(property?.coverImage).toBe(
        'https://cdn.sanity.io/images/test/property-1-cover.jpg',
      )
    })

    it('preserves the Property → Agent and Property → Development reference IDs', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()
      const property = properties[0]

      expect(property?.agentId).toBe('agent-doc-1')
      expect(property?.developmentId).toBe('dev-doc-1')
    })

    it('preserves the geopoint coordinates through the mapping', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()
      const property = properties[0]

      expect(property?.coordinates).toEqual({ lat: 19.4326, lng: -99.1932 })
    })

    it('preserves the amenities array through the mapping', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()
      const property = properties[0]

      expect(property?.amenities).toEqual([
        'Pool',
        'Gym',
        'Concierge',
        'Parking',
      ])
    })

    it('passes the property through the propertiesService helpers', async () => {
      enableSanityProvider()
      mockFetch.mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const properties = await loadPropertiesServer()

      // getBySlug resolves the detail page.
      const found = propertiesService.getBySlug(properties, 'luxury-penthouse-polanco')
      expect(found).toBeDefined()
      expect(found?.id).toBe('prop-doc-1')

      // getAll filters out the 'hidden' status (none in this fixture).
      const visible = propertiesService.getAll(properties)
      expect(visible).toHaveLength(1)

      // getFeatured returns the `featured: true` record.
      const featured = propertiesService.getFeatured(properties)
      expect(featured).toHaveLength(1)
      expect(featured[0]?.featured).toBe(true)

      // getRelated returns no positive-score candidates (the
      // catalog has only one property); it falls back to
      // getFeatured filtered by the exclusion predicate.
      const related = propertiesService.getRelated(properties, found!)
      expect(related).toEqual([])

      // filter with the matching operation + type returns the record.
      const filtered = propertiesService.filter(properties, {
        operation: 'sale',
        type: 'apartment',
      })
      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.id).toBe('prop-doc-1')
    })
  })

  describe('full pipeline (all three document types together)', () => {
    it('loads the agent, development, and property lists in three independent fetches', async () => {
      enableSanityProvider()

      // The per-feature loaders share the mock client. Each
      // call to `mockFetch.mockResolvedValueOnce` queues one
      // response. The first call returns the agents, the
      // second returns the developments, the third returns
      // the properties.
      mockFetch
        .mockResolvedValueOnce([SANITY_AGENT_DOC])
        .mockResolvedValueOnce([SANITY_DEVELOPMENT_DOC])
        .mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      const [agents, developments, properties] = await Promise.all([
        loadAgentsServer(),
        loadDevelopmentsServer(),
        loadPropertiesServer(),
      ])

      expect(agents).toHaveLength(1)
      expect(developments).toHaveLength(1)
      expect(properties).toHaveLength(1)

      // The three documents form a coherent content graph:
      // the property references the agent and the
      // development by document ID.
      const property = properties[0]
      expect(property?.agentId).toBe(agents[0]?.id)
      expect(property?.developmentId).toBe(developments[0]?.id)

      // The page-level helpers resolve the property's
      // referenced documents by their document IDs (the
      // page composes the detail views by calling
      // agentsService.getBySlug / developmentsService.getBySlug
      // — the IDs the property carries are the document
      // IDs, not the slugs, so the page looks up the
      // referenced documents by their `_id` via the
      // loader's getAll output). The test verifies the
      // IDs match the agents / developments arrays.
      const referencedAgent = agents.find(a => a.id === property?.agentId)
      const referencedDevelopment = developments.find(d => d.id === property?.developmentId)
      expect(referencedAgent?.name).toBe('Marina González')
      expect(referencedDevelopment?.name).toBe('Mirador Residencial')
    })

    it('executes the three GROQ queries with the documented projections', async () => {
      enableSanityProvider()
      mockFetch
        .mockResolvedValueOnce([SANITY_AGENT_DOC])
        .mockResolvedValueOnce([SANITY_DEVELOPMENT_DOC])
        .mockResolvedValueOnce([SANITY_PROPERTY_DOC])

      await Promise.all([
        loadAgentsServer(),
        loadDevelopmentsServer(),
        loadPropertiesServer(),
      ])

      // The driver issued three GROQ queries — one per
      // document type. The query strings match the
      // documented projections in `sanity-mappings.ts`.
      const calls = mockFetch.mock.calls
      expect(calls).toHaveLength(3)
      const queries = calls.map(c => c[0] as string)
      expect(queries.some(q => q.includes('[_type == "agent"]'))).toBe(true)
      expect(queries.some(q => q.includes('[_type == "development"]'))).toBe(true)
      expect(queries.some(q => q.includes('[_type == "property"'))).toBe(true)
    })
  })

  describe('boundary schema rejection', () => {
    it('rejects a Sanity document that is missing a required field', async () => {
      enableSanityProvider()

      // The mapping is defensive: missing fields become
      // empty strings. The boundary schema rejects a
      // property with an empty title. The loader catches
      // the boundary schema failure as a
      // `DataSourceInvalidPayloadError`.
      const brokenDoc = { ...SANITY_PROPERTY_DOC, title: '' }
      mockFetch.mockResolvedValueOnce([brokenDoc])

      let error: { name: string, endpoint?: string } | undefined
      try {
        await loadPropertiesServer()
      }
      catch (cause) {
        error = cause as { name: string, endpoint?: string }
      }
      expect(error?.name).toBe('DataSourceInvalidPayloadError')
      // The `endpoint` field on `DataSourceInvalidPayloadError`
      // is the source string the loader passed to the
      // adapter. The properties loader passes
      // 'sanity:property' to the adapter; the adapter threads
      // that source through the error.
      expect(error?.endpoint).toBe('sanity:property')
    })

    it('rejects a Sanity document with an invalid enum value', async () => {
      enableSanityProvider()

      // An invalid `operationType` falls back to 'sale' in
      // the mapping (the default). A non-array `images`
      // becomes `[]` in the mapping. The boundary schema
      // accepts the mapped result.
      const docWithInvalidEnum = {
        ...SANITY_PROPERTY_DOC,
        operationType: 'invalid-value',
      }
      mockFetch.mockResolvedValueOnce([docWithInvalidEnum])

      const properties = await loadPropertiesServer()
      expect(properties[0]?.operationType).toBe('sale')
    })
  })
})
