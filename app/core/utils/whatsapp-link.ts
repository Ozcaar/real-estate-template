/**
 * Build a `wa.me` deep link from a WhatsApp phone number.
 *
 * Strips every non-digit character (spaces, dashes, parentheses, leading
 * `+`, etc.) and prefixes the standard `https://wa.me/` so the result can be
 * opened in a new tab to start a chat via WhatsApp Web or the mobile app.
 *
 * The agency config stores the raw, human-formatted WhatsApp number in
 * `agency.contact.whatsapp` (see `app/config/agencies/*.agency.ts`). This
 * helper keeps the formatting/decoration concern out of the components so a
 * real agency can store the number however they prefer and every contact
 * surface (footer, home CTA, future pages) stays consistent.
 *
 * @param phone WhatsApp number in any common human format, e.g. `+52 81 1234 5678`
 * @returns A ready-to-use `https://wa.me/{digits}` URL, or `null` when no
 *          valid number can be derived so callers can simply `v-if` the result.
 */
export function buildWhatsAppLink(phone: string | undefined | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}
