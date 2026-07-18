import { describe, expect, it, vi } from 'vitest'
import { disabledAdapter, getAdapter, logAdapter, webhookAdapter } from './index'

/**
 * Tests for the adapter registry and runtime selector.
 *
 * The active adapter is determined by `runtimeConfig.leadsAdapter`
 * (sourced from `NUXT_LEADS_ADAPTER`). The default is `'disabled'`,
 * so a fresh deployment that has not configured a lead destination
 * returns 503 on every submission rather than silently dropping
 * leads. An unknown adapter id falls back to the disabled adapter.
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
})

describe('getAdapter', () => {
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
    await setAdapterId('email')
    expect(getAdapter().id).toBe('disabled')
  })

  it('trims whitespace from the adapter id', async () => {
    await setAdapterId('  log  ')
    expect(getAdapter().id).toBe('log')
  })
})
