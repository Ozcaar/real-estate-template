import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  DEFAULT_DATA_SOURCE,
  DataSourceNotImplementedError,
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
 * not-implemented error, and the type guard. The contract is
 * the single most important piece of the adapter foundation:
 * if it is wrong, every feature is wrong. The tests pin down
 * the documented behaviour so a future change cannot regress
 * the "fail clearly rather than silently fall back" promise.
 *
 * Out of scope: the static adapter itself (covered in
 * `adapters/static-adapter.test.ts`) and the per-feature
 * service integrations (covered in each feature's existing
 * `*.service.test.ts`).
 */

const SUPPORTED_KINDS: readonly DataSourceKind[] = ['static', 'api', 'cms']

function makeAdapter(id: DataSourceKind): DataSourceAdapter<{ id: string }> {
  return {
    id,
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
