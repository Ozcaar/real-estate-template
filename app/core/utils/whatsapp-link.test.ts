import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink } from './whatsapp-link'

/**
 * Tests for the `buildWhatsAppLink` helper.
 *
 * The agency config stores the raw, human-formatted WhatsApp number
 * in `agency.contact.whatsapp`. This helper strips every non-digit
 * character (spaces, dashes, parentheses, leading `+`, etc.) and
 * prefixes the standard `https://wa.me/` so the result can be opened
 * in a new tab.
 *
 * Edge cases covered:
 * - empty / null / undefined input → null
 * - leading `+` is stripped
 * - spaces, dashes, parentheses, dots are stripped
 * - non-digit-only strings (no digits) → null
 * - numeric strings pass through unchanged
 * - mixed alphanumeric strings keep only the digits
 */

describe('buildWhatsAppLink', () => {
  it('returns null for undefined', () => {
    expect(buildWhatsAppLink(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(buildWhatsAppLink(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(buildWhatsAppLink('')).toBeNull()
  })

  it('returns null for a whitespace-only string (no digits after strip)', () => {
    expect(buildWhatsAppLink('   ')).toBeNull()
  })

  it('returns null for a string with no digits at all', () => {
    expect(buildWhatsAppLink('not-a-number')).toBeNull()
  })

  it('returns null for a string of only non-digit characters (dashes, spaces, parens, plus)', () => {
    expect(buildWhatsAppLink('+ -- () ')).toBeNull()
  })

  it('strips a leading + from a Mexican-style number', () => {
    // '+52 81 1234 5678' = 12 digits after stripping the leading '+'
    // and the spaces: 52 + 81 + 1234 + 5678 = 528112345678
    expect(buildWhatsAppLink('+52 81 1234 5678')).toBe('https://wa.me/528112345678')
  })

  it('strips a leading + with no spaces', () => {
    expect(buildWhatsAppLink('+18005551234')).toBe('https://wa.me/18005551234')
  })

  it('strips spaces and dashes from a US-style number', () => {
    expect(buildWhatsAppLink('1-800-555-1234')).toBe('https://wa.me/18005551234')
  })

  it('strips parentheses, spaces, and dashes from a US-style number', () => {
    expect(buildWhatsAppLink('(1) 800-555-1234')).toBe('https://wa.me/18005551234')
  })

  it('strips dots from a dotted number format', () => {
    expect(buildWhatsAppLink('1.800.555.1234')).toBe('https://wa.me/18005551234')
  })

  it('passes a digits-only number through unchanged', () => {
    expect(buildWhatsAppLink('18005551234')).toBe('https://wa.me/18005551234')
  })

  it('keeps only the digits in a mixed alphanumeric string', () => {
    // 'Tel: 1-800-555-1234 ext. 42' → '18005551234' + '42' = '1800555123442'
    expect(buildWhatsAppLink('Tel: 1-800-555-1234 ext. 42')).toBe('https://wa.me/1800555123442')
  })

  it('handles a very short number (single digit)', () => {
    expect(buildWhatsAppLink('5')).toBe('https://wa.me/5')
  })

  it('handles a very short number (two digits)', () => {
    expect(buildWhatsAppLink('52')).toBe('https://wa.me/52')
  })

  it('handles a long international number (15 digits, E.164 max)', () => {
    expect(buildWhatsAppLink('+123456789012345')).toBe('https://wa.me/123456789012345')
  })

  it('handles a long number beyond E.164 (the helper does not bound the length)', () => {
    // The helper is intentionally non-validating: it strips and
    // prefixes only. The page layer (or a future Zod schema) is
    // responsible for length validation.
    expect(buildWhatsAppLink('12345678901234567890')).toBe('https://wa.me/12345678901234567890')
  })

  it('strips internal dashes and spaces from an already-numeric-looking string', () => {
    expect(buildWhatsAppLink('1 8 0 0 5 5 5 1 2 3 4')).toBe('https://wa.me/18005551234')
  })

  it('does not include any trailing or leading whitespace in the result', () => {
    const link = buildWhatsAppLink('+1 800 555 1234')
    expect(link).toBe('https://wa.me/18005551234')
    expect(link?.startsWith('https://wa.me/')).toBe(true)
    expect(link?.endsWith(' ')).toBe(false)
  })

  it('always returns the exact prefix https://wa.me/', () => {
    const link = buildWhatsAppLink('+52 81 1234 5678')
    expect(link?.startsWith('https://wa.me/')).toBe(true)
    // No trailing slash beyond the digits, no query string.
    expect(link).not.toMatch(/\/$/)
    expect(link).not.toMatch(/\?/)
  })

  it('returns null for the empty string explicitly (not undefined)', () => {
    const result = buildWhatsAppLink('')
    expect(result).toBeNull()
    expect(result).not.toBeUndefined()
  })
})
