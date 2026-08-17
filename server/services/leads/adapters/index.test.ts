import { describe, expect, it, vi } from 'vitest'
import { disabledAdapter, emailAdapter, getAdapter, logAdapter, webhookAdapter } from './index'
import type { TenantLeadsConfig } from '../../../utils/lead-config'

/**
 * Tests for the adapter registry and runtime selector.
 *
 * The active adapter is determined by the **resolved tenant
 * lead configuration** when a `tenantLeadsConfig` snapshot is
 * passed in (Task 106 multi-tenant deployment), or by
 * `runtimeConfig.leadsAdapter` (sourced from `NUXT_LEADS_ADAPTER`)
 * when the snapshot is absent (single-tenant / no-tenant-context
 * behavior).
 *
 * The default is `'disabled'`, so a fresh deployment that has not
 * configured a lead destination returns 503 on every submission
 * rather than silently dropping leads. An unknown adapter id
 * falls back to the disabled adapter.
 */

// Mock `#imports` so `useRuntimeConfig()` returns the value the
// current test wants. The mock factory is hoisted, so we read the
// desired value at test time by mutating the mock's return value.
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(),
}))

async function setAdapterId(id: string | undefined) {
  const { useRuntimeConfig } = await import('#imports')
  vi.mocked(useRuntimeConfig).mockReturnValue({
    leadsAdapter: id,
  })
}

function makeConfig(adapterId: string): TenantLeadsConfig {
  return {
    adapterId,
    webhookUrl: '',
    webhookSecret: '',
    smtpHost: '',
    smtpPort: '',
    smtpSecure: '',
    smtpUser: '',
    smtpPassword: '',
    emailFrom: '',
    emailTo: '',
  }
}

describe('adapter registry', () => {
  it('exports the disabled adapter with id "disabled"', () => {
    expect(disabledAdapter.id).toBe('disabled')
  })

  it('exports the log adapter with id "log"', () => {
    expect(logAdapter.id).toBe('log')
  })

  it('exports the webhook adapter with id "webhook"', () => {
    expect(webhookAdapter.id).toBe('webhook')
  })

  it('returns the email adapter instance for adapterId "email"', () => {
    // The registry is a frozen `Record<string, LeadDeliveryAdapter>`.
    // The selector returns the exact same instance the registry
    // registered — the test pins the identity so a future
    // refactor cannot introduce a wrapper / decorator.
    expect(getAdapter(makeConfig('email'))).toBe(emailAdapter)
  })
})

describe('getAdapter (single-tenant / no-tenant-context behavior)', () => {
  it('returns the disabled adapter when leadsAdapter is "disabled"', async () => {
    await setAdapterId('disabled')
    expect(getAdapter().id).toBe('disabled')
  })

  it('returns the log adapter when leadsAdapter is "log"', async () => {
    await setAdapterId('log')
    expect(getAdapter().id).toBe('log')
  })

  it('returns the webhook adapter when leadsAdapter is "webhook"', async () => {
    await setAdapterId('webhook')
    expect(getAdapter().id).toBe('webhook')
  })

  it('falls back to the disabled adapter when leadsAdapter is missing', async () => {
    await setAdapterId(undefined)
    expect(getAdapter().id).toBe('disabled')
  })

  it('falls back to the disabled adapter when leadsAdapter is an unknown id', async () => {
    await setAdapterId('sms')
    expect(getAdapter().id).toBe('disabled')
  })

  it('returns the email adapter when leadsAdapter is "email"', async () => {
    await setAdapterId('email')
    expect(getAdapter().id).toBe('email')
  })

  it('trims whitespace from the adapter id', async () => {
    await setAdapterId('  log  ')
    expect(getAdapter().id).toBe('log')
  })
})

describe('getAdapter (per-tenant override, Task 106)', () => {
  it('selects the per-tenant adapter (acme → webhook)', async () => {
    // The global config is `email`; the per-tenant snapshot
    // overrides with `webhook`. The per-tenant path wins.
    await setAdapterId('email')
    expect(getAdapter(makeConfig('webhook')).id).toBe('webhook')
  })

  it('selects the per-tenant adapter (coastal → log)', async () => {
    await setAdapterId('email')
    expect(getAdapter(makeConfig('log')).id).toBe('log')
  })

  it('selects the per-tenant adapter (default tenant → disabled)', async () => {
    await setAdapterId('webhook')
    expect(getAdapter(makeConfig('disabled')).id).toBe('disabled')
  })

  it('falls back to the global config when the per-tenant adapterId is empty', async () => {
    await setAdapterId('webhook')
    // An empty `adapterId` is treated as "use the global
    // config" (the documented fallback for the per-tenant
    // path). The trimmed empty string falls through to the
    // runtime-config lookup.
    expect(getAdapter(makeConfig('')).id).toBe('webhook')
  })

  it('falls back to the global config when the per-tenant adapterId is whitespace', async () => {
    await setAdapterId('webhook')
    expect(getAdapter(makeConfig('   ')).id).toBe('webhook')
  })

  it('falls back to the disabled adapter when the per-tenant adapterId is unknown', async () => {
    // The runtime config is `disabled` (the default); a
    // per-tenant `sms` (unknown) id falls back to disabled.
    // This mirrors the single-tenant behavior: an unknown id
    // never throws — it returns the disabled adapter and the
    // service maps the `disabled` errorCode to a 503.
    await setAdapterId('disabled')
    expect(getAdapter(makeConfig('sms')).id).toBe('disabled')
  })

  it('trims whitespace from the per-tenant adapterId', async () => {
    await setAdapterId('email')
    expect(getAdapter(makeConfig('  webhook  ')).id).toBe('webhook')
  })

  it('isolates concurrent calls: the second call sees its own tenant snapshot, not the first', async () => {
    // Two concurrent requests for different tenants must NOT
    // share adapter configuration. The selector is pure
    // per-request — the second call's tenantLeadsConfig
    // wins for the second call.
    await setAdapterId('email')
    const a = getAdapter(makeConfig('webhook'))
    const c = getAdapter(makeConfig('log'))
    expect(a.id).toBe('webhook')
    expect(c.id).toBe('log')
  })
})