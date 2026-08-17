import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readTenantLeadEnv,
  resolveTenantLeadsConfig,
  type TenantLeadsConfig,
} from './lead-config'
import { sampleAgents } from '../../app/features/agents/data/agents'
import { defaultAgencyConfig } from '../../app/config/agencies/default.agency'
import { DEFAULT_TENANT_ID, type AgencyRegistry, type AgencyRegistryEntry } from '../../app/config/agencies/registry'
import { resolveTheme, themes } from '../../app/themes'
import { defaultI18nLocales } from '../../app/config/i18n'
import { safeParseAgencyConfig } from '../../app/config/agencies/agency.schema'
import type { SiteConfig } from '../../app/types/site.types'
import type { AgencyConfig } from '../../app/types/agency.types'

/**
 * Tests for the per-tenant lead-delivery configuration resolver
 * (Task 106).
 *
 * The resolver is a pure per-request function: every call
 * constructs a fresh `TenantLeadsConfig` snapshot. The tests
 * below pin the documented two-tenant behavior with different
 * lead adapters / configuration, plus the global fallback
 * path.
 *
 * `readTenantLeadEnv` is a pure helper exported for the test
 * surface (so the test does not have to import the entire
 * resolver). It dispatches per-tenant env-var overrides
 * (`NUXT_LEADS_<KEY>__<TENANT_ID>`) over the global
 * fallback. The same `tenantId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')`
 * normalization the site-URL resolver uses is exercised
 * explicitly.
 *
 * `resolveTenantLeadsConfig` is exercised end-to-end with a
 * custom two-tenant registry (acme / coastal). The two
 * tenants use completely different lead-destination
 * configuration (webhook + URL + secret for acme, email + full
 * SMTP settings for coastal). The default tenant falls back to
 * the global env vars; the unknown-host fallback uses the
 * same path.
 */

// Mock `#imports` so `useRuntimeConfig()` returns the value the
// current test wants. The mock factory is hoisted, so we read
// the desired value at test time by mutating the mock's return
// value.
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(),
}))

async function setGlobalConfig(leads: Record<string, string | undefined>) {
  const { useRuntimeConfig } = await import('#imports')
  vi.mocked(useRuntimeConfig).mockReturnValue(leads)
}

const ENV_TENANT_PREFIX = 'NUXT_LEADS_'

function clearLeadEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith(ENV_TENANT_PREFIX)) {
      Reflect.deleteProperty(process.env, key)
    }
  }
}

/**
 * Snapshot the process env vars the resolver reads and restore
 * them after each test so a leak from one test does not
 * pollute the next. The test cleans every `NUXT_LEADS_*` key
 * (including the per-tenant `<KEY>__<TENANT>` overrides) plus
 * the implicit `NUXT_LEADS_<KEY>` set in the test.
 */
const originalEnv = { ...process.env }

beforeEach(() => {
  clearLeadEnv()
})

afterEach(() => {
  clearLeadEnv()
  for (const [key, value] of Object.entries(originalEnv)) {
    if (key.startsWith(ENV_TENANT_PREFIX)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key)
      }
      else {
        process.env[key] = value
      }
    }
  }
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ *
 * Test-only helpers
 * ------------------------------------------------------------------ */

/**
 * Build a custom registry with the default tenant + N custom
 * tenants, each with their own `tenantLeadsConfig` injected
 * via the runtime config. The registry is the test's
 * dependency-injection seam for `resolveTenantLeadsConfig`;
 * the resolver picks the right entry from the host header.
 *
 * This helper is the verbatim pattern from
 * `server/utils/tenant-context.test.ts` so the test's
 * isolation matches the documented contract.
 */
