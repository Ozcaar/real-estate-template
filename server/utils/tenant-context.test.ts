import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAgencyConfig } from '../../app/config/agencies/default.agency'
import { resolveTheme, themes } from '../../app/themes'
import { defaultI18nLocales } from '../../app/config/i18n'
import { safeParseAgencyConfig } from '../../app/config/agencies/agency.schema'
import {
  DEFAULT_TENANT_ID,
  type AgencyRegistry,
  type AgencyRegistryEntry,
} from '../../app/config/agencies/registry'
import {
  resolveTenantContext,
  resolveTenantSiteUrl,
} from './tenant-context'

/**
 * Tests for the server-only per-tenant context resolver
 * (Task 102).
 *
 * The resolver is a pure per-request function: every call
 * constructs a fresh `TenantContext` from the registry +
 * `process.env` + `useRuntimeConfig()`. The tests below pin
 * the two-tenant + unknown-host surface and the per-tenant
 * canonical URL override convention
 * (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>` with global fallback).
 *
 * The default tenant ships with an empty `hosts` list, so a
 * request to `localhost:3000` (or any unmatched hostname)
 * falls back to the default tenant via the registry's
 * `selectAgencyByHost`. The per-tenant tests below build a
 * custom registry with two entries (default + acme) so the
 * multi-entry paths can be exercised in isolation. The
 * resolver accepts the registry as an optional second
 * argument (a thin DI seam) — production callers always omit
 * it.
 */

// Mock `#imports` so `useRuntimeConfig()` returns the value
// the current test wants. The mock factory is hoisted, so we
// read the desired value at test time by mutating the mock's
// return value.
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(),
}))

async function setGlobalSiteUrl(url: string | undefined) {
  const { useRuntimeConfig } = await import('#imports')
  vi.mocked(useRuntimeConfig).mockReturnValue({
    public: { siteUrl: url ?? '' },
  })
}

const ENV_GLOBAL = 'NUXT_PUBLIC_SITE_URL'
const ENV_ACME = 'NUXT_PUBLIC_SITE_URL__ACME'
const ENV_COASTAL = 'NUXT_PUBLIC_SITE_URL__COASTAL'

const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_GLOBAL)
  Reflect.deleteProperty(process.env, ENV_ACME)
  Reflect.deleteProperty(process.env, ENV_COASTAL)
})

