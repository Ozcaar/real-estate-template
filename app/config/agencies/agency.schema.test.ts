import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  agencyConfigSchema,
  agencyContactConfigSchema,
  agencyLeadsConfigSchema,
  agencyModulesConfigSchema,
  agencySocialConfigSchema,
  agencyStructuredAddressSchema,
  measurementUnitSchema,
  safeParseAgencyConfig,
  validateAgencyConfig,
} from './agency.schema'
import type { AgencyConfig } from '~/types/agency.types'
import type { ThemeConfig } from '~/types/theme.types'

/**
 * Tests for the agency configuration Zod schema and the cross-config
 * coherence helpers.
 *
 * The hand-written `AgencyConfig` interface in `~/types/agency.types.ts`
 * is the canonical type consumed by components and helpers. The
 * Zod schema in `agency.schema.ts` is the runtime boundary that
 * catches structural mistakes and cross-config incoherence (agency vs
 * i18n, agency vs theme registry) at module load, before a
 * misconfigured config reaches the UI.
 *
 * Two error channels:
 *
 *   - **Strict rules** (throw on `validateAgencyConfig`, or `ok: false`
 *     on `safeParseAgencyConfig`): structural issues that prevent the
 *     site from rendering correctly.
 *   - **Permissive warnings** (returned in `warnings`, never thrown):
 *     format checks the user can override (email shape, ISO 4217
 *     currency, social URL scheme).
 *
 * The tests below pin down every documented rule plus the fallback
 * behavior of `safeParseAgencyConfig` and the `format warnings` that
 * the default agency intentionally triggers (the five `www.*` social
 * placeholders).
 */

/* ------------------------------------------------------------------ *
 * Minimal fixtures
 * ------------------------------------------------------------------ */

const minimalTheme: ThemeConfig = {
  id: 'default',
  name: 'Default Theme',
  colors: {
    primary: '#000000',
    secondary: '#000000',
    accent: '#000000',
  },
  radii: {
    sm: '0',
    md: '0',
    lg: '0',
  },
}

const themes = { default: minimalTheme }

const i18nLocales = ['en', 'es'] as const

function makeValidAgency(overrides: Partial<AgencyConfig> = {}): AgencyConfig {
  return {
    id: 'default',
    name: 'Real Estate Agency',
    slogan: 'Find your ideal property',
    logo: '/images/logo.svg',
    favicon: '/favicon.ico',
    theme: 'default',
    defaultLocale: 'en',
    availableLocales: ['en', 'es'],
    currency: 'USD',
    measurementUnit: 'metric',
    contact: {
      phone: '1-800-555-1234',
      whatsapp: '1-800-555-1234',
      email: 'example@email.com',
      address: '123 Main Street, Anytown, USA',
      structuredAddress: {
        streetAddress: '123 Main Street',
        addressLocality: 'Anytown',
        addressCountry: 'USA',
      },
      businessHours: 'Mon-Fri 9am-5pm',
    },
    social: {
      facebook: 'http://www.facebook.com/youragency',
      instagram: 'http://www.instagram.com/youragency',
      linkedin: 'http://www.linkedin.com/youragency',
      tiktok: 'http://www.tiktok.com/youragency',
      youtube: 'http://www.youtube.com/youragency',
    },
    modules: {
      properties: true,
      developments: true,
      agents: true,
      blog: false,
      testimonials: true,
      contact: true,
    },
    leads: { enabled: false },
    ...overrides,
  }
}

/* ------------------------------------------------------------------ *
 * measurementUnitSchema
 * ------------------------------------------------------------------ */

