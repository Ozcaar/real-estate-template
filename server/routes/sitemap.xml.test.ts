import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeH3Event } from '../../tests/helpers/h3-event'
import { _resetPropertiesServerCacheForTests } from '../utils/properties'

// Mock the `#imports` module so `useRuntimeConfig` returns a
// public site URL (the default stub returns `{}`, which makes
// `config.public` undefined and crashes the route handler).
vi.mock('#imports', async () => {
  const stub = await import('../../tests/stubs/imports')
  return {
    ...stub,
    useRuntimeConfig: () => ({
      public: {
        siteUrl: process.env[ENV_SITE_URL] || '',
      },
    }),
  }
})

/**
 * Tests for the `GET /sitemap.xml` Nitro route.
 *
 * The route is the dynamic sitemap. The route handler is a
 * server-only module: it must not import app composables
 * (e.g. `useState`, `useSiteConfig`) or code that depends on
 * the Nuxt app context. Property detail URLs are sourced from
 * the server-only property loader at
 * `server/utils/properties.ts` (NOT the property service, which
 * is a client-bundled module that calls the same-origin Nitro
 * endpoint at `/api/properties` over `$fetch`).
 *
 * The route's contract:
 *
 *  - Reads `NUXT_PUBLIC_SITE_URL` (the documented public site
 *    URL) and normalizes the trailing slash. When the value is
 *    empty, the route returns HTTP 503 with a plain-text hint
 *    so a misconfigured deployment is obvious in crawlers'
 *    logs.
 *  - Iterates over the resolved property list from the loader
 *    and emits one URL per visible property. `status: 'hidden'`
 *    records are excluded.
 *  - Iterates over `developmentsService.getAll()` and
 *    `agentsService.getAll()` for the development and agent
 *    detail URLs (those services continue to consume the
 *    static adapter only and are out of scope for the M17
 *    data-flow work).
 *
 * The route is a thin transport; the loader is exercised in
 * detail in `server/utils/properties.test.ts`. This file covers
 * the route's source-level contract (the import surface, the
 * boundary with the app layer) and a few runtime smoke tests
 * (503 when `siteUrl` is empty, 200 with the expected URLs when
 * `siteUrl` is set).
 */

const ENV_KIND = 'NUXT_PROPERTIES_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_PROPERTIES_API_URL'
const ENV_TIMEOUT = 'NUXT_PROPERTIES_API_TIMEOUT_MS'
const ENV_SITE_URL = 'NUXT_PUBLIC_SITE_URL'

const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
  process.env[ENV_SITE_URL] = 'https://example.test'
})

