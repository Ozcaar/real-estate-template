import { z } from 'zod'
import type { LeadInput } from '../types/lead.types'

/**
 * Runtime validation for the lead-capture form.
 *
 * The schema is the **public input contract** shared by the client form
 * (for early UX feedback) and the server endpoint (the trust boundary).
 * Server validation re-runs this schema on every request — the client
 * validation is a UX nicety, never the trust boundary.
 *
 * **Field rules.**
 *
 * - `name` — required, 2–120 trimmed characters.
 * - `message` — required, 10–4000 trimmed characters.
 * - `email` — optional, but if present must be a valid email and at most
 *   254 trimmed characters.
 * - `phone` — optional, permissive formatting, 6–32 characters when
 *   present. Accepts digits, spaces, dashes, parentheses, and a leading
 *   `+`. This deliberately rejects obvious garbage (a 3-character phone
 *   is not a phone) without rejecting legitimate international formats
 *   (Mexican `+52 81 1234 5678`, Argentinian `+54 11 4321 5678`, US
 *   `1-800-555-1234`, Brazilian `(11) 91234-5678`).
 * - `website` — honeypot. The server accepts only an empty string;
 *   any non-empty value is a bot signal and the lead is silently
 *   dropped. The schema enforces the empty-string contract so a
 *   defensive server can rely on `schema.safeParse` even before
 *   reaching the bot-detection code path.
 * - `locale` — optional BCP-47-shaped string, 2–12 characters.
 *
 * **Cross-field rule.** At least one of `email` or `phone` must be
 * non-empty. A real lead has at least one contact channel; the agency
 * can use either to respond.
 *
 * **What is intentionally NOT here.** No `propertyId`, `developmentId`,
 * `source`, `interestType`, `ip`, `userAgent`, `referer`, or
 * `g-recaptcha-response`. The agency-specific contextual fields belong
 * in a future v1.x release; the cross-cutting network fields are
 * stamped by the server and never travel through the public contract.
 */
export const leadInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'name_too_short')
    .max(120, 'name_too_long'),
  email: z
    .string()
    .trim()
    .max(254, 'email_too_long')
    .email('email_invalid')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(32, 'phone_too_long')
    .regex(/^[+]?[0-9 ()-]{6,32}$/, 'phone_invalid')
    .optional()
    .or(z.literal('')),
  message: z
    .string()
    .trim()
    .min(10, 'message_too_short')
    .max(4000, 'message_too_long'),
  website: z
    .string()
    .max(0, 'honeypot')
    .optional()
    .or(z.literal('')),
  locale: z
    .string()
    .trim()
    .min(2, 'locale_invalid')
    .max(12, 'locale_invalid')
    .optional()
    .or(z.literal('')),
})

/**
 * Refined schema. The `.refine` adds the cross-field rule that at
 * least one contact channel is present. The path is `email` so the
 * client can attach the error to the email field by default.
 */
export const leadInputRefined = leadInputSchema.refine(
  (data) => {
    const hasEmail = typeof data.email === 'string' && data.email.length > 0
    const hasPhone = typeof data.phone === 'string' && data.phone.length > 0
    return hasEmail || hasPhone
  },
  { message: 'contact_channel_required', path: ['email'] },
)

/**
 * Type inferred from the schema. Kept assignable to the canonical
 * {@link LeadInput} interface via the assertion below, so the schema
 * and the hand-written type cannot drift.
 */
export type LeadInputParsed = z.infer<typeof leadInputRefined>

const _typeCheck: LeadInputParsed extends LeadInput
  ? LeadInput extends LeadInputParsed
    ? true
    : never
  : never = true
void _typeCheck
