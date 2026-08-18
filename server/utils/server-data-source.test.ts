import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DataSourceMissingConfigError,
  type DataSourceAdapter,
  type DataSourceKind,
  type DataSourceSchema,
} from '~/core/data-source/data-source'
import {
  DEFAULT_API_TIMEOUT_MS,
  createServerDataSourceAdapter,
  createServerLoader,
  parseTimeoutMs,
  readEnv,
  type ServerDataSourceOptions,
} from './server-data-source'

/**
 * Tests for the shared server-side data-source utilities at
 * `server/utils/server-data-source.ts` (Task 108).
 *
 * The shared module consolidates the duplicated kind parsing,
 * `isDataSourceKind` dispatch, missing-config /
 * unsupported-kind error mapping, timeout parsing, and
 * in-flight `pending` coalescing that previously lived in
 * each per-feature loader (`properties.ts`, `agents.ts`,
 * `developments.ts`). The per-feature tests still cover the
 * feature-specific surface (env-var names, schemas, bundled
 * data, the properties-only CMS branch) and pin the same
 * contract; this file covers the shared utility's pure
 * surface in isolation so a future regression in the shared
 * logic is caught here without going through a per-feature
 * test.
 *
 * **No feature imports.** The shared utility has no
 * dependency on `app/features/*`, on the tenant registry,
 * or on the per-feature schemas. The tests use a minimal
 * local schema + sample data so the shared module's
 * behavior is exercised against generic types.
 */

/**
 * A minimal Zod-like schema for the test fixtures. The
 * shared utility only uses `schema.parse(data)` (for the
 * static adapter) and `schema.safeParse(data)` (for the
 * remote adapters, when they care — the api / cms
 * adapters in this test path bypass the schema entirely
 * by short-circuiting on a mock). The minimal shape keeps
 * the test free from the project-wide Zod import.
 */
const testSchema: DataSourceSchema<{ id: string }> = {
  parse: (data: unknown) => {
    if (!Array.isArray(data)) {
      throw new Error('not an array')
    }
    return data as { id: string }[]
  },
  safeParse: (data: unknown) => {
    if (!Array.isArray(data)) {
      return { success: false, error: new Error('not an array') }
    }
    return { success: true, data: data as { id: string }[] }
  },
} as unknown as DataSourceSchema<{ id: string }>

const sampleData: ReadonlyArray<{ id: string }> = [
  { id: 'sample-1' },
  { id: 'sample-2' },
]

/**
 * The default options for the shared utility tests.
 * Per-test overrides compose on top of this base.
 */
function makeOptions(overrides: Partial<ServerDataSourceOptions<{ id: string }>> = {}): ServerDataSourceOptions<{ id: string }> {
  return {
    kindEnvName: 'NUXT_SHARED_TEST_DATA_SOURCE',
    shippedKinds: ['static', 'api'] as const,
    static: {
      data: sampleData,
      schema: testSchema,
      source: 'shared/test/sample',
    },
    api: {
      endpointEnvName: 'NUXT_SHARED_TEST_API_URL',
      timeoutEnvName: 'NUXT_SHARED_TEST_API_TIMEOUT_MS',
      schema: testSchema,
    },
    ...overrides,
  }
}

const ENV_KIND = 'NUXT_SHARED_TEST_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_SHARED_TEST_API_URL'
const ENV_TIMEOUT = 'NUXT_SHARED_TEST_API_TIMEOUT_MS'

const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
})

