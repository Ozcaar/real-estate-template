import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lead } from '../../../../app/features/leads/types/lead.types'
import { logAdapter } from './log'

/**
 * Tests for the `log` delivery adapter.
 *
 * The log adapter writes a single `console.info` line per accepted
 * lead. The line carries only the lead id, the source, the
 * field-presence booleans, and the message length. It must never
 * log the lead's PII (name, email, phone, message content).
 */

const lead: Lead = {
  id: '00000000-0000-0000-0000-000000000001',
  receivedAt: '2026-01-01T00:00:00.000Z',
  source: 'contact',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+52 81 1234 5678',
  message: 'I would like more information about the hillside villa.',
  locale: 'en',
}

describe('logAdapter', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('has id "log"', () => {
    expect(logAdapter.id).toBe('log')
  })

  it('returns ok:true after logging', async () => {
    const result = await logAdapter.deliver({ lead })
    expect(result).toEqual({ ok: true })
  })

  it('writes exactly one console.info line per lead', async () => {
    await logAdapter.deliver({ lead })
    expect(infoSpy).toHaveBeenCalledTimes(1)
  })

  it('logs the lead id, source, and field-presence booleans', async () => {
    await logAdapter.deliver({ lead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('id=00000000-0000-0000-0000-000000000001')
    expect(line).toContain('source=contact')
    expect(line).toContain('hasName=true')
    expect(line).toContain('hasEmail=true')
    expect(line).toContain('hasPhone=true')
    expect(line).toContain(`messageLength=${lead.message.length}`)
  })

  it('never logs PII (name, email, phone, message content)', async () => {
    await logAdapter.deliver({ lead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).not.toContain('Jane Doe')
    expect(line).not.toContain('jane@example.com')
    expect(line).not.toContain('+52 81 1234 5678')
    expect(line).not.toContain('hillside villa')
  })

  it('logs hasName=false when the name is empty', async () => {
    await logAdapter.deliver({ lead: { ...lead, name: '' } })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('hasName=false')
  })

  it('logs hasEmail=false when the email is empty', async () => {
    await logAdapter.deliver({ lead: { ...lead, email: '' } })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('hasEmail=false')
  })

  it('logs hasPhone=false when the phone is empty', async () => {
    await logAdapter.deliver({ lead: { ...lead, phone: '' } })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('hasPhone=false')
  })

  it('logs messageLength=0 when the message is empty', async () => {
    await logAdapter.deliver({ lead: { ...lead, message: '' } })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('messageLength=0')
  })
})

/**
 * Property inquiry branch — log line includes the property slug +
 * title (server-derived catalog metadata, not PII) so an operator
 * can filter the log stream by listing.
 */
describe('logAdapter — property inquiry', () => {
  const propertyLead: Lead = {
    id: '00000000-0000-0000-0000-000000000010',
    receivedAt: '2026-01-01T00:00:00.000Z',
    source: 'property_inquiry',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+52 81 1234 5678',
    message: 'I would like more information about the hillside villa.',
    locale: 'en',
    property: {
      slug: 'modern-hillside-villa',
      title: 'Modern Hillside Villa',
      url: '/properties/modern-hillside-villa',
    },
  }

  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('logs source="property_inquiry" for property inquiries', async () => {
    await logAdapter.deliver({ lead: propertyLead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('source=property_inquiry')
  })

  it('logs the property slug in the log line', async () => {
    await logAdapter.deliver({ lead: propertyLead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('propertySlug=modern-hillside-villa')
  })

  it('logs the property title in the log line', async () => {
    await logAdapter.deliver({ lead: propertyLead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('propertyTitle="Modern Hillside Villa"')
  })

  it('does not log the property URL (the slug is enough for filtering)', async () => {
    // The log line carries the slug + title (the two fields
    // that uniquely identify a listing for log filtering). The
    // URL is intentionally omitted because the catalog can be
    // joined on the slug and the URL is redundant noise.
    await logAdapter.deliver({ lead: propertyLead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).not.toContain('/properties/modern-hillside-villa')
  })

  it('does not include propertySlug / propertyTitle for general contact submissions', async () => {
    await logAdapter.deliver({ lead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).not.toContain('propertySlug=')
    expect(line).not.toContain('propertyTitle=')
  })

  it('still does not log PII on a property inquiry', async () => {
    await logAdapter.deliver({ lead: propertyLead })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).not.toContain('Jane Doe')
    expect(line).not.toContain('jane@example.com')
    expect(line).not.toContain('+52 81 1234 5678')
    expect(line).not.toContain('hillside villa')
  })

  it('escapes a title with double quotes so the log line stays well-formed', async () => {
    await logAdapter.deliver({
      lead: {
        ...propertyLead,
        property: { slug: 'a', title: 'Title "with" quotes', url: '/properties/a' },
      },
    })
    const line = infoSpy.mock.calls[0]?.[0] as string
    expect(line).toContain('propertyTitle="Title \\"with\\" quotes"')
  })
})
