import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@sanity/client'
import { sampleProperties } from '~/features/properties/data/properties'
import {
  createPropertiesServerAdapter,
  loadPropertiesServer,
  _resetPropertiesServerCacheForTests,
} from './properties'

/**
 * Mock the `@sanity/client` SDK at the module level. The
 * Sanity driver imports the SDK directly; the real client
 * would attempt a network request during `createClient()`.
 * The tests replace the SDK with a factory that returns a
 * mock client whose `fetch` method is a `vi.fn()`. The
 * per-test setup configures the mock's resolved value or
 * rejected value.
 *
 * `vi.mock` is hoisted by Vitest's transform so it runs
 * before any of the imports below — placing it after the
 * imports here is the cleanest way to satisfy the
 * `import/first` ESLint rule without losing the mock.
 */
vi.mock('@sanity/client', () => ({
  createClient: vi.fn(() => ({
    fetch: vi.fn(),
  })),
}))

// The SDK mock is shared across the Sanity-mode tests.
const mockCreateClient = vi.mocked(createClient)
const mockFetch = vi.fn()
mockCreateClient.mockImplementation(() => ({
  fetch: mockFetch,
}) as never)

/**
 * Tests for the server-only property loader at
 * `server/utils/properties.ts`.
 *
 * The loader owns the `NUXT_PROPERTIES_*` private
 * configuration and the static / api source selection. It
 * is the single source of truth for the resolved property
 * list on the server and is consumed by the same-origin
 * Nitro endpoint at `server/api/properties.get.ts` (and, in
 * tests, by the unit tests that exercise the static default
 * and the api-configured branch without booting a Nitro
 * server).
 *
 * **No process-lifetime cache.** The loader does NOT retain
 * a successful API result between calls. Each call to
 * {@link loadPropertiesServer} constructs a fresh adapter
 * and awaits its `loadAll()`. Concurrent calls are
 * coalesced through the in-flight `pending` promise so a
 * single render produces at most one in-flight fetch; the
 * promise is cleared on settle, so the next call performs a
 * new fetch. The api is therefore fetched on every call,
 * not "at most once per server lifetime".
 *
 * The api-adapter module and the three `NUXT_PROPERTIES_*`
 * env var name strings are server-only by code
 * organization: the loader lives in `server/utils/`, which
 * is the canonical Nuxt 4 location for server-only
 * utilities, and the loader's imports are bundled to the
 * Nitro server output only.
 */

const ENV_KIND = 'NUXT_PROPERTIES_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_PROPERTIES_API_URL'
const ENV_TIMEOUT = 'NUXT_PROPERTIES_API_TIMEOUT_MS'
const ENV_CMS_URL = 'NUXT_PROPERTIES_CMS_URL'
const ENV_CMS_TIMEOUT = 'NUXT_PROPERTIES_CMS_TIMEOUT_MS'

/**
 * Snapshot the process env vars the loader reads and
 * restore them after each test so a leak from one test
 * does not pollute the next.
 */
const originalEnv = { ...process.env }

beforeEach(() => {
  _resetPropertiesServerCacheForTests()
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
  Reflect.deleteProperty(process.env, ENV_CMS_URL)
  Reflect.deleteProperty(process.env, ENV_CMS_TIMEOUT)
})

afterEach(() => {
  _resetPropertiesServerCacheForTests()
  for (const key of [ENV_KIND, ENV_ENDPOINT, ENV_TIMEOUT, ENV_CMS_URL, ENV_CMS_TIMEOUT]) {
    Reflect.deleteProperty(process.env, key)
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key)
    }
    else {
      process.env[key] = value
    }
  }
  vi.unstubAllGlobals()
})

/**
 * Build a minimal property record that satisfies the
 * runtime `propertyListSchema`. Used by the api-mode tests
 * to construct catalog fixtures for the fetch mock.
 */
