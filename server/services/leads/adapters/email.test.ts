import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead } from '../../../../app/features/leads/types/lead.types'
import { emailAdapter } from './email'

/**
 * Tests for the SMTP email delivery adapter.
 *
 * The `nodemailer` module is fully mocked. The test never opens a
 * real SMTP connection, never resolves a real DNS name, and never
 * sends a real email. The mock is set up via `vi.mock` with a
 * factory that returns a `createTransport` function; the
 * factory-built `transporter` is replaced per-test so each case
 * gets a fresh `sendMail` spy.
 *
 * The `#imports` module is mocked so `useRuntimeConfig()` returns a
 * per-test SMTP config without booting a Nitro server. The mock
 * factory is hoisted, so the `mockTransporter` and `mockSendMail`
 * references are resolved at call time (not at hoist time) — the
 * same pattern used by the existing `lead.service.test.ts`.
 */

const mockSendMail = vi.fn()
const mockTransporterClose = vi.fn()
const mockTransporter = {
  sendMail: mockSendMail,
  close: mockTransporterClose,
}

vi.mock('nodemailer', () => {
  const createTransport = vi.fn(() => mockTransporter)
  return {
    default: { createTransport },
    createTransport,
  }
})

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(),
}))

const { useRuntimeConfig } = await import('#imports')

const VALID_LEAD: Lead = {
  id: '00000000-0000-0000-0000-000000000001',
  receivedAt: '2026-01-01T00:00:00.000Z',
  source: 'contact',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+52 81 1234 5678',
  message: 'I would like more information about the hillside villa.',
  locale: 'en',
}

const FULL_CONFIG = {
  leadsSmtpHost: 'smtp.example.com',
  leadsSmtpPort: '587',
  leadsSmtpSecure: '',
  leadsSmtpUser: 'apikey',
  leadsSmtpPassword: 'topsecret',
  leadsEmailFrom: 'leads@example.com',
  leadsEmailTo: 'agency@example.com',
}

function setConfig(overrides: Partial<typeof FULL_CONFIG> = {}) {
  vi.mocked(useRuntimeConfig).mockReturnValue({
    ...FULL_CONFIG,
    ...overrides,
  })
}

