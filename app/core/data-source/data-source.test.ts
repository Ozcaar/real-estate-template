import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  DEFAULT_DATA_SOURCE,
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceNotImplementedError,
  DataSourceTimeoutError,
  isDataSourceKind,
  selectDataSource,
  type DataSourceAdapter,
  type DataSourceConfig,
  type DataSourceKind,
} from './data-source'

/**
 * Tests for the data-source contract.
 *
 * Scope: the small public surface every feature service depends
 * on — the kind set, the default config, the selector, the
 * not-implemented error, the type guard, the new
 * missing-config / http / timeout / invalid-payload errors, and
 * the async `loadAll()` contract. The contract is the single
 * most important piece of the adapter foundation: if it is
 * wrong, every feature is wrong. The tests pin down the
 * documented behaviour so a future change cannot regress the
 * "fail clearly rather than silently fall back" promise.
 *
 * Out of scope: the static adapter itself (covered in
 * `adapters/static-adapter.test.ts`), the api adapter (covered
 * in `adapters/api-adapter.test.ts`), and the per-feature
 * service integrations (covered in each feature's existing
 * `*.service.test.ts`).
 */

const SUPPORTED_KINDS: readonly DataSourceKind[] = ['static', 'api', 'cms']

function makeAdapter(id: DataSourceKind): DataSourceAdapter<{ id: string }> {
  return {
    id,
    loadAll: () => Promise.resolve([{ id: `${id}-1` }, { id: `${id}-2` }]),
    getAll: () => [{ id: `${id}-1` }, { id: `${id}-2` }],
  }
}

/* ------------------------------------------------------------------ *
 * DEFAULT_DATA_SOURCE
 * ------------------------------------------------------------------ */

describe('DEFAULT_DATA_SOURCE', () => {
  it('is the "static" kind', () => {
    expect(DEFAULT_DATA_SOURCE.kind).toBe('static')
  })

  it('is frozen so callers cannot mutate it at runtime', () => {
    expect(Object.isFrozen(DEFAULT_DATA_SOURCE)).toBe(true)
  })

  it('matches the structural shape of a DataSourceConfig', () => {
    const config: DataSourceConfig = DEFAULT_DATA_SOURCE
    expect(config.kind).toBe('static')
  })
})

/* ------------------------------------------------------------------ *
 * isDataSourceKind — type guard
 * ------------------------------------------------------------------ */

describe('isDataSourceKind', () => {
  it('returns true for "static"', () => {
    expect(isDataSourceKind('static')).toBe(true)
  })

  it('returns true for "api"', () => {
    expect(isDataSourceKind('api')).toBe(true)
  })

  it('returns true for "cms"', () => {
    expect(isDataSourceKind('cms')).toBe(true)
  })

  it('returns false for an empty string', () => {
    expect(isDataSourceKind('')).toBe(false)
  })

  it('returns false for an unknown string', () => {
    expect(isDataSourceKind('graphql')).toBe(false)
  })

  it('is case-sensitive (uppercase variants are not accepted)', () => {
    expect(isDataSourceKind('STATIC')).toBe(false)
    expect(isDataSourceKind('Api')).toBe(false)
    expect(isDataSourceKind('CMS')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isDataSourceKind(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isDataSourceKind(undefined)).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isDataSourceKind(42)).toBe(false)
  })

  it('returns false for a boolean', () => {
    expect(isDataSourceKind(true)).toBe(false)
  })

  it('returns false for an array', () => {
    expect(isDataSourceKind(['static'])).toBe(false)
  })

  it('returns false for a plain object', () => {
    expect(isDataSourceKind({ kind: 'static' })).toBe(false)
  })

  it('narrows the type when used as a type guard', () => {
    // Compile-time check: the guard must accept every
    // documented kind. We cover all three here so a future
    // refactor that drops one fails the compile.
    for (const kind of SUPPORTED_KINDS) {
      const value: unknown = kind
      if (isDataSourceKind(value)) {
        // This assignment would fail to compile if the
        // guard is not a real type guard.
        const narrowed: DataSourceKind = value
        expect(narrowed).toBe(kind)
      }
      else {
        throw new Error(`expected isDataSourceKind to be true for "${kind}"`)
      }
    }
  })
})