function makeApiRecord(overrides: {
  id: string
  slug: string
  title?: string
  price?: number
}): Record<string, unknown> {
  return {
    id: overrides.id,
    slug: overrides.slug,
    title: overrides.title ?? 'API property',
    description: 'A property that exists only in the remote api.',
    operationType: 'sale',
    propertyType: 'house',
    price: overrides.price ?? 1_000_000,
    currency: 'USD',
    location: 'API City',
    city: 'API City',
    state: 'API State',
    country: 'API Country',
    images: ['/images/test.svg'],
    coverImage: '/images/test.svg',
    amenities: [],
    status: 'available',
    featured: false,
  }
}

describe('server/utils/properties — server-only property loader', () => {
  describe('createPropertiesServerAdapter', () => {
    it('returns the static adapter when NUXT_PROPERTIES_DATA_SOURCE is unset', () => {
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when NUXT_PROPERTIES_DATA_SOURCE is empty', () => {
      process.env[ENV_KIND] = ''
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when NUXT_PROPERTIES_DATA_SOURCE is whitespace', () => {
      process.env[ENV_KIND] = '   '
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the cms adapter when NUXT_PROPERTIES_DATA_SOURCE=cms with a valid URL', () => {
      // The v1.1.0 M20 CMS adapter ships a simple HTTP/JSON
      // provider driver. Selecting `'cms'` with a
      // non-empty endpoint constructs the CMS adapter —
      // not a `DataSourceNotImplementedError`.
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('cms')
    })

    it('throws DataSourceMissingConfigError when NUXT_PROPERTIES_DATA_SOURCE=cms with an empty URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = ''
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_PROPERTIES_CMS_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_PROPERTIES_DATA_SOURCE=cms with a whitespace URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = '   '
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_PROPERTIES_CMS_URL',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for an unknown kind such as "graphql"', () => {
      // An unknown non-empty value is a misconfiguration:
      // the operator either mistyped a kind name or
      // requested a future source that has no adapter. The
      // loader must fail loudly rather than silently coerce
      // to static.
      process.env[ENV_KIND] = 'graphql'
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'graphql',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for a case-variant kind such as "STATIC"', () => {
      // The documented kind set is case-sensitive. The
      // type guard rejects 'STATIC' / 'Api' / 'CMS'; the
      // loader surfaces that rejection as a not-implemented
      // error naming the literal env-var value so an
      // operator can spot the typo.
      process.env[ENV_KIND] = 'STATIC'
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'STATIC',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for a case-variant "Api"', () => {
      process.env[ENV_KIND] = 'Api'
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'Api',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for an unknown kind with a future-looking name', () => {
      // The Sanity driver is selected via the `'cms'` kind +
      // the `NUXT_PROPERTIES_CMS_PROVIDER=sanity` provider
      // selector, NOT via a `'sanity'` kind value. The literal
      // `'sanity'` is not in the documented `DataSourceKind`
      // set (`'static' | 'api' | 'cms'`) and is rejected by
      // the type guard. A rebrand that mistakenly uses
      // `NUXT_PROPERTIES_DATA_SOURCE=sanity` directly fails
      // loudly rather than being silently coerced to static.
      process.env[ENV_KIND] = 'sanity'
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'sanity',
        }),
      )
    })

    it('returns the api adapter when NUXT_PROPERTIES_DATA_SOURCE=api with a valid endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('api')
    })

    it('throws DataSourceMissingConfigError when NUXT_PROPERTIES_DATA_SOURCE=api with an empty endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = ''
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_PROPERTIES_API_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_PROPERTIES_DATA_SOURCE=api with a whitespace endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = '   '
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_PROPERTIES_API_URL',
        }),
      )
    })
  })

  describe('loadPropertiesServer — static default', () => {
    it('resolves to the bundled static sample data when NUXT_PROPERTIES_DATA_SOURCE is unset', async () => {
      const loaded = await loadPropertiesServer()
      // Each call constructs a fresh static adapter, which
      // re-runs `propertyListSchema.parse(...)`. The data
      // is structurally identical to the bundled sample
      // but the reference is fresh.
      expect(loaded).toHaveLength(sampleProperties.length)
      const sampleSlugs = new Set(sampleProperties.map(p => p.slug))
      for (const p of loaded) {
        expect(sampleSlugs.has(p.slug)).toBe(true)
      }
      // The bundled static catalog includes the documented
      // 6-record placeholder; assert the documented
      // `modern-hillside-villa` slug is reachable so a
      // future regression that returns an empty array is
      // caught here.
      expect(loaded.some(p => p.slug === 'modern-hillside-villa')).toBe(true)
    })

    it('resolves to the bundled static data when NUXT_PROPERTIES_DATA_SOURCE=static (the historical default)', async () => {
      // The historical default was the literal string
      // 'static'. A rebrand that explicitly sets it should
      // still get the static catalog; only the literal
      // 'api' triggers the api branch.
      process.env[ENV_KIND] = 'static'
      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(sampleProperties.length)
    })

    it('returns structurally-equal data on every call (each call constructs a fresh adapter)', async () => {
      // The loader does NOT memoise. Each call constructs a
      // fresh adapter; the static adapter re-runs the Zod
      // parse at construction, so two calls produce two
      // different array references that are structurally
      // equal. The user-visible contract is "the data is
      // the bundled static catalog" — not "the same array
      // reference is returned by identity".
      const a = await loadPropertiesServer()
      const b = await loadPropertiesServer()
      // The references are different (no process-lifetime
      // cache).
      expect(b).not.toBe(a)
      // The data is structurally equal.
      expect(b).toHaveLength(a.length)
      const aSlugs = new Set(a.map(p => p.slug))
      for (const p of b) {
        expect(aSlugs.has(p.slug)).toBe(true)
      }
    })
  })

  describe('loadPropertiesServer — api mode', () => {
    it('fetches the remote list via the api adapter when NUXT_PROPERTIES_DATA_SOURCE=api', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'

      // Mock the platform fetch so the api adapter's
      // request resolves with a known catalog without
      // hitting the network. The api adapter uses
      // `globalThis.fetch(input, init)`; the mock is
      // registered on `globalThis` so the adapter's call
      // resolves through it.
      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-only-property' })]
      const fetchMock = vi.fn(async (_input: string, _init?: unknown) => {
        return new Response(JSON.stringify(apiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const loaded = await loadPropertiesServer()
      // The first call performs the fetch; the resolved
      // data is the api response (the slug
      // `api-only-property` is not in the bundled static
      // sample).
      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.slug).toBe('api-only-property')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('uses the configured NUXT_PROPERTIES_API_TIMEOUT_MS in milliseconds', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      process.env[ENV_TIMEOUT] = '5000'

      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-001' })]
      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        // The api adapter passes an `AbortController`
        // signal through the init parameter; the timeout
        // is the documented 5 000 ms. Asserting the signal
        // is a smoke test; asserting the timeout value
        // would require a timer mock and is out of scope
        // here (the timeout is exercised in
        // `api-adapter.test.ts`).
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify(apiResponse), { status: 200 })
      })

      await loadPropertiesServer()
    })

    it('falls back to the documented 10 000 ms default when NUXT_PROPERTIES_API_TIMEOUT_MS is unset', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      // No ENV_TIMEOUT — the loader should default to 10
      // 000.

      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-001' })]
      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify(apiResponse), { status: 200 })
      })

      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
    })

    it('re-throws DataSourceHttpError on a non-2xx response from the remote api', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))

      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceHttpError',
        status: 500,
        endpoint: 'https://example.test/properties',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the api response fails Zod validation', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      // The api returns a 200 with a body that does NOT
      // match the `propertyListSchema` (missing required
      // fields). The api adapter's `safeParse` rejects
      // the payload and raises
      // `DataSourceInvalidPayloadError`.
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify([{ id: 'broken' }]), // missing slug, title, …
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'https://example.test/properties',
      })
    })

    it('does not memoise a failed load (a retry can run)', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        if (callCount === 1) {
          return new Response('{}', { status: 500 })
        }
        // Second call: success.
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'api-001', slug: 'api-001' }),
        ]), { status: 200 })
      })

      await expect(loadPropertiesServer()).rejects.toBeInstanceOf(Error)
      // The loader does not memoise successes OR
      // failures. The second call must perform a new
      // fetch (fresh adapter construction).
      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
      expect(callCount).toBe(2)
    })
  })

  describe('loadPropertiesServer — cms mode', () => {
    it('fetches the remote list via the cms adapter when NUXT_PROPERTIES_DATA_SOURCE=cms', async () => {
      // The v1.1.0 M20 CMS adapter is the simple HTTP/JSON
      // provider driver + `propertyListSchema` boundary.
      // The endpoint contract is identical to the api
      // adapter's — the cms path differs only in the
      // boundary shape (cms goes through the
      // `cms-driver.ts` contract).
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'

      const cmsResponse = [makeApiRecord({ id: 'cms-001', slug: 'cms-only-property' })]
      const fetchMock = vi.fn(async (_input: string, _init?: unknown) => {
        return new Response(JSON.stringify(cmsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.slug).toBe('cms-only-property')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('re-throws DataSourceHttpError on a non-2xx response from the CMS endpoint', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 502 }))

      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceHttpError',
        status: 502,
        endpoint: 'https://cms.example.test/properties',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the CMS response fails Zod validation', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify([{ id: 'broken' }]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'cms:NUXT_PROPERTIES_CMS_URL',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the CMS response is not a JSON array', async () => {
      // The cms driver checks the structural shape BEFORE
      // the schema runs — a non-array body is a hard
      // error at the boundary, not a misleading Zod issue.
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify({ not: 'an array' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'https://cms.example.test/properties',
      })
    })

    it('honors NUXT_PROPERTIES_CMS_TIMEOUT_MS as the request timeout', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      process.env[ENV_CMS_TIMEOUT] = '5000'

      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'cms-001', slug: 'cms-001' }),
        ]), { status: 200 })
      })

      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
    })

    it('falls back to the documented 10 000 ms default when NUXT_PROPERTIES_CMS_TIMEOUT_MS is unset', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'

      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'cms-001', slug: 'cms-001' }),
        ]), { status: 200 })
      })

      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
    })

    it('does not memoise a failed CMS load (a retry can run)', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        if (callCount === 1) {
          return new Response('{}', { status: 500 })
        }
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'cms-001', slug: 'cms-001' }),
        ]), { status: 200 })
      })

      await expect(loadPropertiesServer()).rejects.toBeInstanceOf(Error)
      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
      expect(callCount).toBe(2)
    })

    it('two sequential CMS loads observe different upstream responses (no permanent cache)', async () => {
      // The loader does not memoise successes OR failures —
      // the CMS path follows the same no-permanent-cache
      // contract as the api path.
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'

      const firstCatalog = [
        makeApiRecord({ id: 'cms-001', slug: 'first-cms-only-property' }),
      ]
      const secondCatalog = [
        makeApiRecord({ id: 'cms-002', slug: 'second-cms-only-property' }),
      ]
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        return new Response(
          JSON.stringify(callCount === 1 ? firstCatalog : secondCatalog),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      })

      const first = await loadPropertiesServer()
      const second = await loadPropertiesServer()
      expect(first[0]?.slug).toBe('first-cms-only-property')
      expect(second[0]?.slug).toBe('second-cms-only-property')
      expect(callCount).toBe(2)
    })
  })

  describe('loadPropertiesServer — sanity mode (Task 115)', () => {
    /**
     * Sanity-specific env vars the loaders read when the
     * provider is `sanity`. The shared-project / shared-dataset
     * model means these are not duplicated per feature.
     */
    const ENV_SANITY_PROJECT_ID = 'NUXT_SANITY_PROJECT_ID'
    const ENV_SANITY_DATASET = 'NUXT_SANITY_DATASET'
    const ENV_SANITY_API_VERSION = 'NUXT_SANITY_API_VERSION'
    const ENV_SANITY_TOKEN = 'NUXT_SANITY_TOKEN'
    const ENV_PROVIDER = 'NUXT_PROPERTIES_CMS_PROVIDER'

    beforeEach(() => {
      // Reset the mock state before each Sanity test.
      mockFetch.mockReset()
      mockCreateClient.mockClear()
      // Set the minimum required env vars (the project ID).
      // The dataset and API version have documented defaults.
      process.env[ENV_SANITY_PROJECT_ID] = 'abc123'
      process.env[ENV_SANITY_DATASET] = 'production'
      process.env[ENV_SANITY_API_VERSION] = '2024-01-01'
      process.env[ENV_PROVIDER] = 'sanity'
      process.env[ENV_KIND] = 'cms'
    })

    it('requires NUXT_PROPERTIES_CMS_PROVIDER=sanity to wire the Sanity driver', () => {
      // When the provider is the default `http-json`, the
      // existing CMS path requires a URL; the Sanity path
      // is not used.
      Reflect.deleteProperty(process.env, ENV_PROVIDER)
      process.env[ENV_CMS_URL] = 'https://cms.example.test/properties'
      const adapter = createPropertiesServerAdapter()
      expect(adapter.id).toBe('cms')
    })

    it('throws DataSourceMissingConfigError when NUXT_SANITY_PROJECT_ID is unset', () => {
      Reflect.deleteProperty(process.env, ENV_SANITY_PROJECT_ID)
      expect(() => createPropertiesServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_SANITY_PROJECT_ID',
        }),
      )
    })

    it('constructs a Sanity client with the resolved configuration', async () => {
      mockFetch.mockResolvedValueOnce([])
      await loadPropertiesServer()
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2024-01-01',
          useCdn: true,
        }),
      )
    })

    it('falls back to the default dataset when NUXT_SANITY_DATASET is unset', async () => {
      Reflect.deleteProperty(process.env, ENV_SANITY_DATASET)
      mockFetch.mockResolvedValueOnce([])
      await loadPropertiesServer()
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({ dataset: 'production' }),
      )
    })

    it('falls back to the default API version when NUXT_SANITY_API_VERSION is unset', async () => {
      Reflect.deleteProperty(process.env, ENV_SANITY_API_VERSION)
      mockFetch.mockResolvedValueOnce([])
      await loadPropertiesServer()
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({ apiVersion: '2024-01-01' }),
      )
    })

    it('does not pass the token when NUXT_SANITY_TOKEN is unset', async () => {
      Reflect.deleteProperty(process.env, ENV_SANITY_TOKEN)
      mockFetch.mockResolvedValueOnce([])
      await loadPropertiesServer()
      const cfg = mockCreateClient.mock.calls[0]?.[0] as Record<string, unknown>
      expect(Object.prototype.hasOwnProperty.call(cfg, 'token')).toBe(false)
    })

    it('passes the token when NUXT_SANITY_TOKEN is set', async () => {
      process.env[ENV_SANITY_TOKEN] = 'read-token-xyz'
      mockFetch.mockResolvedValueOnce([])
      await loadPropertiesServer()
      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'read-token-xyz' }),
      )
    })

    it('executes the property GROQ query and maps the result', async () => {
      const sanityDocs = [
        {
          _id: 'p-sanity-1',
          title: 'Sanity Property 1',
          slug: 'sanity-property-1',
          description: 'A property from Sanity.',
          operationType: 'sale',
          propertyType: 'house',
          price: 1_200_000,
          currency: 'USD',
          location: 'Sanity City',
          city: 'Sanity City',
          state: 'Sanity State',
          country: 'Sanity Country',
          images: ['https://cdn.sanity.io/images/xxx/p-1.jpg'],
          coverImage: 'https://cdn.sanity.io/images/xxx/p-1-cover.jpg',
          amenities: ['Pool'],
          agentId: 'agent-1',
          developmentId: 'dev-1',
          coordinates: { lat: 19.4, lng: -99.1 },
          status: 'available',
          featured: true,
        },
      ]
      mockFetch.mockResolvedValueOnce(sanityDocs)
      const loaded = await loadPropertiesServer()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.id).toBe('p-sanity-1')
      expect(loaded[0]?.slug).toBe('sanity-property-1')
      expect(loaded[0]?.images).toEqual([
        'https://cdn.sanity.io/images/xxx/p-1.jpg',
      ])
      expect(loaded[0]?.coverImage).toBe(
        'https://cdn.sanity.io/images/xxx/p-1-cover.jpg',
      )
      expect(loaded[0]?.agentId).toBe('agent-1')
      expect(loaded[0]?.developmentId).toBe('dev-1')
      expect(loaded[0]?.status).toBe('available')
      expect(loaded[0]?.featured).toBe(true)
    })

    it('re-throws DataSourceHttpError when the Sanity client throws a statusCode-tagged error', async () => {
      const err = new Error('Upstream 500') as Error & { statusCode: number }
      err.statusCode = 500
      mockFetch.mockRejectedValueOnce(err)
      await expect(loadPropertiesServer()).rejects.toMatchObject({
        name: 'DataSourceHttpError',
        status: 500,
      })
    })
  })

  describe('loadPropertiesServer — no process-lifetime cache (api mode)', () => {
    it('two sequential api loads observe different upstream responses', async () => {
      // This is the regression that motivated the
      // process-lifetime-cache removal: a successful API
      // result is NOT retained between calls. The first
      // call returns the first catalog; the second call
      // performs a NEW fetch and returns the second
      // catalog. A rebrand that ships an updated catalog
      // observes the updated data on the next request,
      // not a stale snapshot.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'

      const firstCatalog = [
        makeApiRecord({ id: 'api-001', slug: 'first-api-only-property', title: 'First' }),
      ]
      const secondCatalog = [
        makeApiRecord({ id: 'api-002', slug: 'second-api-only-property', title: 'Second' }),
      ]
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify(firstCatalog), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify(secondCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      // The first call observes the first catalog.
      const first = await loadPropertiesServer()
      expect(first).toHaveLength(1)
      expect(first[0]?.slug).toBe('first-api-only-property')

      // The second call performs a NEW fetch and observes
      // the second catalog — the loader does NOT memoise
      // the first call's response.
      const second = await loadPropertiesServer()
      expect(second).toHaveLength(1)
      expect(second[0]?.slug).toBe('second-api-only-property')
      // Two distinct fetches, not one.
      expect(callCount).toBe(2)
      // Two distinct array references, not the same one.
      expect(second).not.toBe(first)
    })

    it('three sequential api loads each perform a new fetch and observe the latest catalog', async () => {
      // The contract is "fetch on every call, not at
      // most once". A long-running server observes a
      // fresh upstream snapshot on every request, not a
      // process-lifetime stale value.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'

      const catalogs = [
        [makeApiRecord({ id: 'a-1', slug: 'a-1' })],
        [makeApiRecord({ id: 'b-1', slug: 'b-1' }), makeApiRecord({ id: 'b-2', slug: 'b-2' })],
        [makeApiRecord({ id: 'c-1', slug: 'c-1' })],
      ]
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        const catalog = catalogs[callCount] ?? catalogs[catalogs.length - 1]
        callCount++
        return new Response(JSON.stringify(catalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })

      const a = await loadPropertiesServer()
      const b = await loadPropertiesServer()
      const c = await loadPropertiesServer()
      expect(a).toHaveLength(1)
      expect(b).toHaveLength(2)
      expect(c).toHaveLength(1)
      expect(a[0]?.slug).toBe('a-1')
      expect(b.map(p => p.slug)).toEqual(['b-1', 'b-2'])
      expect(c[0]?.slug).toBe('c-1')
      expect(callCount).toBe(3)
    })

    it('a successful api response is not retained across two sequential calls (different references)', async () => {
      // Pin the absence at the reference level. A future
      // regression that reintroduces a permanent cache
      // would make `second === first` and is caught here.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify([
        makeApiRecord({ id: 'api-001', slug: 'api-001' }),
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

      const first = await loadPropertiesServer()
      const second = await loadPropertiesServer()
      // The two arrays are structurally equal but
      // reference-different — each call constructed a
      // fresh adapter and got a fresh Zod-parsed array.
      expect(second).not.toBe(first)
      expect(second).toHaveLength(first.length)
      const firstSlugs = new Set(first.map(p => p.slug))
      for (const p of second) {
        expect(firstSlugs.has(p.slug)).toBe(true)
      }
    })
  })

  describe('loadPropertiesServer — concurrent-call coalescing', () => {
    it('coalesces concurrent api calls into a single fetch (in-flight promise)', async () => {
      // The `pending` reference is the loader's only
      // shared state. While a call is resolving, other
      // concurrent callers share the same promise. After
      // settle, the reference is cleared and the next
      // call performs a new fetch.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'

      let fetchStarted = 0
      let releaseFetch: (() => void) | null = null
      const fetchStartedPromise = new Promise<void>((resolve) => {
        releaseFetch = resolve
      })
      vi.stubGlobal('fetch', async () => {
        fetchStarted++
        // Hold the first fetch open until the test
        // releases it. While held, the second and third
        // concurrent callers should NOT start new
        // fetches; they should share the in-flight
        // promise.
        await fetchStartedPromise
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'api-001', slug: 'api-only-property' }),
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      })

      // Start three concurrent calls without awaiting
      // any of them. The first call starts the fetch;
      // the second and third calls see the in-flight
      // `pending` promise and return it instead of
      // starting a new fetch.
      const first = loadPropertiesServer()
      const second = loadPropertiesServer()
      const third = loadPropertiesServer()

      // Yield once so the first call can start the
      // fetch and populate `pending`.
      await Promise.resolve()
      await Promise.resolve()
      expect(fetchStarted).toBe(1)

      // Release the fetch and await all three
      // concurrent callers.
      releaseFetch?.()
      const [a, b, c] = await Promise.all([first, second, third])
      expect(a).toHaveLength(1)
      expect(b).toHaveLength(1)
      expect(c).toHaveLength(1)
      // A single fetch served all three concurrent
      // callers.
      expect(fetchStarted).toBe(1)
      // All three callers received the same array
      // reference — the in-flight promise resolves to
      // the same value for every concurrent caller.
      expect(b).toBe(a)
      expect(c).toBe(a)
    })

    it('clears the in-flight promise after settle so the next call performs a new fetch', async () => {
      // The `pending` reference is cleared in the
      // `finally` block of the loader's internal IIFE.
      // After the first call resolves, the next call
      // constructs a fresh adapter and starts a new
      // fetch — the second call's reference-different
      // array is the regression for the removed
      // process-lifetime cache.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/properties'

      let callCount = 0
      const fetchMock = vi.fn(async () => {
        callCount++
        const id = `api-${String(callCount).padStart(3, '0')}`
        const slug = `api-only-${id}`
        return new Response(JSON.stringify([
          makeApiRecord({ id, slug }),
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      })
      vi.stubGlobal('fetch', fetchMock)

      const first = await loadPropertiesServer()
      // After settle, `pending` is null. The next call
      // must construct a fresh adapter and start a new
      // fetch.
      const second = await loadPropertiesServer()
      expect(callCount).toBe(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(first[0]?.slug).toBe('api-only-api-001')
      expect(second[0]?.slug).toBe('api-only-api-002')
    })
  })
})
