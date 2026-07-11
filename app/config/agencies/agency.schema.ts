import { z } from 'zod'
import type {
  AgencyConfig,
  AgencyContactConfig,
  AgencyModulesConfig,
  AgencySocialConfig,
  AgencyStructuredAddress,
  MeasurementUnit,
} from '~/types/agency.types'
import type { ThemeConfig } from '~/types/theme.types'

/**
 * Runtime validation for the agency configuration.
 *
 * The hand-written `AgencyConfig` interface in `~/types/agency.types.ts` is the
 * canonical type — it is what components, composables and helpers consume.
 * This file is the **runtime boundary**: it lets us catch structural mistakes
 * and cross-config incoherence (agency vs i18n, agency vs theme registry) at
 * module load, before the misconfigured config reaches the UI.
 *
 * Two error channels:
 *
 *   - **Strict rules** (throw): structural issues that prevent the site from
 *     rendering correctly (empty name, missing logo, unknown theme id,
 *     defaultLocale not in availableLocales, …).
 *   - **Permissive warnings** (console.warn, never thrown): format checks
 *     the user can override (email shape, ISO 4217 currency, social URL
 *     scheme). The shipped `default.agency.ts` triggers 5 of these (the
 *     `www.*` social placeholders) by design — they document what a real
 *     agency should fix when rebrand‑ing.
 *
 * The validators accept their external dependencies (`themes`, `i18nLocales`)
 * as parameters so this file has no static coupling to `~/themes` or
 * `nuxt.config.ts` and can be unit‑tested in isolation.
 *
 * @see docs/REBRANDING.md for the rebranding workflow this protects.
 */

/* ------------------------------------------------------------------ *
 * Primitive / leaf schemas
 * ------------------------------------------------------------------ */

export const measurementUnitSchema = z.enum(['metric', 'imperial']) satisfies z.ZodType<MeasurementUnit>

const publicPathSchema = z
  .string()
  .min(1)
  .regex(/^\//, 'must start with "/" (served from the public/ directory)')

/* ------------------------------------------------------------------ *
 * Nested config schemas
 * ------------------------------------------------------------------ */

/**
 * Optional schema.org `PostalAddress` companion. Every field is
 * optional AND must be non-empty when supplied (`.min(1).optional()`),
 * so the runtime rejects empty strings but accepts the field being
 * absent. The JSON-LD builder (`app/core/utils/postal-address.ts`)
 * omits absent or empty fields from the final payload.
 */
export const agencyStructuredAddressSchema = z.object({
  streetAddress: z.string().min(1).optional(),
  addressLocality: z.string().min(1).optional(),
  addressRegion: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  addressCountry: z.string().min(1).optional(),
}) satisfies z.ZodType<AgencyStructuredAddress>

export const agencyContactConfigSchema = z.object({
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  email: z.string().min(1),
  address: z.string().min(1),
  structuredAddress: agencyStructuredAddressSchema.optional(),
  businessHours: z.string().optional(),
}) satisfies z.ZodType<AgencyContactConfig>

export const agencySocialConfigSchema = z.object({
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  tiktok: z.string().optional(),
  youtube: z.string().optional(),
}) satisfies z.ZodType<AgencySocialConfig>

export const agencyModulesConfigSchema = z.object({
  properties: z.boolean(),
  developments: z.boolean(),
  agents: z.boolean(),
  blog: z.boolean(),
  testimonials: z.boolean(),
  contact: z.boolean(),
}) satisfies z.ZodType<AgencyModulesConfig>

/* ------------------------------------------------------------------ *
 * Full agency schema
 * ------------------------------------------------------------------ */

export const agencyConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).regex(/\S/, 'must contain at least one non-whitespace character'),
  slogan: z.string().optional(),
  logo: publicPathSchema,
  favicon: publicPathSchema.optional(),
  theme: z.string().min(1),
  defaultLocale: z.string().min(1),
  availableLocales: z.array(z.string().min(1)).min(1),
  currency: z.string().min(1),
  measurementUnit: measurementUnitSchema,
  contact: agencyContactConfigSchema,
  social: agencySocialConfigSchema,
  modules: agencyModulesConfigSchema,
}) satisfies z.ZodType<AgencyConfig>

/**
 * Type inferred from the schema. Kept assignable to the canonical
 * {@link AgencyConfig} interface via the bidirectional compile-time guard
 * below, so the schema and the hand-written type cannot drift.
 */
export type AgencyConfigInput = z.infer<typeof agencyConfigSchema>

// Compile-time guard: the schema output and the hand-written interface must
// stay structurally identical. If either side changes, this fails to compile.
const _typeCheck: AgencyConfigInput extends AgencyConfig
  ? AgencyConfig extends AgencyConfigInput
    ? true
    : never
  : never = true
void _typeCheck

/* ------------------------------------------------------------------ *
 * Cross-config coherence
 * ------------------------------------------------------------------ */

