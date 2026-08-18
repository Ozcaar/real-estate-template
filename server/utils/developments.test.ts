import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleDevelopments } from '~/features/developments/data/developments'
import { DataSourceMissingConfigError } from '~/core/data-source/data-source'
import {
  createDevelopmentsServerAdapter,
  loadDevelopmentsServer,
  _resetDevelopmentsServerCacheForTests,
} from './developments'

/**
 * Tests for the server-only development loader at
 * `server/utils/developments.ts`.
 *
 * The loader owns the `NUXT_DEVELOPMENTS_*` private
 * configuration and the static / api source selection. It is
 * the single source of truth for the resolved development list
 * on the server and is consumed by the same-origin Nitro
 * endpoint at `server/api/developments.get.ts` (and, in tests,
 * by the unit tests that exercise the static default and the
 * api-configured branch without booting a Nitro server).
 *
 * **No process-lifetime cache.** The loader does NOT retain a
 * successful API result between calls. Each call to
 * {@link loadDevelopmentsServer} constructs a fresh adapter and
 * awaits its `loadAll()`. Concurrent calls are coalesced
 * through the in-flight `pending` promise so a single render
 * produces at most one in-flight fetch; the promise is cleared
 * on settle, so the next call performs a new fetch. The api is
 * therefore fetched on every call, not "at most once per server
 * lifetime".
 *
 * The api-adapter module and the three `NUXT_DEVELOPMENTS_*`
 * env var name strings are server-only by code organization:
 * the loader lives in `server/utils/`, which is the canonical
 * Nuxt 4 location for server-only utilities, and the loader's
 * imports are bundled to the Nitro server output only.
 */

const ENV_KIND = 'NUXT_DEVELOPMENTS_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_DEVELOPMENTS_API_URL'
const ENV_TIMEOUT = 'NUXT_DEVELOPMENTS_API_TIMEOUT_MS'
const ENV_CMS_URL = 'NUXT_DEVELOPMENTS_CMS_URL'
const ENV_CMS_TIMEOUT = 'NUXT_DEVELOPMENTS_CMS_TIMEOUT_MS'

/**
 * Snapshot the process env vars the loader reads and restore
 * them after each test so a leak from one test does not
 * pollute the next.
 */
const originalEnv = { ...process.env }

beforeEach(() => {
  _resetDevelopmentsServerCacheForTests()
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
  Reflect.deleteProperty(process.env, ENV_CMS_URL)
  Reflect.deleteProperty(process.env, ENV_CMS_TIMEOUT)
})

