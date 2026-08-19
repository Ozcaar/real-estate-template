import type { Property } from '~/features/properties/types/property.types'
import type { Agent } from '~/features/agents/types/agent.types'
import type { Development } from '~/features/developments/types/development.types'

/**
 * Sanity feature-specific GROQ queries + mapping functions
 * (Task 115 — v1.2 pilot).
 *
 * The driver in `app/core/data-source/adapters/sanity-driver.ts`
 * is provider-agnostic beyond the GROQ query and the
 * `mapRecord` function. This module owns the per-feature
 * pieces:
 *
 *  - `sanityPropertyQuery` / `mapSanityProperty`
 *  - `sanityAgentQuery` / `mapSanityAgent`
 *  - `sanityDevelopmentQuery` / `mapSanityDevelopment`
 *
 * The mappings project the Sanity-native document shape into
 * the boundary shapes the per-feature Zod schemas validate.
 * The boundary shapes are the canonical `Property` / `Agent`
 * / `Development` types — no UI changes are required when the
 * source is swapped.
 *
 * **Image strategy.** The pilot projects image asset URLs
 * directly via `asset->url`. The image-url builder
 * (`@sanity/image-url`) is a separate package and is
 * intentionally deferred (see `docs/CMS_EVALUATION.md` §6.6).
 * The direct projected URLs are the Sanity CDN URLs and work
 * directly with the existing `<ResponsiveImage>` wrapper.
 *
 * **Reference resolution.** The pilot resolves
 * `Property.agentId` and `Property.developmentId` by
 * projecting `agent._ref` and `development._ref` in the
 * GROQ query. The mapping reads the `_ref` string and stores
 * it as the boundary shape's `agentId` / `developmentId`. The
 * agents and developments lists are loaded independently by
 * their own loaders; the per-property reference is resolved at
 * the per-record mapping step.
 *
 * **Slug handling.** Sanity slugs are objects with
 * `current`, `_type`, and `source` fields. The GROQ
 * projection extracts `slug.current` and aliases it as
 * `slug` in the result so the mapping function receives a
 * flat string.
 *
 * **Server-only by call site.** The mapping functions are
 * imported by the server-only feature loaders; the Sanity
 * client token never reaches the client bundle.
 */

/**
 * The GROQ query for the property catalog.
 *
 * The projection returns every field the boundary schema
 * validates. Image arrays are flattened to URLs via
 * `images[].asset->url`; the cover image is flattened via
 * `coverImage.asset->url`. References are resolved to the
 * raw `_ref` string (`agent._ref`, `development._ref`); the
 * loader's own agents / developments lists are loaded
 * independently by their own loaders.
 *
 * The `status != "hidden"` filter mirrors the existing
 * property catalog's `status: 'hidden'` exclusion (the
 * sitemap and the property service both drop hidden records).
 */
export const sanityPropertyQuery = `
*[_type == "property" && status != "hidden"]{
  _id,
  title,
  "slug": slug.current,
  description,
  operationType,
  propertyType,
  price,
  currency,
  location,
  city,
  state,
  country,
  bedrooms,
  bathrooms,
  parkingSpaces,
  sizeUnit,
  constructionSize,
  landSize,
  "images": images[].asset->url,
  "coverImage": coverImage.asset->url,
  amenities,
  "agentId": agent._ref,
  "developmentId": development._ref,
  coordinates,
  status,
  featured
}`.trim()

/**
 * The GROQ query for the agent directory.
 *
 * The projection returns every field the boundary schema
 * validates. The portrait image is flattened via
 * `image.asset->url`.
 */
export const sanityAgentQuery = `
*[_type == "agent"]{
  _id,
  name,
  "slug": slug.current,
  role,
  bio,
  "image": image.asset->url,
  phone,
  email,
  whatsapp,
  specialties
}`.trim()

/**
 * The GROQ query for the development portfolio.
 *
 * The projection returns every field the boundary schema
 * validates. The cover image is flattened via
 * `image.asset->url`.
 */
export const sanityDevelopmentQuery = `
*[_type == "development"]{
  _id,
  name,
  "slug": slug.current,
  status,
  location,
  description,
  "image": image.asset->url,
  priceFrom,
  priceTo,
  currency,
  sizeUnit,
  units,
  bedrooms,
  areaFrom,
  areaTo,
  deliveryDate,
  featured
}`.trim()

/**
 * The internal Sanity document shape for a property after
 * the GROQ projection. The handler is permissive (everything
 * is optional except what the projection guarantees) so the
 * mapping function can apply defaults and the boundary
 * schema can reject records that miss required fields.
 */
