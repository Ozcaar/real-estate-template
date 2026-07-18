import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeH3Event } from '../../../tests/helpers/h3-event'

/**
 * Endpoint tests for `POST /api/contact`.
 *
 * The endpoint is a thin transport wrapper around `leadService.submit()`.
 * The service has its own unit tests in
 * `server/services/leads/lead.service.test.ts`; here we mock the
 * service so the endpoint's transport mapping is the only thing
 * under test. The mock returns a controllable `LeadSubmitStatus`
 * per case, and the assertions verify the HTTP status, body, and
 * `content-type` response header.
 *
 * Every test calls the handler directly with a mock H3Event
 * produced by `tests/helpers/h3-event.ts`. The mock supports the
 * exact surface the endpoint reads (method, headers, body,
 * socket IP) and writes (status, headers).
 */

const submit = vi.fn()

// Mock the lead service so the endpoint's transport mapping is the
// only thing under test. The `submit` function is the single entry
// point the endpoint calls.
vi.mock('../services/leads/lead.service', () => ({
  leadService: { submit: (...args: unknown[]) => submit(...args) },
}))

// Import the handler after the mock is in place. Vitest hoists
// `vi.mock` calls above the import, so the handler sees the mock
// when it resolves `leadService` at call time.
const { default: handler } = await import('./contact.post')

const VALID = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '',
  message: 'I would like more information about the hillside villa.',
  website: '',
  locale: 'en',
}

const POST = (body: string) => JSON.stringify(body)

function post(endpoint: {
  body?: string
  /** Content-Type. Defaults to `application/json`. Pass `''` (empty string) or omit explicitly to test the 415 path. */
  contentType?: string
  ip?: string
  userAgent?: string
  acceptLanguage?: string
}) {
  const headers: Record<string, string> = {}
  // Default to application/json. Tests that exercise the 415 path
  // override this explicitly (e.g. contentType: 'text/plain').
  headers['content-type'] = endpoint.contentType ?? 'application/json'
  if (endpoint.userAgent !== undefined) headers['user-agent'] = endpoint.userAgent
  if (endpoint.acceptLanguage !== undefined) headers['accept-language'] = endpoint.acceptLanguage

  const { event, getResponse } = makeH3Event({
    method: 'POST',
    headers,
    body: endpoint.body,
    ip: endpoint.ip,
  })
  return handler(event).then((body) => ({ body, ...getResponse() }))
}

describe('POST /api/contact — valid submission', () => {
  beforeEach(() => {
    submit.mockReset()
  })

  it('returns 200 with the lead id when the lead service accepts', async () => {
    submit.mockResolvedValue({ status: 'ok', id: '00000000-0000-0000-0000-000000000001' })
    const r = await post({ body: POST(VALID) })
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toMatch(/^application\/json/)
    expect(r.body).toEqual({ ok: true, id: '00000000-0000-0000-0000-000000000001' })
  })

  it('forwards the parsed body, request key, and fallback locale to the service', async () => {
    submit.mockResolvedValue({ status: 'ok', id: '00000000-0000-0000-0000-000000000002' })
    await post({
      body: POST(VALID),
      ip: '203.0.113.7',
      userAgent: 'TestAgent/1.0',
      acceptLanguage: 'es-ES,es;q=0.9',
    })
    expect(submit).toHaveBeenCalledTimes(1)
    const [input, ctx] = submit.mock.calls[0] as [{ body: unknown }, { requestKey: string, fallbackLocale: string }]
    expect(input.body).toEqual(VALID)
    expect(ctx.requestKey).toBe('203.0.113.7::TestAgent/1.0')
    expect(ctx.fallbackLocale).toBe('es')
  })
})

