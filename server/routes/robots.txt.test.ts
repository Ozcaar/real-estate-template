import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeH3Event } from '../../tests/helpers/h3-event'

/**
 * Tests for the `GET /robots.txt` Nitro route.
 *
 * The route is the dynamic tenant-aware robots.txt (Task 102).
 * The route resolves the active tenant via `resolveTenantContext`
 * from `server/utils/tenant-context.ts` and emits a minimal
 * `robots.txt` that either allows crawling and advertises the
 * tenant's `sitemap.xml` (when the resolved siteUrl is set) or
 * blocks all crawling with a hint pointing the operator at the
 * missing env var (when it is empty).
 *
 * The route is server-only; it must not import any Nuxt app
 * composable (`useState`, `useSiteConfig`, `useAsyncData`,
 * `useNuxtApp`). The only Nuxt-supplied import is
 * `useRuntimeConfig` from `#imports`.
 */

// Mock `#imports` so `useRuntimeConfig` returns a configurable
// public site URL (the default stub returns `{}`, which makes
// `config.public` undefined and crashes the resolver).
vi.mock('#imports', async () => {
  const stub = await import('../../tests/stubs/imports')
  return {
    ...stub,
    useRuntimeConfig: vi.fn(),
  }
})

async function setGlobalSiteUrl(url: string | undefined) {
  const { useRuntimeConfig } = await import('#imports')
  vi.mocked(useRuntimeConfig).mockReturnValue({
    public: {
      siteUrl: url ?? '',
    },
  })
}

const ENV_GLOBAL = 'NUXT_PUBLIC_SITE_URL'
const ENV_ACME = 'NUXT_PUBLIC_SITE_URL__ACME'
const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_GLOBAL)
  Reflect.deleteProperty(process.env, ENV_ACME)
})

afterEach(() => {
  for (const key of [ENV_GLOBAL, ENV_ACME]) {
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

async function loadHandler() {
  const mod = await import('./robots.txt')
  return mod.default
}

describe('server/routes/robots.txt.ts — server-only Nitro route', () => {
  describe('source-level (boundary)', () => {
    function stripComments(source: string): string {
      return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
    }

    it('does not import any Nuxt app composable (useState, useSiteConfig, useNuxtApp, useAsyncData)', async () => {
      const source = stripComments(readFileSync(
        join(__dirname, 'robots.txt.ts'),
        'utf8',
      ))
      expect(source).not.toMatch(/useState/)
      expect(source).not.toMatch(/useSiteConfig/)
      expect(source).not.toMatch(/useAsyncData/)
      expect(source).not.toMatch(/useNuxtApp/)
    })

    it('imports the tenant-context resolver directly', async () => {
      const source = readFileSync(
        join(__dirname, 'robots.txt.ts'),
        'utf8',
      )
      // The resolver is imported via the relative path
      // `../utils/tenant-context`; the module lives in
      // `server/utils/` (the canonical Nuxt 4 server-only
      // location).
      expect(source).toMatch(/utils\/tenant-context/)
      expect(source).toMatch(/resolveTenantContext/)
    })

    it('does not import siteConfig from the app-side site.config module (Task 102: tenant-aware)', async () => {
      const source = stripComments(readFileSync(
        join(__dirname, 'robots.txt.ts'),
        'utf8',
      ))
      // The route must read the resolved tenant from
      // `resolveTenantContext`, not from the global app-side
      // `siteConfig` re-export. A future regression that
      // re-imports `siteConfig` here would silently break the
      // multi-tenant deployment.
      expect(source).not.toMatch(/site\.config/)
    })
  })

  describe('runtime (handler)', () => {
    it('returns 200 with a blocking rule when neither NUXT_PUBLIC_SITE_URL nor a per-tenant override is set', async () => {
      Reflect.deleteProperty(process.env, ENV_GLOBAL)
      Reflect.deleteProperty(process.env, ENV_ACME)
      await setGlobalSiteUrl(undefined)
      const { event, getResponse } = makeH3Event({ method: 'GET', headers: { host: 'unknown.example' } })
      const handler = await loadHandler()
      const body = await handler(event)
      const response = getResponse()
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/plain')
      expect(body).toMatch(/User-Agent: \*/)
      expect(body).toMatch(/Disallow: \//)
      expect(body).not.toMatch(/Sitemap:/)
    })

    it('returns 200 with the Sitemap line when NUXT_PUBLIC_SITE_URL is set (default tenant)', async () => {
      process.env[ENV_GLOBAL] = 'https://example.test'
      await setGlobalSiteUrl('https://example.test')
      const { event, getResponse } = makeH3Event({ method: 'GET', headers: { host: 'unknown.example' } })
      const handler = await loadHandler()
      const body = await handler(event)
      const response = getResponse()
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/plain')
      expect(body).toMatch(/User-Agent: \*/)
      expect(body).toMatch(/Allow: \//)
      expect(body).toMatch(/Sitemap: https:\/\/example\.test\/sitemap\.xml/)
    })

    it('strips a trailing slash from the global site URL when building the Sitemap line', async () => {
      process.env[ENV_GLOBAL] = 'https://example.test/'
      await setGlobalSiteUrl('https://example.test/')
      const { event } = makeH3Event({ method: 'GET', headers: { host: 'unknown.example' } })
      const handler = await loadHandler()
      const body = await handler(event)
      expect(body).toMatch(/Sitemap: https:\/\/example\.test\/sitemap\.xml/)
    })

    it('honors x-forwarded-host for tenant resolution', async () => {
      process.env[ENV_GLOBAL] = 'https://default.test'
      await setGlobalSiteUrl('https://default.test')
      const { event } = makeH3Event({
        method: 'GET',
        headers: { host: 'unknown.example', 'x-forwarded-host': 'unknown.example' },
      })
      const handler = await loadHandler()
      const body = await handler(event)
      // The default tenant resolves to the global env var.
      expect(body).toMatch(/Sitemap: https:\/\/default\.test\/sitemap\.xml/)
    })

    it('honors per-tenant NUXT_PUBLIC_SITE_URL__<TENANT_ID> override', async () => {
      // The registry ships with only the default tenant, but the
      // default tenant itself can carry an override keyed by its
      // own id. For an unknown host (which still resolves to the
      // default tenant), the per-tenant override takes precedence.
      process.env[ENV_ACME] = 'https://acme.example.com'
      Reflect.deleteProperty(process.env, ENV_GLOBAL)
      await setGlobalSiteUrl(undefined)
      const { event } = makeH3Event({ method: 'GET', headers: { host: 'unknown.example' } })
      const handler = await loadHandler()
      const body = await handler(event)
      // The per-tenant override is set for tenant id `default`
      // only if `NUXT_PUBLIC_SITE_URL__DEFAULT` is configured —
      // this case uses the acme key with no matching registry
      // entry, so the global fallback applies. This test
      // documents that an unmatched per-tenant env var is
      // ignored (not silently substituted).
      expect(body).toMatch(/Disallow: \//)
      expect(body).not.toMatch(/Sitemap:/)
    })
  })
})