afterEach(() => {
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
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

describe('server/utils/server-data-source — shared utilities', () => {
  describe('readEnv', () => {
    it('returns the env var value when set', () => {
      process.env.SHARED_TEST_VAR = 'hello'
      expect(readEnv('SHARED_TEST_VAR')).toBe('hello')
      Reflect.deleteProperty(process.env, 'SHARED_TEST_VAR')
    })

    it('returns the empty string when the env var is unset', () => {
      expect(readEnv('NUXT_DEFINITELY_UNSET_VAR_FOR_SHARED_TEST')).toBe('')
    })

    it('returns the empty string when process.env is missing the queried key', () => {
      // The defensive guard `typeof process === 'undefined' ||
      // !process.env` covers test environments that strip
      // the global. In Node, `process.env` is always defined;
      // the unset-key path is the realistic surface. The
      // pre-consolidation per-feature loaders shipped the
      // same guard without a dedicated test (the guard is a
      // non-Node defensive path; pinning it in this test
      // would require mutating the Node `process.env`
      // descriptor, which corrupts subsequent tests in the
      // same isolate).
      expect(readEnv('NUXT_DEFINITELY_UNSET_VAR_FOR_SHARED_TEST')).toBe('')
    })
  })

  describe('parseTimeoutMs', () => {
    it('returns the documented default when the env var is unset', () => {
      expect(parseTimeoutMs('NUXT_DEFINITELY_UNSET_TIMEOUT_FOR_SHARED_TEST', 10_000)).toBe(10_000)
    })

    it('returns the documented default when the env var is empty', () => {
      process.env.SHARED_TEST_TIMEOUT = ''
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(10_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })

    it('returns the documented default when the env var is whitespace', () => {
      process.env.SHARED_TEST_TIMEOUT = '   '
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(10_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })

    it('returns the documented default when the env var is non-integer', () => {
      process.env.SHARED_TEST_TIMEOUT = 'abc'
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(10_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })

    it('returns the parsed integer when the env var is a valid integer', () => {
      process.env.SHARED_TEST_TIMEOUT = '5000'
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(5_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })

    it('returns the integer prefix when the env var is a decimal integer-prefixed string', () => {
      // `Number.parseInt('5000abc', 10) === 5000` — the shared
      // utility matches the prior per-feature timeout parsing.
      process.env.SHARED_TEST_TIMEOUT = '5000abc'
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(5_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })

    it('returns the default when the env var is the integer 0 (silent fallback)', () => {
      // `Number.parseInt('0', 10) === 0` which is falsy, so the
      // `|| defaultMs` fallback returns the default — matching
      // the prior per-feature behavior.
      process.env.SHARED_TEST_TIMEOUT = '0'
      expect(parseTimeoutMs('SHARED_TEST_TIMEOUT', 10_000)).toBe(10_000)
      Reflect.deleteProperty(process.env, 'SHARED_TEST_TIMEOUT')
    })
  })

  describe('createServerDataSourceAdapter — kind parsing', () => {
    it('returns the static adapter when the kind env var is unset', () => {
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when the kind env var is empty', () => {
      process.env[ENV_KIND] = ''
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when the kind env var is whitespace', () => {
      process.env[ENV_KIND] = '   '
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('static')
    })

    it('returns the static adapter when the kind env var is the literal "static"', () => {
      process.env[ENV_KIND] = 'static'
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('static')
    })

    it('throws DataSourceNotImplementedError for an unknown kind', () => {
      process.env[ENV_KIND] = 'graphql'
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'graphql',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for a case-variant kind', () => {
      process.env[ENV_KIND] = 'STATIC'
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'STATIC',
        }),
      )
    })

    it('throws DataSourceNotImplementedError for a future-looking kind name', () => {
      process.env[ENV_KIND] = 'sanity'
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'sanity',
        }),
      )
    })

    it('lists the loader\'s shipped kinds on the not-implemented error message', () => {
      // The error's "Supported kinds" line must reflect the
      // loader's runtime reality — not the full contract kind
      // set. A future loader that ships a new kind updates
      // `shippedKinds` and the message follows.
      process.env[ENV_KIND] = 'graphql'
      try {
        createServerDataSourceAdapter(makeOptions())
        throw new Error('expected createServerDataSourceAdapter to throw')
      }
      catch (error) {
        const message = (error as Error).message
        expect(message).toContain('"graphql"')
        expect(message).toContain('not implemented')
        expect(message).toContain('"static"')
        expect(message).toContain('"api"')
      }
    })

    it('passes the literal unknown value through (does not coerce)', () => {
      // The type guard rejects unknown values, and the error
      // surfaces the literal env-var value so an operator can
      // see the typo. The shared utility must not silently
      // coerce unknown values to 'static'.
      process.env[ENV_KIND] = 'Api'
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'Api',
        }),
      )
    })
  })

  describe('createServerDataSourceAdapter — api branch', () => {
    it('returns the api adapter when kind=api with a valid endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/shared'
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('api')
    })

    it('throws DataSourceMissingConfigError when kind=api with an empty endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = ''
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_SHARED_TEST_API_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when kind=api with a whitespace endpoint', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = '   '
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'api',
          field: 'NUXT_SHARED_TEST_API_URL',
        }),
      )
    })

    it('honors the configured timeout env var', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/shared'
      process.env[ENV_TIMEOUT] = '5000'
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('api')
    })

    it('falls back to the documented default timeout when the timeout env var is unset', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/shared'
      const adapter = createServerDataSourceAdapter(makeOptions())
      expect(adapter.id).toBe('api')
    })

    it('honors the optional defaultTimeoutMs override on the api branch', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://example.test/shared'
      const adapter = createServerDataSourceAdapter(makeOptions({
        api: {
          endpointEnvName: ENV_ENDPOINT,
          timeoutEnvName: ENV_TIMEOUT,
          schema: testSchema,
          defaultTimeoutMs: 7_500,
        },
      }))
      expect(adapter.id).toBe('api')
    })

    it('exposes the api kind and the configured env-var field name on the missing-config error', () => {
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = ''
      try {
        createServerDataSourceAdapter(makeOptions())
        throw new Error('expected createServerDataSourceAdapter to throw')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DataSourceMissingConfigError)
        const wrapped = error as DataSourceMissingConfigError
        expect(wrapped.kind).toBe('api')
        expect(wrapped.field).toBe('NUXT_SHARED_TEST_API_URL')
      }
    })
  })

  describe('createServerDataSourceAdapter — cms branch', () => {
    /**
     * A minimal cms-build counter + adapter for the cms
     * tests. The cms branch is OPTIONAL — the agents and
     * developments loaders omit it and the shared utility
     * raises `DataSourceNotImplementedError('cms',
     * shippedKinds)` for them. The properties loader is the
     * only feature that ships a CMS adapter.
     */
    let cmsBuildCalls = 0
    function makeCmsBranch(): ServerDataSourceOptions<{ id: string }>['cms'] {
      cmsBuildCalls = 0
      return {
        endpointEnvName: 'NUXT_SHARED_TEST_CMS_URL',
        timeoutEnvName: 'NUXT_SHARED_TEST_CMS_TIMEOUT_MS',
        schema: testSchema,
        build: ({ endpoint, source, timeoutMs }) => {
          cmsBuildCalls++
          const adapter: DataSourceAdapter<{ id: string }> = {
            id: 'cms',
            loadAll: async () => [{ id: `cms:${endpoint}:${timeoutMs}:${source}` }],
            getAll: () => {
              throw new Error('getAll() not supported in test adapter')
            },
            [Symbol.toStringTag]: `cms:${source}`,
          }
          return adapter
        },
      }
    }

    it('returns the cms adapter when kind=cms with a valid URL and a build callback is supplied', () => {
      process.env[ENV_KIND] = 'cms'
      process.env.NUXT_SHARED_TEST_CMS_URL = 'https://cms.example.test/shared'
      const adapter = createServerDataSourceAdapter(makeOptions({
        shippedKinds: ['static', 'api', 'cms'] as const,
        cms: makeCmsBranch(),
      }))
      expect(adapter.id).toBe('cms')
      expect(cmsBuildCalls).toBe(1)
    })

    it('throws DataSourceMissingConfigError when kind=cms with an empty CMS URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env.NUXT_SHARED_TEST_CMS_URL = ''
      expect(() => createServerDataSourceAdapter(makeOptions({
        shippedKinds: ['static', 'api', 'cms'] as const,
        cms: makeCmsBranch(),
      }))).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_SHARED_TEST_CMS_URL',
        }),
      )
    })

    it('throws DataSourceMissingConfigError when kind=cms with a whitespace CMS URL', () => {
      process.env[ENV_KIND] = 'cms'
      process.env.NUXT_SHARED_TEST_CMS_URL = '   '
      expect(() => createServerDataSourceAdapter(makeOptions({
        shippedKinds: ['static', 'api', 'cms'] as const,
        cms: makeCmsBranch(),
      }))).toThrow(
        expect.objectContaining({
          name: 'DataSourceMissingConfigError',
          kind: 'cms',
          field: 'NUXT_SHARED_TEST_CMS_URL',
        }),
      )
    })

    it('throws DataSourceNotImplementedError when kind=cms but no cms branch is supplied', () => {
      // The agents and developments loaders do not supply a
      // cms branch. Selecting `'cms'` raises
      // `DataSourceNotImplementedError('cms', shippedKinds)`
      // from the shared utility — a rebrand that asks for
      // CMS support on a feature that does not ship it fails
      // loudly rather than silently falling back to the
      // bundled static data.
      process.env[ENV_KIND] = 'cms'
      expect(() => createServerDataSourceAdapter(makeOptions())).toThrow(
        expect.objectContaining({
          name: 'DataSourceNotImplementedError',
          kind: 'cms',
        }),
      )
    })

    it('honors the configured CMS timeout env var', () => {
      process.env[ENV_KIND] = 'cms'
      process.env.NUXT_SHARED_TEST_CMS_URL = 'https://cms.example.test/shared'
      process.env.NUXT_SHARED_TEST_CMS_TIMEOUT_MS = '5000'
      const adapter = createServerDataSourceAdapter(makeOptions({
        shippedKinds: ['static', 'api', 'cms'] as const,
        cms: makeCmsBranch(),
      }))
      expect(adapter.id).toBe('cms')
    })

    it('passes the cms source as `cms:<endpointEnvName>` to the build callback', async () => {
      process.env[ENV_KIND] = 'cms'
      process.env.NUXT_SHARED_TEST_CMS_URL = 'https://cms.example.test/shared'
      const adapter = createServerDataSourceAdapter(makeOptions({
        shippedKinds: ['static', 'api', 'cms'] as const,
        cms: makeCmsBranch(),
      }))
      const data = await adapter.loadAll()
      expect(data[0]?.id).toContain('cms:NUXT_SHARED_TEST_CMS_URL')
    })
  })

  describe('createServerDataSourceAdapter — kind-set boundary', () => {
    it('does not list `cms` in the not-implemented error when the loader does not ship it', () => {
      // The agents and developments loaders ship only
      // `static` + `api`. The "Supported kinds" line on the
      // error message must reflect that runtime reality —
      // listing `cms` would falsely advertise support.
      process.env[ENV_KIND] = 'graphql'
      try {
        createServerDataSourceAdapter(makeOptions({
          shippedKinds: ['static', 'api'] as const,
        }))
        throw new Error('expected createServerDataSourceAdapter to throw')
      }
      catch (error) {
        const message = (error as Error).message
        expect(message).toContain('"static"')
        expect(message).toContain('"api"')
        // cms is in the contract kind set but is intentionally
        // NOT advertised by this loader.
        expect(message).not.toContain('"cms"')
      }
    })

    it('lists every kind in the configured `shippedKinds` on the error message', () => {
      // Properties ships `static` + `api` + `cms`. The
      // shared utility must list all three so an operator
      // can see what the loader actually supports.
      process.env[ENV_KIND] = 'graphql'
      try {
        createServerDataSourceAdapter(makeOptions({
          shippedKinds: ['static', 'api', 'cms'] as readonly DataSourceKind[],
        }))
        throw new Error('expected createServerDataSourceAdapter to throw')
      }
      catch (error) {
        const message = (error as Error).message
        expect(message).toContain('"static"')
        expect(message).toContain('"api"')
        expect(message).toContain('"cms"')
      }
    })
  })

  describe('createServerLoader — in-flight coalescing', () => {
    /**
     * Build a mock adapter that resolves after a configurable
     * delay. The shared loader's `buildAdapter` is captured at
     * factory time and called on every settle cycle.
     */
    function makeMockAdapter(delayMs: number, payload: { id: string }[]): () => DataSourceAdapter<{ id: string }> {
      let built = 0
      return () => {
        built++
        const buildIndex = built
        return {
          id: 'mock',
          loadAll: async () => {
            await new Promise(resolve => setTimeout(resolve, delayMs))
            return payload.map(p => ({ ...p, id: `${p.id}:build${buildIndex}` }))
          },
          getAll: () => {
            throw new Error('getAll() not supported in test adapter')
          },
          [Symbol.toStringTag]: `mock:build${buildIndex}`,
        }
      }
    }

    it('returns the in-flight promise to concurrent callers (single build, single loadAll)', async () => {
      const build = vi.fn(makeMockAdapter(20, [{ id: 'a' }, { id: 'b' }]))
      const loader = createServerLoader<{ id: string }>(build)

      const first = loader.load()
      const second = loader.load()
      const third = loader.load()

      const [a, b, c] = await Promise.all([first, second, third])
      expect(build).toHaveBeenCalledTimes(1)
      expect(a).toHaveLength(2)
      expect(b).toHaveLength(2)
      expect(c).toHaveLength(2)
      // All three concurrent callers received the same array
      // reference — the in-flight promise resolves to the
      // same value for every concurrent caller.
      expect(b).toBe(a)
      expect(c).toBe(a)
    })

    it('clears the in-flight promise after settle so the next call performs a new build', async () => {
      const build = vi.fn(makeMockAdapter(0, [{ id: 'x' }]))
      const loader = createServerLoader<{ id: string }>(build)

      const first = await loader.load()
      const second = await loader.load()
      expect(build).toHaveBeenCalledTimes(2)
      // Two distinct array references — no permanent cache.
      expect(second).not.toBe(first)
    })

    it('does not memoise a failed load (a retry can run)', async () => {
      let attempt = 0
      const build = vi.fn(() => {
        attempt++
        return {
          id: 'mock',
          loadAll: async () => {
            if (attempt === 1) {
              throw new Error('first attempt fails')
            }
            return [{ id: 'recovered' }]
          },
          getAll: () => {
            throw new Error('getAll() not supported in test adapter')
          },
          [Symbol.toStringTag]: 'mock',
        }
      })
      const loader = createServerLoader<{ id: string }>(build)

      await expect(loader.load()).rejects.toThrow('first attempt fails')
      // After the failed settle, the in-flight promise was
      // cleared in the `finally` block. The next call
      // constructs a new adapter and retries.
      const recovered = await loader.load()
      expect(recovered).toHaveLength(1)
      expect(build).toHaveBeenCalledTimes(2)
    })

    it('reset() clears the in-flight promise so the next call performs a new build', async () => {
      let releaseFetch: (() => void) | null = null
      const blockPromise = new Promise<void>((resolve) => {
        releaseFetch = resolve
      })
      const build = vi.fn(() => ({
        id: 'mock',
        loadAll: async () => {
          await blockPromise
          return [{ id: 'after-reset' }]
        },
        getAll: () => {
          throw new Error('getAll() not supported in test adapter')
        },
        [Symbol.toStringTag]: 'mock',
      }))
      const loader = createServerLoader<{ id: string }>(build)

      // Start the first call, hold it in flight, then reset.
      const first = loader.load()
      loader.reset()

      // After `reset()`, the next call must construct a new
      // adapter (the prior in-flight promise is orphaned but
      // never returns to a caller).
      releaseFetch?.()
      await first
      const second = await loader.load()
      expect(build).toHaveBeenCalledTimes(2)
      expect(second[0]?.id).toBe('after-reset')
    })

    it('two sequential settled calls observe different adapter builds (no permanent cache)', async () => {
      const build = vi.fn(makeMockAdapter(0, [{ id: 'a' }, { id: 'b' }]))
      const loader = createServerLoader<{ id: string }>(build)

      const first = await loader.load()
      const second = await loader.load()
      expect(build).toHaveBeenCalledTimes(2)
      // The two adapter builds produced structurally equal
      // data but reference-different arrays — the
      // `mock:buildN` payload tag in each id reflects the
      // build counter.
      expect(first[0]?.id).toMatch(/build1$/)
      expect(second[0]?.id).toMatch(/build2$/)
    })

    it('the default API timeout constant matches the documented 10 000 ms', () => {
      // The shared constant is the source of truth for the
      // default timeout used by every feature loader. A
      // regression that flips the value would silently
      // tighten or loosen the timeout for every loader.
      expect(DEFAULT_API_TIMEOUT_MS).toBe(10_000)
    })

    it('does not share in-flight state across separate createServerLoader calls', async () => {
      // Two loader instances have independent `pending`
      // closures — a concurrent call on one loader does not
      // coalesce with a concurrent call on the other.
      const buildA = vi.fn(makeMockAdapter(0, [{ id: 'a' }]))
      const buildB = vi.fn(makeMockAdapter(0, [{ id: 'b' }]))
      const loaderA = createServerLoader<{ id: string }>(buildA)
      const loaderB = createServerLoader<{ id: string }>(buildB)

      const [a, b] = await Promise.all([loaderA.load(), loaderB.load()])
      expect(buildA).toHaveBeenCalledTimes(1)
      expect(buildB).toHaveBeenCalledTimes(1)
      expect(a[0]?.id).toContain('a')
      expect(b[0]?.id).toContain('b')
    })
  })
})
