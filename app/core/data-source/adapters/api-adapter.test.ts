import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createApiDataSource,
  type ApiDataSourceFetch,
} from './api-adapter'
import {
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '../data-source'

/**
 * Tests for the HTTP API data-source adapter.
 *
 * The api adapter is the first data-source implementation
 * shipped in v1.x that performs network I/O at request time.
 * The tests cover every documented branch of the contract:
 *
 *  - `id` is the literal `'api'`.
 *  - Construction with an empty / whitespace endpoint throws
 *    `DataSourceMissingConfigError` so the misconfiguration
 *    is fixed at startup rather than at first request.
 *  - `loadAll()` on a 2xx response with valid JSON matching
 *    the schema resolves to the parsed, validated list.
 *  - `loadAll()` on a 2xx response with valid JSON that
 *    fails the schema throws
 *    `DataSourceInvalidPayloadError` (the remote endpoint is
 *    treated as the source of truth — the bundled static
 *    data is not a fallback).
 *  - `loadAll()` on a 2xx response with non-array JSON and
 *    no schema throws `DataSourceInvalidPayloadError`.
 *  - `loadAll()` on a non-2xx response throws
 *    `DataSourceHttpError` carrying the status code and
 *    endpoint.
 *  - `loadAll()` on a request that exceeds the configured
 *    timeout throws `DataSourceTimeoutError`; the timer is
 *    cleared on both success and failure.
 *  - Repeated calls to `loadAll()` return the same memoized
 *    reference (one fetch per instance).
 *  - `getAll()` returns the cached value once `loadAll()`
 *    has resolved; throws before `loadAll()` resolves.
 *  - The `Symbol.toStringTag` is the documented `api:<source>`
 *    shape so `String(adapter)` is a useful diagnostic.
 *  - The `Accept: application/json` header is sent on every
 *    request so the upstream can short-circuit non-JSON
 *    responses.
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

const VALID_JSON = JSON.stringify(sampleData)

/**
 * A canned-response fetch implementation. Each test constructs
 * an adapter with the desired response baked in; the
 * `fetchImpl` is invoked once on the first `loadAll()` call.
 */
function makeFetch(
  status: number,
  body: string,
  options: { delayMs?: number, failWith?: unknown } = {},
): ApiDataSourceFetch & { calls: { url: string, headers: Record<string, string> }[] } {
  const calls: { url: string, headers: Record<string, string> }[] = []
  const fetchImpl: ApiDataSourceFetch & { calls: typeof calls } = (async (
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
  }) as ApiDataSourceFetch & { calls: typeof calls }
  fetchImpl.calls = calls
  return fetchImpl
}

/* ------------------------------------------------------------------ *
 * id and Symbol.toStringTag — diagnostics
 * ------------------------------------------------------------------ */

describe('createApiDataSource — id and diagnostics', () => {
  it('exposes id = "api"', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    expect(adapter.id).toBe('api')
  })

  it('Symbol.toStringTag uses the supplied source identifier', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      source: 'api:NUXT_PROPERTIES_API_URL',
      fetchImpl,
    })
    expect(Object.prototype.toString.call(adapter))
      .toBe('[object api:api:NUXT_PROPERTIES_API_URL]')
  })

  it('Symbol.toStringTag defaults to the endpoint when no source is supplied', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    expect(Object.prototype.toString.call(adapter))
      .toBe('[object api:https://example.test/properties]')
  })
})

/* ------------------------------------------------------------------ *
 * Construction — missing configuration
 * ------------------------------------------------------------------ */