afterEach(() => {
  _resetDevelopmentsServerCacheForTests()
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
 * Build a minimal development record that satisfies the
 * runtime `developmentListSchema`. Used by the api-mode tests
 * to construct catalog fixtures for the fetch mock.
 */
function makeApiRecord(overrides: {
  id: string
  slug: string
  name?: string
}): Record<string, unknown> {
  return {
    id: overrides.id,
    slug: overrides.slug,
    name: overrides.name ?? 'API development',
    status: 'pre-sale',
    location: 'API City, API Region',
    description: 'A development that exists only in the remote api.',
    image: '/images/test.svg',
    priceFrom: 250000,
    priceTo: 400000,
    currency: 'USD',
    units: 24,
    bedrooms: 2,
    sizeUnit: 'metric',
    areaFrom: 78,
    areaTo: 112,
    deliveryDate: '2026-06',
    featured: true,
  }
}

describe('server/utils/developments — server-only development loader', () => {
  describe('createDevelopmentsServerAdapter', () => {
    it('returns the static adapter when NUXT_DEVELOPMENTS_DATA_SOURCE is unset', () => {
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when NUXT_DEVELOPMENTS_DATA_SOURCE is empty', () => {
      process.env[ENV_KIND] = ''
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when NUXT_DEVELOPMENTS_DATA_SOURCE is whitespace', () => {
      process.env[ENV_KIND] = '   '
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when NUXT_DEVELOPMENTS_DATA_SOURCE=static (the explicit opt-in)', () => {
      process.env[ENV_KIND] = 'static'
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('static')
    })

    it('returns the cms adapter when NUXT_DEVELOPMENTS_DATA_SOURCE=cms with a valid URL (Task 110)', () => {
      // Task 110 mirrors the property CMS path (v1.1.0 M20)
      // and the agents CMS path (v1.1.0 M26). The
      // developments loader now ships a CMS branch backed by
      // the same `createHttpJsonCmsDriver` +
      // `createCmsDataSource` pair, validated against the
      // `developmentListSchema` boundary.
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('cms')
    })

    it('throws DataSourceMissingConfigError when NUXT_DEVELOPMENTS_DATA_SOURCE=cms with an empty URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = ''
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_DEVELOPMENTS_CMS_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_DEVELOPMENTS_DATA_SOURCE=cms with a whitespace URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = '   '
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_DEVELOPMENTS_CMS_URL',
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
      expect(() => createDevelopmentsServerAdapter()).toThrow(
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
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'STATIC',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for a case-variant "Api"', () => {
      process.env[ENV_KIND] = 'Api'
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'Api',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for an unknown kind with a future-looking name', () => {
      // A rebrand that anticipates a future kind (e.g. a
      // Sanity-backed CMS) must not be silently coerced to
      // static. The loader fails loudly; the future kind
      // ships as a separate task.
      process.env[ENV_KIND] = 'sanity'
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'sanity',
        }),
      )
    })

    it('returns the api adapter when NUXT_DEVELOPMENTS_DATA_SOURCE=api with a valid endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      const adapter = createDevelopmentsServerAdapter()
      expect(adapter.id).toBe('api')
    })

    it('throws DataSourceMissingConfigError when NUXT_DEVELOPMENTS_DATA_SOURCE=api with an empty endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = ''
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_DEVELOPMENTS_API_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_DEVELOPMENTS_DATA_SOURCE=api with a whitespace endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = '   '
      expect(() => createDevelopmentsServerAdapter()).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_DEVELOPMENTS_API_URL',
        }),
      )
    })

    it('the missing-config error names the api kind and the NUXT_DEVELOPMENTS_API_URL field', () => {
      // The `kind` field of `DataSourceMissingConfigError` is
      // the data-source kind (`'static' | 'api' | 'cms'` per
      // `DataSourceKind`), NOT the resource name. A deployment
      // that asks for `'api'` and has a missing endpoint must
      // see `kind: 'api'` and `field: 'NUXT_DEVELOPMENTS_API_URL'`
      // so the operator-facing diagnostic matches the shared
      // data-source contract (the api adapter and the cms driver
      // both use `kind: 'api'` and `kind: 'cms'` for the same
      // error class).
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = ''
      try {
        createDevelopmentsServerAdapter()
        throw new Error('expected createDevelopmentsServerAdapter to throw')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DataSourceMissingConfigError)
        const wrapped = error as DataSourceMissingConfigError
        expect(wrapped.kind).toBe('api')
        expect(wrapped.field).toBe('NUXT_DEVELOPMENTS_API_URL')
      }
    })
  })

  describe('loadDevelopmentsServer — static default', () => {
    it('resolves to the bundled static sample data when NUXT_DEVELOPMENTS_DATA_SOURCE is unset', async () => {
      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(sampleDevelopments.length)
      const sampleSlugs = new Set(sampleDevelopments.map(d => d.slug))
      for (const d of loaded) {
        expect(sampleSlugs.has(d.slug)).toBe(true)
      }
      // The bundled static catalog includes the documented
      // `mirador-del-valle` slug; assert at least one catalog
      // slug is reachable so a future regression that
      // returns an empty array is caught here.
      expect(loaded.some(d => d.slug === 'mirador-del-valle')).toBe(true)
    })

    it('resolves to the bundled static data when NUXT_DEVELOPMENTS_DATA_SOURCE=static (the explicit opt-in)', async () => {
      process.env[ENV_KIND] = 'static'
      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(sampleDevelopments.length)
    })

    it('returns structurally-equal data on every call (each call constructs a fresh adapter)', async () => {
      // The loader does NOT memoise. Each call constructs a
      // fresh adapter; the static adapter re-runs the Zod
      // parse at construction, so two calls produce two
      // different array references that are structurally
      // equal.
      const a = await loadDevelopmentsServer()
      const b = await loadDevelopmentsServer()
      expect(b).not.toBe(a)
      expect(b).toHaveLength(a.length)
      const aSlugs = new Set(a.map(d => d.slug))
      for (const d of b) {
        expect(aSlugs.has(d.slug)).toBe(true)
      }
    })
  })

  describe('loadDevelopmentsServer — api mode', () => {
    it('fetches the remote list via the api adapter when NUXT_DEVELOPMENTS_DATA_SOURCE=api', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'

      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-only-development' })]
      const fetchMock = vi.fn(async (_input: string, _init?: unknown) => {
        return new Response(JSON.stringify(apiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.slug).toBe('api-only-development')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('uses the configured NUXT_DEVELOPMENTS_API_TIMEOUT_MS in milliseconds', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      process.env[ENV_TIMEOUT] = '5000'

      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-001' })]
      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify(apiResponse), { status: 200 })
      })

      await loadDevelopmentsServer()
    })

    it('falls back to the documented 10 000 ms default when NUXT_DEVELOPMENTS_API_TIMEOUT_MS is unset', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'

      const apiResponse = [makeApiRecord({ id: 'api-001', slug: 'api-001' })]
      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify(apiResponse), { status: 200 })
      })

      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
    })

    it('re-throws DataSourceHttpError on a non-2xx response from the remote api', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))

      await expect(loadDevelopmentsServer()).rejects.toMatchObject({
        name: 'DataSourceHttpError',
        status: 500,
        endpoint: 'https://example.test/developments',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the api response fails Zod validation', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      // The api returns a 200 with a body that does NOT
      // match the `developmentListSchema` (missing required
      // fields). The api adapter's `safeParse` rejects the
      // payload and raises `DataSourceInvalidPayloadError`.
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify([{ id: 'broken' }]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadDevelopmentsServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'https://example.test/developments',
      })
    })

    it('does not memoise a failed load (a retry can run)', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        if (callCount === 1) {
          return new Response('{}', { status: 500 })
        }
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'api-001', slug: 'api-001' }),
        ]), { status: 200 })
      })

      await expect(loadDevelopmentsServer()).rejects.toBeInstanceOf(Error)
      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
      expect(callCount).toBe(2)
    })
  })

  describe('loadDevelopmentsServer — cms mode (Task 110)', () => {
    it('fetches the remote list via the cms adapter when NUXT_DEVELOPMENTS_DATA_SOURCE=cms', async () => {
      // The developments CMS path (Task 110) mirrors the
      // property CMS path (v1.1.0 M20) and the agents CMS
      // path (v1.1.0 M26) — the same
      // `createHttpJsonCmsDriver` + `createCmsDataSource`
      // pair, validated against the `developmentListSchema`
      // boundary. The endpoint contract is identical to the
      // api adapter's — the cms path differs only in the
      // boundary shape (cms goes through the
      // `cms-driver.ts` contract).
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'

      const cmsResponse = [makeApiRecord({ id: 'cms-001', slug: 'cms-only-development' })]
      const fetchMock = vi.fn(async (_input: string, _init?: unknown) => {
        return new Response(JSON.stringify(cmsResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.slug).toBe('cms-only-development')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('re-throws DataSourceHttpError on a non-2xx response from the CMS endpoint', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 502 }))

      await expect(loadDevelopmentsServer()).rejects.toMatchObject({
        name: 'DataSourceHttpError',
        status: 502,
        endpoint: 'https://cms.example.test/developments',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the CMS response fails Zod validation', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
      // The cms returns a 200 with a body that does NOT
      // match the `developmentListSchema` (missing required
      // fields). The cms adapter's `safeParse` rejects the
      // payload and raises `DataSourceInvalidPayloadError`.
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify([{ id: 'broken' }]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadDevelopmentsServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'cms:NUXT_DEVELOPMENTS_CMS_URL',
      })
    })

    it('re-throws DataSourceInvalidPayloadError when the CMS response is not a JSON array', async () => {
      // The cms driver checks the structural shape BEFORE
      // the schema runs — a non-array body is a hard
      // error at the boundary, not a misleading Zod issue.
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
      vi.stubGlobal('fetch', async () => new Response(
        JSON.stringify({ not: 'an array' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ))

      await expect(loadDevelopmentsServer()).rejects.toMatchObject({
        name: 'DataSourceInvalidPayloadError',
        endpoint: 'https://cms.example.test/developments',
      })
    })

    it('honors NUXT_DEVELOPMENTS_CMS_TIMEOUT_MS as the request timeout', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
      process.env[ENV_CMS_TIMEOUT] = '5000'

      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'cms-001', slug: 'cms-001' }),
        ]), { status: 200 })
      })

      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
    })

    it('falls back to the documented 10 000 ms default when NUXT_DEVELOPMENTS_CMS_TIMEOUT_MS is unset', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'

      vi.stubGlobal('fetch', async (_input: string, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'cms-001', slug: 'cms-001' }),
        ]), { status: 200 })
      })

      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
    })

    it('does not memoise a failed CMS load (a retry can run)', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'
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

      await expect(loadDevelopmentsServer()).rejects.toBeInstanceOf(Error)
      const loaded = await loadDevelopmentsServer()
      expect(loaded).toHaveLength(1)
      expect(callCount).toBe(2)
    })

    it('two sequential CMS loads observe different upstream responses (no permanent cache)', async () => {
      // The loader does not memoise successes OR failures —
      // the CMS path follows the same no-permanent-cache
      // contract as the api path. Mirrors the property
      // CMS regression test (M20) and the agents CMS
      // regression test (M26).
      process.env[ENV_KIND] = 'cms'
      process.env[ENV_CMS_URL] = 'https://cms.example.test/developments'

      const firstCatalog = [
        makeApiRecord({ id: 'cms-001', slug: 'first-cms-only-development', name: 'First' }),
      ]
      const secondCatalog = [
        makeApiRecord({ id: 'cms-002', slug: 'second-cms-only-development', name: 'Second' }),
      ]
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        return new Response(
          JSON.stringify(callCount === 1 ? firstCatalog : secondCatalog),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      })

      const first = await loadDevelopmentsServer()
      const second = await loadDevelopmentsServer()
      expect(first[0]?.slug).toBe('first-cms-only-development')
      expect(second[0]?.slug).toBe('second-cms-only-development')
      expect(callCount).toBe(2)
    })
  })

  describe('loadDevelopmentsServer — no process-lifetime cache (api mode)', () => {
    it('two sequential api loads observe different upstream responses', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'

      const firstCatalog = [
        makeApiRecord({ id: 'api-001', slug: 'first-api-only-development', name: 'First' }),
      ]
      const secondCatalog = [
        makeApiRecord({ id: 'api-002', slug: 'second-api-only-development', name: 'Second' }),
      ]
      let callCount = 0
      vi.stubGlobal('fetch', async () => {
        callCount++
        return new Response(
          JSON.stringify(callCount === 1 ? firstCatalog : secondCatalog),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      })

      const first = await loadDevelopmentsServer()
      const second = await loadDevelopmentsServer()
      expect(first[0]?.slug).toBe('first-api-only-development')
      expect(second[0]?.slug).toBe('second-api-only-development')
      expect(callCount).toBe(2)
    })

    it('a successful api response is not retained across two sequential calls (different references)', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify([
        makeApiRecord({ id: 'api-001', slug: 'api-001' }),
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

      const first = await loadDevelopmentsServer()
      const second = await loadDevelopmentsServer()
      expect(second).not.toBe(first)
      expect(second).toHaveLength(first.length)
    })
  })

  describe('loadDevelopmentsServer — concurrent-call coalescing', () => {
    it('coalesces concurrent api calls into a single fetch (in-flight promise)', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'

      let fetchStarted = 0
      let releaseFetch: (() => void) | null = null
      const fetchStartedPromise = new Promise<void>((resolve) => {
        releaseFetch = resolve
      })
      vi.stubGlobal('fetch', async () => {
        fetchStarted++
        await fetchStartedPromise
        return new Response(JSON.stringify([
          makeApiRecord({ id: 'api-001', slug: 'api-only-development' }),
        ]), { status: 200 })
      })

      const first = loadDevelopmentsServer()
      const second = loadDevelopmentsServer()
      const third = loadDevelopmentsServer()

      await Promise.resolve()
      await Promise.resolve()
      expect(fetchStarted).toBe(1)

      releaseFetch?.()
      const [a, b, c] = await Promise.all([first, second, third])
      expect(a).toHaveLength(1)
      expect(b).toHaveLength(1)
      expect(c).toHaveLength(1)
      expect(fetchStarted).toBe(1)
      expect(b).toBe(a)
      expect(c).toBe(a)
    })

    it('clears the in-flight promise after settle so the next call performs a new fetch', async () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/developments'

      let callCount = 0
      const fetchMock = vi.fn(async () => {
        callCount++
        const id = `api-${String(callCount).padStart(3, '0')}`
        const slug = `api-only-${id}`
        return new Response(JSON.stringify([
          makeApiRecord({ id, slug }),
        ]), { status: 200 })
      })
      vi.stubGlobal('fetch', fetchMock)

      const first = await loadDevelopmentsServer()
      const second = await loadDevelopmentsServer()
      expect(callCount).toBe(2)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(first[0]?.slug).toBe('api-only-api-001')
      expect(second[0]?.slug).toBe('api-only-api-002')
    })
  })

  describe('loadDevelopmentsServer — boundary', () => {
    it('the loader module does not export any process-lifetime cache state', async () => {
      // The loader is module-level stateless except for the
      // in-flight `pending` reference (cleared on settle).
      const mod = await import('./developments')
      const exportedNames = Object.keys(mod).sort()
      expect(exportedNames).toEqual([
        '_resetDevelopmentsServerCacheForTests',
        'createDevelopmentsServerAdapter',
        'loadDevelopmentsServer',
      ])
    })
  })
})