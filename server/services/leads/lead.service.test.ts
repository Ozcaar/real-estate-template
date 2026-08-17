import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead, PropertyReference } from '../../../app/features/leads/types/lead.types'
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

/**
 * Rate-limit window-expiry tests.
 *
 * The 10-minute sliding window is the most subtle rate-limit
 * behavior: the cleanup loop in `checkRateLimit` filters out
 * timestamps older than `RATE_LIMIT_WINDOW_MS` on every call. The
 * tests below use `vi.useFakeTimers()` to advance the clock past
 * the 10-minute boundary and verify that an old key is reset
 * (the 6th attempt becomes the 1st of a new window) and that the
 * cleanup is opportunistic (a stale key does not consume budget
 * in a new window).
 *
 * `vi.useFakeTimers()` replaces `Date.now()`, `new Date()`, and the
 * timer functions. The lead service reads `Date.now()` directly in
 * `checkRateLimit`; the fake clock controls that read. The
 * `realTimers()` cleanup in `afterEach` keeps the test suite
 * isolated from the fake clock.
 */
describe('leadService.submit — rate limit window expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    mockAdapter.deliver.mockReset()
    mockAdapter.deliver.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows a new submission after the 10-minute window expires', async () => {
    const key = freshKey('rl-expiry')
    const base = Date.now()

    // Fill the window: 5 valid submissions at t = base.
    for (let i = 0; i < 5; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }

    // 6th attempt within the window: blocked.
    const sixth = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(sixth).toEqual({ status: 'rate_limited' })

    // Advance the clock by 10 minutes + 1 second. The cleanup loop
    // on the next call drops every timestamp in the old window.
    vi.setSystemTime(base + 10 * 60 * 1000 + 1000)

    // 7th attempt: the window has expired. The old timestamps are
    // filtered out, the entry is reset, and the new attempt is the
    // 1st of a fresh window.
    const seventh = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(seventh.status).toBe('ok')
  })

  it('accepts a request at exactly 10 minutes (boundary: strict greater-than)', async () => {
    const key = freshKey('rl-expiry-boundary')
    const base = Date.now()

    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
    }

    // Advance to exactly 10 minutes. The cleanup filter is
    // `t > cutoff` (strict greater-than), where
    // `cutoff = now - RATE_LIMIT_WINDOW_MS`. At exactly 10
    // minutes, `cutoff === base`, every stored timestamp equals
    // `base`, and every timestamp is filtered out. The window
    // is already considered "past" and the new attempt is
    // accepted. This matches the documented behavior of a
    // sliding-window rate limiter with strict greater-than.
    vi.setSystemTime(base + 10 * 60 * 1000)
    const passed = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(passed.status).toBe('ok')
  })

  it('resets all 5 slots after the window expires (not just 1)', async () => {
    const key = freshKey('rl-expiry-reset')
    const base = Date.now()

    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
    }

    // Advance past the window.
    vi.setSystemTime(base + 10 * 60 * 1000 + 1000)

    // All 5 slots should be available again — submit 5 times and
    // expect every attempt to succeed.
    for (let i = 0; i < 5; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }

    // The 6th attempt in the new window: blocked.
    const blocked = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(blocked).toEqual({ status: 'rate_limited' })
  })

  it('opportunistically drops stale entries for unrelated keys on the next call', async () => {
    const keyStale = freshKey('rl-stale')
    const keyFresh = freshKey('rl-fresh')
    const base = Date.now()

    // Fill the stale key's window at t = base.
    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: keyStale, fallbackLocale: 'en' },
      )
    }

    // Advance past the window. The next call (on a different key)
    // runs the cleanup loop and drops the stale entry.
    vi.setSystemTime(base + 10 * 60 * 1000 + 1000)

    const fresh = await leadService.submit(
      { body: validLead },
      { requestKey: keyFresh, fallbackLocale: 'en' },
    )
    expect(fresh.status).toBe('ok')

    // After the cleanup, the stale key is removed. A subsequent
    // attempt on the stale key in a new window is also accepted
    // (its old entries were dropped, not just reduced).
    const staleResurrected = await leadService.submit(
      { body: validLead },
      { requestKey: keyStale, fallbackLocale: 'en' },
    )
    expect(staleResurrected.status).toBe('ok')
  })

  it('tracks timestamps across the window boundary — only in-window submissions count', async () => {
    const key = freshKey('rl-partial-window')
    const base = Date.now()

    // 3 submissions at t = base.
    for (let i = 0; i < 3; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
    }

    // Advance 5 minutes (half the window).
    vi.setSystemTime(base + 5 * 60 * 1000)

    // 2 more submissions — these are still in the window.
    for (let i = 0; i < 2; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
    }

    // Advance to 10 minutes + 1 second. The first 3 are now outside
    // the window; only the last 2 remain. After the cleanup,
    // exactly 2 slots are consumed; 3 more are available.
    vi.setSystemTime(base + 10 * 60 * 1000 + 1000)

    // 3 more accepted (the last 2 fell off, leaving 2 used → 3 free).
    for (let i = 0; i < 3; i++) {
      const result = await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(result.status).toBe('ok')
    }

    // Now 5 are used again; 6th is blocked.
    const blocked = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(blocked).toEqual({ status: 'rate_limited' })
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

/**
 * Property inquiry branch — `propertyContext`.
 *
 * The endpoint looks up the property server-side via the catalog
 * and passes a verified `PropertyReference` to the service. The
 * service stamps the lead with `source: 'property_inquiry'` and
 * the `property` field; client-supplied title, price, or
 * location are NEVER trusted (the endpoint produces the
 * reference, not the client).
 */
describe('leadService.submit — property inquiry context', () => {
  const propertyContext: PropertyReference = {
    slug: 'modern-hillside-villa',
    title: 'Modern Hillside Villa',
    url: '/properties/modern-hillside-villa',
  }

  /**
   * Body for a property-inquiry submission: `validLead` (which
   * has no `property` block) plus the property slug block. With
   * the Task 101B contract, the source is derived from the body's
   * `property` field, so the body MUST carry the slug for the
   * source to be `property_inquiry`.
   */
  const validPropertyBody = {
    ...validLead,
    property: { slug: propertyContext.slug },
  }

  beforeEach(() => {
    mockAdapter.deliver.mockResolvedValue({ ok: true })
  })

  it('stamps source "property_inquiry" when the body carries property.slug and a verified propertyContext is supplied', async () => {
    // The happy path: the body carries property.slug AND the
    // canonical lookup succeeded (propertyContext is defined).
    // The lead is stamped with source: 'property_inquiry' AND
    // the property reference.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    const result = await leadService.submit(
      { body: validPropertyBody, propertyContext },
      { requestKey: freshKey('pi-source'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
    expect(captured?.source).toBe('property_inquiry')
    expect(captured?.property).toEqual(propertyContext)
  })

  it('stamps the verified property reference on the lead', async () => {
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: validPropertyBody, propertyContext },
      { requestKey: freshKey('pi-ref'), fallbackLocale: 'en' },
    )
    expect(captured?.property).toEqual(propertyContext)
  })

  it('does not validate the body against the property schema (the endpoint already did)', async () => {
    // The service trusts the body has been schema-validated by
    // the endpoint, but it still runs the same schema as a
    // safety net. The property block is optional in the schema,
    // so a body without a property block is valid.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: validPropertyBody, propertyContext },
      { requestKey: freshKey('pi-body'), fallbackLocale: 'en' },
    )
    expect(captured?.source).toBe('property_inquiry')
    expect(captured?.property).toEqual(propertyContext)
  })

  it('stamps source "contact" when the body has no property block (general contact form path unchanged)', async () => {
    // Task 101B: source is derived from the body, not from
    // propertyContext. A body without property.slug is a
    // general contact submission — the source is 'contact'.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('contact-source'), fallbackLocale: 'en' },
    )
    expect(captured?.source).toBe('contact')
    expect(captured?.property).toBeUndefined()
  })

  it('preserves source "property_inquiry" when the body carries property.slug but the lookup returned undefined (soft failure: slug not in catalog)', async () => {
    // Task 101B regression: the source is preserved
    // independently of whether the catalog lookup
    // succeeded. A slug that does not match any catalog
    // record produces a lead with source: 'property_inquiry'
    // but NO `property` field. The agency can filter the
    // inquiry source from general contact submissions even
    // when the slug is unknown to the server.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    const result = await leadService.submit(
      {
        body: { ...validLead, property: { slug: 'removed-listing' } },
        // No propertyContext — soft failure (slug not in
        // catalog).
      },
      { requestKey: freshKey('pi-soft-missing'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
    expect(captured?.source).toBe('property_inquiry')
    // The property field is omitted (no verified reference).
    expect(captured).not.toHaveProperty('property')
  })

  it('preserves source "property_inquiry" when the body carries property.slug and the propertyContext is undefined (soft failure: lookup error)', async () => {
    // Task 101B regression: the source is preserved when the
    // catalog lookup throws (transient api failure, timeout,
    // DNS error). The endpoint catches the throw and passes
    // `propertyContext: undefined`. The service stamps
    // source: 'property_inquiry' from the body's property
    // block and omits the property field.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    const result = await leadService.submit(
      {
        body: { ...validLead, property: { slug: 'any-slug' } },
        // No propertyContext — the endpoint's lookup threw
        // and was caught, returning undefined.
      },
      { requestKey: freshKey('pi-soft-error'), fallbackLocale: 'en' },
    )
    expect(result.status).toBe('ok')
    expect(captured?.source).toBe('property_inquiry')
    expect(captured).not.toHaveProperty('property')
  })

  it('omits lead.property when the body has no property block even if propertyContext is supplied (source/property invariant — Task 101C)', async () => {
    // Defensive + invariant: the body is the source of truth
    // for the user's intent, AND a `contact` lead MUST NOT
    // carry property metadata. A hypothetical endpoint that
    // supplies `propertyContext` without a matching body
    // `property` block does NOT turn a general contact
    // submission into a hybrid that confuses the agency's
    // downstream filters. The endpoint contract today always
    // derives `propertyContext` from the body's `property.slug`,
    // so this scenario cannot happen in production — but the
    // service enforces the invariant defensively:
    // `lead.property` is stamped ONLY when both
    // `isPropertyInquiry` AND `propertyContext` are present.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      {
        body: validLead, // No property block.
        propertyContext, // ← would be unusual; defensively DROPPED.
      },
      { requestKey: freshKey('contact-invariant'), fallbackLocale: 'en' },
    )
    // Source is derived from the body (no property → contact).
    expect(captured?.source).toBe('contact')
    // The property field is OMITTED — the source/property
    // invariant pins this: a `contact` lead can never carry
    // property metadata, even if a defensive `propertyContext`
    // was supplied. The agency's downstream filters never see
    // a hybrid `contact` lead with `property`.
    expect(captured).not.toHaveProperty('property')
  })

  it('does not trust a client-supplied source field (defense-in-depth)', async () => {
    // The schema's z.object(...) strips unknown keys, so a
    // body with `source: 'contact'` still parses to
    // LeadInputParsed without a `source` field. Even if a
    // future schema relaxation passes the value through,
    // the service derives source from the body's intent
    // (property.slug present or not), NOT from the body's
    // source field. The server is the sole authority for
    // lead.source.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      {
        body: {
          ...validLead,
          property: { slug: 'modern-hillside-villa' },
          // User tries to forge: "this is a general contact".
          source: 'contact',
        },
        propertyContext,
      },
      { requestKey: freshKey('pi-forged-source'), fallbackLocale: 'en' },
    )
    // The body has property.slug → source is property_inquiry.
    expect(captured?.source).toBe('property_inquiry')
  })

  it('triggers the honeypot path even when the body carries property.slug', async () => {
    // A property inquiry with a non-empty honeypot is still
    // silently dropped — the bot detection is independent of
    // the property intent.
    mockAdapter.deliver.mockClear()
    const result = await leadService.submit(
      {
        body: { ...validPropertyBody, website: 'http://bot.example.com' },
        propertyContext,
      },
      { requestKey: freshKey('pi-honey'), fallbackLocale: 'en' },
    )
    expect(result).toEqual({ status: 'honeypot' })
    expect(mockAdapter.deliver).not.toHaveBeenCalled()
  })

  it('rate-limits property inquiries under the same per-process budget as contact submissions', async () => {
    // The rate limiter is shared across both sources. Five
    // accepted property inquiries within the window succeed;
    // the sixth is rejected with status "rate_limited".
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('pi-rl')
    for (let i = 0; i < 5; i++) {
      const r = await leadService.submit(
        { body: validPropertyBody, propertyContext },
        { requestKey: key, fallbackLocale: 'en' },
      )
      expect(r.status).toBe('ok')
    }
    const sixth = await leadService.submit(
      { body: validPropertyBody, propertyContext },
      { requestKey: key, fallbackLocale: 'en' },
    )
    expect(sixth).toEqual({ status: 'rate_limited' })
  })

  it('omits the property field from the lead when no propertyContext is supplied (matches existing JSON shape)', async () => {
    // When the body has no property block (a general contact
    // submission), the lead is stamped with source: 'contact'
    // and no property field. The field is omitted (not set to
    // null) so the JSON shape matches the existing adapter
    // contract.
    let captured: Lead | null = null
    mockAdapter.deliver.mockImplementation(async (input) => {
      captured = input.lead
      return { ok: true }
    })
    await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('contact-no-prop'), fallbackLocale: 'en' },
    )
    expect(captured?.source).toBe('contact')
    expect(captured).not.toHaveProperty('property')
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

