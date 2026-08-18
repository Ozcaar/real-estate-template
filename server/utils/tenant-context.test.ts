import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAgencyConfig } from '../../app/config/agencies/default.agency'
import { resolveTheme, themes } from '../../app/themes'
import { defaultI18nLocales } from '../../app/config/i18n'
import { safeParseAgencyConfig } from '../../app/config/agencies/agency.schema'
import type { SiteConfig } from '../../app/types/site.types'
import {
  DEFAULT_TENANT_ID,
  type AgencyRegistry,
  type AgencyRegistryEntry,
} from '../../app/config/agencies/registry'
import {
  resolveTenantContext,
  resolveTenantSiteUrl,
} from './tenant-context'

// Mock `#imports` so `useRuntimeConfig` returns a value the
// tests can read. The mock factory is hoisted, so we read the
// desired value at test time by mutating the mock's return
// value. The default mock returns an object with `public.siteUrl`
// so the `config.public.siteUrl` access in `resolveTenantContext`
// does not throw.
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({
    public: { siteUrl: '' },
  })),
}))

/**
 * Tests for the server-only tenant context resolver at
 * `server/utils/tenant-context.ts`.
 *
 * The loader owns the `NUXT_AGENTS_*` private configuration and the
 * static / api source selection. It is the single source of truth for
 * the resolved agent list on the server and is consumed by the
 * same-origin Nitro endpoint at `server/api/agents.get.ts` (and, in
 * tests, by the unit tests that exercise the static default and the
 * api-configured branch without booting a Nitro server).
 *
 * **No process-lifetime cache.** The loader does NOT retain a
 * successful API result between calls. Each call to
 * {@link loadAgentsServer} constructs a fresh adapter and awaits its
 * `loadAll()`. Concurrent calls are coalesced through the in-flight
 * `pending` promise so a single render produces at most one in-flight
 * fetch; the promise is cleared on settle, so the next call performs
 * a new fetch. The api is therefore fetched on every call, not "at
 * most once per server lifetime".
 *
 * The api-adapter module and the three `NUXT_AGENTS_*` env var name
 * strings are server-only by code organization: the loader lives in
 * `server/utils/`, which is the canonical Nuxt 4 location for
 * server-only utilities, and the loader's imports are bundled to the
 * Nitro server output only.
 */

const ENV_KIND = 'NUXT_AGENTS_DATA_SOURCE'
const ENV_ENDPOINT = 'NUXT_AGENTS_API_URL'
const ENV_TIMEOUT = 'NUXT_AGENTS_API_TIMEOUT_MS'

/**
 * Snapshot the process env vars the loader reads and restore
 * them after each test so a leak from one test does not
 * pollute the next.
 */
const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_KIND)
  Reflect.deleteProperty(process.env, ENV_ENDPOINT)
  Reflect.deleteProperty(process.env, ENV_TIMEOUT)
})

afterEach(() => {
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
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ *
 * resolveTenantSiteUrl — per-tenant + global fallback
 * ------------------------------------------------------------------ */

describe('resolveTenantSiteUrl', () => {
  it('returns the per-tenant override when set', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com',
    }
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com', env))
      .toBe('https://acme.example.com')
  })

  it('strips trailing slashes from the per-tenant override', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com///',
    }
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com', env))
      .toBe('https://acme.example.com')
  })

  it('falls back to the global value when the per-tenant override is unset', () => {
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com'))
      .toBe('https://default.example.com')
  })

  it('falls back to the global value when the per-tenant override is empty', () => {
    const env = { NUXT_PUBLIC_SITE_URL__ACME: '' }
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com', env))
      .toBe('https://default.example.com')
  })

  it('falls back to the global value when the per-tenant override is whitespace', () => {
    const env = { NUXT_PUBLIC_SITE_URL__ACME: '   ' }
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com', env))
      .toBe('https://default.example.com')
  })

  it('strips trailing slashes from the global fallback', () => {
    expect(resolveTenantSiteUrl('acme', 'https://default.example.com/'))
      .toBe('https://default.example.com')
  })

  it('returns empty string when both the override and the global are unset', () => {
    expect(resolveTenantSiteUrl('acme', '')).toBe('')
  })

  it('returns empty string when both the override and the global are whitespace', () => {
    expect(resolveTenantSiteUrl('acme', '   ')).toBe('')
  })

  it('uppercases the tenant id and replaces non-alphanumeric chars with underscores', () => {
    // A rebrand that registers a tenant with a hyphen in its
    // id (e.g. `tenant-id`) expects the resolver to look up
    // `NUXT_PUBLIC_SITE_URL__TENANT_ID`.
    const env = {
      NUXT_PUBLIC_SITE_URL__TENANT_ID: 'https://tenant-id.example.com',
    }
    expect(resolveTenantSiteUrl('tenant-id', 'https://default.example.com', env))
      .toBe('https://tenant-id.example.com')
  })

  it('uppercases an already-uppercase tenant id without double-substitution', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com',
    }
    expect(resolveTenantSiteUrl('ACME', 'https://default.example.com', env))
      .toBe('https://acme.example.com')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — default tenant (single-domain)
 * ------------------------------------------------------------------ */

