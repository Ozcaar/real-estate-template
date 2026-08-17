import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleDevelopments } from '~/features/developments/data/developments'
import {
  _resetDevelopmentsServerCacheForTests,
  loadDevelopmentsServer,
} from '../utils/developments'

/**
 * Tests for the `GET /api/developments` Nitro endpoint.
 *
 * The endpoint is the documented public surface through which
 * the app-side developments service reads the resolved public
 * development list. The endpoint delegates to
 * {@link loadDevelopmentsServer} (the server-only development
 * loader) and is the same-origin path the service calls via
 * `$fetch`. The endpoint never reads the env vars directly;
 * the loader is the single source of truth on the server.
 *
 * The endpoint's contract is intentionally minimal — a thin
 * transport. The loader is exercised in detail in
 * `server/utils/developments.test.ts`; this file covers the
 * endpoint's public surface (status, body shape, no
 * private-configuration leak) and the server-only /
 * client-safe boundary.
 */

const ENV_KIND = 'NUXT_DEVELOPMENTS_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_DEVELOPMENTS_API_URL'
const ENV_TIMEOUT = 'NUXT_DEVELOPMENTS_API_TIMEOUT_MS'

const originalEnv = { ...process.env }

beforeEach(() => {
  _resetDevelopmentsServerCacheForTests()
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
})

afterEach(() => {
  _resetDevelopmentsServerCacheForTests()
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
  const mod = await import('./developments.get')
  return mod.default
}

/**
 * Strip JSDoc block comments and line comments from the source so
 * the textual checks ignore documented mentions of the protected
 * identifiers (the JSDoc on `developments.get.ts` references the
 * env-var names and the error classes). Comments are stripped
 * by Vite / Rollup before the file reaches the client bundle, so
 * the relevant surface is the non-comment code only.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('server/api/developments.get.ts — same-origin Nitro endpoint', () => {
  it('serves the bundled static catalog when NUXT_DEVELOPMENTS_DATA_SOURCE is unset', async () => {
    const handler = await loadEndpoint()
    const body = await handler()
    expect(Array.isArray(body)).toBe(true)
    expect((body as Array<{ slug: string }>).some(d => d.slug === 'mirador-del-valle'))
      .toBe(true)
  })

  it('returns a structurally-equal body on every call (the loader does not memoise)', async () => {
    const handler = await loadEndpoint()
    const fromEndpoint = await handler()
    const fromLoader = await loadDevelopmentsServer()
    expect(fromEndpoint).not.toBe(fromLoader)
    expect(fromEndpoint).toHaveLength(sampleDevelopments.length)
    const sampleSlugs = new Set(sampleDevelopments.map(d => d.slug))
    for (const d of fromEndpoint) {
      expect(sampleSlugs.has(d.slug)).toBe(true)
    }
    expect(fromEndpoint).toHaveLength(fromLoader.length)
    const loaderSlugs = new Set(fromLoader.map(d => d.slug))
    for (const d of fromEndpoint) {
      expect(loaderSlugs.has(d.slug)).toBe(true)
    }
  })

  it('does not contain any NUXT_DEVELOPMENTS_API_* env-var name in the body or in the source', async () => {
    const handler = await loadEndpoint()
    const body = await handler()
    const bodyText = JSON.stringify(body)
    expect(bodyText).not.toMatch(/NUXT_DEVELOPMENTS_DATA_SOURCE/)
    expect(bodyText).not.toMatch(/NUXT_DEVELOPMENTS_API_URL/)
    expect(bodyText).not.toMatch(/NUXT_DEVELOPMENTS_API_TIMEOUT_MS/)

    const source = stripComments(readFileSync(
      join(__dirname, 'developments.get.ts'),
      'utf8',
    ))
    expect(source).not.toMatch(/NUXT_DEVELOPMENTS_DATA_SOURCE/)
    expect(source).not.toMatch(/NUXT_DEVELOPMENTS_API_URL/)
    expect(source).not.toMatch(/NUXT_DEVELOPMENTS_API_TIMEOUT_MS/)
    expect(source).not.toMatch(/process\.env/)
  })

  it('does not import the api-adapter module or the data-source runtime exports', async () => {
    const source = stripComments(readFileSync(
      join(__dirname, 'developments.get.ts'),
      'utf8',
    ))
    expect(source).not.toMatch(/api-adapter/)
    expect(source).not.toMatch(/createApiDataSource/)
    expect(source).not.toMatch(/DataSourceHttpError/)
    expect(source).not.toMatch(/DataSourceTimeoutError/)
    expect(source).not.toMatch(/DataSourceInvalidPayloadError/)
  })

  it('re-throws loader errors (DataSourceHttpError on a 5xx response from the remote api)', async () => {
    process.env[ENV_KIND] = 'api'
    process.env[ENV_ENDPOINT] = 'https://example.test/developments'
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))

    const handler = await loadEndpoint()
    await expect(handler()).rejects.toMatchObject({
      name: 'DataSourceHttpError',
      status: 500,
    })
  })
})