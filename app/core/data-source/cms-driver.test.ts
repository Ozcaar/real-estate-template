import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createCmsDataSource, type CmsDriver } from './cms-driver'
import { DataSourceInvalidPayloadError } from './data-source'

/**
 * Tests for the CMS data-source adapter (Task 103).
 *
 * The adapter is provider-agnostic: it wraps a
 * {@link CmsDriver} and validates the driver's output
 * against the supplied boundary Zod schema. The driver
 * itself is exercised in
 * `adapters/http-json-cms-driver.test.ts`.
 *
 * The tests cover every documented branch:
 *
 *  - `id` is the literal `'cms'`.
 *  - `loadAll()` on a successful dispatch with valid data
 *    resolving against the schema returns the mapped list.
 *  - `loadAll()` on a successful dispatch whose output fails
 *    the schema throws `DataSourceInvalidPayloadError` with
 *    the underlying `ZodError` as `cause`.
 *  - `loadAll()` re-throws driver errors verbatim (the
 *    adapter does not wrap transport failures in a custom
 *    class).
 *  - Repeated calls to `loadAll()` return the same
 *    memoized reference (one dispatch per instance).
 *  - `getAll()` returns the cached value once `loadAll()`
 *    has resolved; throws before `loadAll()` resolves.
 *  - The `Symbol.toStringTag` is the documented
 *    `cms:<source>` shape so `String(adapter)` is a useful
 *    diagnostic.
 */

interface TestRecord {
  id: string
  name: string
}

const testRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})

const testListSchema = z.array(testRecordSchema) satisfies z.ZodType<TestRecord[]>

const SAMPLE: readonly TestRecord[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
]

/**
 * Build a driver that dispatches the supplied list once
 * and records the call count.
 */
function makeDriver(
  list: readonly TestRecord[],
  options: { failWith?: unknown } = {},
): CmsDriver<TestRecord> & { calls: number } {
  const driver = {
    id: 'fake',
    calls: 0,
    async dispatch(): Promise<readonly TestRecord[]> {
      driver.calls++
      if (options.failWith !== undefined) throw options.failWith
      return list
    },
  } as CmsDriver<TestRecord> & { calls: number }
  return driver
}