describe('POST /api/contact — transport guards', () => {
  beforeEach(() => {
    submit.mockReset()
  })

  it('returns 415 when Content-Type is not application/json', async () => {
    const r = await post({ body: POST(VALID), contentType: 'text/plain' })
    expect(r.status).toBe(415)
    expect(r.body).toEqual({ ok: false, error: 'unsupported_media_type' })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 415 when Content-Type is missing', async () => {
    const r = await post({ body: POST(VALID), contentType: '' })
    expect(r.status).toBe(415)
    expect(r.body).toEqual({ ok: false, error: 'unsupported_media_type' })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 415 when Content-Type is application/x-www-form-urlencoded', async () => {
    const r = await post({
      body: 'name=Jane&email=jane%40example.com',
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(r.status).toBe(415)
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 413 when the raw body exceeds 16 KB', async () => {
    // Build a JSON body > 16 KB. The body-size check runs before
    // JSON.parse, so a 20 KB string of 'x' is enough to trip it.
    const oversized = 'x'.repeat(20 * 1024)
    const r = await post({ body: oversized })
    expect(r.status).toBe(413)
    expect(r.body).toEqual({ ok: false, error: 'payload_too_large' })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 413 for a 16 KB + 1 byte body (boundary)', async () => {
    const exact = 'x'.repeat(16 * 1024 + 1)
    const r = await post({ body: exact })
    expect(r.status).toBe(413)
  })

  it('accepts a body of exactly 16 KB (boundary)', async () => {
    submit.mockResolvedValue({ status: 'ok', id: '00000000-0000-0000-0000-000000000003' })
    // 16 KB of valid JSON: a name field, a short message, and the
    // rest is padding. We pad the message field to reach exactly
    // 16 KB serialized.
    const baseLen = JSON.stringify({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      message: 'x',
      website: '',
      locale: 'en',
    }).length
    const padding = 16 * 1024 - baseLen + 1
    const valid = { ...VALID, message: 'x'.repeat(padding) }
    const r = await post({ body: POST(valid) })
    expect(r.status).toBe(200)
  })

  it('returns 400 with empty issues when the body is empty', async () => {
    const r = await post({ body: '' })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ ok: false, error: 'validation', issues: [] })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 400 with empty issues when the body is malformed JSON', async () => {
    const r = await post({ body: '{"name": "Jane", broken' })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ ok: false, error: 'validation', issues: [] })
    expect(submit).not.toHaveBeenCalled()
  })

  it('returns 400 with mapped issues when schema validation fails', async () => {
    submit.mockResolvedValue({
      status: 'validation',
      issues: [{ path: 'name', message: 'name_too_short' }],
    })
    const r = await post({ body: POST({ ...VALID, name: 'A' }) })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({
      ok: false,
      error: 'validation',
      issues: [{ path: 'name', message: 'name_too_short' }],
    })
  })
})

describe('POST /api/contact — service-driven status mapping', () => {
  beforeEach(() => {
    submit.mockReset()
  })

  it('returns 200 without an id when the honeypot trips (silent success)', async () => {
    submit.mockResolvedValue({ status: 'honeypot' })
    const r = await post({ body: POST({ ...VALID, website: 'http://bot.example.com' }) })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
    expect('id' in (r.body as Record<string, unknown>)).toBe(false)
  })

  it('returns 429 when the rate limit is exceeded', async () => {
    submit.mockResolvedValue({ status: 'rate_limited' })
    const r = await post({ body: POST(VALID) })
    expect(r.status).toBe(429)
    expect(r.body).toEqual({ ok: false, error: 'rate_limited' })
  })

  it('returns 503 when the configured adapter is disabled', async () => {
    submit.mockResolvedValue({ status: 'adapter_disabled' })
    const r = await post({ body: POST(VALID) })
    expect(r.status).toBe(503)
    expect(r.body).toEqual({ ok: false, error: 'adapter_disabled' })
  })

  it('returns 502 when delivery fails (transport / auth / unsupported)', async () => {
    submit.mockResolvedValue({ status: 'delivery' })
    const r = await post({ body: POST(VALID) })
    expect(r.status).toBe(502)
    expect(r.body).toEqual({ ok: false, error: 'delivery' })
  })
})

describe('POST /api/contact — headers and response shape', () => {
  beforeEach(() => {
    submit.mockReset()
  })

  it('sets content-type: application/json; charset=utf-8 on every response', async () => {
    submit.mockResolvedValue({ status: 'ok', id: '00000000-0000-0000-0000-000000000004' })
    const ok = await post({ body: POST(VALID) })
    expect(ok.headers['content-type']).toBe('application/json; charset=utf-8')

    submit.mockResolvedValue({ status: 'rate_limited' })
    const rl = await post({ body: POST(VALID) })
    expect(rl.headers['content-type']).toBe('application/json; charset=utf-8')

    submit.mockResolvedValue({ status: 'validation', issues: [] })
    const v = await post({ body: '' })
    expect(v.headers['content-type']).toBe('application/json; charset=utf-8')

    const ct = await post({ body: POST(VALID), contentType: 'application/xml' })
    expect(ct.headers['content-type']).toBe('application/json; charset=utf-8')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
