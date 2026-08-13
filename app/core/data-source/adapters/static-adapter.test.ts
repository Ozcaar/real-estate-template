import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createStaticDataSource, type StaticDataSourceOptions } from './static-adapter'

/**
 * Tests for the static data-source adapter.
 *
 * The static adapter is the only always-on data-source
 * implementation shipped with the v1.x template. It wraps a
 * bundled TypeScript array and exposes it through the
 * `DataSourceAdapter` contract. The contract-level tests
 * (selector, error class, type guard) live in
 * `../data-source.test.ts`; this file pins down the
 * implementation-level behaviour that every feature depends
 * on.
 *
 * Coverage:
 *
 *  - `id` is the literal `'static'`.
 *  - `loadAll()` returns a `Promise<readonly T[]>` that
 *    resolves immediately with the bundled data.
 *  - `getAll()` returns the supplied data, in order, as a
 *    synchronous accessor.
 *  - `getAll()` and `loadAll()` return the same reference on
 *    repeated calls (the adapter memoizes).
 *  - With a Zod schema, the adapter validates at construction
 *    and a bad record throws a `ZodError` synchronously.
 *  - Without a schema, the adapter returns the data
 *    unchanged (the data file is the source of truth).
 *  - Empty arrays are valid.
 *  - The `Symbol.toStringTag` is the documented
 *    `static:<source>` shape so `String(adapter)` and
 *    `Object.prototype.toString.call(adapter)` are useful
 *    diagnostics.
 *  - Mutating the original array after construction does not
 *    change the adapter's view (the adapter takes a snapshot
 *    via the validation memo).
 *  - The async contract is satisfied end-to-end: a page can
 *    `await adapter.loadAll()` from a `<script setup>` and
 *    get the same array as `getAll()` returns.
 */