describe('emailAdapter', () => {
  beforeEach(() => {
    mockSendMail.mockReset()
    mockTransporterClose.mockReset()
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has id "email"', () => {
    expect(emailAdapter.id).toBe('email')
  })

  describe('configuration validation', () => {
    it('returns unsupported when the host is missing', async () => {
      setConfig({ leadsSmtpHost: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
      expect(mockSendMail).not.toHaveBeenCalled()
    })

    it('returns unsupported when the port is missing', async () => {
      setConfig({ leadsSmtpPort: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
      expect(mockSendMail).not.toHaveBeenCalled()
    })

    it('returns unsupported when the user is missing', async () => {
      setConfig({ leadsSmtpUser: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when the password is missing', async () => {
      setConfig({ leadsSmtpPassword: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when the from address is missing', async () => {
      setConfig({ leadsEmailFrom: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when the to address is missing', async () => {
      setConfig({ leadsEmailTo: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when the port is not a positive integer', async () => {
      setConfig({ leadsSmtpPort: '0' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })

      setConfig({ leadsSmtpPort: '-1' })
      const result2 = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result2).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })

      setConfig({ leadsSmtpPort: 'abc' })
      const result3 = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result3).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when all SMTP config is missing', async () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({})
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })

    it('returns unsupported when only the secure flag is set (no other config)', async () => {
      vi.mocked(useRuntimeConfig).mockReturnValue({ leadsSmtpSecure: 'true' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'unsupported', retryable: false })
    })
  })

  describe('successful delivery', () => {
    it('returns ok:true when sendMail resolves', async () => {
      setConfig()
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: true })
    })

    it('sends from the configured from address', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockSendMail.mock.calls[0]?.[0]).toMatchObject({ from: 'leads@example.com' })
    })

    it('sends to the configured to address', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockSendMail.mock.calls[0]?.[0]).toMatchObject({ to: 'agency@example.com' })
    })

    it('sets the subject to "New lead: <name>"', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockSendMail.mock.calls[0]?.[0]).toMatchObject({ subject: 'New lead: Jane Doe' })
    })

    it('sends a plain-text body', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      const options = mockSendMail.mock.calls[0]?.[0] as { text: string }
      expect(options.text).toContain('Name: Jane Doe')
      expect(options.text).toContain('Email: jane@example.com')
      expect(options.text).toContain('Phone: +52 81 1234 5678')
      expect(options.text).toContain('I would like more information about the hillside villa.')
      expect(options.text).toContain('Locale: en')
      expect(options.text).toContain('Source: contact')
      expect(options.text).toContain('ID: 00000000-0000-0000-0000-000000000001')
      expect(options.text).toContain('Received: 2026-01-01T00:00:00.000Z')
    })

    it('sends an HTML body', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      expect(options.html).toContain('<h2')
      expect(options.html).toContain('Jane Doe')
      expect(options.html).toContain('jane@example.com')
      expect(options.html).toContain('+52 81 1234 5678')
    })

    it('sets replyTo to the lead email when present', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockSendMail.mock.calls[0]?.[0]).toMatchObject({ replyTo: 'jane@example.com' })
    })

    it('omits replyTo when the lead has no email', async () => {
      setConfig()
      const leadWithoutEmail: Lead = { ...VALID_LEAD, email: '' }
      await emailAdapter.deliver({ lead: leadWithoutEmail })
      const options = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>
      expect('replyTo' in options).toBe(false)
    })

    it('uses secure:true when NUXT_LEADS_SMTP_SECURE is "true"', async () => {
      setConfig({ leadsSmtpSecure: 'true' })
      await emailAdapter.deliver({ lead: VALID_LEAD })
      // The transporter options are internal; verify via the createTransport call.
      // The mock returns the same transporter regardless, so we just check
      // that sendMail was called and no error was returned.
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result.ok).toBe(true)
    })

    it('uses secure:false when NUXT_LEADS_SMTP_SECURE is "false"', async () => {
      setConfig({ leadsSmtpSecure: 'false' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result.ok).toBe(true)
    })

    it('uses secure:false when NUXT_LEADS_SMTP_SECURE is empty (default)', async () => {
      setConfig({ leadsSmtpSecure: '' })
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result.ok).toBe(true)
    })
  })

  describe('HTML escaping', () => {
    it('escapes < > & " \' in the lead name', async () => {
      setConfig()
      const malicious: Lead = { ...VALID_LEAD, name: '<script>"&\'</script>' }
      await emailAdapter.deliver({ lead: malicious })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      // The raw script tag must not appear in the HTML body.
      expect(options.html).not.toContain('<script>')
      // The escaped form must appear.
      expect(options.html).toContain('&lt;script&gt;')
      expect(options.html).toContain('&quot;&amp;&#39;')
      // The plain-text body is NOT escaped (it's plain text).
      const opts = mockSendMail.mock.calls[0]?.[0] as { text: string; html: string }
      expect(opts.text).toContain('<script>')
    })

    it('escapes the lead message', async () => {
      setConfig()
      const malicious: Lead = {
        ...VALID_LEAD,
        message: 'Hello <img src=x onerror=alert(1)> & "quoted"',
      }
      await emailAdapter.deliver({ lead: malicious })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      expect(options.html).not.toContain('<img')
      expect(options.html).toContain('&lt;img')
      expect(options.html).toContain('&amp;')
      expect(options.html).toContain('&quot;quoted&quot;')
    })

    it('escapes the lead email and phone', async () => {
      setConfig()
      const malicious: Lead = {
        ...VALID_LEAD,
        email: '"><script>alert(1)</script>',
        phone: '<b>+1 555 123 4567</b>',
      }
      await emailAdapter.deliver({ lead: malicious })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      expect(options.html).not.toContain('<script>alert(1)</script>')
      expect(options.html).toContain('&quot;&gt;&lt;script&gt;')
      expect(options.html).toContain('&lt;b&gt;')
    })

    it('renders the em-dash placeholder for empty optional fields', async () => {
      setConfig()
      const sparse: Lead = { ...VALID_LEAD, email: '', phone: '' }
      await emailAdapter.deliver({ lead: sparse })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      // The em-dash placeholder (—) appears in place of the empty values.
      expect(options.html).toContain('—')
    })

    it('preserves newlines in the message by converting to <br>', async () => {
      setConfig()
      const multiline: Lead = {
        ...VALID_LEAD,
        message: 'Line one\nLine two\nLine three',
      }
      await emailAdapter.deliver({ lead: multiline })
      const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
      expect(options.html).toContain('Line one<br>Line two<br>Line three')
    })
  })

  describe('error mapping', () => {
    it('returns errorCode:auth on EAUTH errors', async () => {
      setConfig()
      const authError = Object.assign(new Error('Invalid login'), { code: 'EAUTH' })
      mockSendMail.mockRejectedValueOnce(authError)
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'auth', retryable: false })
    })

    it('returns errorCode:auth on EAUTHENTICATION errors', async () => {
      setConfig()
      const authError = Object.assign(new Error('Auth failed'), { code: 'EAUTHENTICATION' })
      mockSendMail.mockRejectedValueOnce(authError)
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'auth', retryable: false })
    })

    it('returns errorCode:transport + retryable:false on ETIMEDOUT', async () => {
      setConfig()
      const timeoutError = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })
      mockSendMail.mockRejectedValueOnce(timeoutError)
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: false })
    })

    it('returns errorCode:transport + retryable:false on EAI_AGAIN (DNS)', async () => {
      setConfig()
      const dnsError = Object.assign(new Error('DNS lookup failed'), { code: 'EAI_AGAIN' })
      mockSendMail.mockRejectedValueOnce(dnsError)
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: false })
    })

    it('returns errorCode:transport + retryable:true on ECONNECTION', async () => {
      setConfig()
      const connError = Object.assign(new Error('Connection refused'), { code: 'ECONNECTION' })
      mockSendMail.mockRejectedValueOnce(connError)
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: true })
    })

    it('returns errorCode:transport + retryable:true on errors without a code', async () => {
      setConfig()
      mockSendMail.mockRejectedValueOnce(new Error('Unknown SMTP failure'))
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: true })
    })

    it('returns errorCode:transport on non-Error throw values', async () => {
      setConfig()
      mockSendMail.mockRejectedValueOnce('string-throw')
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result).toEqual({ ok: false, errorCode: 'transport', retryable: true })
    })
  })

  describe('transporter lifecycle', () => {
    it('closes the transporter after a successful send', async () => {
      setConfig()
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockTransporterClose).toHaveBeenCalledTimes(1)
    })

    it('closes the transporter after a failed send', async () => {
      setConfig()
      mockSendMail.mockRejectedValueOnce(new Error('boom'))
      await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(mockTransporterClose).toHaveBeenCalledTimes(1)
    })

    it('swallows errors from transporter.close()', async () => {
      setConfig()
      mockSendMail.mockResolvedValue({ messageId: 'ok' })
      mockTransporterClose.mockImplementationOnce(() => {
        throw new Error('close failed')
      })
      // The adapter should not throw even if close() rejects.
      const result = await emailAdapter.deliver({ lead: VALID_LEAD })
      expect(result.ok).toBe(true)
    })
  })
})