interface SanityPropertyDocument {
  _id?: unknown
  title?: unknown
  slug?: unknown
  description?: unknown
  operationType?: unknown
  propertyType?: unknown
  price?: unknown
  currency?: unknown
  location?: unknown
  city?: unknown
  state?: unknown
  country?: unknown
  bedrooms?: unknown
  bathrooms?: unknown
  parkingSpaces?: unknown
  sizeUnit?: unknown
  constructionSize?: unknown
  landSize?: unknown
  images?: unknown
  coverImage?: unknown
  amenities?: unknown
  agentId?: unknown
  developmentId?: unknown
  coordinates?: unknown
  status?: unknown
  featured?: unknown
}

/**
 * The internal Sanity document shape for an agent after
 * the GROQ projection.
 */
interface SanityAgentDocument {
  _id?: unknown
  name?: unknown
  slug?: unknown
  role?: unknown
  bio?: unknown
  image?: unknown
  phone?: unknown
  email?: unknown
  whatsapp?: unknown
  specialties?: unknown
}

/**
 * The internal Sanity document shape for a development
 * after the GROQ projection.
 */
interface SanityDevelopmentDocument {
  _id?: unknown
  name?: unknown
  slug?: unknown
  status?: unknown
  location?: unknown
  description?: unknown
  image?: unknown
  priceFrom?: unknown
  priceTo?: unknown
  currency?: unknown
  sizeUnit?: unknown
  units?: unknown
  bedrooms?: unknown
  areaFrom?: unknown
  areaTo?: unknown
  deliveryDate?: unknown
  featured?: unknown
}

/**
 * Read a non-empty string from the Sanity document, or
 * `undefined` if the field is missing / empty. The function
 * mirrors what the per-feature Zod schema treats as
 * "missing" (empty string / whitespace).
 *
 * **Slug-specific edge case.** Sanity slugs are objects with
 * `current`, `_type`, and `source` fields. The default GROQ
 * projection in this module extracts `slug.current` and
 * aliases it as `slug` (a flat string), so the mapping always
 * receives a string. Both shapes are accepted so the mapping
 * is robust to alternative GROQ projections that do not
 * alias the slug.
 */
function readString(doc: Record<string, unknown>, key: string): string | undefined {
  const value = doc[key]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  // Sanity slug object: extract `current`.
  if (value && typeof value === 'object' && 'current' in value) {
    const current = (value as { current: unknown }).current
    if (typeof current === 'string') {
      const trimmed = current.trim()
      return trimmed === '' ? undefined : trimmed
    }
  }
  return undefined
}

/**
 * Read a non-empty string from the Sanity document; default
 * to `fallback` if missing.
 */
function readStringWithDefault(
  doc: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return readString(doc, key) ?? fallback
}

/**
 * Read a number from the Sanity document, or `undefined` if
 * the field is missing / not a number.
 */