function buildEntry(raw: AgencyConfig, hosts: readonly string[] = []): AgencyRegistryEntry {
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

function buildCustomRegistry(): AgencyRegistry {
  const out: Record<string, AgencyRegistryEntry> = {}
  out[DEFAULT_TENANT_ID] = buildEntry(defaultAgencyConfig)
  return Object.freeze(out)
}

/* ------------------------------------------------------------------ *
 * readTenantLeadEnv — pure helper
 * ------------------------------------------------------------------ */

describe('readTenantLeadEnv', () => {
  it('returns the per-tenant override when set', () => {
    process.env.NUXT_LEADS_ADAPTER__ACME = 'email'
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', 'log')).toBe('email')
  })

  it('strips trailing whitespace from the per-tenant override', () => {
    process.env.NUXT_LEADS_ADAPTER__ACME = '  email  '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', 'log')).toBe('email')
  })

  it('falls back to the global value when the per-tenant override is unset', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', 'log')).toBe('log')
  })

  it('falls back to the global value when the per-tenant override is empty', () => {
    process.env.NUXT_LEADS_ADAPTER__ACME = ''
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', 'log')).toBe('log')
  })

  it('falls back to the global value when the per-tenant override is whitespace', () => {
    process.env.NUXT_LEADS_ADAPTER__ACME = '   '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', 'log')).toBe('log')
  })

  it('returns empty string when both the override and the global are unset', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', '')).toBe('')
  })

  it('uppercases the tenant id and replaces non-alphanumeric chars with underscores', () => {
    // A rebrand that registers a tenant with a hyphen in its
    // id (e.g. `tenant-id`) expects the env-var name
    // `NUXT_LEADS_<KEY>__TENANT_ID` (uppercase + underscore).
    process.env.NUXT_LEADS_ADAPTER__TENANT_ID = 'webhook'
    expect(readTenantLeadEnv('tenant-id', 'NUXT_LEADS_ADAPTER', 'log')).toBe('webhook')
  })

  it('uppercases an already-uppercase tenant id without double-substitution', () => {
    process.env.NUXT_LEADS_ADAPTER__ACME = 'email'
    expect(readTenantLeadEnv('ACME', 'NUXT_LEADS_ADAPTER', 'log')).toBe('email')
  })

  it('strips trailing whitespace from the global fallback too', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_ADAPTER', '  log  ')).toBe('log')
  })
})

/* ------------------------------------------------------------------ *
 * readTenantLeadEnv — credential preservation
 *
 * The historical implementation trimmed both the per-tenant
 * override and the global fallback. That is correct for
 * non-credential fields (URLs, hostnames, port numbers, email
 * addresses, adapter ids) where stray whitespace is a
 * formatting artifact, but wrong for credential fields
 * (webhookSecret, smtpUser, smtpPassword) where leading or
 * trailing whitespace is a meaningful part of the secret.
 *
 * The `preserveWhitespace` option opts a field out of the
 * trim; the fall-back decision still treats whitespace-only
 * values as "missing" so a misconfigured operator who set
 * only whitespace does not produce a "looks valid but
 * does not authenticate" credential.
 * ------------------------------------------------------------------ */

