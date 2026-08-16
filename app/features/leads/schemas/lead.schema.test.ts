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

/**
 * Property inquiry schema branch — `property.slug`.
 *
 * The `/properties/[slug]` inquiry form sends a
 * `property: { slug }` block alongside the user-typed fields.
 * The slug is the ONLY client-supplied property field — title,
 * price, location, and any other metadata are NEVER trusted as
 * authoritative and are always server-derived from the catalog
 * lookup. The schema validates the slug's format (URL-safe
 * lowercase + digits + dashes, 1–120 characters) so a malformed
 * slug is rejected at the boundary.
 *
 * `property` is optional; the contact form omits it entirely. A
 * present `property` block must carry a valid `slug`; title /
 * price / any other field are stripped by the schema (the parsed
 * type only exposes `slug`, not a record).
 */
describe('leadInputSchema — property.slug (property inquiry branch)', () => {
  it('accepts a well-formed slug', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: 'modern-hillside-villa' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.property).toEqual({ slug: 'modern-hillside-villa' })
    }
  })

  it('accepts a single-character slug', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: 'a' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a 120-character slug', () => {
    const slug = 'a'.repeat(120)
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug },
    })
    expect(result.success).toBe(true)
  })

  it('trims surrounding whitespace from the slug', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: '  modern-hillside-villa  ' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.property?.slug).toBe('modern-hillside-villa')
    }
  })

  it('accepts a payload without a property block (general contact form)', () => {
    const result = leadInputSchema.safeParse(validBase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.property).toBeUndefined()
    }
  })

  it('rejects a 121-character slug with property_slug_too_long', () => {
    const slug = 'a'.repeat(121)
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const slugIssue = result.error.issues.find(
        i => i.path[0] === 'property' && i.path[1] === 'slug',
      )
      expect(slugIssue?.message).toBe('property_slug_too_long')
    }
  })

  it('rejects an empty slug with property_slug_required', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: '' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const slugIssue = result.error.issues.find(
        i => i.path[0] === 'property' && i.path[1] === 'slug',
      )
      expect(slugIssue?.message).toBe('property_slug_required')
    }
  })

  it('rejects a whitespace-only slug (trim yields empty)', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: '   ' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with uppercase characters', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: 'Modern-Hillside-Villa' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const slugIssue = result.error.issues.find(
        i => i.path[0] === 'property' && i.path[1] === 'slug',
      )
      expect(slugIssue?.message).toBe('property_slug_invalid')
    }
  })

  it('rejects a slug with underscores (only lowercase, digits, and dashes allowed)', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: 'modern_hillside_villa' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with spaces', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: 'modern hillside villa' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with path-traversal characters', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: '../../etc/passwd' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a slug with HTML / script characters', () => {
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: { slug: '<script>alert(1)</script>' },
    })
    expect(result.success).toBe(false)
  })

  it('strips client-supplied title / price / location (only slug is preserved)', () => {
    // Client tries to forge a "different" title and price in the
    // property block. The schema accepts the block but only
    // preserves `slug`; the parsed type exposes only `slug`, so
    // title / price / location cannot reach the service.
    const result = leadInputSchema.safeParse({
      ...validBase,
      property: {
        slug: 'modern-hillside-villa',
        title: 'FORGED TITLE',
        price: 1,
        location: 'FORGED LOCATION',
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.property).toEqual({ slug: 'modern-hillside-villa' })
      expect(result.data.property).not.toHaveProperty('title')
      expect(result.data.property).not.toHaveProperty('price')
      expect(result.data.property).not.toHaveProperty('location')
    }
  })
})