function readNumber(doc: Record<string, unknown>, key: string): number | undefined {
  const value = doc[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

/**
 * Read a boolean from the Sanity document, or `undefined`
 * if the field is missing / not a boolean.
 */
function readBoolean(doc: Record<string, unknown>, key: string): boolean | undefined {
  const value = doc[key]
  if (typeof value !== 'boolean') return undefined
  return value
}

/**
 * Read a string array from the Sanity document. Returns
 * `undefined` if the field is missing / not an array.
 */
function readStringArray(
  doc: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = doc[key]
  if (!Array.isArray(value)) return undefined
  const filtered = value.filter((v): v is string => typeof v === 'string')
  return filtered
}

/**
 * Read a string ref from a GROQ-projected reference field.
 * The projection returns `agent._ref` as a raw string (the
 * document ID). `null` / `undefined` means the reference is
 * absent.
 */
function readRef(doc: Record<string, unknown>, key: string): string | undefined {
  const value = doc[key]
  if (typeof value !== 'string' || value === '') return undefined
  return value
}

/**
 * Read a coordinates object from the Sanity document.
 * Returns `undefined` if the field is missing / not a
 * `{ lat, lng }` object.
 */
function readCoordinates(
  doc: Record<string, unknown>,
  key: string,
): { lat: number, lng: number } | undefined {
  const value = doc[key]
  if (!value || typeof value !== 'object') return undefined
  const v = value as { lat?: unknown, lng?: unknown }
  if (typeof v.lat !== 'number' || typeof v.lng !== 'number') return undefined
  if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return undefined
  return { lat: v.lat, lng: v.lng }
}

/**
 * Convert a Sanity property document into the boundary
 * `Property` shape.
 *
 * The mapping is defensive: every field is read through a
 * permissive helper that treats missing / empty / wrong-typed
 * values as `undefined`. The boundary Zod schema
 * (`propertyListSchema`) validates the result; a record that
 * misses a required field is rejected at the boundary with
 * a `DataSourceInvalidPayloadError` that surfaces the
 * underlying Zod issue.
 *
 * The function is the only feature-specific piece of the
 * Property Sanity CMS path; the driver + adapter + boundary
 * schema are feature-agnostic.
 */
export function mapSanityProperty(doc: unknown): Property {
  const d = (doc ?? {}) as SanityPropertyDocument & Record<string, unknown>

  // The boundary schema's required string fields. The
  // defaults below are placeholders that the schema will
  // reject; the schema's error message tells the operator
  // which field is missing. An empty title / slug / etc. is
  // a real Sanity schema-validation issue, not a
  // mapping-default issue.
  const id = readStringWithDefault(d, '_id', '')
  const title = readStringWithDefault(d, 'title', '')
  const slug = readStringWithDefault(d, 'slug', '')
  const description = readStringWithDefault(d, 'description', '')
  const operationType
    = readString(d, 'operationType') === 'rent' ? 'rent' : 'sale'
  const propertyTypeRaw = readString(d, 'propertyType')
  const propertyType
    = propertyTypeRaw === 'house'
      || propertyTypeRaw === 'apartment'
      || propertyTypeRaw === 'land'
      || propertyTypeRaw === 'commercial'
      || propertyTypeRaw === 'office'
      ? propertyTypeRaw
      : 'house'
  const price = readNumber(d, 'price') ?? 0
  const currency = readStringWithDefault(d, 'currency', '')
  const location = readStringWithDefault(d, 'location', '')
  const city = readStringWithDefault(d, 'city', '')
  const state = readStringWithDefault(d, 'state', '')
  const country = readStringWithDefault(d, 'country', '')
  const coverImage = readStringWithDefault(d, 'coverImage', '')
  const statusRaw = readString(d, 'status')
  const status
    = statusRaw === 'available'
      || statusRaw === 'sold'
      || statusRaw === 'rented'
      || statusRaw === 'reserved'
      || statusRaw === 'hidden'
      ? statusRaw
      : 'available'

  return {
    id,
    title,
    slug,
    description,
    operationType,
    propertyType,
    price,
    currency,
    location,
    city,
    state,
    country,
    bedrooms: readNumber(d, 'bedrooms'),
    bathrooms: readNumber(d, 'bathrooms'),
    parkingSpaces: readNumber(d, 'parkingSpaces'),
    sizeUnit: readString(d, 'sizeUnit') === 'imperial' ? 'imperial' : 'metric',
    constructionSize: readNumber(d, 'constructionSize'),
    landSize: readNumber(d, 'landSize'),
    images: readStringArray(d, 'images') ?? [],
    coverImage,
    amenities: readStringArray(d, 'amenities') ?? [],
    agentId: readRef(d, 'agentId'),
    developmentId: readRef(d, 'developmentId'),
    coordinates: readCoordinates(d, 'coordinates'),
    status,
    featured: readBoolean(d, 'featured') ?? false,
  }
}

/**
 * Convert a Sanity agent document into the boundary
 * `Agent` shape.
 */
export function mapSanityAgent(doc: unknown): Agent {
  const d = (doc ?? {}) as SanityAgentDocument & Record<string, unknown>

  const id = readStringWithDefault(d, '_id', '')
  const name = readStringWithDefault(d, 'name', '')
  const slug = readStringWithDefault(d, 'slug', '')
  const role = readStringWithDefault(d, 'role', '')
  const bio = readStringWithDefault(d, 'bio', '')
  const image = readStringWithDefault(d, 'image', '')

  return {
    id,
    name,
    slug,
    role,
    bio,
    image,
    phone: readString(d, 'phone'),
    email: readString(d, 'email'),
    whatsapp: readString(d, 'whatsapp'),
    specialties: readStringArray(d, 'specialties'),
  }
}

/**
 * Convert a Sanity development document into the boundary
 * `Development` shape.
 */
export function mapSanityDevelopment(doc: unknown): Development {
  const d = (doc ?? {}) as SanityDevelopmentDocument & Record<string, unknown>

  const id = readStringWithDefault(d, '_id', '')
  const name = readStringWithDefault(d, 'name', '')
  const slug = readStringWithDefault(d, 'slug', '')
  const statusRaw = readString(d, 'status')
  const status
    = statusRaw === 'pre-sale'
      || statusRaw === 'under-construction'
      || statusRaw === 'ready-to-deliver'
      || statusRaw === 'sold-out'
      ? statusRaw
      : 'pre-sale'
  const location = readStringWithDefault(d, 'location', '')
  const description = readStringWithDefault(d, 'description', '')
  const image = readStringWithDefault(d, 'image', '')
  const sizeUnit = readString(d, 'sizeUnit') === 'imperial' ? 'imperial' : 'metric'

  return {
    id,
    name,
    slug,
    status,
    location,
    description,
    image,
    priceFrom: readNumber(d, 'priceFrom'),
    priceTo: readNumber(d, 'priceTo'),
    currency: readString(d, 'currency'),
    sizeUnit,
    units: readNumber(d, 'units'),
    bedrooms: readNumber(d, 'bedrooms'),
    areaFrom: readNumber(d, 'areaFrom'),
    areaTo: readNumber(d, 'areaTo'),
    deliveryDate: readString(d, 'deliveryDate'),
    featured: readBoolean(d, 'featured'),
  }
}