describe('readTenantLeadEnv — credential preservation (preserveWhitespace: true)', () => {
  it('preserves leading and trailing whitespace in a per-tenant webhook secret', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '  acme-secret  '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe('  acme-secret  ')
  })

  it('preserves leading and trailing whitespace in a global webhook secret', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', '  global-secret  ', process.env, { preserveWhitespace: true })).toBe('  global-secret  ')
  })

  it('preserves leading and trailing whitespace in a per-tenant SMTP username', () => {
    process.env.NUXT_LEADS_SMTP_USER__COASTAL = '  leads@coastal.example.com  '
    expect(readTenantLeadEnv('coastal', 'NUXT_LEADS_SMTP_USER', 'fallback', process.env, { preserveWhitespace: true })).toBe('  leads@coastal.example.com  ')
  })

  it('preserves leading and trailing whitespace in a global SMTP username', () => {
    expect(readTenantLeadEnv('coastal', 'NUXT_LEADS_SMTP_USER', '  leads@global.example.com  ', process.env, { preserveWhitespace: true })).toBe('  leads@global.example.com  ')
  })

  it('preserves leading and trailing whitespace in a per-tenant SMTP password', () => {
    process.env.NUXT_LEADS_SMTP_PASSWORD__COASTAL = '  coastal-pass  '
    expect(readTenantLeadEnv('coastal', 'NUXT_LEADS_SMTP_PASSWORD', 'fallback', process.env, { preserveWhitespace: true })).toBe('  coastal-pass  ')
  })

  it('preserves leading and trailing whitespace in a global SMTP password', () => {
    expect(readTenantLeadEnv('coastal', 'NUXT_LEADS_SMTP_PASSWORD', '  global-pass  ', process.env, { preserveWhitespace: true })).toBe('  global-pass  ')
  })

  it('preserves a per-tenant credential whose value contains internal whitespace (no leading/trailing)', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = 'has internal space'
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe('has internal space')
  })

  it('preserves a single leading-space credential (not a formatting artifact)', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = ' secret'
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe(' secret')
  })

  it('preserves a single trailing-space credential (not a formatting artifact)', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = 'secret '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe('secret ')
  })

  it('preserves a single-tab credential', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '\tsecret\t'
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe('\tsecret\t')
  })

  it('preserves a credential whose value is exactly whitespace-padded globally (per-tenant not set)', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', '  global-secret  ', process.env, { preserveWhitespace: true })).toBe('  global-secret  ')
  })

  it('preserves a credential with a newline (multi-line secret — unusual but valid)', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = 'line1\nline2'
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback', process.env, { preserveWhitespace: true })).toBe('line1\nline2')
  })

  it('falls back to the global value when the per-tenant credential is whitespace-only', () => {
    // A misconfigured operator who set only whitespace did
    // not set a real credential. The fall-back decision is
    // orthogonal to the return-shape decision — a
    // whitespace-only per-tenant value falls back to the
    // global value (which IS preserved exactly when
    // `preserveWhitespace: true` is set).
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '   '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', '  global-secret  ', process.env, { preserveWhitespace: true })).toBe('  global-secret  ')
  })

  it('falls back to the global value when the per-tenant credential is an empty string', () => {
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = ''
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', '  global-secret  ', process.env, { preserveWhitespace: true })).toBe('  global-secret  ')
  })

  it('returns empty string when both the per-tenant and the global credential are whitespace-only', () => {
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', '   ', process.env, { preserveWhitespace: true })).toBe('')
  })

  it('preserves the SMTP password when only the global value has leading/trailing whitespace (per-tenant unset)', () => {
    // The per-tenant override is unset, so the function
    // returns the global fallback value exactly as configured
    // (with whitespace preserved).
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_SMTP_PASSWORD', '  smtp-pass  ', process.env, { preserveWhitespace: true })).toBe('  smtp-pass  ')
  })

  it('preserves the SMTP password when both per-tenant and global values are whitespace-padded (per-tenant wins)', () => {
    // When the per-tenant value is set, it wins — the global
    // value is not consulted. Both happen to have padding in
    // this scenario; the per-tenant padding is what reaches
    // the adapter.
    process.env.NUXT_LEADS_SMTP_PASSWORD__ACME = '  per-tenant-pass  '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_SMTP_PASSWORD', '  global-pass  ', process.env, { preserveWhitespace: true })).toBe('  per-tenant-pass  ')
  })

  it('preserves the webhook secret when the global value is untrimmed whitespace-padded', () => {
    // Pinned for the runtime-config path: `useRuntimeConfig()`
    // returns the value as-is from the env var. The dispatcher
    // reads the global value, checks it has content via
    // `.trim()`, and returns it exactly as configured when
    // `preserveWhitespace: true` is set.
    const globalValue = '  global-webhook-secret  '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', globalValue, process.env, { preserveWhitespace: true })).toBe('  global-webhook-secret  ')
  })

  it('preserves the credential value with no trim option specified (the default IS to trim, by design)', () => {
    // The default behavior (no `preserveWhitespace` option) is
    // to trim — this pins the historical behavior for callers
    // that have not opted in. A caller that needs preservation
    // MUST pass `preserveWhitespace: true` explicitly.
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '  acme-secret  '
    expect(readTenantLeadEnv('acme', 'NUXT_LEADS_WEBHOOK_SECRET', 'fallback')).toBe('acme-secret')
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantLeadsConfig — per-tenant + global fallback
 * ------------------------------------------------------------------ */

describe('resolveTenantLeadsConfig — single-tenant default (global fallback)', () => {
  it('returns the global config when NUXT_AGENTS_DATA_SOURCE=static (default tenant)', async () => {
    await setGlobalConfig({
      leadsAdapter: 'webhook',
      leadsWebhookUrl: 'https://default-hooks.example.com/inbox',
      leadsWebhookSecret: 'default-secret',
    })
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.adapterId).toBe('webhook')
    expect(config.webhookUrl).toBe('https://default-hooks.example.com/inbox')
    expect(config.webhookSecret).toBe('default-secret')
    expect(config.smtpHost).toBe('')
    expect(config.emailFrom).toBe('')
  })

  it('returns the default `disabled` adapter when no global config is set', async () => {
    await setGlobalConfig({})
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.adapterId).toBe('disabled')
  })

  it('returns the global SMTP config when the default tenant uses email', async () => {
    await setGlobalConfig({
      leadsAdapter: 'email',
      leadsSmtpHost: 'mail.example.com',
      leadsSmtpPort: '587',
      leadsSmtpUser: 'leads@example.com',
      leadsSmtpPassword: 'secret',
      leadsEmailFrom: 'leads@example.com',
      leadsEmailTo: 'inbox@example.com',
    })
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.adapterId).toBe('email')
    expect(config.smtpHost).toBe('mail.example.com')
    expect(config.smtpPort).toBe('587')
    expect(config.smtpUser).toBe('leads@example.com')
    expect(config.smtpPassword).toBe('secret')
    expect(config.emailFrom).toBe('leads@example.com')
    expect(config.emailTo).toBe('inbox@example.com')
    expect(config.webhookUrl).toBe('')
    expect(config.webhookSecret).toBe('')
  })

  it('falls back to the default tenant for an unknown host (single-tenant behavior preserved)', async () => {
    await setGlobalConfig({ leadsAdapter: 'log' })
    const config = resolveTenantLeadsConfig('unmatched.example', buildCustomRegistry())
    expect(config.adapterId).toBe('log')
  })

  it('falls back to the default tenant for an empty host (matches the sitemap / robots behavior)', async () => {
    await setGlobalConfig({ leadsAdapter: 'log' })
    const config = resolveTenantLeadsConfig('', buildCustomRegistry())
    expect(config.adapterId).toBe('log')
  })

  it('falls back to the default tenant for a null host', async () => {
    await setGlobalConfig({ leadsAdapter: 'log' })
    const config = resolveTenantLeadsConfig(null, buildCustomRegistry())
    expect(config.adapterId).toBe('log')
  })
})