/* ------------------------------------------------------------------ *
 * selectDataSource — happy path
 * ------------------------------------------------------------------ */

describe('selectDataSource — happy path', () => {
  it('returns the "static" adapter when kind is "static"', () => {
    const staticAdapter = makeAdapter('static')
    const result = selectDataSource({ kind: 'static' }, { static: staticAdapter })
    expect(result).toBe(staticAdapter)
  })

  it('returns the "api" adapter when kind is "api" and the registry has one', () => {
    const apiAdapter = makeAdapter('api')
    const result = selectDataSource(
      { kind: 'api' },
      { static: makeAdapter('static'), api: apiAdapter },
    )
    expect(result).toBe(apiAdapter)
  })

  it('returns the "cms" adapter when kind is "cms" and the registry has one', () => {
    const cmsAdapter = makeAdapter('cms')
    const result = selectDataSource(
      { kind: 'cms' },
      { static: makeAdapter('static'), cms: cmsAdapter },
    )
    expect(result).toBe(cmsAdapter)
  })

  it('uses the DEFAULT_DATA_SOURCE ("static") when no config is passed (rebrand shape)', () => {
    // The selector itself takes a `config` argument, but the
    // shape of that argument is `DEFAULT_DATA_SOURCE`. This
    // test pins down that a call site using the default
    // resolves to the "static" adapter.
    const staticAdapter = makeAdapter('static')
    const result = selectDataSource(DEFAULT_DATA_SOURCE, { static: staticAdapter })
    expect(result).toBe(staticAdapter)
  })

  it('returns the same adapter reference from the registry (no clone)', () => {
    const staticAdapter = makeAdapter('static')
    const result = selectDataSource({ kind: 'static' }, { static: staticAdapter })
    expect(result).toBe(staticAdapter)
  })
})

/* ------------------------------------------------------------------ *
 * selectDataSource — "fail clearly rather than silently fall back"
 * ------------------------------------------------------------------ */