export interface ValidateAgencyConfigDeps {
  /**
   * The full themes registry. `agency.theme` must be one of its keys.
   * (Import as `themes` from `~/themes`.)
   */
  themes: Record<string, ThemeConfig>
  /**
   * The locale codes wired into the Nuxt i18n config. `agency.defaultLocale`
   * and every entry in `agency.availableLocales` must be present in this list.
   * (Pass `defaultI18nLocales` from `~/config/i18n`.)
   */
  i18nLocales: readonly string[]
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ISO_4217_RE = /^[A-Z]{3}$/
const URL_PREFIX_RE = /^(https?:\/\/|www\.)/

const SOCIAL_KEYS: ReadonlyArray<keyof AgencySocialConfig> = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
]

/**
 * Run cross-config coherence checks (defaultLocale ⊆ availableLocales,
 * defaultLocale ⊆ i18nLocales, every availableLocales entry ⊆ i18nLocales,
 * theme ∈ themes keys). Returns a `ZodError` with one issue per failure,
 * or `null` when everything checks out.
 */
function runCrossConfigChecks(
  config: AgencyConfig,
  deps: ValidateAgencyConfigDeps,
): z.ZodError | null {
  const crossSchema = z.unknown().superRefine((_, ctx) => {
    if (!config.availableLocales.includes(config.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message:
          `defaultLocale "${config.defaultLocale}" must be included in availableLocales `
          + `(${config.availableLocales.join(', ')})`,
      })
    }

    if (!deps.i18nLocales.includes(config.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message:
          `defaultLocale "${config.defaultLocale}" is not a registered i18n locale `
          + `(registered: ${deps.i18nLocales.join(', ')})`,
      })
    }

    for (const locale of config.availableLocales) {
      if (!deps.i18nLocales.includes(locale)) {
        ctx.addIssue({
          code: 'custom',
          path: ['availableLocales'],
          message:
            `availableLocales contains "${locale}" which is not a registered i18n locale `
            + `(registered: ${deps.i18nLocales.join(', ')})`,
        })
      }
    }

    if (!Object.prototype.hasOwnProperty.call(deps.themes, config.theme)) {
      ctx.addIssue({
        code: 'custom',
        path: ['theme'],
        message:
          `theme "${config.theme}" is not registered in the theme registry `
          + `(registered: ${Object.keys(deps.themes).join(', ')})`,
      })
    }
  })

  const result = crossSchema.safeParse(config)
  return result.success ? null : result.error
}

/**
 * Collect format issues as plain warnings. These never throw; a real agency
 * may legitimately store a non‑ISO 4217 currency like `'US$'` or a `www.`
 * social URL during a transition. The shipped `default.agency.ts` triggers
 * 5 of these (one per social platform) by design.
 */
function collectFormatWarnings(config: AgencyConfig): string[] {
  const warnings: string[] = []

  if (config.contact.email && !EMAIL_RE.test(config.contact.email)) {
    warnings.push(
      `contact.email "${config.contact.email}" does not look like a normal email address`,
    )
  }

  if (config.currency && !ISO_4217_RE.test(config.currency)) {
    warnings.push(
      `currency "${config.currency}" does not match the ISO 4217 format (3 uppercase letters)`,
    )
  }

  for (const key of SOCIAL_KEYS) {
    const value = config.social[key]
    if (value && !URL_PREFIX_RE.test(value)) {
      warnings.push(
        `social.${key} "${value}" should start with "http://", "https://" or "www."`,
      )
    }
  }

  return warnings
}

/* ------------------------------------------------------------------ *
 * Public helpers
 * ------------------------------------------------------------------ */

export interface ValidateAgencyConfigResult {
  /** The validated agency (same reference as the input on success). */
  agency: AgencyConfig
  /** Non-fatal format issues that should be surfaced to the operator. */
  warnings: string[]
}

export type SafeParseAgencyConfigResult =
  | { ok: true, agency: AgencyConfig, warnings: string[] }
  | { ok: false, error: z.ZodError, warnings: string[] }

/**
 * Validate an agency config strictly. Throws a `ZodError` on any structural
 * or cross-config failure. Format issues are returned as warnings.
 */
export function validateAgencyConfig(
  agency: AgencyConfig,
  deps: ValidateAgencyConfigDeps,
): ValidateAgencyConfigResult {
  const structural = agencyConfigSchema.safeParse(agency)
  const issues: z.core.$ZodIssue[] = structural.success
    ? []
    : structural.error.issues.slice()

  if (structural.success) {
    const crossError = runCrossConfigChecks(structural.data, deps)
    if (crossError) {
      issues.push(...crossError.issues)
    }
  }

  if (issues.length > 0) {
    throw new z.ZodError(issues)
  }

  return { agency, warnings: collectFormatWarnings(agency) }
}

/**
 * Non-throwing variant. Returns a tagged result so callers (for example a
 * future multi-tenant loader) can decide whether to fall back to the default
 * agency or surface the error to the operator.
 */
export function safeParseAgencyConfig(
  agency: unknown,
  deps: ValidateAgencyConfigDeps,
): SafeParseAgencyConfigResult {
  const structural = agencyConfigSchema.safeParse(agency)

  if (!structural.success) {
    return { ok: false, error: structural.error, warnings: [] }
  }

  const crossError = runCrossConfigChecks(structural.data, deps)
  if (crossError) {
    return { ok: false, error: crossError, warnings: [] }
  }

  return {
    ok: true,
    agency: structural.data,
    warnings: collectFormatWarnings(structural.data),
  }
}