interface TestRecord {
  id: string
  name: string
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const sampleData: readonly TestRecord[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
]

const testRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

const testListSchema = z.array(testRecordSchema) satisfies z.ZodType<TestRecord[]>

/* ------------------------------------------------------------------ *
 * id and getAll — happy path
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — id', () => {
  it('exposes id = "static"', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    expect(adapter.id).toBe('static')
  })
})

describe('createStaticDataSource — getAll (no schema)', () => {
  it('returns the supplied data, in order', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    expect(adapter.getAll()).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })

  it('returns the same reference on every call (memoized)', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    const first = adapter.getAll()
    const second = adapter.getAll()
    expect(second).toBe(first)
  })

  it('returns an empty array when the data is empty', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: [] })
    expect(adapter.getAll()).toEqual([])
  })

  it('returns the data as-is when no schema is supplied (no validation)', () => {
    // The data is intentionally not a `TestRecord[]` to
    // prove the adapter does not validate when no schema is
    // supplied. The caller is responsible for shape.
    const looseData = [{ id: 1 }, { id: 2 }] as unknown as readonly TestRecord[]
    const adapter = createStaticDataSource<TestRecord>({ data: looseData })
    expect(adapter.getAll()).toBe(looseData)
  })
})

/* ------------------------------------------------------------------ *
 * getAll — with a Zod schema
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — getAll (with a Zod schema)', () => {
  it('returns the data when every record passes the schema', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      schema: testListSchema,
    })
    expect(adapter.getAll()).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })

  it('throws a ZodError at construction when a record is invalid', () => {
    const broken = [
      { id: '1', name: 'Alpha' },
      { id: '', name: 'Empty id' },
    ] as unknown as readonly TestRecord[]
    expect(() => createStaticDataSource<TestRecord>({ data: broken, schema: testListSchema }))
      .toThrow()
  })

  it('throws synchronously — the construction is the validation point', () => {
    // A future async source would fetch and parse on demand;
    // the static source validates up front. The construction
    // call itself is what throws.
    const broken = [{ id: '' }] as unknown as readonly TestRecord[]
    let threw = false
    try {
      createStaticDataSource<TestRecord>({ data: broken, schema: testListSchema })
    }
    catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('accepts an empty array (a valid empty list is not a validation error)', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: [],
      schema: testListSchema,
    })
    expect(adapter.getAll()).toEqual([])
  })

  it('returns the same reference on every call (the validated list is memoized)', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      schema: testListSchema,
    })
    expect(adapter.getAll()).toBe(adapter.getAll())
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — async contract
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — loadAll (async contract)', () => {
  it('returns a Promise', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    expect(adapter.loadAll()).toBeInstanceOf(Promise)
  })

  it('resolves to the supplied data, in order', async () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    const data = await adapter.loadAll()
    expect(data).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })

  it('resolves to the same reference on every call (memoized)', async () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    const first = await adapter.loadAll()
    const second = await adapter.loadAll()
    expect(second).toBe(first)
  })

  it('loadAll() and getAll() return the same array reference', async () => {
    // The async and sync accessors must agree on the
    // underlying array so a page can `await
    // adapter.loadAll()` once and then call `getAll()`
    // synchronously from a reactive computed without
    // triggering a second parse.
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    const fromLoad = await adapter.loadAll()
    const fromGet = adapter.getAll()
    expect(fromGet).toBe(fromLoad)
  })

  it('loadAll() resolves to an empty array when the data is empty', async () => {
    const adapter = createStaticDataSource<TestRecord>({ data: [] })
    const data = await adapter.loadAll()
    expect(data).toEqual([])
  })

  it('loadAll() resolves to the validated list when a schema is supplied', async () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      schema: testListSchema,
    })
    const data = await adapter.loadAll()
    expect(data).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })

  it('loadAll() is consumable through await in a script-setup page', async () => {
    // Simulates the Nuxt `useAsyncData('key', () => adapter.loadAll())`
    // pattern at the contract level: `await adapter.loadAll()` must
    // return a value usable by the service layer immediately.
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    const data = await adapter.loadAll()
    // The service-layer pattern: derive a filtered list from the
    // resolved value without any further I/O.
    const ids = data.map(record => record.id)
    expect(ids).toEqual(['1', '2', '3'])
  })
})

/* ------------------------------------------------------------------ *
 * Diagnostics — Symbol.toStringTag
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — diagnostics', () => {
  it('Symbol.toStringTag is "static" when no source is supplied', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    expect(Object.prototype.toString.call(adapter)).toBe('[object static:static]')
  })

  it('Symbol.toStringTag includes the supplied source identifier', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      source: 'app/features/properties/data/properties.ts',
    })
    expect(Object.prototype.toString.call(adapter))
      .toBe('[object static:app/features/properties/data/properties.ts]')
  })

  it('String(adapter) yields the same toStringTag', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      source: 'agents',
    })
    expect(String(adapter)).toBe('[object static:agents]')
  })
})

/* ------------------------------------------------------------------ *
 * Source identifier — default and override
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — source identifier', () => {
  it('uses "static" as the default source', () => {
    const adapter = createStaticDataSource<TestRecord>({ data: sampleData })
    expect(Object.prototype.toString.call(adapter)).toContain('static:static')
  })

  it('accepts a custom source identifier', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      source: 'custom-source',
    })
    expect(Object.prototype.toString.call(adapter)).toContain('custom-source')
  })

  it('accepts the empty string as a source identifier (edge case, not a recommendation)', () => {
    const adapter = createStaticDataSource<TestRecord>({
      data: sampleData,
      source: '',
    })
    expect(Object.prototype.toString.call(adapter)).toBe('[object static:]')
  })
})

/* ------------------------------------------------------------------ *
 * Independence from the original array
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — independence from the original array', () => {
  it('with a schema, the validated snapshot is independent of later mutations to the source array', () => {
    // When a Zod schema is supplied, the adapter calls
    // `schema.parse(data)` at construction. The Zod parse
    // produces a fresh array, so subsequent mutations to
    // the source array do not affect the adapter's view.
    const data: TestRecord[] = [{ id: '1', name: 'Alpha' }]
    const adapter = createStaticDataSource<TestRecord>({
      data,
      schema: testListSchema,
    })
    const before = adapter.getAll()
    data.push({ id: '2', name: 'Beta' })
    const after = adapter.getAll()
    expect(before).toEqual([{ id: '1', name: 'Alpha' }])
    expect(after).toEqual([{ id: '1', name: 'Alpha' }])
  })

  it('without a schema, the adapter returns the same reference as the source array (documented pass-through)', () => {
    // The static adapter is a thin pass-through when no
    // schema is supplied: `getAll()` returns the exact
    // reference passed in. The caller is responsible for
    // not mutating the source array after construction
    // when this contract is used.
    const data: TestRecord[] = [{ id: '1', name: 'Alpha' }]
    const adapter = createStaticDataSource<TestRecord>({ data })
    const first = adapter.getAll()
    expect(first).toBe(data)
  })

  it('loadAll() with a schema also returns the validated snapshot (independent of later mutations)', async () => {
    const data: TestRecord[] = [{ id: '1', name: 'Alpha' }]
    const adapter = createStaticDataSource<TestRecord>({
      data,
      schema: testListSchema,
    })
    const before = await adapter.loadAll()
    data.push({ id: '2', name: 'Beta' })
    const after = await adapter.loadAll()
    expect(before).toEqual([{ id: '1', name: 'Alpha' }])
    expect(after).toEqual([{ id: '1', name: 'Alpha' }])
  })
})

/* ------------------------------------------------------------------ *
 * Options shape — type-level smoke test
 * ------------------------------------------------------------------ */

describe('createStaticDataSource — options shape', () => {
  it('accepts a minimal options object (only `data`)', () => {
    const options: StaticDataSourceOptions<TestRecord> = { data: sampleData }
    const adapter = createStaticDataSource<TestRecord>(options)
    expect(adapter.getAll()).toHaveLength(3)
  })

  it('accepts a full options object (data + schema + source)', () => {
    const options: StaticDataSourceOptions<TestRecord> = {
      data: sampleData,
      schema: testListSchema,
      source: 'full-options',
    }
    const adapter = createStaticDataSource<TestRecord>(options)
    expect(adapter.getAll()).toHaveLength(3)
    expect(adapter.id).toBe('static')
    expect(Object.prototype.toString.call(adapter)).toContain('full-options')
  })

  it('accepts a readonly array as input', () => {
    // `data` is typed `readonly T[]`. A `T[]` is assignable
    // to `readonly T[]`, so a mutable array is also accepted.
    const mutable: TestRecord[] = [{ id: '1', name: 'Alpha' }]
    const adapter = createStaticDataSource<TestRecord>({ data: mutable })
    expect(adapter.getAll()).toEqual([{ id: '1', name: 'Alpha' }])
  })
})