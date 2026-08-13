import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProperties } from '~/features/properties/data/properties'
import {
  _resetPropertiesServerCacheForTests,
  loadPropertiesServer,
} from '../utils/properties'

/**
 * Tests for the `GET /api/properties` Nitro endpoint.
 *
 * The endpoint is the documented public surface through which
 * the app-side property service reads the resolved public
 * property list. The endpoint delegates to
 * {@link loadPropertiesServer} (the server-only property
 * loader) and is the same-origin path the service calls via
 * `$fetch`. The endpoint never reads the env vars directly;
 * the loader is the single source of truth on the server.
 *
 * The endpoint's contract is intentionally minimal — a thin
 * transport. The loader is exercised in detail in
 * `server/utils/properties.test.ts`; this file covers the
 * endpoint's public surface (status, body shape, no
 * private-configuration leak) and the server-only / client-safe
 * boundary.
 */

const ENV_KIND = 'NUXT_PROPERTIES_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_PROPERTIES_API_URL'
const ENV_TIMEOUT = 'NUXT_PROPERTIES_API_TIMEOUT_MS'

const originalEnv = { ...process.env }

beforeEach(() => {
  _resetPropertiesServerCacheForTests()
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
})

afterEach(() => {
  _resetPropertiesServerCacheForTests()
  for (const key of [ENV_KIND, ENV_ENDPOINT, ENV_TIMEOUT]) {
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
})

/**
 * Import the endpoint handler dynamically so each test gets a
 * fresh module (the handler is a `defineEventHandler` callback
 * that runs per request; re-importing is cheap and keeps the
 * test surface clean).
 */
async function loadEndpoint() {
  const mod = await import('./properties.get')
  return mod.default
}

/**
 * Strip JSDoc block comments and line comments from the source so
 * the textual checks ignore documented mentions of the protected
 * identifiers (the JSDoc on `properties.get.ts` references the
 * env-var names and the error classes). Comments are stripped
 * by Vite / Rollup before the file reaches the client bundle, so
 * the relevant surface is the non-comment code only.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('server/api/properties.get.ts — same-origin Nitro endpoint', () => {
  it('serves the bundled static catalog when NUXT_PROPERTIES_DATA_SOURCE is unset', async () => {
    const handler = await loadEndpoint()
    const body = await handler()
    // The body is the resolved list — the static sample by
    // default. Assert the body is an array containing the
    // documented `modern-hillside-villa` slug.
    expect(Array.isArray(body)).toBe(true)
    expect((body as Array<{ slug: string }>).some(p => p.slug === 'modern-hillside-villa'))
      .toBe(true)
  })

  it('returns a structurally-equal body on every call (the loader does not memoise)', async () => {
    // The endpoint is a thin transport; the body is the
    // loader's resolved list. A regression that wrapped the
    // loader's result (e.g. a JSON-encode / JSON-decode round
    // trip) would change the body shape and is caught here.
    //
    // The loader does NOT memoise successful results. Each
    // call constructs a fresh adapter and returns a fresh
    // array reference; the data is structurally equal. The
    // endpoint mirrors that contract — the body is the
    // loader's resolved value, and a regression that
    // reintroduced a process-lifetime cache would also
    // reintroduce the same stale-snapshot bug at the
    // endpoint layer.
    const handler = await loadEndpoint()
    const fromEndpoint = await handler()
    const fromLoader = await loadPropertiesServer()
    // Reference inequality — the loader creates a fresh
    // adapter on every call.
    expect(fromEndpoint).not.toBe(fromLoader)
    // Structural equality with the bundled sample.
    expect(fromEndpoint).toHaveLength(sampleProperties.length)
    const sampleSlugs = new Set(sampleProperties.map(p => p.slug))
    for (const p of fromEndpoint) {
      expect(sampleSlugs.has(p.slug)).toBe(true)
    }
    // Structural equality between the endpoint and the
    // loader — both return the same data, just as
    // different array references.
    expect(fromEndpoint).toHaveLength(fromLoader.length)
    const loaderSlugs = new Set(fromLoader.map(p => p.slug))
    for (const p of fromEndpoint) {
      expect(loaderSlugs.has(p.slug)).toBe(true)
    }
  })

  it('does not contain any NUXT_PROPERTIES_API_* env-var name in the body or in the source', async () => {
    // The endpoint emits only the resolved public list. The
    // private env-var names live in the loader's process.env
    // reads, never in the response body.
    const handler = await loadEndpoint()
    const body = await handler()
    const bodyText = JSON.stringify(body)
    expect(bodyText).not.toMatch(/NUXT_PROPERTIES_DATA_SOURCE/)
    expect(bodyText).not.toMatch(/NUXT_PROPERTIES_API_URL/)
    expect(bodyText).not.toMatch(/NUXT_PROPERTIES_API_TIMEOUT_MS/)

    // Source-level check: the endpoint file must not contain
    // any of the protected env-var names either (the loader
    // is the sole reader). Comments are stripped so the
    // documented mentions in the JSDoc do not trip the
    // textual scan.
    const source = stripComments(readFileSync(
      join(__dirname, 'properties.get.ts'),
      'utf8',
    ))
    expect(source).not.toMatch(/NUXT_PROPERTIES_DATA_SOURCE/)
    expect(source).not.toMatch(/NUXT_PROPERTIES_API_URL/)
    expect(source).not.toMatch(/NUXT_PROPERTIES_API_TIMEOUT_MS/)
    // The endpoint also must not read `process.env` directly
    // — the loader is the sole reader.
    expect(source).not.toMatch(/process\.env/)
  })

  it('does not import the api-adapter module or the data-source runtime exports', async () => {
    // The endpoint delegates to the server-only loader; it
    // must not import the api-adapter module or any
    // data-source runtime exports directly. The loader is the
    // single import surface for the api-adapter module.
    const source = stripComments(readFileSync(
      join(__dirname, 'properties.get.ts'),
      'utf8',
    ))
    expect(source).not.toMatch(/api-adapter/)
    expect(source).not.toMatch(/createApiDataSource/)
    expect(source).not.toMatch(/DataSourceHttpError/)
    expect(source).not.toMatch(/DataSourceTimeoutError/)
    expect(source).not.toMatch(/DataSourceInvalidPayloadError/)
  })

  it('re-throws loader errors (DataSourceHttpError on a 5xx response from the remote api)', async () => {
    // The endpoint delegates loader errors to Nitro, which
    // maps the thrown error to the response. A regression
    // that swallowed the error would leak 200 to a misconfigured
    // deployment and is caught here.
    process.env[ENV_KIND] = 'api'
    process.env[ENV_ENDPOINT] = 'https://example.test/properties'
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))

    const handler = await loadEndpoint()
    await expect(handler()).rejects.toMatchObject({
      name: 'DataSourceHttpError',
      status: 500,
    })
  })
})