afterEach(() => {
  _resetPropertiesServerCacheForTests()
  for (const key of [ENV_KIND, ENV_ENDPOINT, ENV_TIMEOUT, ENV_SITE_URL]) {
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
  vi.unstubAllGlobals()
})

async function loadHandler() {
  const mod = await import('./sitemap.xml')
  return mod.default
}

describe('server/routes/sitemap.xml.ts — server-only Nitro route', () => {
  describe('source-level (boundary)', () => {
    /**
     * Strip JSDoc block comments and line comments from the source so
     * the textual checks ignore documented mentions of the protected
     * identifiers (the JSDoc on `sitemap.xml.ts` references the
     * api-adapter and the env-var names). Comments are stripped
     * by Vite / Rollup before the file reaches the client bundle,
     * so the relevant surface is the non-comment code only.
     */
    function stripComments(source: string): string {
      return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
    }

    it('does not import the property service (avoids the client-bundled service module)', async () => {
      const source = stripComments(readFileSync(
        join(__dirname, 'sitemap.xml.ts'),
        'utf8',
      ))
      // The sitemap must not import the app-side property
      // service — the service is a client-bundled module that
      // calls the Nitro endpoint over `$fetch`. The sitemap
      // uses the server-only loader directly.
      expect(source).not.toMatch(/propertiesService/)
      expect(source).not.toMatch(/features\/properties\/services\/properties\.service/)
    })

    it('does not import any Nuxt app composable (useState, useSiteConfig, useNuxtApp, useAsyncData)', async () => {
      const source = stripComments(readFileSync(
        join(__dirname, 'sitemap.xml.ts'),
        'utf8',
      ))
      // The sitemap is a Nitro server route. It must not
      // depend on the Nuxt app context (no `useState`, no
      // `useSiteConfig`, no `useAsyncData`, no `useNuxtApp`).
      // The only Nuxt-supplied import is `useRuntimeConfig`
      // from `#imports`, which Nitro provides.
      expect(source).not.toMatch(/useState/)
      expect(source).not.toMatch(/useSiteConfig/)
      expect(source).not.toMatch(/useAsyncData/)
      expect(source).not.toMatch(/useNuxtApp/)
    })

    it('does not import the api-adapter module or any NUXT_PROPERTIES_API_* env-var name', async () => {
      const source = stripComments(readFileSync(
        join(__dirname, 'sitemap.xml.ts'),
        'utf8',
      ))
      // The api-adapter module and the env-var name strings
      // live in `server/utils/properties.ts`. The sitemap
      // imports the loader (which encapsulates the api-adapter
      // + env-var reads) but does not import the api-adapter
      // module directly.
      expect(source).not.toMatch(/api-adapter/)
      expect(source).not.toMatch(/createApiDataSource/)
      expect(source).not.toMatch(/NUXT_PROPERTIES_DATA_SOURCE/)
      expect(source).not.toMatch(/NUXT_PROPERTIES_API_URL/)
      expect(source).not.toMatch(/NUXT_PROPERTIES_API_TIMEOUT_MS/)
    })

    it('imports the server-only loader directly', async () => {
      const source = readFileSync(
        join(__dirname, 'sitemap.xml.ts'),
        'utf8',
      )
      expect(source).toMatch(/server\/utils\/properties/)
      expect(source).toMatch(/loadPropertiesServer/)
    })
  })

  describe('runtime (handler)', () => {
    it('returns 503 with a documented hint when NUXT_PUBLIC_SITE_URL is empty', async () => {
      Reflect.deleteProperty(process.env, ENV_SITE_URL)
      const { event, getResponse } = makeH3Event({ method: 'GET' })
      const handler = await loadHandler()
      await handler(event)
      const response = getResponse()
      expect(response.status).toBe(503)
      expect(response.headers['content-type']).toContain('text/plain')
    })

    it('returns 200 with an XML urlset when NUXT_PUBLIC_SITE_URL is set', async () => {
      const { event, getResponse } = makeH3Event({ method: 'GET' })
      const handler = await loadHandler()
      const body = await handler(event)
      const response = getResponse()
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('application/xml')
      expect(typeof body).toBe('string')
      expect((body as string)).toMatch(/<urlset/)
      expect((body as string)).toMatch(/<loc>https:\/\/example\.test\/<\/loc>/)
      expect((body as string)).toMatch(/<loc>https:\/\/example\.test\/properties<\/loc>/)
    })

    it('emits one URL per visible property from the server-only loader', async () => {
      // The static default catalog (NUXT_PROPERTIES_DATA_SOURCE
      // unset) is the bundled `sampleProperties` array. The
      // sitemap iterates over the resolved list and emits one
      // URL per visible record; `status: 'hidden'` records are
      // excluded.
      const { event } = makeH3Event({ method: 'GET' })
      const handler = await loadHandler()
      const body = (await handler(event)) as string
      // The static catalog includes `modern-hillside-villa` and
      // other slugs that are NOT hidden. Assert at least one
      // property URL is present.
      expect(body).toMatch(/<loc>https:\/\/example\.test\/properties\/modern-hillside-villa<\/loc>/)
    })

    it('emits the api-resolved URLs when the api source is configured', async () => {
      // Mock the platform fetch so the api adapter's request
      // resolves with a known catalog that includes an
      // api-only slug (`api-only-property`) that is NOT in
      // the bundled static sample. The sitemap must emit the
      // api-only URL when the loader returns the api-resolved
      // list.
      process.env[ENV_KIND] = 'api'
      process.env[ENV_ENDPOINT] = 'https://api.example.test/properties'
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify([
        {
          id: 'api-001',
          slug: 'api-only-property',
          title: 'API-only property',
          description: 'A property that exists only in the remote api.',
          operationType: 'sale',
          propertyType: 'house',
          price: 1_000_000,
          currency: 'USD',
          location: 'API City',
          city: 'API City',
          state: 'API State',
          country: 'API Country',
          images: ['/images/test.svg'],
          coverImage: '/images/test.svg',
          amenities: [],
          status: 'available',
          featured: false,
        },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

      const { event } = makeH3Event({ method: 'GET' })
      const handler = await loadHandler()
      const body = (await handler(event)) as string
      expect(body).toMatch(/<loc>https:\/\/example\.test\/properties\/api-only-property<\/loc>/)
    })
  })
})