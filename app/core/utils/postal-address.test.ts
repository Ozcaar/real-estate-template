import { describe, expect, it } from 'vitest'
import type { AgencyConfig } from '~/types/agency.types'
import { agencyPostalAddress } from './postal-address'

/**
 * Tests for the `agencyPostalAddress` JSON-LD builder.
 *
 * Returns the plain `contact.address` string when the agency has no
 * `structuredAddress` companion or every field is empty / whitespace
 * (the legacy / unmigrated agency contract). When at least one field
 * is non-empty, returns a `PostalAddress` object with only the
 * non-empty fields. Field names match schema.org exactly.
 */

/**
 * Minimal AgencyConfig factory so the test inputs stay focused on
 * the relevant slice. `contact.address` is the legacy free-text
 * fallback; `contact.structuredAddress` is the optional companion.
 */
function makeAgency(overrides: {
  address?: string
  structuredAddress?: AgencyConfig['contact']['structuredAddress']
}): AgencyConfig {
  return {
    id: 'test',
    name: 'Test Agency',
    logo: '/images/logo.svg',
    theme: 'default',
    defaultLocale: 'en',
    availableLocales: ['en'],
    currency: 'USD',
    measurementUnit: 'metric',
    contact: {
      phone: '+1-800-555-1234',
      whatsapp: '+1-800-555-1234',
      email: 'test@example.com',
      address: overrides.address ?? 'Legacy Free-Text Address',
      structuredAddress: overrides.structuredAddress,
    },
    social: {},
    modules: {
      properties: true,
      developments: true,
      agents: true,
      blog: false,
      testimonials: true,
      contact: true,
    },
    leads: { enabled: false },
  }
}

describe('agencyPostalAddress — legacy / unmigrated', () => {
  it('returns the free-text address when structuredAddress is undefined', () => {
    const agency = makeAgency({ structuredAddress: undefined })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })

  it('returns the free-text address when structuredAddress is an empty object', () => {
    const agency = makeAgency({ structuredAddress: {} })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })

  it('returns the free-text address when every field is an empty string', () => {
    const agency = makeAgency({
      structuredAddress: {
        streetAddress: '',
        addressLocality: '',
        addressRegion: '',
        postalCode: '',
        addressCountry: '',
      },
    })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })

  it('returns the free-text address when every field is whitespace-only', () => {
    const agency = makeAgency({
      structuredAddress: {
        streetAddress: '   ',
        addressLocality: '\t',
        addressRegion: ' \n ',
        postalCode: '  ',
        addressCountry: '\t\t',
      },
    })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })

  it('returns the free-text address when every field is missing (only the object is present)', () => {
    const agency = makeAgency({ structuredAddress: { streetAddress: '' } })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })
})

describe('agencyPostalAddress — migrated / partial fields', () => {
  it('emits a PostalAddress with a single non-empty field (streetAddress only)', () => {
    const agency = makeAgency({
      structuredAddress: { streetAddress: '123 Main Street' },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main Street',
    })
  })

  it('emits a PostalAddress with a single non-empty field (addressLocality only)', () => {
    const agency = makeAgency({
      structuredAddress: { addressLocality: 'Anytown' },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Anytown',
    })
  })

  it('emits a PostalAddress with a single non-empty field (addressCountry only)', () => {
    const agency = makeAgency({
      structuredAddress: { addressCountry: 'USA' },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'USA',
    })
  })

  it('emits a PostalAddress with addressRegion only (postal code not invented)', () => {
    const agency = makeAgency({
      structuredAddress: { addressRegion: 'CDMX' },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      addressRegion: 'CDMX',
    })
  })

  it('emits a PostalAddress with postalCode only', () => {
    const agency = makeAgency({
      structuredAddress: { postalCode: '64000' },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      postalCode: '64000',
    })
  })

  it('emits a PostalAddress with all five non-empty fields', () => {
    const agency = makeAgency({
      structuredAddress: {
        streetAddress: '123 Main Street',
        addressLocality: 'Anytown',
        addressRegion: 'CA',
        postalCode: '90210',
        addressCountry: 'USA',
      },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main Street',
      addressLocality: 'Anytown',
      addressRegion: 'CA',
      postalCode: '90210',
      addressCountry: 'USA',
    })
  })

  it('omits empty fields from a partial structuredAddress', () => {
    const agency = makeAgency({
      structuredAddress: {
        streetAddress: '123 Main Street',
        addressLocality: 'Anytown',
        addressRegion: '',
        postalCode: '  ',
        addressCountry: 'USA',
      },
    })
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main Street',
      addressLocality: 'Anytown',
      addressCountry: 'USA',
    })
  })

  it('trims whitespace from a single space-padded field', () => {
    const agency = makeAgency({
      structuredAddress: { streetAddress: '  123 Main Street  ' },
    })
    // The helper checks `trim() !== ''` to decide whether to include
    // the field, but stores the original (untrimmed) value. This
    // matches the documented behavior: presence is decided by the
    // trimmed value, the value itself is preserved as supplied.
    expect(agencyPostalAddress(agency)).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '  123 Main Street  ',
    })
  })

  it('does not include undefined fields in the returned object', () => {
    const agency = makeAgency({
      structuredAddress: { streetAddress: '123 Main Street' },
    })
    const result = agencyPostalAddress(agency)
    expect(result).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Main Street',
    })
    expect(Object.keys(result as Record<string, unknown>)).toEqual([
      '@type',
      'streetAddress',
    ])
  })

  it('always sets @type to "PostalAddress" when at least one field is non-empty', () => {
    const agency = makeAgency({
      structuredAddress: { addressCountry: 'USA' },
    })
    const result = agencyPostalAddress(agency)
    expect((result as { '@type': string })['@type']).toBe('PostalAddress')
  })
})

describe('agencyPostalAddress — fallback edge cases', () => {
  it('returns the free-text address when structuredAddress is an explicit undefined field', () => {
    const agency = makeAgency({ structuredAddress: undefined })
    expect(agencyPostalAddress(agency)).toBe('Legacy Free-Text Address')
  })

  it('returns the custom free-text address (overridden via the factory)', () => {
    const agency = makeAgency({
      address: 'Custom Visible Address',
      structuredAddress: undefined,
    })
    expect(agencyPostalAddress(agency)).toBe('Custom Visible Address')
  })

  it('falls back to the free-text address when every field is whitespace, even with a non-empty object', () => {
    const agency = makeAgency({
      address: '123 Main St',
      structuredAddress: {
        streetAddress: '   ',
        addressLocality: '\n',
        addressRegion: '\t',
        postalCode: ' \r ',
        addressCountry: '',
      },
    })
    expect(agencyPostalAddress(agency)).toBe('123 Main St')
  })
})
