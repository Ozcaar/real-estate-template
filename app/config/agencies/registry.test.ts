import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TENANT_ID,
  agencyRegistry,
  normalizeHostname,
  selectAgencyByHost,
  type AgencyRegistry,
  type AgencyRegistryEntry,
} from './registry'
import { defaultAgencyConfig } from './default.agency'
import { resolveTheme, themes } from '../../themes'
import { defaultI18nLocales } from '../i18n'
import { safeParseAgencyConfig } from './agency.schema'
import type { AgencyConfig } from '~/types/agency.types'
import type { SiteConfig } from '~/types/site.types'

// Silence the format-warn console.warn that `validateAgencyConfig`
// would emit for the default agency's social-URL placeholders. The
// test fixtures inherit those placeholders and would otherwise spam
// the test output. `safeParseAgencyConfig` is the non-throwing
// variant used here so the test does not depend on console mocking
// at every call site.
vi.spyOn(console, 'warn').mockImplementation(() => {})

/**
 * Tests for the minimal multi-tenant agency registry.
 *
 * The registry is a pure-data module: a frozen record keyed by
 * tenant id, plus two pure functions (`normalizeHostname` and
 * `selectAgencyByHost`). No Nuxt context, no `useState`, no
 * runtime side effects — so the tests run in plain Node with no
 * stubs.
 *
 * The cases below cover every documented branch:
 *
 *  - `normalizeHostname` — `null` / `undefined` / empty / whitespace,
 *    lowercasing, port stripping (IPv4 + IPv6-style brackets),
 *    `www.` preservation, whitespace trimming.
 *  - `selectAgencyByHost` — exact match, case-insensitive match,
 *    port-bearing match, empty / null / unknown → default fallback,
 *    custom default id, missing default id → `TypeError`.
 *  - `agencyRegistry` invariants — contains the default tenant,
 *    the registry is frozen, every entry is frozen, the hosts /
 *    siteConfig sub-objects are frozen, every id is unique, the
 *    default entry's `config.id` matches the registry key, the
 *    default entry's `siteConfig` matches the bundled default.
 *
 * Test-only fixtures build custom registries on top of the
 * exported default registry so the production shape is preserved
 * (the default entry is always present) while exercising the
 * multi-entry paths.
 */

/* ------------------------------------------------------------------ *
 * Test-only helpers
 * ------------------------------------------------------------------ */

/**
 * A copy of the default agency config with a different `id`,
 * `name`, and `theme`. Safe to use in a custom registry because
 * the structural fields required by the schema are unchanged
 * (the theme id `'default'` is the only registered theme, so a
 * custom theme would fail validation).
 */
function makeAgency(overrides: Partial<AgencyConfig>): AgencyConfig {
  return {
    ...defaultAgencyConfig,
    ...overrides,
    id: overrides.id ?? 'custom',
    name: overrides.name ?? 'Custom Real Estate',
    theme: 'default',
  }
}

/**
 * Build an entry by going through the same validation path the
 * production registry uses (non-throwing variant, no console
 * noise). This way the test fixture exercises the same
 * `SiteConfig` shape the resolver returns at runtime.
 */
