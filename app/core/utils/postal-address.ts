import type { AgencyConfig } from '~/types/agency.types'

/**
 * Shape of the schema.org `PostalAddress` payload emitted on the
 * home, contact and about `RealEstateAgent` nodes. The field names
 * match schema.org exactly so the object can be spread directly into
 * a JSON-LD payload.
 *
 * Only fields that are non-empty (after `.trim()`) appear in the
 * returned object; the JSON-LD never carries `undefined` entries.
 */
export interface PostalAddressPayload {
  '@type': 'PostalAddress'
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

/**
 * Decide what to emit as the `address` field on the three agency
 * `RealEstateAgent` JSON-LD nodes (home, contact `mainEntity`, about
 * `mainEntity`).
 *
 * - If the agency has no `contact.structuredAddress`, or every field of
 *   that object is empty / whitespace-only, the function returns the
 *   existing free-text `contact.address` string. This is the legacy
 *   behaviour, preserved for every rebranded agency that has not
 *   migrated.
 * - If at least one structured field is non-empty, the function returns
 *   a `PostalAddress` object containing only the non-empty fields.
 *   `addressRegion` and `postalCode` are included when present, so a
 *   rebrand that knows a state or postal code can supply them.
 *
 * The function is page-agnostic: no `useI18n`, `useRoute`, `useHead`,
 * or component imports. It is a pure function over the agency
 * configuration and can be unit-tested in isolation.
 *
 * @param agency The active agency config (from `useSiteConfig().value.agency`).
 * @returns A plain `address` string (legacy / unmigrated agency) or a
 *          schema.org `PostalAddress` object (migrated agency).
 */
export function agencyPostalAddress(agency: AgencyConfig): string | PostalAddressPayload {
  const structured = agency.contact.structuredAddress
  if (!structured) {
    return agency.contact.address
  }

  const payload: PostalAddressPayload = { '@type': 'PostalAddress' }
  let hasAny = false

  if (structured.streetAddress && structured.streetAddress.trim() !== '') {
    payload.streetAddress = structured.streetAddress
    hasAny = true
  }
  if (structured.addressLocality && structured.addressLocality.trim() !== '') {
    payload.addressLocality = structured.addressLocality
    hasAny = true
  }
  if (structured.addressRegion && structured.addressRegion.trim() !== '') {
    payload.addressRegion = structured.addressRegion
    hasAny = true
  }
  if (structured.postalCode && structured.postalCode.trim() !== '') {
    payload.postalCode = structured.postalCode
    hasAny = true
  }
  if (structured.addressCountry && structured.addressCountry.trim() !== '') {
    payload.addressCountry = structured.addressCountry
    hasAny = true
  }

  if (!hasAny) {
    return agency.contact.address
  }

  return payload
}
