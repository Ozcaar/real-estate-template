import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead } from '../../../app/features/leads/types/lead.types'
import { leadService } from './lead.service'

/**
 * Tests for the lead service pipeline.
 *
 * The service is the single entry point for processing a contact-form
 * submission. It runs five stages: honeypot, schema validation,
 * per-process rate limit, lead stamping, and delivery. Each test
 * uses a fresh `requestKey` so the in-memory rate-limit map (which
 * persists across tests within the same module) does not bleed
 * between cases.
 *
 * The adapter is mocked per-test so the service's delivery mapping
 * can be exercised in isolation, without booting a Nitro server.
 */

// Mock the adapter registry. The service calls `getAdapter()` from
// `./adapters`; replacing that import with a controllable mock keeps
// the test focused on the service's behavior.
const mockAdapter = {
  id: 'log' as const,
  deliver: vi.fn(),
}

vi.mock('./adapters', () => ({
  getAdapter: vi.fn(() => mockAdapter),
}))

const validLead = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '',
  message: 'I would like more information about the hillside villa.',
  website: '',
  locale: 'en',
}

let keyCounter = 0
function freshKey(prefix = 'k') {
  keyCounter += 1
  return `${prefix}-${Date.now()}-${keyCounter}`
}

describe('leadService.submit — honeypot', () => {
  it('returns status "honeypot" when the honeypot field is a non-empty string', async () => {
    const result = await leadService.submit(
      { body: { ...validLead, website: 'http://bot.example.com' } },
      { requestKey: freshKey('honey'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'honeypot' })
  })

  it('does not call the adapter when the honeypot is triggered', async () => {
    mockAdapter.deliver.mockClear()
    await leadService.submit(
      { body: { ...validLead, website: 'http://bot.example.com' } },
      { requestKey: freshKey('honey'), fallbackLocale: 'en' },
    )
    expect(mockAdapter.deliver).not.toHaveBeenCalled()
  })

  it('proceeds with validation when the honeypot is an empty string', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const result = await leadService.submit(
      { body: { ...validLead, website: '' } },
      { requestKey: freshKey('empty-honey'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
  })

  it('proceeds with validation when the honeypot field is missing', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const { website, ...body } = validLead
    void website
    const result = await leadService.submit(
      { body },
      { requestKey: freshKey('missing-honey'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
  })
})

describe('leadService.submit — schema validation', () => {
  it('returns status "validation" with mapped issues for a bad name', async () => {
    const result = await leadService.submit(
      { body: { ...validLead, name: 'A' } },
      { requestKey: freshKey('name'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
    if (result.status === 'validation') {
      const nameIssue = result.issues.find(i => i.path === 'name')
      expect(nameIssue?.message).toBe('name_too_short')
    }
  })

  it('returns status "validation" with contact_channel_required when email and phone are both empty', async () => {
    const result = await leadService.submit(
      { body: { ...validLead, email: '', phone: '' } },
      { requestKey: freshKey('channel'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
    if (result.status === 'validation') {
      const channelIssue = result.issues.find(i => i.message === 'contact_channel_required')
      expect(channelIssue).toBeDefined()
      expect(channelIssue?.path).toBe('email')
    }
  })

  it('returns status "validation" for a malformed email', async () => {
    const result = await leadService.submit(
      { body: { ...validLead, email: 'not-an-email' } },
      { requestKey: freshKey('email'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
  })

  it('returns status "validation" for an invalid phone', async () => {
    const result = await leadService.submit(
      { body: { ...validLead, email: '', phone: 'abc' } },
      { requestKey: freshKey('phone'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
  })

  it('does not call the adapter when validation fails', async () => {
    mockAdapter.deliver.mockClear()
    await leadService.submit(
      { body: { ...validLead, name: 'A' } },
      { requestKey: freshKey('novalid'), fallbackLocale: 'en' },
    )
    expect(mockAdapter.deliver).not.toHaveBeenCalled()
  })
})

describe('leadService.submit — rate limit', () => {
  it('accepts the first 5 valid submissions in a window', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('rl-pass')
    for (let i = 0; i < 5; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }
  })

  it('returns status "rate_limited" on the 6th valid submission', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('rl-block')
    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
    }
    const sixth = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(sixth).toEqual({ status: 'rate_limited' })
  })

  it('does not consume the rate-limit budget on validation failures', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('rl-novalid')
    // 10 invalid submissions should not consume any budget.
    for (let i = 0; i < 10; i++) {
      const result = await leadService.submit(
        { body: { ...validLead, name: 'A' } },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('validation')
    }
    // 5 valid submissions should still be accepted.
    for (let i = 0; i < 5; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }
  })

  it('does not consume the rate-limit budget on honeypot trips', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('rl-honey')
    for (let i = 0; i < 10; i++) {
      const result = await leadService.submit(
        { body: { ...validLead, website: 'http://bot.example.com' } },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('honeypot')
    }
    for (let i = 0; i < 5; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }
  })

  it('tracks request keys independently', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const keyA = freshKey('rl-iso-a')
    const keyB = freshKey('rl-iso-b')
    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: keyA, fallbackLocale: 'en' },
      )
    }
    // Key A is now blocked; key B should still be accepted.
    const a = await leadService.submit(
      { body: validLead },
      { requestKey: keyA, fallbackLocale: 'en' },
    )
    const b = await leadService.submit(
      { body: validLead },
      { requestKey: keyB, fallbackLocale: 'en' },
    )
    expect(a).toEqual({ status: 'rate_limited' })
    expect(b.status).toBe('ok')
  })
})

describe('leadService.submit — lead stamping', () => {
  beforeEach(() => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
  })

  it('stamps a UUID id, a receivedAt ISO timestamp, and source "contact"', async () => {
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('stamp'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
    expect(captured).not.toBeNull()
    if (captured) {
      expect(captured.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(new Date(captured.receivedAt).toString()).not.toBe('Invalid Date')
      expect(captured.source).toBe('contact')
    }
  })

  it('forwards the validated name, email, phone, and message to the adapter', async () => {
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('forward'), fallbackLocale: 'en' },
    )
    expect(captured).not.toBeNull()
    if (captured) {
      expect(captured.name).toBe(validLead.name)
      expect(captured.email).toBe(validLead.email)
      expect(captured.phone).toBe('')
      expect(captured.message).toBe(validLead.message)
    }
  })

  it('uses the validated locale when present', async () => {
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: { ...validLead, locale: 'es' } },
      { requestKey: freshKey('locale'), fallbackLocale: 'en' },
    )
    expect(captured?.locale).toBe('es')
  })

  it('falls back to the request locale when the validated locale is empty', async () => {
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: { ...validLead, locale: '' } },
      { requestKey: freshKey('locale-fb'), fallbackLocale: 'es' },
    )
    expect(captured?.locale).toBe('es')
  })
})

describe('leadService.submit — delivery mapping', () => {
  beforeEach(() => {
    mockAdapter.deliver.mockReset()
  })

  it('returns status "ok" with the lead id when the adapter succeeds', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('ok'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(typeof result.id).toBe('string')
      expect(result.id.length).toBeGreaterThan(0)
    }
  })

  it('returns status "adapter_disabled" when the adapter reports disabled', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: false, errorCode: 'disabled', retryable: false })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('disabled'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'adapter_disabled' })
  })

  it('returns status "delivery" when the adapter reports transport', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: false, errorCode: 'transport', retryable: true })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('transport'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'delivery' })
  })

  it('returns status "delivery" when the adapter reports auth', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: false, errorCode: 'auth', retryable: false })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('auth'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'delivery' })
  })

  it('returns status "delivery" when the adapter reports rate_limited', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: false, errorCode: 'rate_limited', retryable: true })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('ar-l'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'delivery' })
  })

  it('returns status "delivery" when the adapter reports unsupported', async () => {
    mockAdapter.deliver.mockResolvedValue({ ok: false, errorCode: 'unsupported', retryable: false })
    const result = await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('unsup'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'delivery' })
  })
})

describe('leadService.submit — non-object bodies', () => {
  it('returns status "validation" for a non-object body (string)', async () => {
    const result = await leadService.submit(
      { body: 'not an object' },
      { requestKey: freshKey('string-body'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
  })

  it('returns status "validation" for a null body', async () => {
    const result = await leadService.submit(
      { body: null },
      { requestKey: freshKey('null-body'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
  })

  it('returns status "validation" for an array body', async () => {
    const result = await leadService.submit(
      { body: [validLead] },
      { requestKey: freshKey('array-body'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('validation')
  })
})

afterEach(() => {
  mockAdapter.deliver.mockReset()
})