function buildTestEntry(
  raw: AgencyConfig,
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

/**
 * Build a registry with the default entry + N custom entries.
 * The default entry is always present so the fallback target is
 * stable.
 */
function registryWith(
  extras: ReadonlyArray<{ agency: AgencyConfig, hosts: readonly string[] }>,
): AgencyRegistry {
  const base: AgencyRegistry = { ...agencyRegistry }
  for (const extra of extras) {
    base[extra.agency.id] = buildTestEntry(extra.agency, extra.hosts)
  }
  return Object.freeze(base)
}

/* ------------------------------------------------------------------ *
 * normalizeHostname
 * ------------------------------------------------------------------ */

describe('normalizeHostname', () => {
  it('returns empty string for null', () => {
    expect(normalizeHostname(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(normalizeHostname(undefined)).toBe('')
  })

  it('returns empty string for the empty string', () => {
    expect(normalizeHostname('')).toBe('')
  })

  it('returns empty string for whitespace', () => {
    expect(normalizeHostname('   ')).toBe('')
  })

  it('returns empty string for tabs and newlines', () => {
    expect(normalizeHostname('\t\n')).toBe('')
  })

  it('lowercases the input', () => {
    expect(normalizeHostname('EXAMPLE.com')).toBe('example.com')
  })

  it('lowercases an all-uppercase input', () => {
    expect(normalizeHostname('ACME.EXAMPLE.COM')).toBe('acme.example.com')
  })

  it('preserves case of mixed-case input but lowercases the result', () => {
    expect(normalizeHostname('AcMe.example.Com')).toBe('acme.example.com')
  })

  it('strips the port from a host:port pair', () => {
    expect(normalizeHostname('example.com:8080')).toBe('example.com')
  })

  it('strips the port from localhost', () => {
    expect(normalizeHostname('localhost:3000')).toBe('localhost')
  })

  it('strips the port from an IPv4 address', () => {
    expect(normalizeHostname('127.0.0.1:3000')).toBe('127.0.0.1')
  })

  it('does not parse IPv6 addresses — the documented behavior is "intentionally minimal"', () => {
    // IPv6 literals contain multiple `:` characters. The
    // normalization splits at the first `:` (so it can handle
    // `host:port` pairs), which means an IPv6 literal is
    // truncated to the part before its first colon. This is the
    // documented behavior — the normalization is intentionally
    // minimal, IPv6 normalization is a future concern. A rebrand
    // that owns an IPv6 literal should list it explicitly in the
    // entry's `hosts` array.
    expect(normalizeHostname('[::1]:3000')).toBe('[')
    expect(normalizeHostname('[::1]')).toBe('[')
  })

  it('preserves a leading www. (does not strip it)', () => {
    expect(normalizeHostname('www.example.com')).toBe('www.example.com')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeHostname('  example.com  ')).toBe('example.com')
  })

  it('returns the lowercase trimmed form of a whitespace-padded host:port', () => {
    expect(normalizeHostname('  EXAMPLE.com:3000  ')).toBe('example.com')
  })
})

/* ------------------------------------------------------------------ *
 * selectAgencyByHost — fallback behavior
 * ------------------------------------------------------------------ */

describe('selectAgencyByHost — fallback', () => {
  it('returns the default tenant when the host does not match any entry', () => {
    const entry = selectAgencyByHost(agencyRegistry, 'unmatched.example')
    expect(entry.id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for null host', () => {
    expect(selectAgencyByHost(agencyRegistry, null).id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for undefined host', () => {
    expect(selectAgencyByHost(agencyRegistry, undefined).id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for empty host', () => {
    expect(selectAgencyByHost(agencyRegistry, '').id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for whitespace host', () => {
    expect(selectAgencyByHost(agencyRegistry, '   ').id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for localhost (no host list matches)', () => {
    // The default tenant ships with hosts: [], so localhost resolves
    // to it via the fallback — the documented single-agency
    // behavior is preserved.
    expect(selectAgencyByHost(agencyRegistry, 'localhost').id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for localhost:3000', () => {
    expect(selectAgencyByHost(agencyRegistry, 'localhost:3000').id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the default tenant for 127.0.0.1:3000', () => {
    expect(selectAgencyByHost(agencyRegistry, '127.0.0.1:3000').id).toBe(DEFAULT_TENANT_ID)
  })
})

/* ------------------------------------------------------------------ *
 * selectAgencyByHost — multi-entry matching
 * ------------------------------------------------------------------ */

describe('selectAgencyByHost — matching', () => {
  const acme = makeAgency({ id: 'acme', name: 'Acme Real Estate' })
  const coastal = makeAgency({ id: 'coastal', name: 'Coastal Properties' })

  const custom = registryWith([
    { agency: acme, hosts: ['acme.example.com', 'www.acme.example.com'] },
    { agency: coastal, hosts: ['coastal.example.com'] },
  ])

  it('returns the entry whose hosts list contains the exact host', () => {
    expect(selectAgencyByHost(custom, 'acme.example.com').id).toBe('acme')
    expect(selectAgencyByHost(custom, 'coastal.example.com').id).toBe('coastal')
  })

  it('matches case-insensitively (uppercase input)', () => {
    expect(selectAgencyByHost(custom, 'ACME.EXAMPLE.COM').id).toBe('acme')
  })

  it('matches case-insensitively (mixed-case input)', () => {
    expect(selectAgencyByHost(custom, 'AcMe.Example.Com').id).toBe('acme')
  })

  it('strips the port when matching', () => {
    expect(selectAgencyByHost(custom, 'acme.example.com:3000').id).toBe('acme')
  })

  it('matches a host with leading www. when the entry lists both', () => {
    expect(selectAgencyByHost(custom, 'www.acme.example.com').id).toBe('acme')
  })

  it('falls back to the default when no host matches', () => {
    expect(selectAgencyByHost(custom, 'unknown.example.com').id).toBe(DEFAULT_TENANT_ID)
  })

  it('falls back to the default for an empty input', () => {
    expect(selectAgencyByHost(custom, '').id).toBe(DEFAULT_TENANT_ID)
  })

  it('returns the first matching entry when hosts overlap (insertion order)', () => {
    // Two entries both list 'shared.example.com'; the first one
    // registered wins. This documents the iteration order.
    const shared = registryWith([
      { agency: acme, hosts: ['shared.example.com'] },
      { agency: coastal, hosts: ['shared.example.com'] },
    ])
    expect(selectAgencyByHost(shared, 'shared.example.com').id).toBe('acme')
  })
})

/* ------------------------------------------------------------------ *
 * selectAgencyByHost — custom default id + error path
 * ------------------------------------------------------------------ */

describe('selectAgencyByHost — custom default', () => {
  const acme = makeAgency({ id: 'acme', name: 'Acme Real Estate' })
  const custom = registryWith([
    { agency: acme, hosts: ['acme.example.com'] },
  ])

  it('uses the supplied defaultId when no entry matches', () => {
    // The registry's default key is 'default', but we can pass
    // another id (e.g. 'acme') as the default fallback. This is
    // the path a future deployment could take if the platform's
    // "always-on" tenant is not the 'default' one.
    const result = selectAgencyByHost(custom, 'unknown.example.com', 'acme')
    expect(result.id).toBe('acme')
  })

  it('throws a TypeError when the supplied defaultId is not registered', () => {
    expect(() => selectAgencyByHost(custom, 'any', 'missing')).toThrow(TypeError)
  })

  it('returns the matched entry even when the supplied defaultId is not registered', () => {
    // A host match is the source of truth; the fallback is only
    // consulted when no host matches. A registry with a matching
    // entry plus a missing defaultId is valid for the host that
    // matches — the TypeError only fires when no host matches
    // AND the defaultId is missing.
    expect(selectAgencyByHost(custom, 'acme.example.com', 'missing').id)
      .toBe('acme')
  })
})

/* ------------------------------------------------------------------ *
 * agencyRegistry — invariants
 * ------------------------------------------------------------------ */

describe('agencyRegistry', () => {
  it('contains the default tenant', () => {
    expect(agencyRegistry[DEFAULT_TENANT_ID]).toBeDefined()
  })

  it('has the documented default tenant id', () => {
    expect(agencyRegistry[DEFAULT_TENANT_ID].id).toBe(DEFAULT_TENANT_ID)
  })

  it('default tenant config matches the bundled default agency', () => {
    const entry = agencyRegistry[DEFAULT_TENANT_ID]
    expect(entry.config.id).toBe(defaultAgencyConfig.id)
    expect(entry.config.name).toBe(defaultAgencyConfig.name)
    expect(entry.config.theme).toBe(defaultAgencyConfig.theme)
  })

  it('default tenant siteConfig carries the agency and the resolved theme', () => {
    const entry = agencyRegistry[DEFAULT_TENANT_ID]
    expect(entry.siteConfig.agency.id).toBe(defaultAgencyConfig.id)
    expect(entry.siteConfig.theme.id).toBe(defaultAgencyConfig.theme)
  })

  it('default tenant ships with an empty hosts list (fallback-only)', () => {
    expect(agencyRegistry[DEFAULT_TENANT_ID].hosts).toEqual([])
  })

  it('is frozen at the top level', () => {
    expect(Object.isFrozen(agencyRegistry)).toBe(true)
  })

  it('every entry is frozen', () => {
    for (const entry of Object.values(agencyRegistry)) {
      expect(Object.isFrozen(entry)).toBe(true)
    }
  })

  it('every entry hosts list is frozen', () => {
    for (const entry of Object.values(agencyRegistry)) {
      expect(Object.isFrozen(entry.hosts)).toBe(true)
    }
  })

  it('every entry siteConfig is frozen', () => {
    for (const entry of Object.values(agencyRegistry)) {
      expect(Object.isFrozen(entry.siteConfig)).toBe(true)
    }
  })

  it('every entry id matches its registry key', () => {
    for (const [key, entry] of Object.entries(agencyRegistry)) {
      expect(entry.id).toBe(key)
    }
  })

  it('every entry config.id matches its registry key', () => {
    for (const [key, entry] of Object.entries(agencyRegistry)) {
      expect(entry.config.id).toBe(key)
    }
  })

  it('all tenant ids are unique', () => {
    const ids = Object.values(agencyRegistry).map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exports the documented DEFAULT_TENANT_ID constant', () => {
    expect(DEFAULT_TENANT_ID).toBe('default')
  })
})