/* ------------------------------------------------------------------ *
 * id and Symbol.toStringTag
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — id and diagnostics', () => {
  it('exposes id = "cms"', () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })
    expect(adapter.id).toBe('cms')
  })

  it('Symbol.toStringTag uses the supplied source identifier', () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
      source: 'cms:NUXT_PROPERTIES_CMS_URL',
    })
    expect(Object.prototype.toString.call(adapter))
      .toBe('[object cms:cms:NUXT_PROPERTIES_CMS_URL]')
  })

  it('Symbol.toStringTag falls back to "cms:<driver.id>" when no source is supplied', () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })
    expect(Object.prototype.toString.call(adapter))
      .toBe('[object cms:cms:fake]')
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — success
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — loadAll success', () => {
  it('resolves with the driver\'s mapped list when the schema accepts it', async () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    const loaded = await adapter.loadAll()
    expect(loaded).toHaveLength(2)
    expect(loaded[0]?.name).toBe('Alpha')
    expect(loaded[1]?.name).toBe('Beta')
    expect(driver.calls).toBe(1)
  })

  it('accepts an empty array (zero records is a valid catalog)', async () => {
    const driver = makeDriver([])
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    const loaded = await adapter.loadAll()
    expect(loaded).toEqual([])
    expect(driver.calls).toBe(1)
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — mapping / identity
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — mapping contract', () => {
  it('the driver is the sole mapping boundary; the adapter does not transform the data', async () => {
    // The adapter does NOT mutate the driver's output. The
    // driver returns the mapped list as-is; the adapter
    // only validates with the schema. A rebrand that
    // needs per-record transformation ships the mapping
    // in a custom driver, not in the adapter.
    const mappedList: readonly TestRecord[] = [
      { id: 'driver-mapped', name: 'Driver-mapped record' },
    ]
    const driver = makeDriver(mappedList)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    const loaded = await adapter.loadAll()
    expect(loaded).toEqual(mappedList)
    expect(loaded[0]?.id).toBe('driver-mapped')
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — invalid payload
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — invalid payload', () => {
  it('throws DataSourceInvalidPayloadError when the driver\'s output fails the schema', async () => {
    const driver = makeDriver([{ id: '', name: '' }])
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
      source: 'cms:test',
    })

    await expect(adapter.loadAll()).rejects.toThrow(DataSourceInvalidPayloadError)
    await expect(adapter.loadAll()).rejects.toMatchObject({
      name: 'DataSourceInvalidPayloadError',
      endpoint: 'cms:test',
    })
  })

  it('the invalid-payload error carries the underlying ZodError as cause', async () => {
    const driver = makeDriver([{ id: '', name: '' }])
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
      source: 'cms:test',
    })

    try {
      await adapter.loadAll()
      throw new Error('expected adapter.loadAll() to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceInvalidPayloadError)
      expect((error as DataSourceInvalidPayloadError).cause).toBeInstanceOf(z.ZodError)
    }
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — driver errors propagate
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — driver error propagation', () => {
  it('re-throws driver exceptions verbatim (the adapter does not wrap transport failures)', async () => {
    const transportError = new Error('upstream timeout')
    const driver = makeDriver(SAMPLE, { failWith: transportError })
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    await expect(adapter.loadAll()).rejects.toBe(transportError)
  })
})

/* ------------------------------------------------------------------ *
 * Memoization
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — memoization', () => {
  it('memoizes the resolved list — repeated loadAll() calls do not re-dispatch the driver', async () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    const a = await adapter.loadAll()
    const b = await adapter.loadAll()
    const c = await adapter.loadAll()

    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(driver.calls).toBe(1)
  })

  it('a failed loadAll() does not memoise; a retry can run', async () => {
    let callCount = 0
    const driver: CmsDriver<TestRecord> & { calls: number } = {
      id: 'flaky',
      calls: 0,
      async dispatch(): Promise<readonly TestRecord[]> {
        driver.calls++
        callCount++
        if (callCount === 1) throw new Error('transient')
        return SAMPLE
      },
    }
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    await expect(adapter.loadAll()).rejects.toThrow('transient')
    const loaded = await adapter.loadAll()
    expect(loaded).toHaveLength(2)
    expect(driver.calls).toBe(2)
  })

  it('coalesces concurrent loadAll() calls into a single dispatch', async () => {
    // Two concurrent calls share the in-flight promise.
    let dispatchCount = 0
    let release: (() => void) | null = null
    const releasePromise = new Promise<void>((resolve) => { release = resolve })
    const driver: CmsDriver<TestRecord> = {
      id: 'slow',
      async dispatch(): Promise<readonly TestRecord[]> {
        dispatchCount++
        await releasePromise
        return SAMPLE
      },
    }
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    const a = adapter.loadAll()
    const b = adapter.loadAll()
    const c = adapter.loadAll()
    await Promise.resolve()
    await Promise.resolve()
    expect(dispatchCount).toBe(1)

    release?.()
    const [ra, rb, rc] = await Promise.all([a, b, c])
    expect(ra).toHaveLength(2)
    expect(rb).toBe(ra)
    expect(rc).toBe(ra)
    expect(dispatchCount).toBe(1)
  })
})

/* ------------------------------------------------------------------ *
 * getAll
 * ------------------------------------------------------------------ */

describe('createCmsDataSource — getAll', () => {
  it('returns the cached value once loadAll() has resolved', async () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    await adapter.loadAll()
    expect(adapter.getAll()).toHaveLength(2)
  })

  it('throws when called before loadAll() has resolved', () => {
    const driver = makeDriver(SAMPLE)
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    expect(() => adapter.getAll()).toThrow(
      /getAll\(\) called before loadAll\(\) resolved/,
    )
  })

  it('still throws after a failed loadAll() — the cache is only populated on success', async () => {
    const driver = makeDriver(SAMPLE, { failWith: new Error('boom') })
    const adapter = createCmsDataSource<TestRecord>({
      driver,
      schema: testListSchema,
    })

    await expect(adapter.loadAll()).rejects.toThrow('boom')
    expect(() => adapter.getAll()).toThrow(
      /getAll\(\) called before loadAll\(\) resolved/,
    )
  })
})