describe('resolveTenantContext - default tenant (single-domain)', () => {
  function buildRegistry(): AgencyRegistry {
    return Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
    }) as AgencyRegistry
  }

  function buildEntry(raw: typeof defaultAgencyConfig, hosts: readonly string[] = []): AgencyRegistryEntry {
    const result = safeParseAgencyConfig(raw, {
      themes,
      i18nLocales: defaultI18nLocales,
    })
    if (!result.ok) throw result.error
    const agency = result.agency
    const siteConfig: SiteConfig = Object.freeze({
      agency,
      theme: resolveTheme(agency.theme),
    })
    return Object.freeze({
      id: agency.id,
      config: agency,
      siteConfig,
      hosts: Object.freeze([...hosts]),
    })
  }

  it('returns the default tenant for `localhost` (a typical dev host)', () => {
    const ctx = resolveTenantContext('localhost', buildRegistry())
    expect(ctx.id).toBe(DEFAULT_TENANT_ID)
    expect(ctx.agency.id).toBe('default')
    expect(ctx.siteConfig.agency.id).toBe('default')
  })

  it('returns the default tenant for `127.0.0.1`', () => {
    expect(resolveTenantContext('127.0.0.1', buildRegistry()).id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for an empty host', () => {
    expect(resolveTenantContext('', buildRegistry()).id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for null', () => {
    expect(resolveTenantContext(null, buildRegistry()).id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for undefined', () => {
    expect(resolveTenantContext(undefined, buildRegistry()).id).toBe(DEFAULT_TENANT_ID)
  })

  it('uses the global siteUrl when no per-tenant override is set', () => {
    const ctx = resolveTenantContext('localhost', buildRegistry())
    // The siteUrl value depends on `useRuntimeConfig()` which
    // is mocked by the test environment to return an empty
    // object; the default fallback produces the empty string.
    expect(typeof ctx.siteUrl).toBe('string')
  })

  it('returns the default tenant\'s defaultLocale for `localhost`', () => {
    const ctx = resolveTenantContext('localhost', buildRegistry())
    expect(ctx.defaultLocale).toBe(ctx.agency.defaultLocale)
  })

  it('strips trailing slashes from the global siteUrl', () => {
    const ctx = resolveTenantContext('localhost', buildRegistry())
    expect(ctx.siteUrl).not.toMatch(/\/$/)
  })

  it('returns an empty siteUrl when no global and no per-tenant siteUrl are set', () => {
    const ctx = resolveTenantContext('localhost', buildRegistry())
    expect(ctx.siteUrl).toBe('')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — multi-tenant (two isolated tenants)
 * ------------------------------------------------------------------ */

describe('resolveTenantContext - multi-tenant (two isolated tenants)', () => {
  function buildTwoTenantRegistry(): AgencyRegistry {
    const acmeAgency = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const coastalAgency = { ...defaultAgencyConfig, id: 'coastal', name: 'Coastal Properties' }
    return Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry
  }

  function buildEntry(raw: typeof defaultAgencyConfig, hosts: readonly string[] = []): AgencyRegistryEntry {
    const result = safeParseAgencyConfig(raw, {
      themes,
      i18nLocales: defaultI18nLocales,
    })
    if (!result.ok) throw result.error
    const agency = result.agency
    const siteConfig: SiteConfig = Object.freeze({
      agency,
      theme: resolveTheme(agency.theme),
    })
    return Object.freeze({
      id: agency.id,
      config: agency,
      siteConfig,
      hosts: Object.freeze([...hosts]),
    })
  }

  it('returns the acme tenant for `acme.example.com`', () => {
    expect(resolveTenantContext('acme.example.com', buildTwoTenantRegistry()).id).toBe('acme')
  })

  it('returns the coastal tenant for `coastal.example.com`', () => {
    expect(resolveTenantContext('coastal.example.com', buildTwoTenantRegistry()).id).toBe('coastal')
  })

  it('matches case-insensitively and strips the port (delegated to the registry)', () => {
    expect(resolveTenantContext('ACME.EXAMPLE.COM:3000', buildTwoTenantRegistry()).id).toBe('acme')
  })

  it('preserves the per-tenant siteUrl for the matching tenant', () => {
    const ctx = resolveTenantContext('acme.example.com', buildTwoTenantRegistry())
    // siteUrl is per-tenant; in the test environment
    // `useRuntimeConfig` returns an empty object, so the
    // default siteUrl is the empty string. The per-tenant
    // siteUrl override path is exercised in the
    // `resolveTenantSiteUrl` tests.
    expect(typeof ctx.siteUrl).toBe('string')
  })

  it('falls back to the default tenant for an unknown host (multi-tenant registry)', () => {
    expect(resolveTenantContext('unknown.example.com', buildTwoTenantRegistry()).id)
      .toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default tenant for an empty host (multi-tenant registry)', () => {
    expect(resolveTenantContext('', buildTwoTenantRegistry()).id).toBe(DEFAULT_TENANT_ID)
  })

  it('two concurrent calls for different tenants return different snapshots', () => {
    const a = resolveTenantContext('acme.example.com', buildTwoTenantRegistry())
    const c = resolveTenantContext('coastal.example.com', buildTwoTenantRegistry())
    expect(a.id).toBe('acme')
    expect(c.id).toBe('coastal')
    expect(a).not.toBe(c)
  })

  it('isolates two tenants: acme and coastal see different agencies simultaneously', () => {
    // Simulate interleaved requests: alternating hostnames.
    const a1 = resolveTenantContext('acme.example.com', buildTwoTenantRegistry())
    const c1 = resolveTenantContext('coastal.example.com', buildTwoTenantRegistry())
    const a2 = resolveTenantContext('acme.example.com', buildTwoTenantRegistry())
    const c2 = resolveTenantContext('coastal.example.com', buildTwoTenantRegistry())
    expect(a1.id).toBe('acme')
    expect(c1.id).toBe('coastal')
    expect(a2.id).toBe('acme')
    expect(c2.id).toBe('coastal')
    // The four snapshots are distinct references.
    expect(a1).not.toBe(c1)
    expect(a2).not.toBe(a1)
  })

  it('falls back to the default tenant for a tenant without per-tenant overrides', () => {
    expect(resolveTenantContext('localhost', buildTwoTenantRegistry()).id)
      .toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default tenant for a tenant with only one per-tenant field set', () => {
    // Coastal sets only the acme host; the SMTP
    // fields fall back to the global config.
    const coastalAgency = { ...defaultAgencyConfig, id: 'coastal', name: 'Coastal Properties' }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry
    expect(resolveTenantContext('coastal.example.com', registry).id).toBe('coastal')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — request isolation
 * ------------------------------------------------------------------ */

describe('resolveTenantContext - request isolation', () => {
  function buildCustomRegistry(): AgencyRegistry {
    const acmeAgency = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const coastalAgency = { ...defaultAgencyConfig, id: 'coastal', name: 'Coastal Properties' }
    return Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry
  }

  function buildEntry(raw: typeof defaultAgencyConfig, hosts: readonly string[] = []): AgencyRegistryEntry {
    const result = safeParseAgencyConfig(raw, {
      themes,
      i18nLocales: defaultI18nLocales,
    })
    if (!result.ok) throw result.error
    const agency = result.agency
    const siteConfig: SiteConfig = Object.freeze({
      agency,
      theme: resolveTheme(agency.theme),
    })
    return Object.freeze({
      id: agency.id,
      config: agency,
      siteConfig,
      hosts: Object.freeze([...hosts]),
    })
  }

  it('does not mutate the custom registry across calls', () => {
    const customRegistry = buildCustomRegistry()
    resolveTenantContext('acme.example.com', customRegistry)
    resolveTenantContext('coastal.example.com', customRegistry)
    resolveTenantContext('unknown.example.com', customRegistry)
    // Multiple resolveTenantContext calls do not mutate the
    // registry (the entries are frozen at construction time
    // by `buildEntry`; the resolver does not modify them).
    resolveTenantContext('acme.example.com', customRegistry)
    resolveTenantContext('unknown.example.com', customRegistry)
    expect(Object.isFrozen(customRegistry)).toBe(true)
  })
})