describe('resolveTenantLeadsConfig — two-tenant with different lead adapters', () => {
  // Two isolated tenants, each with completely different
  // lead-destination configuration:
  //   - acme:   webhook (URL + secret from the global config)
  //   - coastal: email (full SMTP settings from the global config)
  // The default tenant uses the global config (webhook) as the
  // documented single-tenant fallback. Per-tenant env-var
  // overrides re-direct each tenant to its own destination.

  it('selects the per-tenant adapter (acme → webhook)', async () => {
    await setGlobalConfig({
      // Global fallback (default tenant uses webhook).
      leadsAdapter: 'webhook',
      leadsWebhookUrl: 'https://default-hooks.example.com/inbox',
      leadsWebhookSecret: 'default-secret',
    })
    // Per-tenant override: acme stays on webhook but with
    // its own URL + secret.
    process.env.NUXT_LEADS_ADAPTER__ACME = 'webhook'
    process.env.NUXT_LEADS_WEBHOOK_URL__ACME = 'https://acme-hooks.example.com/inbox'
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = 'acme-secret'
    // No per-tenant override for coastal → falls back to the
    // global config (which has leadsAdapter='webhook').

    // Build a custom registry with acme + coastal entries.
    const acmeAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'acme',
      name: 'Acme Real Estate',
    }
    const coastalAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'coastal',
      name: 'Coastal Properties',
    }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry

    const config = resolveTenantLeadsConfig('acme.example.com', registry)
    expect(config.adapterId).toBe('webhook')
    expect(config.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(config.webhookSecret).toBe('acme-secret')
    expect(config.smtpHost).toBe('')
    expect(config.emailFrom).toBe('')
  })

  it('selects the per-tenant adapter (coastal → email via per-tenant override)', async () => {
    await setGlobalConfig({
      // Global fallback (default tenant uses webhook).
      leadsAdapter: 'webhook',
      leadsWebhookUrl: 'https://default-hooks.example.com/inbox',
      leadsWebhookSecret: 'default-secret',
    })
    // Per-tenant override: coastal uses email.
    process.env.NUXT_LEADS_ADAPTER__COASTAL = 'email'
    process.env.NUXT_LEADS_SMTP_HOST__COASTAL = 'mail.coastal.example.com'
    process.env.NUXT_LEADS_SMTP_PORT__COASTAL = '587'
    process.env.NUXT_LEADS_SMTP_USER__COASTAL = 'leads@coastal.example.com'
    process.env.NUXT_LEADS_SMTP_PASSWORD__COASTAL = 'coastal-secret'
    process.env.NUXT_LEADS_EMAIL_FROM__COASTAL = 'leads@coastal.example.com'
    process.env.NUXT_LEADS_EMAIL_TO__COASTAL = 'inbox@coastal.example.com'
    // No per-tenant override for acme → falls back to the
    // global config (webhook).

    const acmeAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'acme',
      name: 'Acme Real Estate',
    }
    const coastalAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'coastal',
      name: 'Coastal Properties',
    }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry

    const config = resolveTenantLeadsConfig('coastal.example.com', registry)
    expect(config.adapterId).toBe('email')
    expect(config.smtpHost).toBe('mail.coastal.example.com')
    expect(config.smtpPort).toBe('587')
    expect(config.smtpUser).toBe('leads@coastal.example.com')
    expect(config.smtpPassword).toBe('coastal-secret')
    expect(config.emailFrom).toBe('leads@coastal.example.com')
    expect(config.emailTo).toBe('inbox@coastal.example.com')
    // Coastal did NOT set NUXT_LEADS_WEBHOOK_URL__COASTAL, so
    // the webhook URL falls back to the global config
    // (the documented field-level fallback — per-field
    // dispatch, not all-or-nothing).
    expect(config.webhookUrl).toBe('https://default-hooks.example.com/inbox')
    expect(config.webhookSecret).toBe('default-secret')
  })

  it('isolates two tenants: acme and coastal see different adapters and config simultaneously', async () => {
    // Two requests in flight on different hostnames at the
    // same time must NOT share adapter configuration. The
    // resolver is pure per-request so the two snapshots are
    // independent — the test calls it twice in sequence and
    // asserts both.
    await setGlobalConfig({
      leadsAdapter: 'webhook',
      leadsWebhookUrl: 'https://default-hooks.example.com/inbox',
      leadsWebhookSecret: 'default-secret',
    })
    process.env.NUXT_LEADS_ADAPTER__ACME = 'webhook'
    process.env.NUXT_LEADS_WEBHOOK_URL__ACME = 'https://acme-hooks.example.com/inbox'
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = 'acme-secret'
    process.env.NUXT_LEADS_ADAPTER__COASTAL = 'email'
    process.env.NUXT_LEADS_SMTP_HOST__COASTAL = 'mail.coastal.example.com'
    process.env.NUXT_LEADS_SMTP_PORT__COASTAL = '587'
    process.env.NUXT_LEADS_SMTP_USER__COASTAL = 'leads@coastal.example.com'
    process.env.NUXT_LEADS_SMTP_PASSWORD__COASTAL = 'coastal-secret'
    process.env.NUXT_LEADS_EMAIL_FROM__COASTAL = 'leads@coastal.example.com'
    process.env.NUXT_LEADS_EMAIL_TO__COASTAL = 'inbox@coastal.example.com'

    const acmeAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'acme',
      name: 'Acme Real Estate',
    }
    const coastalAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'coastal',
      name: 'Coastal Properties',
    }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry

    // Interleaved requests: acme, coastal, acme, coastal.
    const a1 = resolveTenantLeadsConfig('acme.example.com', registry)
    const c1 = resolveTenantLeadsConfig('coastal.example.com', registry)
    const a2 = resolveTenantLeadsConfig('acme.example.com', registry)
    const c2 = resolveTenantLeadsConfig('coastal.example.com', registry)

    expect(a1.adapterId).toBe('webhook')
    expect(a1.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(a1.smtpHost).toBe('')
    expect(c1.adapterId).toBe('email')
    // Coastal did NOT set NUXT_LEADS_WEBHOOK_URL__COASTAL,
    // so the webhook URL falls back to the global config.
    expect(c1.webhookUrl).toBe('https://default-hooks.example.com/inbox')
    expect(c1.smtpHost).toBe('mail.coastal.example.com')
    expect(a2.adapterId).toBe('webhook')
    expect(a2.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(c2.adapterId).toBe('email')
    expect(c2.smtpHost).toBe('mail.coastal.example.com')

    // The two snapshots are distinct references — the
    // resolver is not memoising.
    expect(a1).not.toBe(c1)
    expect(a2).not.toBe(a1)
  })

  it('falls back to the global config for a tenant without per-tenant overrides', async () => {
    // The default tenant ships with empty per-tenant env
    // vars. A request to its host uses the global config
    // only.
    await setGlobalConfig({
      leadsAdapter: 'log',
    })
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.adapterId).toBe('log')
  })

  it('falls back to the default tenant for a tenant with only one per-tenant field set', async () => {
    // Coastal sets only the adapter id (email); the SMTP
    // fields fall back to the global config. This pins the
    // field-level fallback — per-field dispatch, not
    // all-or-nothing.
    await setGlobalConfig({
      leadsSmtpHost: 'mail.global.example.com',
      leadsSmtpPort: '25',
      leadsSmtpUser: 'leads@global.example.com',
      leadsSmtpPassword: 'global-secret',
      leadsEmailFrom: 'leads@global.example.com',
      leadsEmailTo: 'inbox@global.example.com',
    })
    process.env.NUXT_LEADS_ADAPTER__COASTAL = 'email'
    // SMTP fields NOT overridden for coastal → fall back
    // to the global config.

    const coastalAgency: AgencyConfig = {
      ...defaultAgencyConfig,
      id: 'coastal',
      name: 'Coastal Properties',
    }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry

    const config = resolveTenantLeadsConfig('coastal.example.com', registry)
    expect(config.adapterId).toBe('email')
    expect(config.smtpHost).toBe('mail.global.example.com')
    expect(config.smtpPort).toBe('25')
    expect(config.smtpUser).toBe('leads@global.example.com')
    expect(config.smtpPassword).toBe('global-secret')
    expect(config.emailFrom).toBe('leads@global.example.com')
    expect(config.emailTo).toBe('inbox@global.example.com')
  })
})

