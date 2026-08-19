import { describe, expect, it, vi } from 'vitest'
import {
  DataSourceHttpError,
  DataSourceInvalidPayloadError,
  DataSourceMissingConfigError,
  DataSourceTimeoutError,
} from '~/core/data-source/data-source'
import { createSanityDriver } from './sanity-driver'

/**
 * Mock the `SanityClient.fetch` method only. The driver
 * reads the GROQ query and the `params` and `options`
 * arguments; the tests assert on both.
 */
function makeMockClient(response: {
  result?: unknown
  error?: unknown
  statusCode?: number
}): {
  fetch: ReturnType<typeof vi.fn>
} {
  return {
    fetch: vi.fn(async () => {
      if (response.error) {
        // Replicate the shape the real @sanity/client throws
        // for a non-2xx response (an Error with `statusCode`).
        if (response.statusCode !== undefined) {
          const err = new Error('Sanity error') as Error & { statusCode: number }
          err.statusCode = response.statusCode
          throw err
        }
        throw response.error
      }
      return response.result
    }),
  }
}

describe('server/utils/sanity-driver', () => {
  describe('createSanityDriver — construction', () => {
    it('returns a driver with id "sanity"', () => {
      const client = makeMockClient({ result: [] })
      const driver = createSanityDriver<{ id: string }>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc as { id: string },
      })
      expect(driver.id).toBe('sanity')
    })

    it('throws DataSourceMissingConfigError when the client is missing', () => {
      expect(() =>
        createSanityDriver({
          client: null as never,
          query: '*[_type == "property"]',
          mapRecord: () => ({}),
        }),
      ).toThrow(DataSourceMissingConfigError)
    })

    it('throws DataSourceMissingConfigError when the query is empty', () => {
      const client = makeMockClient({ result: [] })
      expect(() =>
        createSanityDriver({
          client: client as never,
          query: '',
          mapRecord: () => ({}),
        }),
      ).toThrow(DataSourceMissingConfigError)
    })

    it('throws DataSourceMissingConfigError when the query is whitespace', () => {
      const client = makeMockClient({ result: [] })
      expect(() =>
        createSanityDriver({
          client: client as never,
          query: '   ',
          mapRecord: () => ({}),
        }),
      ).toThrow(DataSourceMissingConfigError)
    })
  })

  describe('dispatch — happy path', () => {
    it('returns the mapped array on a successful GROQ query', async () => {
      const documents = [
        { _id: 'p1', title: 'Property 1' },
        { _id: 'p2', title: 'Property 2' },
      ]
      const client = makeMockClient({ result: documents })
      const driver = createSanityDriver<{ id: string, title: string }>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => {
          const d = doc as { _id: string, title: string }
          return { id: d._id, title: d.title }
        },
      })
      const result = await driver.dispatch()
      expect(result).toEqual([
        { id: 'p1', title: 'Property 1' },
        { id: 'p2', title: 'Property 2' },
      ])
    })

    it('returns an empty array when the dataset has no matching documents', async () => {
      const client = makeMockClient({ result: [] })
      const driver = createSanityDriver<{ id: string }>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc as { id: string },
      })
      const result = await driver.dispatch()
      expect(result).toEqual([])
    })

    it('forwards the GROQ query to client.fetch', async () => {
      const client = makeMockClient({ result: [] })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "agent"]{ _id, name }',
        mapRecord: (doc) => doc,
        source: 'sanity:agent',
      })
      await driver.dispatch()
      expect(client.fetch).toHaveBeenCalledWith(
        '*[_type == "agent"]{ _id, name }',
        {},
        expect.objectContaining({
          filterResponse: true,
          timeout: 10_000,
        }),
      )
    })

    it('applies the supplied mapRecord to every document', async () => {
      const documents = [
        { _id: 'a1', name: 'Agent 1' },
        { _id: 'a2', name: 'Agent 2' },
        { _id: 'a3', name: 'Agent 3' },
      ]
      const client = makeMockClient({ result: documents })
      const mapRecord = vi.fn((doc: unknown) => {
        const d = doc as { _id: string, name: string }
        return { id: d._id, name: d.name.toUpperCase() }
      })
      const driver = createSanityDriver<{ id: string, name: string }>({
        client: client as never,
        query: '*[_type == "agent"]',
        mapRecord,
      })
      const result = await driver.dispatch()
      expect(result).toEqual([
        { id: 'a1', name: 'AGENT 1' },
        { id: 'a2', name: 'AGENT 2' },
        { id: 'a3', name: 'AGENT 3' },
      ])
      expect(mapRecord).toHaveBeenCalledTimes(3)
    })

    it('honors a custom timeoutMs', async () => {
      const client = makeMockClient({ result: [] })
      const driver = createSanityDriver<{ id: string }>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc as { id: string },
        timeoutMs: 5_000,
      })
      await driver.dispatch()
      expect(client.fetch).toHaveBeenCalledWith(
        '*[_type == "property"]',
        {},
        expect.objectContaining({ timeout: 5_000 }),
      )
    })
  })

  describe('dispatch — failure modes', () => {
    it('throws DataSourceInvalidPayloadError when the response is not an array', async () => {
      const client = makeMockClient({ result: { not: 'an array' } })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
        source: 'sanity:test',
      })
      await expect(driver.dispatch()).rejects.toThrow(
        DataSourceInvalidPayloadError,
      )
    })

    it('throws DataSourceInvalidPayloadError when the response is null', async () => {
      const client = makeMockClient({ result: null })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
      })
      await expect(driver.dispatch()).rejects.toThrow(
        DataSourceInvalidPayloadError,
      )
    })

    it('throws DataSourceHttpError when the upstream returns a 500', async () => {
      const client = makeMockClient({
        error: new Error('Internal Server Error'),
        statusCode: 500,
      })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
        source: 'sanity:test',
      })
      await expect(driver.dispatch()).rejects.toThrow(DataSourceHttpError)
    })

    it('throws DataSourceHttpError with status 0 on a generic network failure', async () => {
      const client = makeMockClient({
        error: new Error('ENOTFOUND api.sanity.io'),
      })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
      })
      try {
        await driver.dispatch()
        throw new Error('expected dispatch to throw')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DataSourceHttpError)
        if (error instanceof DataSourceHttpError) {
          expect(error.status).toBe(0)
        }
      }
    })

    it('throws DataSourceTimeoutError when the fetch aborts', async () => {
      const client = {
        fetch: vi.fn(async () => {
          const err = new Error('The operation was aborted.')
          err.name = 'AbortError'
          throw err
        }),
      }
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
        source: 'sanity:test',
        timeoutMs: 3_000,
      })
      try {
        await driver.dispatch()
        throw new Error('expected dispatch to throw')
      }
      catch (error) {
        expect(error).toBeInstanceOf(DataSourceTimeoutError)
        if (error instanceof DataSourceTimeoutError) {
          expect(error.timeoutMs).toBe(3_000)
        }
      }
    })

    it('throws DataSourceTimeoutError when the error message mentions timeout', async () => {
      const client = {
        fetch: vi.fn(async () => {
          throw new Error('Request timed out after 10000ms')
        }),
      }
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
        source: 'sanity:test',
        timeoutMs: 10_000,
      })
      await expect(driver.dispatch()).rejects.toThrow(DataSourceTimeoutError)
    })
  })

  describe('Symbol.toStringTag', () => {
    it('exposes the source in the diagnostic tag', () => {
      const client = makeMockClient({ result: [] })
      const driver = createSanityDriver<unknown>({
        client: client as never,
        query: '*[_type == "property"]',
        mapRecord: (doc) => doc,
        source: 'sanity:property',
      })
      expect(String(driver)).toContain('sanity:property')
      expect(Object.prototype.toString.call(driver)).toContain(
        'cms-driver:sanity:property',
      )
    })
  })
})
