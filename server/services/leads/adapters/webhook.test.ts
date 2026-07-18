import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead } from '../../../../app/features/leads/types/lead.types'
import { webhookAdapter } from './webhook'

/**
 * Tests for the `webhook` delivery adapter.
 *
 * The webhook adapter sends the stamped lead to a configured endpoint
 * with an HMAC SHA-256 signature header. The full transport behavior
 * (200, 401, 403, 5xx, 3xx, network error, timeout, signature, config
 * errors) is exercised here using `vi.fn()` to mock the global
 * `fetch` and `useRuntimeConfig` from `#imports`.
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

const URL = 'https://example.test/hook'
const SECRET = 'super-secret-shared-key'

// Mock the `#imports` module so the adapter can read runtime config
// without booting a Nitro server. The mock is set up per test through
// `vi.mocked(useRuntimeConfig).mockReturnValue(...)`.
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => ({
    leadsWebhookUrl: URL,
    leadsWebhookSecret: SECRET,
  })),
}))

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('webhookAdapter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    vi.useRealTimers()
  })

  it('has id "webhook"', () => {
    expect(webhookAdapter.id).toBe('webhook')
  })

  it('returns ok:true when the upstream returns 2xx', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: true })
  })

  it('returns errorCode "auth" and retryable:false on upstream 401', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401))
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'auth', retryable: false })
  })

  it('returns errorCode "auth" and retryable:false on upstream 403', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(403))
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'auth', retryable: false })
  })

  it('returns errorCode "transport" and retryable:true on upstream 500', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(500))
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: true })
  })

  it('returns errorCode "transport" and retryable:true on upstream 502', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(502))
    const result = await webhookAdapter.deliver({ lead })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('transport')
      expect(result.retryable).toBe(true)
    }
  })

  it('returns errorCode "transport" and retryable:true on upstream 503', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(503))
    const result = await webhookAdapter.deliver({ lead })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('transport')
      expect(result.retryable).toBe(true)
    }
  })

  it('returns errorCode "transport" and retryable:true on a 3xx redirect (manual redirect)', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://elsewhere.test/x' } }),
    )
    const result = await webhookAdapter.deliver({ lead })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('transport')
      expect(result.retryable).toBe(true)
    }
  })

  it('returns errorCode "transport" with retryable:true on fetch network error', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'))
    const result = await webhookAdapter.deliver({ lead })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('transport')
      expect(result.retryable).toBe(true)
    }
  })

  it('returns errorCode "transport" with retryable:false on AbortError (timeout)', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    fetchSpy.mockRejectedValue(abort)
    const result = await webhookAdapter.deliver({ lead })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('transport')
      expect(result.retryable).toBe(false)
    }
  })

  it('returns errorCode "unsupported" when the URL is missing', async () => {
    const { useRuntimeConfig } = await import('#imports')
    vi.mocked(useRuntimeConfig).mockReturnValueOnce({
      leadsWebhookUrl: '',
      leadsWebhookSecret: SECRET,
    })
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns errorCode "unsupported" when the secret is missing', async () => {
    const { useRuntimeConfig } = await import('#imports')
    vi.mocked(useRuntimeConfig).mockReturnValueOnce({
      leadsWebhookUrl: URL,
      leadsWebhookSecret: '',
    })
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns errorCode "unsupported" when both URL and secret are missing', async () => {
    const { useRuntimeConfig } = await import('#imports')
    vi.mocked(useRuntimeConfig).mockReturnValueOnce({
      leadsWebhookUrl: '',
      leadsWebhookSecret: '',
    })
    const result = await webhookAdapter.deliver({ lead })
    expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends a POST with the stamped lead as JSON', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual(lead)
  })

  it('sends the content-type: application/json header', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
  })

  it('sends the X-Lead-Signature header with sha256=<hex>', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['x-lead-signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it('computes the signature as HMAC SHA-256 of the exact JSON payload with the secret', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    const body = String(init.body)
    const expected = createHmac('sha256', SECRET).update(body).digest('hex')
    expect(headers['x-lead-signature']).toBe(`sha256=${expected}`)
  })

  it('uses redirect: "manual" so 3xx is not followed', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.redirect).toBe('manual')
  })

  it('passes an AbortSignal so the 5-second timeout can fire', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200))
    await webhookAdapter.deliver({ lead })
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
