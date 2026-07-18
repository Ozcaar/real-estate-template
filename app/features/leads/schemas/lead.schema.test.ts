import { describe, expect, it } from 'vitest'
import { leadInputRefined, leadInputSchema } from './lead.schema'

/**
 * Tests for the public lead-capture input contract.
 *
 * Covers every documented field rule plus the cross-field contact
 * channel requirement. The schema is the single source of truth for
 * both the client form (UX feedback) and the server endpoint (trust
 * boundary), so the rules here must stay in lock-step with the
 * runtime behavior in `server/services/leads/lead.service.ts`.
 */

const validBase = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '',
  message: 'I would like more information about the hillside villa.',
  website: '',
  locale: 'en',
}

describe('leadInputSchema — name', () => {
  it('accepts a 2-character name', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: 'Jo' })
    expect(result.success).toBe(true)
  })

  it('rejects a 1-character name with name_too_short', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: 'J' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'name')
    expect(issue?.message).toBe('name_too_short')
  })

  it('rejects a whitespace-only name after trim', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: '   ' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'name')
    expect(issue?.message).toBe('name_too_short')
  })

  it('accepts a 120-character name', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: 'a'.repeat(120) })
    expect(result.success).toBe(true)
  })

  it('rejects a 121-character name with name_too_long', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: 'a'.repeat(121) })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'name')
    expect(issue?.message).toBe('name_too_long')
  })

  it('trims surrounding whitespace before validation', () => {
    const result = leadInputSchema.safeParse({ ...validBase, name: '  Jane Doe  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Jane Doe')
  })
})

describe('leadInputSchema — email', () => {
  it('accepts a well-formed email', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: 'jane@example.com' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty email (channel is optional)', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email with email_invalid', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: 'not-an-email' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'email')
    expect(issue?.message).toBe('email_invalid')
  })

  it('rejects an email without a domain', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: 'jane@' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'email')
    expect(issue?.message).toBe('email_invalid')
  })

  it('rejects an email longer than 254 characters with email_too_long', () => {
    const longLocal = 'a'.repeat(250)
    const result = leadInputSchema.safeParse({ ...validBase, email: `${longLocal}@x.io` })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'email')
    expect(issue?.message).toBe('email_too_long')
  })

  it('trims surrounding whitespace from the email before validation', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '  jane@example.com  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('jane@example.com')
  })
})

describe('leadInputSchema — phone', () => {
  it('accepts a Mexican phone with leading +', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '+52 81 1234 5678' })
    expect(result.success).toBe(true)
  })

  it('accepts a US phone with dashes', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '1-800-555-1234' })
    expect(result.success).toBe(true)
  })

  it('accepts a Brazilian phone with parentheses', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '(11) 91234-5678' })
    expect(result.success).toBe(true)
  })

  it('accepts a plain digit string of 6–32 characters', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '1234567890' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty phone (channel is optional)', () => {
    const result = leadInputSchema.safeParse({ ...validBase, phone: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a 3-character phone with phone_invalid', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '123' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'phone')
    expect(issue?.message).toBe('phone_invalid')
  })

  it('rejects a phone with letters with phone_invalid', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: 'abc12345' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'phone')
    expect(issue?.message).toBe('phone_invalid')
  })

  it('rejects a 33-character phone with phone_too_long', () => {
    const result = leadInputSchema.safeParse({ ...validBase, email: '', phone: '1'.repeat(33) })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'phone')
    expect(issue?.message).toBe('phone_too_long')
  })
})

describe('leadInputSchema — message', () => {
  it('accepts a 10-character message', () => {
    const result = leadInputSchema.safeParse({ ...validBase, message: '1234567890' })
    expect(result.success).toBe(true)
  })

  it('rejects a 9-character message with message_too_short', () => {
    const result = leadInputSchema.safeParse({ ...validBase, message: '123456789' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'message')
    expect(issue?.message).toBe('message_too_short')
  })

  it('rejects a whitespace-only 10-character message after trim', () => {
    const result = leadInputSchema.safeParse({ ...validBase, message: '          ' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'message')
    expect(issue?.message).toBe('message_too_short')
  })

  it('accepts a 4000-character message', () => {
    const result = leadInputSchema.safeParse({ ...validBase, message: 'a'.repeat(4000) })
    expect(result.success).toBe(true)
  })

  it('rejects a 4001-character message with message_too_long', () => {
    const result = leadInputSchema.safeParse({ ...validBase, message: 'a'.repeat(4001) })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'message')
    expect(issue?.message).toBe('message_too_long')
  })
})

describe('leadInputSchema — honeypot (website)', () => {
  it('accepts an empty website', () => {
    const result = leadInputSchema.safeParse({ ...validBase, website: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a non-empty website with honeypot', () => {
    const result = leadInputSchema.safeParse({ ...validBase, website: 'http://bot.example.com' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'website')
    expect(issue?.message).toBe('honeypot')
  })
})

describe('leadInputSchema — locale', () => {
  it('accepts a 2-character locale', () => {
    const result = leadInputSchema.safeParse({ ...validBase, locale: 'en' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty locale (falls back to the request locale)', () => {
    const result = leadInputSchema.safeParse({ ...validBase, locale: '' })
    expect(result.success).toBe(true)
  })

  it('accepts a 12-character locale', () => {
    const result = leadInputSchema.safeParse({ ...validBase, locale: 'zh-Hant-HK' })
    // 11 chars; bump to 12 to test the max
    const result2 = leadInputSchema.safeParse({ ...validBase, locale: 'zh-Hant-HKx' })
    expect(result.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('rejects a 1-character locale with locale_invalid', () => {
    const result = leadInputSchema.safeParse({ ...validBase, locale: 'e' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'locale')
    expect(issue?.message).toBe('locale_invalid')
  })

  it('rejects a 13-character locale with locale_invalid', () => {
    const result = leadInputSchema.safeParse({ ...validBase, locale: 'a'.repeat(13) })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.path[0] === 'locale')
    expect(issue?.message).toBe('locale_invalid')
  })
})

describe('leadInputRefined — cross-field contact channel', () => {
  it('accepts a payload with only an email', () => {
    const result = leadInputRefined.safeParse({ ...validBase, email: 'jane@example.com', phone: '' })
    expect(result.success).toBe(true)
  })

  it('accepts a payload with only a phone', () => {
    const result = leadInputRefined.safeParse({ ...validBase, email: '', phone: '+52 81 1234 5678' })
    expect(result.success).toBe(true)
  })

  it('accepts a payload with both email and phone', () => {
    const result = leadInputRefined.safeParse({ ...validBase, email: 'jane@example.com', phone: '+52 81 1234 5678' })
    expect(result.success).toBe(true)
  })

  it('rejects a payload with neither email nor phone with contact_channel_required on path email', () => {
    const result = leadInputRefined.safeParse({ ...validBase, email: '', phone: '' })
    expect(result.success).toBe(false)
    const issue = result.success ? null : result.error.issues.find(i => i.message === 'contact_channel_required')
    expect(issue).toBeDefined()
    expect(issue?.path[0]).toBe('email')
  })
})

describe('leadInputRefined — full happy path', () => {
  it('accepts the canonical valid payload', () => {
    const result = leadInputRefined.safeParse(validBase)
    expect(result.success).toBe(true)
  })
})