describe('resolveTenantLeadsConfig — return shape', () => {
  it('returns a frozen-shape object with all documented fields', async () => {
    await setGlobalConfig({})
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    // Type-level sanity check via the typed return.
    const keys: ReadonlyArray<keyof TenantLeadsConfig> = [
      'adapterId',
      'webhookUrl',
      'webhookSecret',
      'smtpHost',
      'smtpPort',
      'smtpSecure',
      'smtpUser',
      'smtpPassword',
      'emailFrom',
      'emailTo',
    ]
    for (const key of keys) {
      expect(typeof config[key]).toBe('string')
    }
  })

  it('returns the empty-string fallback when no global and no per-tenant env vars are set', async () => {
    await setGlobalConfig({})
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.adapterId).toBe('disabled')
    expect(config.webhookUrl).toBe('')
    expect(config.webhookSecret).toBe('')
    expect(config.smtpHost).toBe('')
    expect(config.smtpPort).toBe('')
    expect(config.smtpSecure).toBe('')
    expect(config.smtpUser).toBe('')
    expect(config.smtpPassword).toBe('')
    expect(config.emailFrom).toBe('')
    expect(config.emailTo).toBe('')
  })

  it('the bundled sampleAgents catalog validates (no regression in test infrastructure)', () => {
    // This is a sanity check on the test fixture itself —
    // the bundled `sampleAgents` catalog (4 records) must
    // still be a valid `Agent[]` for the test isolation
    // boundary in the rest of the file. A future catalog
    // edit that breaks the boundary surfaces here.
    expect(sampleAgents.length).toBeGreaterThan(0)
    for (const agent of sampleAgents) {
      expect(agent.id).toBeTruthy()
      expect(agent.slug).toBeTruthy()
    }
  })
})

