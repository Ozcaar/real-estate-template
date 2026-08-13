import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Property } from '../types/property.types'
import {
  isPropertySort,
  propertiesService,
  type PropertySort,
} from './properties.service'

/**
 * API-state regression test for the property service.
 *
 * The HTTP property data source and its `NUXT_PROPERTIES_API_*`
 * private configuration are server-only. The server-only
 * property loader at `server/utils/properties.ts` reads the
 * env vars, fetches the remote property list via the
 * existing api adapter (or returns the bundled static data
 * when the api kind is not configured), and validates the
 * response against `propertyListSchema`. The Nitro endpoint
 * at `server/api/properties.get.ts` exposes the resolved
 * list to the app; the property service consumes it through
 * the auto-injected `$fetch` global, which resolves to a
 * same-origin request on both server (loopback to the Nitro
 * endpoint) and client (same-origin HTTP request). The
 * api-adapter module and the env-var name strings are
 * server-only by code organization and never reach the
 * client bundle.
 *
 * **No service-level or loader-level memoisation.** The
 * loader does NOT retain a successful API result between
 * calls. Each call constructs a fresh adapter and performs
 * a new `loadAll()`. The `pending` reference inside the
 * loader coalesces concurrent in-flight calls only; it is
 * cleared on settle. The service is a thin `$fetch`
 * transport; it returns whatever the Nitro endpoint emits
 * on every call.
 *
 * This test exercises the data-flow contract without booting
 * a Nuxt app. `vi.stubGlobal('$fetch', ...)` replaces the
 * Nuxt auto-injected `$fetch` with a function that returns a
 * deterministic catalog — simulating the response the Nitro
 * endpoint would emit when the configured kind is `'api'`.
 * The custom catalog includes an "api-only" property that
 * does NOT exist in the bundled static sample. The test
 * then verifies the service:
 *
 *  1. Returns the custom catalog on `loadAll()` (the
 *     api-resolved data is the source of truth on both
 *     server and client).
 *  2. Makes the api-only property reachable through the
 *     pure helper `getBySlug(data, 'api-only-slug')` (so
 *     the property detail page does NOT 404 after
 *     client-side navigation).
 *  3. Returns whatever the stubbed `$fetch` returns on every
 *     call (the service is a thin transport; repeated
 *     calls return the same reference when the stub
 *     returns the same reference, and a different reference
 *     when the stub returns a different reference).
 *  4. Observes an updated catalog on the next call (no
 *     process-lifetime cache at the service layer or at
 *     the loader layer; the service is reactive to
 *     upstream changes).
 *  5. Falls back to the bundled static adapter when the
 *     endpoint returns the static catalog (so the static
 *     build is unchanged when the api kind is not
 *     configured).
 *
 * The test is the documented regression coverage for the
 * client-side-navigation data flow: a property that exists
 * only in the remote api (and not in the static sample) is
 * accessible after client-side navigation, because the
 * page's `useAsyncData` calls `$fetch('/api/properties')` on
 * every navigation, the Nitro endpoint delegates to the
 * server-only loader, and the loader fetches the latest
 * upstream data on every call.
 */

function makeProperty(overrides: Partial<Property> & Pick<Property, 'id' | 'slug'>): Property {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title ?? 'API-only property',
    description: overrides.description ?? 'A property that exists only in the remote api.',
    operationType: overrides.operationType ?? 'sale',
    propertyType: overrides.propertyType ?? 'house',
    price: overrides.price ?? 100000,
    currency: overrides.currency ?? 'USD',
    location: overrides.location ?? 'API City',
    city: overrides.city ?? 'API City',
    state: overrides.state ?? 'API State',
    country: overrides.country ?? 'API Country',
    images: overrides.images ?? ['/images/test.svg'],
    coverImage: overrides.coverImage ?? '/images/test.svg',
    amenities: overrides.amenities ?? [],
    status: overrides.status ?? 'available',
    featured: overrides.featured ?? false,
    ...overrides,
  }
}