describe('leadService.submit — per-tenant lead configuration (Task 106)', () => {
  // The contact endpoint resolves the active tenant from the
  // request hostname and threads a `TenantLeadsConfig` snapshot
  // through the lead pipeline. The service forwards the
  // snapshot to the adapter; the adapter reads URL / secret /
  // SMTP fields from the snapshot, not from `useRuntimeConfig()`.
  // These tests pin the threading contract.
  function makeTenantLeadsConfig(adapterId: string): {
    adapterId: string
    webhookUrl: string
    webhookSecret: string
    smtpHost: string
    smtpPort: string
    smtpSecure: string
    smtpUser: string
    smtpPassword: string
    emailFrom: string
    emailTo: string
  } {
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

  it('threads the tenantLeadsConfig into the adapter input when supplied', async () => {
    mockAdapter.deliver.mockReset()
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    let captured: { lead: unknown, tenantLeadsConfig?: unknown } | null = null
    mockAdapter.deliver.mockImplementation(async (input: { lead: unknown, tenantLeadsConfig?: unknown }) => {
      captured = input
      return { ok: true }
    })
    const tenantLeadsConfig = makeTenantLeadsConfig('webhook')
    tenantLeadsConfig.webhookUrl = 'https://acme-hooks.example.com/inbox'
    tenantLeadsConfig.webhookSecret = 'acme-secret'
    await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('tenant-thread'), fallbackLocale: 'en', tenantLeadsConfig },
    )
    expect(captured).not.toBeNull()
    expect(captured?.tenantLeadsConfig).toBe(tenantLeadsConfig)
    // The snapshot is forwarded by reference — the adapter
    // reads from the same object the service received, with
    // no per-tenant env-var dispatch in between.
    const c = captured?.tenantLeadsConfig as { webhookUrl: string, webhookSecret: string }
    expect(c?.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(c?.webhookSecret).toBe('acme-secret')
  })

  it('does not include tenantLeadsConfig when the context omits it (single-tenant / no-tenant path)', async () => {
    mockAdapter.deliver.mockReset()
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    let captured: { lead: unknown, tenantLeadsConfig?: unknown } | null = null
    mockAdapter.deliver.mockImplementation(async (input: { lead: unknown, tenantLeadsConfig?: unknown }) => {
      captured = input
      return { ok: true }
    })
    await leadService.submit(
      { body: validLead },
      { requestKey: freshKey('no-tenant'), fallbackLocale: 'en' },
    )
    // The input carries `tenantLeadsConfig: undefined` when
    // the context omits it — the adapter falls back to
    // `useRuntimeConfig()`. The service threads the field
    // unconditionally so the adapter's TypeScript signature
    // is uniform; the runtime value is `undefined` when
    // the contact endpoint did not resolve a per-tenant
    // snapshot.
    expect(captured).not.toBeNull()
    expect(captured?.tenantLeadsConfig).toBeUndefined()
  })

  it('selects the adapter via getAdapter(tenantLeadsConfig) so the per-tenant adapterId wins', async () => {
    // The contact endpoint selects the adapter from the
    // tenant's snapshot. The service must forward the
    // snapshot to getAdapter (which then returns the matching
    // adapter) and to the adapter's input (so the adapter
    // reads URL / secret / SMTP fields from the snapshot).
    //
    // This is the "two-tenant, different adapter" integration
    // check: the same `getAdapter` mock returns the same
    // `mockAdapter` for every call (it does not read the
    // snapshot's adapterId), so the assertion below is on the
    // input alone — the snapshot is forwarded. The
    // adapter-selection logic is tested separately in
    // `server/services/leads/adapters/index.test.ts`.
    mockAdapter.deliver.mockReset()
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    let captured: { lead: unknown, tenantLeadsConfig?: unknown } | null = null
    mockAdapter.deliver.mockImplementation(async (input: { lead: unknown, tenantLeadsConfig?: unknown }) => {
      captured = input
      return { ok: true }
    })

    // Tenant 1 (acme) — webhook destination.
    const acmeConfig = makeTenantLeadsConfig('webhook')
    acmeConfig.webhookUrl = 'https://acme-hooks.example.com/inbox'
    acmeConfig.webhookSecret = 'acme-secret'
    // Tenant 2 (coastal) — email destination.
    const coastalConfig = makeTenantLeadsConfig('email')
    coastalConfig.smtpHost = 'mail.coastal.example.com'
    coastalConfig.smtpUser = 'leads@coastal.example.com'
    coastalConfig.emailFrom = 'leads@coastal.example.com'
    coastalConfig.emailTo = 'inbox@coastal.example.com'

    // Two concurrent requests, two snapshots, two adapter
    // calls. The service forwards each snapshot by reference
    // — concurrent requests for different tenants do NOT
    // share adapter configuration.
    const keyA = freshKey('acme-tenant')
    const keyC = freshKey('coastal-tenant')
    await leadService.submit({ body: validLead }, { requestKey: keyA, fallbackLocale: 'en', tenantLeadsConfig: acmeConfig })
    await leadService.submit({ body: validLead }, { requestKey: keyC, fallbackLocale: 'en', tenantLeadsConfig: coastalConfig })

    expect(mockAdapter.deliver).toHaveBeenCalledTimes(2)
    const calls = mockAdapter.deliver.mock.calls as Array<[{ lead: unknown, tenantLeadsConfig?: { webhookUrl: string, webhookSecret: string, smtpHost: string, smtpUser: string, emailFrom: string, emailTo: string } }]>
    // The first call (acme) carries the webhook config.
    expect(calls[0]?.[0]?.tenantLeadsConfig?.webhookUrl).toBe('https://acme-hooks.example.com/inbox')
    expect(calls[0]?.[0]?.tenantLeadsConfig?.webhookSecret).toBe('acme-secret')
    // The second call (coastal) carries the email config —
    // NOT the webhook config. The two snapshots are
    // independent; concurrent requests do not share
    // configuration.
    expect(calls[1]?.[0]?.tenantLeadsConfig?.smtpHost).toBe('mail.coastal.example.com')
    expect(calls[1]?.[0]?.tenantLeadsConfig?.webhookUrl).toBe('')
    expect(calls[1]?.[0]?.tenantLeadsConfig?.smtpUser).toBe('leads@coastal.example.com')
    expect(calls[1]?.[0]?.tenantLeadsConfig?.emailFrom).toBe('leads@coastal.example.com')
    expect(calls[1]?.[0]?.tenantLeadsConfig?.emailTo).toBe('inbox@coastal.example.com')
    // Both snapshots are distinct references (the service
    // does not memoise).
    expect(calls[0]?.[0]?.tenantLeadsConfig).toBe(acmeConfig)
    expect(calls[1]?.[0]?.tenantLeadsConfig).toBe(coastalConfig)
    // The captured input still has the same `lead` shape (the
    // service does not mutate the lead between the rate-limit
    // check and the adapter dispatch).
    expect(captured).not.toBeNull()
  })

  it('the honeypot path does not forward the snapshot to the adapter (silent discard)', async () => {
    // The honeypot path returns the silent success result
    // WITHOUT calling the adapter. The snapshot is not
    // forwarded because no delivery happens.
    mockAdapter.deliver.mockReset()
    await leadService.submit(
      { body: { ...validLead, website: 'http://bot.example.com' } },
      { requestKey: freshKey('honey-tenant'), fallbackLocale: 'en', tenantLeadsConfig: makeTenantLeadsConfig('webhook') },
    )
    expect(mockAdapter.deliver).not.toHaveBeenCalled()
  })

  it('the rate-limit path does not forward the snapshot to the adapter', async () => {
    // Same: the rate-limit path returns the rate_limited
    // result WITHOUT calling the adapter.
    mockAdapter.deliver.mockReset()
    mockAdapter.deliver.mockResolvedValue({ ok: true })
    const key = freshKey('rl-tenant')
    for (let i = 0; i < 5; i++) {
      await leadService.submit(
        { body: validLead },
        { requestKey: key, fallbackLocale: 'en', tenantLeadsConfig: makeTenantLeadsConfig('webhook') },
      )
    }
    mockAdapter.deliver.mockClear()
    const r = await leadService.submit(
      { body: validLead },
      { requestKey: key, fallbackLocale: 'en', tenantLeadsConfig: makeTenantLeadsConfig('webhook') },
    )
    expect(r).toEqual({ status: 'rate_limited' })
    expect(mockAdapter.deliver).not.toHaveBeenCalled()
  })
})

afterEach(() => {
  mockAdapter.deliver.mockReset()
})