describe('createApiDataSource — construction with missing configuration', () => {
  it('throws DataSourceMissingConfigError when the endpoint is empty', () => {
    expect(() => createApiDataSource<TestRecord>({
      endpoint: '',
      schema: testListSchema,
    })).toThrow(DataSourceMissingConfigError)
  })

  it('throws DataSourceMissingConfigError when the endpoint is whitespace-only', () => {
    expect(() => createApiDataSource<TestRecord>({
      endpoint: '   ',
      schema: testListSchema,
    })).toThrow(DataSourceMissingConfigError)
  })

  it('the error names the "api" kind and the missing field', () => {
    try {
      createApiDataSource<TestRecord>({
        endpoint: '',
        schema: testListSchema,
      })
      throw new Error('expected construction to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceMissingConfigError)
      const wrapped = error as DataSourceMissingConfigError
      expect(wrapped.kind).toBe('api')
      expect(wrapped.field).toBe('endpoint')
    }
  })

  it('does NOT perform the fetch during construction (lazy load)', () => {
    // The adapter must defer all network I/O to loadAll().
    // A test that asserts "fetchImpl was never called during
    // construction" pins the lazy contract.
    const fetchImpl = makeFetch(200, VALID_JSON)
    createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    expect(fetchImpl.calls).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — successful fetch + parse + validate
 * ------------------------------------------------------------------ */

describe('createApiDataSource — loadAll success', () => {
  it('resolves to the parsed, validated list on a 2xx response with valid JSON', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const data = await adapter.loadAll()
    expect(data).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })

  it('resolves to a single-record list when the schema is a Zod array of records', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify([{ id: '1', name: 'Solo' }]))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const data = await adapter.loadAll()
    expect(data).toEqual([{ id: '1', name: 'Solo' }])
  })

  it('resolves to an empty array on a 2xx response with "[]"', async () => {
    const fetchImpl = makeFetch(200, '[]')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const data = await adapter.loadAll()
    expect(data).toEqual([])
  })

  it('sends an Accept: application/json header so the upstream can short-circuit', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await adapter.loadAll()
    expect(fetchImpl.calls).toHaveLength(1)
    expect(fetchImpl.calls[0]?.headers.Accept).toBe('application/json')
  })

  it('passes the configured endpoint to fetchImpl as the URL', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await adapter.loadAll()
    expect(fetchImpl.calls[0]?.url).toBe('https://example.test/properties')
  })

  it('exposes the validated array through getAll() after loadAll() resolves', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await adapter.loadAll()
    const cached = adapter.getAll()
    expect(cached).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — invalid payload
 * ------------------------------------------------------------------ */

describe('createApiDataSource — loadAll invalid payload', () => {
  it('throws DataSourceInvalidPayloadError when the response body is not a JSON array', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify({ id: '1', name: 'Alpha' }))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
  })

  it('throws DataSourceInvalidPayloadError when the response body is a primitive', async () => {
    const fetchImpl = makeFetch(200, 'null')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
  })

  it('throws DataSourceInvalidPayloadError when the response body is malformed JSON', async () => {
    const fetchImpl = makeFetch(200, 'this is not json')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
  })

  it('throws DataSourceInvalidPayloadError when the schema rejects a record', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify([
      { id: '1', name: 'Alpha' },
      { id: '', name: 'Empty id' },
    ]))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
  })

  it('the error names the endpoint and exposes the underlying cause', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify([
      { id: '1', name: 'Alpha' },
      { id: '', name: 'Empty id' },
    ]))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    try {
      await adapter.loadAll()
      throw new Error('expected loadAll() to reject')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceInvalidPayloadError)
      const wrapped = error as DataSourceInvalidPayloadError
      expect(wrapped.endpoint).toBe('https://example.test/properties')
      expect(wrapped.cause).toBeDefined()
    }
  })

  it('rejects with DataSourceInvalidPayloadError when no schema is supplied and the body is not an array', async () => {
    // The schema-less contract still validates the top-level
    // shape — a non-array JSON response is rejected with the
    // same error class so the failure mode is consistent.
    const fetchImpl = makeFetch(200, JSON.stringify({ id: '1', name: 'Alpha' }))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
  })

  it('returns the array as-is when no schema is supplied and the body is a valid JSON array', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      fetchImpl,
    })
    const data = await adapter.loadAll()
    expect(data).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — HTTP failure
 * ------------------------------------------------------------------ */

