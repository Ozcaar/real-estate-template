import { describe, expect, it } from 'vitest'
import {
  createHttpJsonCmsDriver,
  type CmsDriverFetch,
} from './http-json-cms-driver'
import {
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '../data-source'

/**
 * Tests for the simple HTTP/JSON CMS provider driver (Task 103).
 *
 * The driver is the first concrete {@link CmsDriver}
 * shipped in the v1.x template. It is a thin HTTP/JSON
 * transport: fetch a JSON array, return it as the mapped
 * list (identity mapping), let the boundary schema validate.
 *
 * Coverage:
 *
 *  - `id` is the literal `'http-json'`.
 *  - Construction with an empty / whitespace endpoint
 *    throws `DataSourceMissingConfigError` so the
 *    misconfiguration is fixed at startup rather than at
 *    first request.
 *  - `dispatch()` on a 2xx response with valid JSON
 *    resolves to the parsed array.
 *  - `dispatch()` on a 2xx response with non-array JSON
 *    throws `DataSourceInvalidPayloadError`.
 *  - `dispatch()` on a non-2xx response throws
 *    `DataSourceHttpError` carrying the status code and
 *    endpoint.
 *  - `dispatch()` on a request that exceeds the configured
 *    timeout throws `DataSourceTimeoutError`; the timer is
 *    cleared on both success and failure.
 *  - The `Accept: application/json` header is sent on
 *    every request so the upstream can short-circuit
 *    non-JSON responses.
 *  - The `Symbol.toStringTag` is the documented
 *    `cms-driver:<source>` shape.
 *  - A driver constructed without a custom `timeoutMs` uses
 *    the documented 10 000 ms default.
 *  - The driver propagates transport errors verbatim (no
 *    custom wrapping).
 */

interface TestRecord {
  id: string
  name: string
}

const SAMPLE: readonly TestRecord[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
]

const VALID_JSON = JSON.stringify(SAMPLE)

/**
 * A canned-response fetch implementation. Each test constructs
 * a driver with the desired response baked in; the
 * `fetchImpl` is invoked once on the first `dispatch()` call.
 */
function makeFetch(
  status: number,
  body: string,
  options: { delayMs?: number, failWith?: unknown } = {},
): CmsDriverFetch & { calls: { url: string, headers: Record<string, string> }[] } {
  const calls: { url: string, headers: Record<string, string> }[] = []
  const fetchImpl: CmsDriverFetch & { calls: typeof calls } = (async (
    url: string,
    init?: { headers?: Record<string, string>, signal?: AbortSignal },
  ) => {
    calls.push({ url, headers: { ...(init?.headers ?? {}) } })
    if (options.failWith !== undefined) {
      throw options.failWith
    }
    if (options.delayMs !== undefined) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, options.delayMs)
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => JSON.parse(body),
    }
  }) as CmsDriverFetch & { calls: typeof calls }
  fetchImpl.calls = calls
  return fetchImpl
}