describe('selectDataSource — not-implemented error', () => {
  it('throws DataSourceNotImplementedError for "api" when the registry has no api adapter', () => {
    const staticAdapter = makeAdapter('static')
    expect(() => selectDataSource({ kind: 'api' }, { static: staticAdapter }))
      .toThrow(DataSourceNotImplementedError)
  })

  it('throws DataSourceNotImplementedError for "cms" when the registry has no cms adapter', () => {
    const staticAdapter = makeAdapter('static')
    expect(() => selectDataSource({ kind: 'cms' }, { static: staticAdapter }))
      .toThrow(DataSourceNotImplementedError)
  })

  it('throws DataSourceNotImplementedError for an empty registry', () => {
    expect(() => selectDataSource({ kind: 'static' }, {}))
      .toThrow(DataSourceNotImplementedError)
  })

  it('the error has the correct name', () => {
    try {
      selectDataSource({ kind: 'api' }, { static: makeAdapter('static') })
      throw new Error('expected selectDataSource to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceNotImplementedError)
      expect((error as Error).name).toBe('DataSourceNotImplementedError')
    }
  })

  it('the error exposes the missing kind as a property', () => {
    try {
      selectDataSource({ kind: 'cms' }, { static: makeAdapter('static') })
      throw new Error('expected selectDataSource to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceNotImplementedError)
      const wrapped = error as DataSourceNotImplementedError
      expect(wrapped.kind).toBe('cms')
    }
  })

  it('the error message names the missing kind and points at the adapter folder', () => {
    try {
      selectDataSource({ kind: 'api' }, { static: makeAdapter('static') })
      throw new Error('expected selectDataSource to throw')
    }
    catch (error) {
      const message = (error as Error).message
      expect(message).toContain('"api"')
      expect(message).toContain('not implemented')
      expect(message).toContain('app/core/data-source/adapters/')
    }
  })

  it('the error\'s supportedKinds reflects the registry\'s actual kinds (not the full contract set)', () => {
    // The selector computes supportedKinds from its own
    // registry — a registry with only 'static' produces a
    // message that lists only 'static'. This is the
    // difference between the selector (runtime registry)
    // and a feature loader with a hard-coded shipped set.
    try {
      selectDataSource({ kind: 'api' }, { static: makeAdapter('static') })
      throw new Error('expected selectDataSource to throw')
    }
    catch (error) {
      const wrapped = error as DataSourceNotImplementedError
      expect(wrapped.supportedKinds).toEqual(['static'])
      expect(wrapped.message).toContain('"static"')
      // The message does NOT contain '"api"' or '"cms"' in
      // the "Supported kinds" line — the registry does not
      // ship them.
      const supportedLine = wrapped.message.match(/Supported kinds: (.+)\./)?.[1] ?? ''
      expect(supportedLine).toBe('"static"')
    }
  })

  it('the error\'s supportedKinds lists every registry entry', () => {
    // A registry with all three kinds produces a message
    // listing all three. The selector must surface the
    // full set when the registry is fully populated.
    try {
      selectDataSource(
        { kind: 'graphql' as DataSourceKind },
        {
          static: makeAdapter('static'),
          api: makeAdapter('api'),
          cms: makeAdapter('cms'),
        },
      )
      throw new Error('expected selectDataSource to throw')
    }
    catch (error) {
      const wrapped = error as DataSourceNotImplementedError
      expect(wrapped.supportedKinds.sort()).toEqual(['api', 'cms', 'static'])
    }
  })

  it('never falls back to "static" when the configured kind is "api"', () => {
    // This is the single most important promise of the
    // contract: a rebrand that asks for 'api' but does not
    // register an api adapter must fail loudly, not ship the
    // bundled static data. We assert that the "api" path
    // never reaches the static adapter.
    const staticAdapter = makeAdapter('static')
    let selected: DataSourceAdapter<{ id: string }> | undefined
    try {
      selected = selectDataSource({ kind: 'api' }, { static: staticAdapter })
    }
    catch {
      selected = undefined
    }
    expect(selected).toBeUndefined()
  })

  it('never falls back to "static" when the configured kind is "cms"', () => {
    const staticAdapter = makeAdapter('static')
    let selected: DataSourceAdapter<{ id: string }> | undefined
    try {
      selected = selectDataSource({ kind: 'cms' }, { static: staticAdapter })
    }
    catch {
      selected = undefined
    }
    expect(selected).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ *
 * selectDataSource — type coupling
 * ------------------------------------------------------------------ */

describe('selectDataSource — type coupling', () => {
  it('returns an adapter whose id matches the configured kind', () => {
    const staticAdapter = makeAdapter('static')
    const result = selectDataSource({ kind: 'static' }, { static: staticAdapter })
    expect(result.id).toBe('static')
  })

  it('a registry entry for a different record type would fail the type-check at the call site', () => {
    // This test does not run any runtime check — the value
    // is in the comment. The selector is generic over the
    // record type `T`, so a registry entry that returns the
    // wrong type fails the compile-time check. We exercise a
    // real adapter here so the generic is pinned down to
    // `{ id: string }`.
    const staticAdapter: DataSourceAdapter<{ id: string }> = makeAdapter('static')
    const result = selectDataSource<{ id: string }>(
      { kind: 'static' },
      { static: staticAdapter },
    )
    expect(result.getAll().every(item => typeof item.id === 'string')).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceNotImplementedError — direct construction
 * ------------------------------------------------------------------ */

describe('DataSourceNotImplementedError', () => {
  it('can be constructed directly (so tests and other code can throw it without the selector)', () => {
    const error = new DataSourceNotImplementedError('api')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DataSourceNotImplementedError)
    expect(error.name).toBe('DataSourceNotImplementedError')
    expect(error.kind).toBe('api')
  })

  it('the message includes the kind and the adapter folder path', () => {
    const error = new DataSourceNotImplementedError('cms')
    expect(error.message).toContain('"cms"')
    expect(error.message).toContain('app/core/data-source/adapters/')
  })

  it('the default "Supported kinds" line lists every contract kind', () => {
    // The default constructor (no supportedKinds) lists the
    // full contract kind set so the message is meaningful
    // even when the caller does not know the runtime subset.
    const error = new DataSourceNotImplementedError('graphql')
    expect(error.message).toContain('"static"')
    expect(error.message).toContain('"api"')
    expect(error.message).toContain('"cms"')
  })

  it('the supportedKinds option overrides the default "Supported kinds" line', () => {
    // The feature loaders (e.g. the property loader at
    // `server/utils/properties.ts`) ship only `'static'` +
    // `'api'`. They pass the actual subset so the error
    // message reflects runtime reality, not the full
    // contract set.
    const error = new DataSourceNotImplementedError('graphql', ['static', 'api'])
    expect(error.supportedKinds).toEqual(['static', 'api'])
    expect(error.message).toContain('"static"')
    expect(error.message).toContain('"api"')
    // `'cms'` is intentionally absent from the message
    // because the loader does not ship a CMS adapter.
    expect(error.message).not.toContain('"cms"')
  })

  it('the supportedKinds option supports a single-element subset', () => {
    const error = new DataSourceNotImplementedError('api', ['static'])
    expect(error.supportedKinds).toEqual(['static'])
    expect(error.message).toContain('"static"')
  })

  it('exposes the supportedKinds as a readonly property on the instance', () => {
    const error = new DataSourceNotImplementedError('api', ['static', 'api'])
    expect(error.supportedKinds).toEqual(['static', 'api'])
  })

  it('is catchable as a generic Error', () => {
    try {
      throw new DataSourceNotImplementedError('api')
    }
    catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceMissingConfigError — api / cms misconfiguration
 * ------------------------------------------------------------------ */

describe('DataSourceMissingConfigError', () => {
  it('exposes the configured kind and the missing field name', () => {
    const error = new DataSourceMissingConfigError('api', 'NUXT_PROPERTIES_API_URL')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DataSourceMissingConfigError)
    expect(error.name).toBe('DataSourceMissingConfigError')
    expect(error.kind).toBe('api')
    expect(error.field).toBe('NUXT_PROPERTIES_API_URL')
  })

  it('the message names the kind, the missing field, and the env var', () => {
    const error = new DataSourceMissingConfigError('api', 'NUXT_PROPERTIES_API_URL')
    expect(error.message).toContain('api')
    expect(error.message).toContain('NUXT_PROPERTIES_API_URL')
    expect(error.message).toContain('missing')
  })

  it('can be constructed for the "cms" kind with a different field', () => {
    const error = new DataSourceMissingConfigError('cms', 'NUXT_CMS_PROJECT_ID')
    expect(error.kind).toBe('cms')
    expect(error.field).toBe('NUXT_CMS_PROJECT_ID')
    expect(error.message).toContain('NUXT_CMS_PROJECT_ID')
  })

  it('is catchable as a generic Error', () => {
    try {
      throw new DataSourceMissingConfigError('api', 'endpoint')
    }
    catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })

  it('is distinct from DataSourceNotImplementedError (different cause)', () => {
    // A missing-config failure is a rebrand misconfiguration
    // (the adapter exists; the env var is empty). A
    // not-implemented failure is a contract gap (the
    // adapter does not exist). The two errors must remain
    // distinct so an operator can fix the right problem.
    const a = new DataSourceMissingConfigError('api', 'endpoint')
    const b = new DataSourceNotImplementedError('api')
    expect(a).not.toBeInstanceOf(DataSourceNotImplementedError)
    expect(b).not.toBeInstanceOf(DataSourceMissingConfigError)
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceHttpError — non-2xx response
 * ------------------------------------------------------------------ */

describe('DataSourceHttpError', () => {
  it('exposes the status code and the endpoint URL', () => {
    const error = new DataSourceHttpError(503, 'https://example.test/properties')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DataSourceHttpError)
    expect(error.name).toBe('DataSourceHttpError')
    expect(error.status).toBe(503)
    expect(error.endpoint).toBe('https://example.test/properties')
  })

  it('the message names the status code and the endpoint', () => {
    const error = new DataSourceHttpError(500, 'https://example.test/properties')
    expect(error.message).toContain('500')
    expect(error.message).toContain('https://example.test/properties')
  })

  it('preserves the status code for every documented 2xx / 4xx / 5xx class', () => {
    const cases = [200, 400, 401, 403, 404, 429, 500, 502, 503]
    for (const status of cases) {
      const error = new DataSourceHttpError(status, 'https://example.test/properties')
      expect(error.status).toBe(status)
    }
  })

  it('is catchable as a generic Error', () => {
    try {
      throw new DataSourceHttpError(404, 'https://example.test/properties')
    }
    catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceTimeoutError — request aborted
 * ------------------------------------------------------------------ */

describe('DataSourceTimeoutError', () => {
  it('exposes the endpoint URL and the timeout in milliseconds', () => {
    const error = new DataSourceTimeoutError('https://example.test/properties', 5_000)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DataSourceTimeoutError)
    expect(error.name).toBe('DataSourceTimeoutError')
    expect(error.endpoint).toBe('https://example.test/properties')
    expect(error.timeoutMs).toBe(5_000)
  })

  it('the message names the endpoint and the timeout in milliseconds', () => {
    const error = new DataSourceTimeoutError('https://example.test/properties', 10_000)
    expect(error.message).toContain('https://example.test/properties')
    expect(error.message).toContain('10000')
    expect(error.message).toContain('timed out')
  })

  it('is catchable as a generic Error', () => {
    try {
      throw new DataSourceTimeoutError('https://example.test/properties', 5_000)
    }
    catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })

  it('is distinct from DataSourceHttpError (transport / application failure)', () => {
    // A timeout is a transport failure (the request never
    // got a response). An http failure is an application
    // response with a 4xx / 5xx status. The two errors must
    // remain distinct so an operator can distinguish a slow
    // upstream from a misconfigured one.
    const a = new DataSourceTimeoutError('https://example.test/properties', 5_000)
    const b = new DataSourceHttpError(504, 'https://example.test/properties')
    expect(a).not.toBeInstanceOf(DataSourceHttpError)
    expect(b).not.toBeInstanceOf(DataSourceTimeoutError)
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceInvalidPayloadError — schema mismatch
 * ------------------------------------------------------------------ */

describe('DataSourceInvalidPayloadError', () => {
  it('exposes the endpoint URL and the underlying cause', () => {
    const cause = new Error('Required at path: id')
    const error = new DataSourceInvalidPayloadError('https://example.test/properties', cause)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DataSourceInvalidPayloadError)
    expect(error.name).toBe('DataSourceInvalidPayloadError')
    expect(error.endpoint).toBe('https://example.test/properties')
    expect(error.cause).toBe(cause)
  })

  it('the message names the endpoint and the underlying detail', () => {
    const cause = new Error('Required at path: id')
    const error = new DataSourceInvalidPayloadError('https://example.test/properties', cause)
    expect(error.message).toContain('https://example.test/properties')
    expect(error.message).toContain('Required at path: id')
  })

  it('accepts a non-Error cause (e.g. a ZodError)', () => {
    // The constructor accepts `unknown` for `cause` so a
    // ZodError (which is the typical cause from the api
    // adapter's `safeParse` call) can be passed through
    // without an explicit wrap.
    const cause = { issues: [{ path: ['id'], message: 'Required' }] }
    const error = new DataSourceInvalidPayloadError('https://example.test/properties', cause)
    expect(error.cause).toBe(cause)
    expect(error.message).toContain('https://example.test/properties')
  })

  it('is catchable as a generic Error', () => {
    try {
      throw new DataSourceInvalidPayloadError('https://example.test/properties', new Error('x'))
    }
    catch (e) {
      expect(e).toBeInstanceOf(Error)
    }
  })
})

/* ------------------------------------------------------------------ *
 * DataSourceAdapter — async contract (loadAll)
 * ------------------------------------------------------------------ */

describe('DataSourceAdapter — async contract', () => {
  it('loadAll() returns a Promise', () => {
    const adapter = makeAdapter('static')
    const result = adapter.loadAll()
    expect(result).toBeInstanceOf(Promise)
  })

  it('loadAll() resolves to the same data the adapter represents', async () => {
    const adapter = makeAdapter('static')
    const data = await adapter.loadAll()
    expect(data).toEqual([{ id: 'static-1' }, { id: 'static-2' }])
  })

  it('loadAll() is awaitable end-to-end with every supported kind', async () => {
    // The contract is the same for every kind — the static
    // adapter resolves immediately, the api / cms adapters
    // do their work asynchronously. The selector returns
    // whichever adapter was registered; `loadAll()` always
    // returns a Promise that resolves to the data.
    const staticAdapter = makeAdapter('static')
    const apiAdapter = makeAdapter('api')
    const cmsAdapter = makeAdapter('cms')

    const s = await selectDataSource({ kind: 'static' }, { static: staticAdapter }).loadAll()
    const a = await selectDataSource({ kind: 'api' }, { static: staticAdapter, api: apiAdapter }).loadAll()
    const c = await selectDataSource({ kind: 'cms' }, { static: staticAdapter, cms: cmsAdapter }).loadAll()
    expect(s).toEqual([{ id: 'static-1' }, { id: 'static-2' }])
    expect(a).toEqual([{ id: 'api-1' }, { id: 'api-2' }])
    expect(c).toEqual([{ id: 'cms-1' }, { id: 'cms-2' }])
  })
})

/* ------------------------------------------------------------------ *
 * Default + select — end-to-end shape used by feature services
 * ------------------------------------------------------------------ */

describe('Default + select — end-to-end shape used by feature services', () => {
  it('a feature registry with only a "static" entry resolves for the default kind', () => {
    // This is the typical feature-service shape:
    //   const adapter = selectDataSource(DEFAULT_DATA_SOURCE, { static: ... })
    const staticAdapter = makeAdapter('static')
    const adapter = selectDataSource(DEFAULT_DATA_SOURCE, { static: staticAdapter })
    expect(adapter.id).toBe('static')
    expect(adapter.getAll()).toEqual([{ id: 'static-1' }, { id: 'static-2' }])
  })

  it('a feature registry with only a "static" entry still rejects an "api" request loudly', () => {
    // A rebrand that upgrades a feature to use a real API
    // would have to register an "api" adapter in addition
    // to the existing "static" entry. The default registry
    // shape must not silently serve the wrong source.
    const staticAdapter = makeAdapter('static')
    expect(() => selectDataSource({ kind: 'api' }, { static: staticAdapter }))
      .toThrow(DataSourceNotImplementedError)
  })

  it('a feature registry with static + api entries resolves both kinds', () => {
    const staticAdapter = makeAdapter('static')
    const apiAdapter = makeAdapter('api')
    expect(selectDataSource({ kind: 'static' }, { static: staticAdapter, api: apiAdapter }))
      .toBe(staticAdapter)
    expect(selectDataSource({ kind: 'api' }, { static: staticAdapter, api: apiAdapter }))
      .toBe(apiAdapter)
  })
})

/* ------------------------------------------------------------------ *
 * Schema type — compile-time guard (run-time sanity)
 * ------------------------------------------------------------------ */

describe('DataSourceSchema — type compatibility with zod', () => {
  it('accepts a real Zod array schema', () => {
    const schema: z.ZodType<{ id: string }[]> = z.array(z.object({ id: z.string() }))
    // A trivial parse to make sure the schema is real.
    const parsed = schema.parse([{ id: 'ok' }])
    expect(parsed).toEqual([{ id: 'ok' }])
  })
})