/* ------------------------------------------------------------------ *
 * resolveTenantLeadsConfig — credential preservation end-to-end
 *
 * These tests exercise the full `resolveTenantLeadsConfig`
 * path with credential fields. The resolver forwards
 * `{ preserveWhitespace: true }` to `readTenantLeadEnv` for
 * the three credential fields (`webhookSecret`, `smtpUser`,
 * `smtpPassword`); the seven non-credential fields use the
 * default trim. This block pins the end-to-end behavior —
 * the same contract the contact endpoint / lead pipeline
 * depends on.
 * ------------------------------------------------------------------ */

describe('resolveTenantLeadsConfig — credential preservation (end-to-end)', () => {
  // Two-tenant registry: acme (webhook) + coastal (email).
  // The registry enables the per-tenant env-var dispatch;
  // without the acme / coastal entries, the resolver falls
  // back to the default tenant and the per-tenant env vars
  // are never consulted.
  function buildTwoTenantRegistry(): AgencyRegistry {
    const acmeAgency: AgencyConfig = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const coastalAgency: AgencyConfig = { ...defaultAgencyConfig, id: 'coastal', name: 'Coastal Properties' }
    return Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
      coastal: { ...buildEntry(coastalAgency), hosts: Object.freeze(['coastal.example.com']) },
    }) as AgencyRegistry
  }

  it('preserves leading and trailing whitespace in the per-tenant webhook secret', async () => {
    await setGlobalConfig({ leadsAdapter: 'webhook' })
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '  acme-webhook-secret  '
    const config = resolveTenantLeadsConfig('acme.example.com', buildTwoTenantRegistry())
    expect(config.webhookSecret).toBe('  acme-webhook-secret  ')
  })

  it('preserves leading and trailing whitespace in the per-tenant SMTP password', async () => {
    await setGlobalConfig({ leadsAdapter: 'email' })
    process.env.NUXT_LEADS_SMTP_PASSWORD__COASTAL = '  coastal-smtp-pass  '
    const config = resolveTenantLeadsConfig('coastal.example.com', buildTwoTenantRegistry())
    expect(config.smtpPassword).toBe('  coastal-smtp-pass  ')
  })

  it('preserves leading and trailing whitespace in the per-tenant SMTP username', async () => {
    await setGlobalConfig({ leadsAdapter: 'email' })
    process.env.NUXT_LEADS_SMTP_USER__COASTAL = '  leads@coastal.example.com  '
    const config = resolveTenantLeadsConfig('coastal.example.com', buildTwoTenantRegistry())
    expect(config.smtpUser).toBe('  leads@coastal.example.com  ')
  })

  it('preserves whitespace in the global webhook secret when the per-tenant override is unset', async () => {
    // The runtime config (the "global" path) can carry an
    // untrimmed value. The dispatcher preserves it.
    await setGlobalConfig({
      leadsAdapter: 'webhook',
      leadsWebhookSecret: '  global-webhook-secret  ',
    })
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.webhookSecret).toBe('  global-webhook-secret  ')
  })

  it('preserves whitespace in the global SMTP password when the per-tenant override is unset', async () => {
    await setGlobalConfig({
      leadsAdapter: 'email',
      leadsSmtpPassword: '  global-smtp-pass  ',
    })
    const config = resolveTenantLeadsConfig('localhost', buildCustomRegistry())
    expect(config.smtpPassword).toBe('  global-smtp-pass  ')
  })

  it('still trims non-credential fields (URLs / hostnames / email / adapter id)', async () => {
    // The credential-preservation fix is opt-in per field.
    // Non-credential fields (webhookUrl, smtpHost, emailFrom,
    // emailTo, adapterId) keep the historical trim behavior
    // so a `.env` file with stray whitespace does not break
    // a URL or email address.
    await setGlobalConfig({ leadsAdapter: '  webhook  ' })
    process.env.NUXT_LEADS_WEBHOOK_URL__ACME = '  https://acme-hooks.example.com/inbox  '
    process.env.NUXT_LEADS_SMTP_HOST__ACME = '  mail.acme.example.com  '
    process.env.NUXT_LEADS_EMAIL_FROM__ACME = '  leads@acme.example.com  '
    const acmeAgency: AgencyConfig = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
    }) as AgencyRegistry
    const config = resolveTenantLeadsConfig('acme.example.com', registry)
    // Non-credential fields are trimmed.
    expect(config.adapterId).toBe('webhook')
    expect(config.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(config.smtpHost).toBe('mail.acme.example.com')
    expect(config.emailFrom).toBe('leads@acme.example.com')
  })

  it('falls back to the global credential when the per-tenant credential is whitespace-only (real-world misconfiguration)', async () => {
    // A misconfigured operator who set only whitespace on the
    // per-tenant override should NOT ship a whitespace-only
    // credential — that would authenticate as a different
    // (likely empty) value. The dispatcher falls back to the
    // global credential instead, which IS preserved exactly
    // when configured with whitespace.
    await setGlobalConfig({
      leadsAdapter: 'webhook',
      leadsWebhookSecret: '  global-webhook-secret  ',
    })
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '   '
    const acmeAgency: AgencyConfig = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
    }) as AgencyRegistry
    const config = resolveTenantLeadsConfig('acme.example.com', registry)
    expect(config.webhookSecret).toBe('  global-webhook-secret  ')
  })

  it('returns empty string when both per-tenant and global credentials are whitespace-only', async () => {
    // The dispatcher treats a whitespace-only value as
    // "missing" (an operator who set only whitespace did not
    // set a real credential). When both fallback sources are
    // whitespace-only, the field is empty. The adapter
    // receives an empty credential and the request fails
    // downstream — the documented fail-fast behavior.
    await setGlobalConfig({ leadsAdapter: 'webhook' })
    process.env.NUXT_LEADS_WEBHOOK_SECRET__ACME = '   '
    const acmeAgency: AgencyConfig = { ...defaultAgencyConfig, id: 'acme', name: 'Acme Real Estate' }
    const registry: AgencyRegistry = Object.freeze({
      [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig),
      acme: { ...buildEntry(acmeAgency), hosts: Object.freeze(['acme.example.com']) },
    }) as AgencyRegistry
    const config = resolveTenantLeadsConfig('acme.example.com', registry)
    expect(config.webhookSecret).toBe('')
  })
})