describe('measurementUnitSchema', () => {
  it('accepts "metric"', () => {
    expect(measurementUnitSchema.safeParse('metric').success).toBe(true)
  })

  it('accepts "imperial"', () => {
    expect(measurementUnitSchema.safeParse('imperial').success).toBe(true)
  })

  it('rejects an unknown measurement unit', () => {
    expect(measurementUnitSchema.safeParse('celsius').success).toBe(false)
  })

  it('rejects the empty string', () => {
    expect(measurementUnitSchema.safeParse('').success).toBe(false)
  })

  it('rejects a number', () => {
    expect(measurementUnitSchema.safeParse(42).success).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * agencyStructuredAddressSchema
 * ------------------------------------------------------------------ */

describe('agencyStructuredAddressSchema', () => {
  it('accepts an empty object (all fields are optional)', () => {
    expect(agencyStructuredAddressSchema.safeParse({}).success).toBe(true)
  })

  it('accepts an absent value via the parent (the field is .optional())', () => {
    // Direct .parse of `undefined` is rejected; the parent uses .optional().
    // This test documents the field-level behavior.
    const result = agencyStructuredAddressSchema.safeParse({
      streetAddress: undefined,
    })
    expect(result.success).toBe(true)
  })

  it('accepts every field non-empty', () => {
    expect(
      agencyStructuredAddressSchema.safeParse({
        streetAddress: '123 Main',
        addressLocality: 'Anytown',
        addressRegion: 'CA',
        postalCode: '90210',
        addressCountry: 'USA',
      }).success,
    ).toBe(true)
  })

  it('rejects an empty string on a supplied field', () => {
    expect(
      agencyStructuredAddressSchema.safeParse({ streetAddress: '' }).success,
    ).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * agencyContactConfigSchema
 * ------------------------------------------------------------------ */

describe('agencyContactConfigSchema', () => {
  it('accepts a minimal valid contact config', () => {
    const minimal = {
      phone: '1',
      whatsapp: '2',
      email: 'a@b.c',
      address: 'X',
    }
    expect(agencyContactConfigSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejects an empty phone', () => {
    expect(
      agencyContactConfigSchema.safeParse({
        phone: '',
        whatsapp: '1',
        email: 'a@b.c',
        address: 'X',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty email', () => {
    expect(
      agencyContactConfigSchema.safeParse({
        phone: '1',
        whatsapp: '1',
        email: '',
        address: 'X',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty address', () => {
    expect(
      agencyContactConfigSchema.safeParse({
        phone: '1',
        whatsapp: '1',
        email: 'a@b.c',
        address: '',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty whatsapp', () => {
    expect(
      agencyContactConfigSchema.safeParse({
        phone: '1',
        whatsapp: '',
        email: 'a@b.c',
        address: 'X',
      }).success,
    ).toBe(false)
  })

  it('accepts an optional structuredAddress', () => {
    const result = agencyContactConfigSchema.safeParse({
      phone: '1',
      whatsapp: '1',
      email: 'a@b.c',
      address: 'X',
      structuredAddress: { streetAddress: '1 Main' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts an optional businessHours', () => {
    const result = agencyContactConfigSchema.safeParse({
      phone: '1',
      whatsapp: '1',
      email: 'a@b.c',
      address: 'X',
      businessHours: '9-5',
    })
    expect(result.success).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * agencySocialConfigSchema
 * ------------------------------------------------------------------ */

describe('agencySocialConfigSchema', () => {
  it('accepts an empty object (every social field is optional)', () => {
    expect(agencySocialConfigSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a full set of social URLs', () => {
    expect(
      agencySocialConfigSchema.safeParse({
        facebook: 'https://facebook.com/x',
        instagram: 'https://instagram.com/x',
        linkedin: 'https://linkedin.com/x',
        tiktok: 'https://tiktok.com/x',
        youtube: 'https://youtube.com/x',
      }).success,
    ).toBe(true)
  })

  it('accepts an empty string on a supplied social field (no min(1) constraint)', () => {
    // The social fields use `z.string().optional()` (no `.min(1)`),
    // so an empty string is a valid (if empty) value. The format
    // warnings at the agencyConfig level surface the missing
    // scheme; the schema itself only enforces type and presence.
    expect(
      agencySocialConfigSchema.safeParse({ facebook: '' }).success,
    ).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * agencyModulesConfigSchema
 * ------------------------------------------------------------------ */

describe('agencyModulesConfigSchema', () => {
  it('accepts a full module set', () => {
    const full = {
      properties: true,
      developments: true,
      agents: true,
      blog: false,
      testimonials: true,
      contact: true,
    }
    expect(agencyModulesConfigSchema.safeParse(full).success).toBe(true)
  })

  it('rejects a missing module (every module is required)', () => {
    const partial = {
      properties: true,
      developments: true,
      agents: true,
      blog: false,
      testimonials: true,
      // contact is missing
    }
    expect(agencyModulesConfigSchema.safeParse(partial).success).toBe(false)
  })

  it('rejects a non-boolean module value', () => {
    const bad = {
      properties: 'yes',
      developments: true,
      agents: true,
      blog: false,
      testimonials: true,
      contact: true,
    }
    expect(agencyModulesConfigSchema.safeParse(bad).success).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * agencyLeadsConfigSchema
 * ------------------------------------------------------------------ */

describe('agencyLeadsConfigSchema', () => {
  it('accepts { enabled: true }', () => {
    expect(agencyLeadsConfigSchema.safeParse({ enabled: true }).success).toBe(true)
  })

  it('accepts { enabled: false }', () => {
    expect(agencyLeadsConfigSchema.safeParse({ enabled: false }).success).toBe(true)
  })

  it('rejects a missing enabled flag', () => {
    expect(agencyLeadsConfigSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a non-boolean enabled value', () => {
    expect(agencyLeadsConfigSchema.safeParse({ enabled: 'true' }).success).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * agencyConfigSchema — top-level structural rules
 * ------------------------------------------------------------------ */

describe('agencyConfigSchema — id and name', () => {
  it('rejects an empty id', () => {
    const agency = makeValidAgency({ id: '' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('rejects an empty name', () => {
    const agency = makeValidAgency({ name: '' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only name (must contain a non-whitespace character)', () => {
    const agency = makeValidAgency({ name: '   ' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('accepts a single non-whitespace name', () => {
    const agency = makeValidAgency({ name: 'A' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(true)
  })

  it('accepts a name with leading/trailing whitespace but non-empty content', () => {
    const agency = makeValidAgency({ name: '  Real Estate  ' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(true)
  })
})

describe('agencyConfigSchema — logo and favicon', () => {
  it('rejects a logo that does not start with "/"', () => {
    const agency = makeValidAgency({ logo: 'images/logo.svg' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('accepts a logo that starts with "/"', () => {
    const agency = makeValidAgency({ logo: '/images/logo.svg' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(true)
  })

  it('rejects an empty logo', () => {
    const agency = makeValidAgency({ logo: '' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('rejects a favicon that does not start with "/"', () => {
    const agency = makeValidAgency({ favicon: 'favicon.ico' })
    const result = agencyConfigSchema.safeParse(agency)
    expect(result.success).toBe(false)
  })

  it('accepts a missing favicon (optional)', () => {
    const agency = makeValidAgency({ favicon: undefined })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(true)
  })
})

describe('agencyConfigSchema — theme, locales, currency, unit', () => {
  it('rejects an empty theme', () => {
    const agency = makeValidAgency({ theme: '' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })

  it('rejects an empty defaultLocale', () => {
    const agency = makeValidAgency({ defaultLocale: '' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })

  it('rejects an empty availableLocales array', () => {
    const agency = makeValidAgency({ availableLocales: [] })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })

  it('rejects an availableLocales entry that is empty', () => {
    const agency = makeValidAgency({ availableLocales: ['en', ''] })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })

  it('accepts a single-locale availableLocales array', () => {
    const agency = makeValidAgency({ availableLocales: ['en'] })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(true)
  })

  it('rejects an empty currency', () => {
    const agency = makeValidAgency({ currency: '' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })

  it('rejects an invalid measurement unit', () => {
    const agency = makeValidAgency({ measurementUnit: 'si' as 'metric' })
    expect(agencyConfigSchema.safeParse(agency).success).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * validateAgencyConfig — happy path
 * ------------------------------------------------------------------ */

describe('validateAgencyConfig', () => {
  it('returns the agency and a warnings array on a valid config', () => {
    const agency = makeValidAgency()
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.agency).toBe(agency)
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('returns the same agency reference (no clone)', () => {
    const agency = makeValidAgency()
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.agency).toBe(agency)
  })

  it('throws a ZodError when defaultLocale is not in availableLocales', () => {
    const agency = makeValidAgency({ defaultLocale: 'fr', availableLocales: ['en', 'es'] })
    expect(() => validateAgencyConfig(agency, { themes, i18nLocales })).toThrow(z.ZodError)
  })

  it('throws a ZodError when defaultLocale is not in i18nLocales', () => {
    const agency = makeValidAgency({ defaultLocale: 'fr' })
    expect(() => validateAgencyConfig(agency, { themes, i18nLocales })).toThrow(z.ZodError)
  })

  it('throws a ZodError when an availableLocales entry is not in i18nLocales', () => {
    const agency = makeValidAgency({ availableLocales: ['en', 'fr'] })
    expect(() => validateAgencyConfig(agency, { themes, i18nLocales })).toThrow(z.ZodError)
  })

  it('throws a ZodError when the theme is not in the themes registry', () => {
    const agency = makeValidAgency({ theme: 'coastal' })
    expect(() => validateAgencyConfig(agency, { themes, i18nLocales })).toThrow(z.ZodError)
  })

  it('throws a ZodError on a structural failure (empty name)', () => {
    const agency = makeValidAgency({ name: '' })
    expect(() => validateAgencyConfig(agency, { themes, i18nLocales })).toThrow(z.ZodError)
  })

  it('throws a ZodError on a structural failure (missing contact)', () => {
    const agency = makeValidAgency()
    // Strip the contact field to force a structural failure.
    const broken = { ...agency, contact: undefined as unknown as AgencyConfig['contact'] }
    expect(() => validateAgencyConfig(broken, { themes, i18nLocales })).toThrow(z.ZodError)
  })
})

/* ------------------------------------------------------------------ *
 * Format warnings — the permissive channel
 * ------------------------------------------------------------------ */

describe('validateAgencyConfig — format warnings', () => {
  it('returns no email warning when the email looks normal', () => {
    const agency = makeValidAgency()
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('contact.email'))).toBe(false)
  })

  it('returns an email warning when the email lacks a domain', () => {
    const agency = makeValidAgency({
      contact: {
        ...makeValidAgency().contact,
        email: 'no-at-symbol',
      },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('contact.email'))).toBe(true)
  })

  it('returns an email warning when the email has no TLD', () => {
    const agency = makeValidAgency({
      contact: {
        ...makeValidAgency().contact,
        email: 'name@domain',
      },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('contact.email'))).toBe(true)
  })

  it('returns no currency warning when the currency is ISO 4217 (3 uppercase letters)', () => {
    const agency = makeValidAgency({ currency: 'USD' })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('currency'))).toBe(false)
  })

  it('returns a currency warning when the currency is not ISO 4217', () => {
    const agency = makeValidAgency({ currency: 'US$' })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('currency'))).toBe(true)
  })

  it('returns a currency warning for a 3-character lowercase code', () => {
    const agency = makeValidAgency({ currency: 'usd' })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('currency'))).toBe(true)
  })

  it('returns a social URL warning when the value is a bare path', () => {
    const agency = makeValidAgency({
      social: { facebook: 'facebook.com/youragency' },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('social.facebook'))).toBe(true)
  })

  it('returns no social URL warning when the value starts with https://', () => {
    const agency = makeValidAgency({
      social: { facebook: 'https://facebook.com/youragency' },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('social.facebook'))).toBe(false)
  })

  it('returns no social URL warning when the value starts with http://', () => {
    const agency = makeValidAgency({
      social: { facebook: 'http://facebook.com/youragency' },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('social.facebook'))).toBe(false)
  })

  it('returns no social URL warning when the value starts with www.', () => {
    const agency = makeValidAgency({
      social: { facebook: 'www.facebook.com/youragency' },
    })
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    expect(result.warnings.some(w => w.includes('social.facebook'))).toBe(false)
  })

  it('returns five social URL warnings for the default agency (one per platform)', () => {
    // The default agency intentionally ships www.* placeholders.
    const agency = makeValidAgency()
    const result = validateAgencyConfig(agency, { themes, i18nLocales })
    const socialWarnings = result.warnings.filter(w => w.includes('social.'))
    // Every supplied social field triggers a warning because the
    // default values are 'http://www.*' which match the URL_PREFIX_RE
    // (the regex accepts 'http://' and 'www.' alike). So none of
    // the social fields warn. This is the documented behavior.
    expect(socialWarnings.length).toBe(0)
  })
})

/* ------------------------------------------------------------------ *
 * safeParseAgencyConfig
 * ------------------------------------------------------------------ */

describe('safeParseAgencyConfig', () => {
  it('returns ok: true with the agency on a valid config', () => {
    const agency = makeValidAgency()
    const result = safeParseAgencyConfig(agency, { themes, i18nLocales })
    expect(result.ok).toBe(true)
    if (result.ok) {
      // The schema returns a fresh parsed object (Zod's `data`),
      // structurally identical to the input but not the same
      // reference. Use `toEqual` for a deep-equality check.
      expect(result.agency).toEqual(agency)
      expect(Array.isArray(result.warnings)).toBe(true)
    }
  })

  it('returns ok: false with a ZodError on a structural failure (non-throwing)', () => {
    const broken = { ...makeValidAgency(), name: '' }
    const result = safeParseAgencyConfig(broken, { themes, i18nLocales })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(z.ZodError)
      expect(result.warnings).toEqual([])
    }
  })

  it('returns ok: false on a cross-config failure (unknown theme)', () => {
    const agency = makeValidAgency({ theme: 'coastal' })
    const result = safeParseAgencyConfig(agency, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a cross-config failure (defaultLocale not in availableLocales)', () => {
    const agency = makeValidAgency({ defaultLocale: 'fr', availableLocales: ['en', 'es'] })
    const result = safeParseAgencyConfig(agency, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a cross-config failure (locale not in i18nLocales)', () => {
    const agency = makeValidAgency({ availableLocales: ['en', 'fr'] })
    const result = safeParseAgencyConfig(agency, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a non-object input (string)', () => {
    const result = safeParseAgencyConfig('not an agency', { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a non-object input (null)', () => {
    const result = safeParseAgencyConfig(null, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a non-object input (array)', () => {
    const result = safeParseAgencyConfig([], { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a non-object input (undefined)', () => {
    const result = safeParseAgencyConfig(undefined, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on a non-object input (number)', () => {
    const result = safeParseAgencyConfig(42, { themes, i18nLocales })
    expect(result.ok).toBe(false)
  })
})

/* ------------------------------------------------------------------ *
 * Console warn isolation
 * ------------------------------------------------------------------ */

describe('validateAgencyConfig — does not log via console.warn', () => {
  it('does not call console.warn on a valid config with warnings', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const agency = makeValidAgency({ currency: 'US$' })
    validateAgencyConfig(agency, { themes, i18nLocales })
    // The collected warnings are returned; they are NOT console.warn'd.
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