afterEach(() => {
  for (const key of [ENV_GLOBAL, ENV_ACME, ENV_COASTAL]) {
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

/* ------------------------------------------------------------------ *
 * Test-only fixtures
 * ------------------------------------------------------------------ */

/**
 * Build a registry entry by going through the same validation
 * path the production registry uses (non-throwing variant, no
 * console noise). This way the test fixture exercises the same
 * `SiteConfig` shape the resolver returns at runtime.
 */
function buildTestEntry(
  raw: typeof defaultAgencyConfig,
  hosts: readonly string[],
): AgencyRegistryEntry {
  const result = safeParseAgencyConfig(raw, {
    themes,
    i18nLocales: defaultI18nLocales,
  })
  if (!result.ok) {
    throw result.error
  }
  const agency = result.agency
  const siteConfig = Object.freeze({
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

/**
 * Build a registry with the default entry + N custom entries.
 * The default entry is always present so the fallback target
 * is stable.
 */
function registryWith(
  extras: ReadonlyArray<{ id: string, hosts: readonly string[] }>,
): AgencyRegistry {
  const out: Record<string, AgencyRegistryEntry> = {
    [DEFAULT_TENANT_ID]: buildTestEntry(defaultAgencyConfig, []),
  }
  for (const extra of extras) {
    const raw = {
      ...defaultAgencyConfig,
      id: extra.id,
      name: `${extra.id} Real Estate`,
    }
    out[extra.id] = buildTestEntry(raw, extra.hosts)
  }
  return Object.freeze(out)
}

/* ------------------------------------------------------------------ *
 * resolveTenantSiteUrl (pure helper)
 * ------------------------------------------------------------------ */

describe('resolveTenantSiteUrl', () => {
  it('returns the per-tenant override when set', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com',
    }
    expect(resolveTenantSiteUrl('acme', '', env)).toBe('https://acme.example.com')
  })

  it('strips trailing slashes from the per-tenant override', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com///',
    }
    expect(resolveTenantSiteUrl('acme', '', env)).toBe('https://acme.example.com')
  })

  it('falls back to the global site URL when the per-tenant override is unset', () => {
    expect(resolveTenantSiteUrl('acme', 'https://example.com')).toBe('https://example.com')
  })

  it('falls back to the global site URL when the per-tenant override is empty', () => {
    const env = { NUXT_PUBLIC_SITE_URL__ACME: '' }
    expect(resolveTenantSiteUrl('acme', 'https://example.com', env)).toBe('https://example.com')
  })

  it('falls back to the global site URL when the per-tenant override is whitespace', () => {
    const env = { NUXT_PUBLIC_SITE_URL__ACME: '   ' }
    expect(resolveTenantSiteUrl('acme', 'https://example.com', env)).toBe('https://example.com')
  })

  it('strips trailing slashes from the global fallback', () => {
    expect(resolveTenantSiteUrl('acme', 'https://example.com/')).toBe('https://example.com')
  })

  it('returns the empty string when both the override and the global are unset', () => {
    expect(resolveTenantSiteUrl('acme', '')).toBe('')
  })

  it('returns the empty string when both the override and the global are whitespace', () => {
    expect(resolveTenantSiteUrl('acme', '   ')).toBe('')
  })

  it('uppercases the tenant id and replaces non-alphanumeric chars with underscores for the env-var name', () => {
    // A rebrand that registers `tenant-id` (with a hyphen)
    // expects the resolver to look up
    // `NUXT_PUBLIC_SITE_URL__TENANT_ID`.
    const env = {
      NUXT_PUBLIC_SITE_URL__TENANT_ID: 'https://tenant-id.example.com',
    }
    expect(resolveTenantSiteUrl('tenant-id', '', env)).toBe('https://tenant-id.example.com')
  })

  it('uppercases an already-uppercase tenant id without double-substitution', () => {
    const env = {
      NUXT_PUBLIC_SITE_URL__ACME: 'https://acme.example.com',
    }
    expect(resolveTenantSiteUrl('ACME', '', env)).toBe('https://acme.example.com')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — default tenant (single-domain)
 * ------------------------------------------------------------------ */

describe('resolveTenantContext — default tenant (single-domain)', () => {
  it('returns the default tenant for an unknown host', async () => {
    await setGlobalSiteUrl('https://example.test')
    const ctx = resolveTenantContext('unknown.example')
    expect(ctx.id).toBe('default')
    expect(ctx.agency.id).toBe('default')
    expect(ctx.siteConfig.agency.id).toBe('default')
  })

  it('returns the default tenant for localhost', async () => {
    await setGlobalSiteUrl('https://example.test')
    const ctx = resolveTenantContext('localhost')
    expect(ctx.id).toBe('default')
  })

  it('returns the default tenant for an empty host', async () => {
    await setGlobalSiteUrl('https://example.test')
    expect(resolveTenantContext('').id).toBe('default')
  })

  it('returns the default tenant for null', async () => {
    await setGlobalSiteUrl('https://example.test')
    expect(resolveTenantContext(null).id).toBe('default')
  })

  it('returns the default tenant for undefined', async () => {
    await setGlobalSiteUrl('https://example.test')
    expect(resolveTenantContext(undefined).id).toBe('default')
  })

  it('uses the global site URL for the default tenant when no per-tenant override is set', async () => {
    await setGlobalSiteUrl('https://example.test')
    const ctx = resolveTenantContext('unknown.example')
    expect(ctx.siteUrl).toBe('https://example.test')
  })

  it('strips trailing slashes from the global site URL for the default tenant', async () => {
    await setGlobalSiteUrl('https://example.test/')
    const ctx = resolveTenantContext('unknown.example')
    expect(ctx.siteUrl).toBe('https://example.test')
  })

  it('returns the empty site URL for the default tenant when no global env var is set', async () => {
    await setGlobalSiteUrl(undefined)
    const ctx = resolveTenantContext('unknown.example')
    expect(ctx.siteUrl).toBe('')
  })

  it('exposes the tenant default locale (from agency.defaultLocale)', async () => {
    await setGlobalSiteUrl('https://example.test')
    const ctx = resolveTenantContext('unknown.example')
    expect(ctx.defaultLocale).toBe(ctx.agency.defaultLocale)
    expect(ctx.defaultLocale).toBe('en')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — multi-tenant (two-entry registry)
 * ------------------------------------------------------------------ */

describe('resolveTenantContext — multi-tenant (two isolated tenants)', () => {
  const customRegistry = registryWith([
    { id: 'acme', hosts: ['acme.example.com', 'www.acme.example.com'] },
    { id: 'coastal', hosts: ['coastal.example.com'] },
  ])

  beforeEach(async () => {
    process.env[ENV_ACME] = 'https://acme.example.com'
    process.env[ENV_COASTAL] = 'https://coastal.example.com'
  })

  it('isolates two tenants: acme returns the acme agency, coastal returns the coastal agency', async () => {
    await setGlobalSiteUrl('https://default.test')

    const acmeCtx = resolveTenantContext('acme.example.com', customRegistry)
    const coastalCtx = resolveTenantContext('coastal.example.com', customRegistry)

    expect(acmeCtx.id).toBe('acme')
    expect(acmeCtx.agency.name).toBe('acme Real Estate')
    expect(acmeCtx.siteUrl).toBe('https://acme.example.com')

    expect(coastalCtx.id).toBe('coastal')
    expect(coastalCtx.agency.name).toBe('coastal Real Estate')
    expect(coastalCtx.siteUrl).toBe('https://coastal.example.com')
  })

  it('returns the per-tenant siteUrl for the matching tenant', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('acme.example.com', customRegistry)
    expect(ctx.siteUrl).toBe('https://acme.example.com')
  })

  it('matches case-insensitively and strips the port (delegated to the registry)', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('ACME.EXAMPLE.COM:3000', customRegistry)
    expect(ctx.id).toBe('acme')
    expect(ctx.siteUrl).toBe('https://acme.example.com')
  })

  it('falls back to the default tenant for an unknown host (multi-tenant registry)', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('unknown.example.com', customRegistry)
    expect(ctx.id).toBe('default')
    // The default tenant has no per-tenant override, so the
    // resolved URL falls back to the global env var.
    expect(ctx.siteUrl).toBe('https://default.test')
  })

  it('falls back to the default tenant for an empty host (multi-tenant registry)', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('', customRegistry)
    expect(ctx.id).toBe('default')
    expect(ctx.siteUrl).toBe('https://default.test')
  })

  it('two concurrent calls on different hostnames never share siteUrl state', async () => {
    await setGlobalSiteUrl('https://default.test')

    // Simulate interleaved requests: alternating hostnames.
    const a = resolveTenantContext('acme.example.com', customRegistry)
    const c = resolveTenantContext('coastal.example.com', customRegistry)
    const a2 = resolveTenantContext('acme.example.com', customRegistry)
    const c2 = resolveTenantContext('coastal.example.com', customRegistry)

    expect(a.siteUrl).toBe('https://acme.example.com')
    expect(c.siteUrl).toBe('https://coastal.example.com')
    expect(a2.siteUrl).toBe('https://acme.example.com')
    expect(c2.siteUrl).toBe('https://coastal.example.com')

    // The default tenant returned for an "unknown" host
    // uses the global fallback, NOT either per-tenant URL.
    const fallback = resolveTenantContext('unknown.example.com', customRegistry)
    expect(fallback.id).toBe('default')
    expect(fallback.siteUrl).toBe('https://default.test')
  })

  it('exposes the active tenant defaultLocale from agency.defaultLocale', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('acme.example.com', customRegistry)
    expect(ctx.defaultLocale).toBe(ctx.agency.defaultLocale)
  })

  it('returns the per-tenant siteConfig (frozen, pre-resolved)', async () => {
    await setGlobalSiteUrl('https://default.test')
    const ctx = resolveTenantContext('acme.example.com', customRegistry)
    expect(ctx.siteConfig.agency.id).toBe('acme')
    expect(Object.isFrozen(ctx.siteConfig)).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantContext — request isolation (no module-level state)
 * ------------------------------------------------------------------ */

describe('resolveTenantContext — request isolation', () => {
  it('clearing process.env between calls resets the resolver (no module-level state)', async () => {
    await setGlobalSiteUrl('https://default.test')
    process.env[ENV_ACME] = 'https://acme.example.com'
    const customRegistry = registryWith([
      { id: 'acme', hosts: ['acme.example.com'] },
    ])
    const before = resolveTenantContext('acme.example.com', customRegistry)
    expect(before.siteUrl).toBe('https://acme.example.com')

    // Clear the per-tenant env var; the resolver must now
    // fall back to the global env var on the next call.
    Reflect.deleteProperty(process.env, ENV_ACME)
    const after = resolveTenantContext('acme.example.com', customRegistry)
    expect(after.siteUrl).toBe('https://default.test')
  })

  it('does not mutate the registry across calls (frozen entries preserved)', async () => {
    await setGlobalSiteUrl('https://default.test')
    const customRegistry = registryWith([
      { id: 'acme', hosts: ['acme.example.com'] },
    ])
    expect(Object.isFrozen(customRegistry)).toBe(true)
    for (const entry of Object.values(customRegistry)) {
      expect(Object.isFrozen(entry)).toBe(true)
      expect(Object.isFrozen(entry.siteConfig)).toBe(true)
      expect(Object.isFrozen(entry.hosts)).toBe(true)
    }
    // Multiple resolveTenantContext calls do not mutate.
    resolveTenantContext('acme.example.com', customRegistry)
    resolveTenantContext('unknown.example.com', customRegistry)
    expect(Object.isFrozen(customRegistry)).toBe(true)
  })
})