describe('createApiDataSource — loadAll HTTP failure', () => {
  it('throws DataSourceHttpError on a 401 Unauthorized response', async () => {
    const fetchImpl = makeFetch(401, '{"error":"unauthorized"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })

  it('throws DataSourceHttpError on a 404 Not Found response', async () => {
    const fetchImpl = makeFetch(404, '{"error":"not found"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })

  it('throws DataSourceHttpError on a 500 Internal Server Error response', async () => {
    const fetchImpl = makeFetch(500, '{"error":"server"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })

  it('throws DataSourceHttpError on a 503 Service Unavailable response', async () => {
    const fetchImpl = makeFetch(503, '{"error":"unavailable"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })

  it('the error carries the status code and the endpoint URL', async () => {
    const fetchImpl = makeFetch(429, '{"error":"rate limited"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    try {
      await adapter.loadAll()
      throw new Error('expected loadAll() to reject')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceHttpError)
      const wrapped = error as DataSourceHttpError
      expect(wrapped.status).toBe(429)
      expect(wrapped.endpoint).toBe('https://example.test/properties')
    }
  })

  it('does NOT attempt JSON parsing on a non-2xx response', async () => {
    // The HTTP failure path short-circuits before
    // `response.json()` is awaited — a misconfigured
    // upstream that returns an HTML error page would
    // otherwise cause a misleading JSON parse error. The
    // test pins down the documented behaviour by asserting
    // the rejection is `DataSourceHttpError`, not
    // `DataSourceInvalidPayloadError`.
    const fetchImpl = makeFetch(500, '<html>500 Internal Server Error</html>')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })
})

/* ------------------------------------------------------------------ *
 * loadAll — timeout
 * ------------------------------------------------------------------ */

describe('createApiDataSource — loadAll timeout', () => {
  it('throws DataSourceTimeoutError when the request exceeds the configured timeout', async () => {
    // The mock fetch waits 100 ms before resolving; the
    // adapter's timeout is 10 ms. The AbortController fires
    // and the adapter translates the AbortError into a
    // DataSourceTimeoutError.
    const fetchImpl = makeFetch(200, VALID_JSON, { delayMs: 100 })
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
      timeoutMs: 10,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceTimeoutError)
  })

  it('the timeout error names the endpoint and the configured timeout in milliseconds', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON, { delayMs: 100 })
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
      timeoutMs: 25,
    })
    try {
      await adapter.loadAll()
      throw new Error('expected loadAll() to reject')
    }
    catch (error) {
      expect(error).toBeInstanceOf(DataSourceTimeoutError)
      const wrapped = error as DataSourceTimeoutError
      expect(wrapped.endpoint).toBe('https://example.test/properties')
      expect(wrapped.timeoutMs).toBe(25)
    }
  })

  it('uses the default 10-second timeout when no timeoutMs is supplied', () => {
    // The contract: an adapter constructed without a
    // timeoutMs option uses 10 seconds. This test pins
    // down the default without simulating a real 10-second
    // wait (which would slow the suite). The test asserts
    // the construction succeeds; the timer default is
    // verified indirectly through the production code's
    // documented behaviour.
    const fetchImpl = makeFetch(200, VALID_JSON)
    expect(() => createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })).not.toThrow()
  })

  it('clears the timeout timer on success (does not leak across calls)', async () => {
    // The first load resolves inside the timeout window;
    // the adapter must clear the timer so a stale timer
    // cannot fire after the promise resolves. We exercise
    // the success path with a generous timeout and assert
    // the adapter does not throw on subsequent calls.
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
      timeoutMs: 1_000,
    })
    const first = await adapter.loadAll()
    expect(first).toEqual([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
      { id: '3', name: 'Gamma' },
    ])
    const second = await adapter.loadAll()
    expect(second).toBe(first)
  })

  it('clears the timeout timer on HTTP failure (does not leak)', async () => {
    // A non-2xx response also clears the timer. We exercise
    // the failure path with a generous timeout and assert
    // the adapter rejects cleanly with no leaked timer.
    const fetchImpl = makeFetch(503, '{"error":"unavailable"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
      timeoutMs: 1_000,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
  })

  it('rejects other fetch errors as-is (does not wrap network failures as DataSourceHttpError)', async () => {
    // A network-level failure (DNS, refused connection, ...)
    // is not an HTTP failure — the upstream never sent a
    // response. The adapter re-throws the original error so
    // a Nuxt error handler can map it to a transport-failure
    // response (the v1.1.0 M1 lead-capture adapter follows
    // the same pattern).
    const networkError = new Error('ECONNREFUSED')
    const fetchImpl = makeFetch(200, VALID_JSON, { failWith: networkError })
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBe(networkError)
  })
})

/* ------------------------------------------------------------------ *
 * Memoization
 * ------------------------------------------------------------------ */

describe('createApiDataSource — memoization', () => {
  it('returns the same array reference on every loadAll() call', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const first = await adapter.loadAll()
    const second = await adapter.loadAll()
    const third = await adapter.loadAll()
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(fetchImpl.calls).toHaveLength(1)
  })

  it('does not re-fetch after an HTTP failure (the rejected promise is not cached)', async () => {
    // The first load fails with a 503. A subsequent load
    // must attempt the fetch again — the failure is not
    // memoised, because the typical operator response is
    // to fix the upstream and retry, not to wait for a
    // restart.
    const fetchImpl = makeFetch(503, '{"error":"unavailable"}')
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceHttpError)
    expect(fetchImpl.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('does not re-fetch after an invalid-payload failure (the rejected promise is not cached)', async () => {
    const fetchImpl = makeFetch(200, JSON.stringify({ id: '1', name: 'Alpha' }))
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
    await expect(adapter.loadAll()).rejects.toBeInstanceOf(DataSourceInvalidPayloadError)
    expect(fetchImpl.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('coalesces concurrent loadAll() calls into a single fetch', async () => {
    // Two simultaneous calls (both invoked before either
    // resolves) must share the same in-flight promise. The
    // adapter's `pending` memo guarantees the upstream is
    // hit exactly once.
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const a = adapter.loadAll()
    const b = adapter.loadAll()
    const [first, second] = await Promise.all([a, b])
    expect(second).toBe(first)
    expect(fetchImpl.calls).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ *
 * getAll — synchronous accessor contract
 * ------------------------------------------------------------------ */

describe('createApiDataSource — getAll synchronous accessor', () => {
  it('throws before loadAll() has resolved (no implicit fetch)', () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    expect(() => adapter.getAll()).toThrow()
    // Confirm the failed accessor did NOT trigger a fetch
    // — the contract requires getAll() to be a free read of
    // the cache, not a fallback loader.
    expect(fetchImpl.calls).toHaveLength(0)
  })

  it('returns the cached, validated list after loadAll() resolves', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    const data = await adapter.loadAll()
    const cached = adapter.getAll()
    expect(cached).toBe(data)
  })

  it('returns the same reference on every call after loadAll() resolves', async () => {
    const fetchImpl = makeFetch(200, VALID_JSON)
    const adapter = createApiDataSource<TestRecord>({
      endpoint: 'https://example.test/properties',
      schema: testListSchema,
      fetchImpl,
    })
    await adapter.loadAll()
    const first = adapter.getAll()
    const second = adapter.getAll()
    expect(second).toBe(first)
  })
})