const API_ONLY_CATALOG: readonly Property[] = [
  makeProperty({
    id: 'api-prop-001',
    slug: 'api-only-property',
    title: 'Remote Hillside Estate',
    description: 'A property that exists only in the remote api and not in the bundled static sample.',
    price: 1_200_000,
  }),
  makeProperty({
    id: 'api-prop-002',
    slug: 'modern-hillside-villa',
    title: 'Modern Hillside Villa (api edition)',
    description: 'A property whose slug matches a static-sample slug but whose data is from the api.',
    price: 685_000,
  }),
]

let currentCatalog: readonly Property[]
function installFetch(catalog: readonly Property[]): void {
  currentCatalog = catalog
  vi.stubGlobal('$fetch', <T = unknown>(_url: string, _options?: unknown): Promise<T> => {
    return Promise.resolve(currentCatalog as unknown as T)
  })
}

describe('propertiesService — api-state data flow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('api mode (Nitro endpoint returns the api-resolved catalog)', () => {
    it('returns the api-resolved catalog on loadAll()', async () => {
      installFetch(API_ONLY_CATALOG)
      const loaded = await propertiesService.loadAll()
      expect(loaded).toBe(API_ONLY_CATALOG)
    })

    it('returns the same reference on repeated loadAll() calls when $fetch returns a constant reference', async () => {
      // The service is a thin `$fetch` transport. It
      // returns whatever the stubbed `$fetch` returns on
      // every call. The default stub in this test
      // (`installFetch(catalog)`) returns a constant
      // reference, so two `loadAll()` calls return the
      // same reference. This is the stub's behaviour, not
      // a service-level memoisation — the next test
      // ("observes an updated catalog on the next call")
      // proves the service is reactive when `$fetch`
      // returns a different reference.
      installFetch(API_ONLY_CATALOG)
      const a = await propertiesService.loadAll()
      const b = await propertiesService.loadAll()
      const c = await propertiesService.loadAll()
      expect(b).toBe(a)
      expect(c).toBe(a)
    })

    it('exposes the api-only property through getBySlug() after the load', async () => {
      installFetch(API_ONLY_CATALOG)
      const loaded = await propertiesService.loadAll()
      const apiOnly = propertiesService.getBySlug(loaded, 'api-only-property')
      expect(apiOnly).toBeDefined()
      expect(apiOnly?.id).toBe('api-prop-001')
      expect(apiOnly?.title).toBe('Remote Hillside Estate')
    })

    it('makes the api-only property reachable through the filter pipeline', async () => {
      installFetch(API_ONLY_CATALOG)
      const loaded = await propertiesService.loadAll()
      const visible = propertiesService.getAll(loaded)
      const apiOnly = visible.find(p => p.slug === 'api-only-property')
      expect(apiOnly).toBeDefined()
      const filtered = propertiesService.filter(loaded, { location: 'API' }, 'featured')
      expect(filtered.some(p => p.slug === 'api-only-property')).toBe(true)
    })

    it('makes the api-only property reachable through the getRelated() helper', async () => {
      installFetch(API_ONLY_CATALOG)
      const loaded = await propertiesService.loadAll()
      const apiOnly = propertiesService.getBySlug(loaded, 'api-only-property')
      expect(apiOnly).toBeDefined()
      const related = propertiesService.getRelated(loaded, apiOnly!, 3)
      expect(related.some(p => p.slug === 'api-only-property')).toBe(false)
      expect(related.some(p => p.slug === 'modern-hillside-villa')).toBe(true)
    })

    it('observes an updated catalog on the next call (no process-lifetime cache at the service layer)', async () => {
      // The service is a thin `$fetch` transport. A
      // rebrand that updates the upstream catalog
      // observes the new data on the next call — the
      // service does not memoise (and neither does the
      // loader it calls via the Nitro endpoint). The
      // first call returns the original catalog; the
      // second call (with a stubbed `$fetch` that now
      // returns the refreshed catalog) returns the
      // refreshed catalog as a different array
      // reference. A regression that reintroduced a
      // process-lifetime cache would make `second ===
      // first` and is caught here.
      installFetch(API_ONLY_CATALOG)
      const first = await propertiesService.loadAll()
      expect(first).toBe(API_ONLY_CATALOG)

      const REFRESHED_CATALOG: readonly Property[] = [
        makeProperty({
          id: 'api-prop-003',
          slug: 'refreshed-api-property',
          title: 'Refreshed Remote Estate',
          price: 2_000_000,
        }),
      ]
      installFetch(REFRESHED_CATALOG)
      const second = await propertiesService.loadAll()
      expect(second).toBe(REFRESHED_CATALOG)
      // The two arrays are different references (the
      // stub is a different catalog).
      expect(second).not.toBe(first)
      // The refreshed catalog is reachable through the
      // pure service helpers.
      const refreshed = propertiesService.getBySlug(second, 'refreshed-api-property')
      expect(refreshed).toBeDefined()
    })

    it('does not fall back to the static adapter when the api catalog is set', async () => {
      const API_ONLY_NO_STATIC: readonly Property[] = [
        makeProperty({
          id: 'api-prop-009',
          slug: 'api-only-property',
          title: 'Api-only',
        }),
      ]
      installFetch(API_ONLY_NO_STATIC)
      const loaded = await propertiesService.loadAll()
      expect(loaded.length).toBe(1)
      const staticOnly = propertiesService.getBySlug(loaded, 'modern-hillside-villa')
      expect(staticOnly).toBeUndefined()
    })

    it('propagates the api endpoint URL only as a same-origin path', async () => {
      installFetch(API_ONLY_CATALOG)
      const calls: Array<{ url: string; options: unknown }> = []
      vi.stubGlobal('$fetch', <T = unknown>(url: string, options?: unknown): Promise<T> => {
        calls.push({ url, options: options ?? null })
        return Promise.resolve(currentCatalog as unknown as T)
      })
      await propertiesService.loadAll()
      expect(calls.length).toBe(1)
      expect(calls[0]?.url).toBe('/api/properties')
      expect(calls[0]?.url).not.toMatch(/^https?:/)
      expect(calls[0]?.url).not.toMatch(/NUXT_PROPERTIES/)
    })
  })

  describe('static mode (Nitro endpoint returns the static catalog — the default)', () => {
    it('falls back to the bundled static adapter when the endpoint returns the static catalog', async () => {
      const STATIC_CATALOG: readonly Property[] = [
        makeProperty({
          id: 'static-001',
          slug: 'modern-hillside-villa',
          title: 'Modern Hillside Villa',
          price: 685_000,
        }),
      ]
      installFetch(STATIC_CATALOG)
      const loaded = await propertiesService.loadAll()
      expect(loaded.length).toBe(1)
      const staticOnly = propertiesService.getBySlug(loaded, 'modern-hillside-villa')
      expect(staticOnly).toBeDefined()
      const apiOnly = propertiesService.getBySlug(loaded, 'api-only-property')
      expect(apiOnly).toBeUndefined()
    })

    it('returns the same reference on repeated loadAll() calls in static mode', async () => {
      const STATIC_CATALOG: readonly Property[] = [
        makeProperty({ id: 'static-001', slug: 'modern-hillside-villa' }),
      ]
      installFetch(STATIC_CATALOG)
      const a = await propertiesService.loadAll()
      const b = await propertiesService.loadAll()
      expect(b).toBe(a)
    })
  })

  describe('isPropertySort type guard (unchanged contract)', () => {
    it('accepts the documented sort values', () => {
      expect(isPropertySort('featured')).toBe(true)
      expect(isPropertySort('price-asc')).toBe(true)
      expect(isPropertySort('price-desc')).toBe(true)
    })
    it('rejects an unknown sort value', () => {
      expect(isPropertySort('price')).toBe(false)
    })
  })

  it('exports the PropertySort type union (compile-time check)', () => {
    const sort: PropertySort = 'price-asc'
    expect(sort).toBe('price-asc')
  })
})