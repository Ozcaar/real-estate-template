import { describe, expect, it } from 'vitest'
import type { Lead } from '../../../../app/features/leads/types/lead.types'
import { disabledAdapter } from './disabled'

/**
 * Tests for the `disabled` delivery adapter.
 *
 * The disabled adapter is the safe default: it never returns success
 * and never silently discards a submission. The lead is still routed
 * through the lead service's normal pipeline, and the service maps
 * the `disabled` errorCode to the `adapter_disabled` transport status,
 * which the endpoint surfaces as a 503 to the client.
 */

const lead: Lead = {
  id: '00000000-0000-0000-0000-000000000001',
  receivedAt: '2026-01-01T00:00:00.000Z',
  source: 'contact',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+52 81 1234 5678',
  message: 'I would like more information.',
  locale: 'en',
}

describe('disabledAdapter', () => {
  it('has id "disabled"', () => {
    expect(disabledAdapter.id).toBe('disabled')
  })

  it('returns ok:false with errorCode "disabled"', async () => {
    const result = await disabledAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'disabled', retryable: false })
  })

  it('does not throw when called with an empty lead', async () => {
    const empty: Lead = {
      ...lead,
      name: '',
      email: '',
      phone: '',
      message: '',
    }
    const result = await disabledAdapter.deliver({ lead: empty })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('disabled')
    }
  })
})