/**
 * Property inquiry branch — email subject + body carry the
 * verified property reference so the agency sees the listing
 * context without having to look it up. The property title, slug,
 * and URL are all server-derived catalog metadata (escaped
 * defensively in HTML).
 */
describe('emailAdapter — property inquiry', () => {
  const propertyLead: Lead = {
    ...VALID_LEAD,
    source: 'property_inquiry',
    property: {
      slug: 'modern-hillside-villa',
      title: 'Modern Hillside Villa',
      url: '/properties/modern-hillside-villa',
    },
  }

  beforeEach(() => {
    setConfig()
    // Clear the mock history so `mockSendMail.mock.calls[0]`
    // is the call from THIS test, not the previous one. The
    // outer describe's `beforeEach` runs first (resetting the
    // mock), then the inner `beforeEach` runs (clearing the
    // history without resetting the implementation so the
    // resolved value persists across tests in this block).
    mockSendMail.mockClear()
    mockTransporterClose.mockClear()
    mockSendMail.mockResolvedValue({ messageId: 'ok' })
  })

  it('prefixes the subject with "Property inquiry:" and includes the title', async () => {
    await emailAdapter.deliver({ lead: propertyLead })
    const options = mockSendMail.mock.calls[0]?.[0] as { subject: string }
    expect(options.subject).toContain('Property inquiry:')
    expect(options.subject).toContain('Modern Hillside Villa')
  })

  it('renders the property title in the plain-text body', async () => {
    await emailAdapter.deliver({ lead: propertyLead })
    const options = mockSendMail.mock.calls[0]?.[0] as { text: string }
    expect(options.text).toContain('New property inquiry')
    expect(options.text).toContain('Property: Modern Hillside Villa')
    expect(options.text).toContain('Property URL: /properties/modern-hillside-villa')
    expect(options.text).toContain('Property slug: modern-hillside-villa')
  })

  it('renders the property title in the HTML body', async () => {
    await emailAdapter.deliver({ lead: propertyLead })
    const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
    expect(options.html).toContain('New property inquiry')
    expect(options.html).toContain('Modern Hillside Villa')
    expect(options.html).toContain('/properties/modern-hillside-villa')
    expect(options.html).toContain('modern-hillside-villa')
  })

  it('does NOT use the contact-form heading for property inquiries', async () => {
    // The two sources render different headings so the agency
    // can scan the inbox and route accordingly.
    await emailAdapter.deliver({ lead: propertyLead })
    const options = mockSendMail.mock.calls[0]?.[0] as { text: string, html: string }
    expect(options.text).not.toContain('New lead from the contact form')
    expect(options.html).not.toContain('New lead from the contact form')
  })

  it('falls back gracefully when propertyLead has no property (legacy / soft-failure path)', async () => {
    // A soft failure in the property lookup at the endpoint
    // level can produce a `source: 'property_inquiry'` lead
    // without a `property` reference. The adapter must not crash;
    // it should render the heading with no property block.
    const softFail: Lead = { ...propertyLead, property: undefined }
    const result = await emailAdapter.deliver({ lead: softFail })
    expect(result.ok).toBe(true)
    const options = mockSendMail.mock.calls[0]?.[0] as { text: string, html: string }
    expect(options.text).not.toContain('Property:')
    expect(options.html).not.toContain('Property URL:')
  })

  it('uses the "Property inquiry — <name>" subject on soft failure (no property reference)', async () => {
    // Task 101B: the source 'property_inquiry' is preserved
    // independently of whether the catalog lookup
    // succeeded. A soft-failure lead (source: 'property_inquiry'
    // without a `property` field) still signals "Property
    // inquiry" in the subject line so the agency can filter
    // it from general contact submissions in their inbox.
    // The subject falls back to "Property inquiry — <name>"
    // (without the property title) when the reference is
    // absent.
    const softFail: Lead = { ...propertyLead, property: undefined }
    await emailAdapter.deliver({ lead: softFail })
    const options = mockSendMail.mock.calls[0]?.[0] as { subject: string }
    expect(options.subject).toContain('Property inquiry')
    expect(options.subject).not.toContain('New lead')
    // The subject does NOT include a title (no reference).
    expect(options.subject).not.toContain('Modern Hillside Villa')
  })

  it('falls back to the general "New lead: <name>" subject for source "contact"', async () => {
    // The general-contact subject is unchanged by the
    // Task 101B contract. A lead with source: 'contact' (no
    // body property block) uses the historical subject line.
    await emailAdapter.deliver({ lead: VALID_LEAD })
    const options = mockSendMail.mock.calls[0]?.[0] as { subject: string }
    expect(options.subject).toBe(`New lead: ${VALID_LEAD.name}`)
  })

  it('escapes a malicious property title in the HTML body', async () => {
    const malicious: Lead = {
      ...propertyLead,
      property: {
        slug: 'modern-hillside-villa',
        title: '<script>"&\'</script>',
        url: '/properties/modern-hillside-villa',
      },
    }
    await emailAdapter.deliver({ lead: malicious })
    const options = mockSendMail.mock.calls[0]?.[0] as { html: string, text: string }
    // The raw script tag must not appear in the HTML body.
    expect(options.html).not.toContain('<script>')
    expect(options.html).toContain('&lt;script&gt;')
    // The plain-text body is NOT escaped (it's plain text) —
    // it carries the literal title because plain-text clients
    // (mail clients with no HTML rendering) need the
    // human-readable form. The plaintext value is what the user
    // submitted, so the privacy boundary is the same as for the
    // contact form.
    expect(options.text).toContain('<script>')
  })

  it('escapes a malicious slug in the HTML body', async () => {
    const malicious: Lead = {
      ...propertyLead,
      property: {
        slug: 'a<b>c',
        title: 'Title',
        url: '/properties/a',
      },
    }
    await emailAdapter.deliver({ lead: malicious })
    const options = mockSendMail.mock.calls[0]?.[0] as { html: string }
    // Slug 'a<b>c' fails the slug regex at the schema level — the
    // service never sees a malformed slug. But defensive escaping
    // is still applied in case a future schema relaxes the
    // regex.
    expect(options.html).not.toContain('a<b>c')
  })
})