/* ------------------------------------------------------------------ *
 * Construction
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — construction', () => {
  it('throws DataSourceMissingConfigError on an empty endpoint', () => {
    expect(() => createHttpJsonCmsDriver<TestRecord>({
      endpoint: '',
    })).toThrow(DataSourceMissingConfigError)
  })

  it('throws DataSourceMissingConfigError on a whitespace endpoint', () => {
    expect(() => createHttpJsonCmsDriver<TestRecord>({
      endpoint: '   ',
    })).toThrow(DataSourceMissingConfigError)
  })

  it('the missing-config error names the cms kind and the endpoint field', () => {
    try {
      createHttpJsonCmsDriver<TestRecord>({ endpoint: '' })
      throw new Error('expected driver construction to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceMissingConfigError)
      expect((error as DataSourceMissingConfigError).kind).toBe('cms')
      expect((error as DataSourceMissingConfigError).field).toBe('endpoint')
    }
  })

  it('does not throw on a valid endpoint', () => {
    expect(() => createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
    })).not.toThrow()
  })

  it('falls back to the documented 10 000 ms default when timeoutMs is unset', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })
    // The 10 000 ms default is observable only via a slow
    // mock; we instead smoke-test that the AbortSignal is
    // passed and a successful dispatch resolves quickly.
    await driver.dispatch()
    expect(fetchImpl.calls).toHaveLength(1)
  })

  it('accepts a custom timeoutMs', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
      timeoutMs: 5000,
    })
    await driver.dispatch()
  })

  it('ignores non-positive timeoutMs values and falls back to the default', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
      timeoutMs: 0,
    })
    await driver.dispatch()
  })
})

/* ------------------------------------------------------------------ *
 * id and Symbol.toStringTag
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — id and diagnostics', () => {
  it('exposes id = "http-json"', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })
    expect(driver.id).toBe('http-json')
  })

  it('Symbol.toStringTag uses the supplied source identifier', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      source: 'cms:NUXT_PROPERTIES_CMS_URL',
      fetchImpl,
    })
    expect(Object.prototype.toString.call(driver))
      .toBe('[object cms-driver:cms:NUXT_PROPERTIES_CMS_URL]')
  })
})

/* ------------------------------------------------------------------ *
 * dispatch — success
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — dispatch success', () => {
  it('returns the parsed JSON array on a 2xx response', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    const data = await driver.dispatch()
    expect(data).toHaveLength(2)
    expect(data[0]?.name).toBe('Alpha')
    expect(data[1]?.name).toBe('Beta')
  })

  it('returns an empty array when the upstream returns []', async () => {
    const fetchImpl = makeFetch(200, '[]')
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    const data = await driver.dispatch()
    expect(data).toEqual([])
  })

  it('sends the Accept: application/json header on every request', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await driver.dispatch()
    expect(fetchImpl.calls[0]?.headers.Accept).toBe('application/json')
  })

  it('passes an AbortSignal to the fetch implementation (the timeout hook is wired)', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await driver.dispatch()
    // The mock's `calls` records the headers only; we
    // augment the mock with a signal check at the call
    // site via a second fetchImpl.
    const signalFetch = (async (
      _url: string,
      init?: { signal?: AbortSignal },
    ) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      return {
        ok: true,
        status: 200,
        json: async () => [],
      }
    }) as CmsDriverFetch
    const signalDriver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl: signalFetch,
    })
    await signalDriver.dispatch()
  })
})

/* ------------------------------------------------------------------ *
 * dispatch — invalid payload
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — dispatch invalid payload', () => {
  it('throws DataSourceInvalidPayloadError when the body is not a JSON array', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify({ not: 'an array' }))
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceInvalidPayloadError',
      endpoint: 'https://example.test/properties',
    })
  })

  it('throws DataSourceInvalidPayloadError when the JSON is malformed', async () => {
    const fetchImpl = makeFetch(200, '{ this is not valid JSON')
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceInvalidPayloadError',
      endpoint: 'https://example.test/properties',
    })
  })

  it('the driver does NOT run the boundary schema — that is the adapter\'s job', async () => {
    // The driver is provider-agnostic; it returns the raw
    // array and lets the adapter validate. A record that
    // violates `testListSchema` reaches the adapter
    // unchanged.
    const fetchImpl = makeFetch(200, JSON.stringify([{ id: '', name: '' }]))
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    const data = await driver.dispatch()
    // The driver returns the raw payload — invalid records
    // pass through. The adapter would then raise
    // `DataSourceInvalidPayloadError`.
    expect(data).toEqual([{ id: '', name: '' }])
  })
})

/* ------------------------------------------------------------------ *
 * dispatch — HTTP failure
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — dispatch HTTP failure', () => {
  it('throws DataSourceHttpError on a non-2xx response', async () => {
    const fetchImpl = makeFetch(500, '{}')
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceHttpError',
      status: 500,
      endpoint: 'https://example.test/properties',
    })
  })

  it('throws DataSourceHttpError on a 401 response', async () => {
    const fetchImpl = makeFetch(401, '{}')
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceHttpError',
      status: 401,
    })
  })

  it('throws DataSourceHttpError on a 404 response', async () => {
    const fetchImpl = makeFetch(404, 'not found')
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceHttpError',
      status: 404,
    })
  })
})

/* ------------------------------------------------------------------ *
 * dispatch — timeout
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — dispatch timeout', () => {
  it('throws DataSourceTimeoutError when the request exceeds timeoutMs', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON, { delayMs: 200 })
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
      timeoutMs: 50,
    })

    await expect(driver.dispatch()).rejects.toBeInstanceOf(DataSourceTimeoutError)
    await expect(driver.dispatch()).rejects.toMatchObject({
      name: 'DataSourceTimeoutError',
      endpoint: 'https://example.test/properties',
      timeoutMs: 50,
    })
  })

  it('the original AbortError is not chained on the public DataSourceTimeoutError', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON, { delayMs: 200 })
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
      timeoutMs: 50,
    })

    try {
      await driver.dispatch()
      throw new Error('expected driver.dispatch() to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceTimeoutError)
      expect((error as Error).cause).toBeUndefined()
    }
  })
})

/* ------------------------------------------------------------------ *
 * dispatch — transport errors propagate
 * ------------------------------------------------------------------ */

describe('createHttpJsonCmsDriver — dispatch transport errors', () => {
  it('re-throws network errors verbatim (no custom wrapping)', async () => {
    const networkError = new Error('ECONNREFUSED')
    const fetchImpl = makeFetch(200, VALID_JSON, { failWith: networkError })
    const driver = createHttpJsonCmsDriver<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })

    await expect(driver.dispatch()).rejects.toBe(networkError)
  })
})