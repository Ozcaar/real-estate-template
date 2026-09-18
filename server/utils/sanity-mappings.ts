import type { Property } from '~/features/properties/types/property.types'
import type { Agent } from '~/features/agents/types/agent.types'
import type { Development } from '~/features/developments/types/development.types'
import type {
  ImageSourceMeta,
  ImageHotspot,
  ImageCrop,
  ImageAssetMetadata,
} from '~/core/image/image-source'

/**
 * Sanity feature-specific GROQ queries + mapping functions
 * (Task 115 — v1.2 pilot; Task 130 — image metadata).
 *
 * The driver in `server/utils/sanity-driver.ts`
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
 * **Image strategy (Task 130).** Each image-bearing GROQ
 * projection now returns two siblings: the canonical asset
 * URL (`coverImage`, `image`, `images[]`) and an optional
 * `*Meta` object carrying the asset reference, editor-picked
 * hotspot (`{ x, y, width, height }` — all four fields) +
 * crop (`{ top, bottom, left, right }`) + intrinsic
 * dimensions. The mapper emits a provider-neutral
 * `ImageSourceMeta` (`app/core/image/`) alongside the
 * existing `string` URL. The mapper never reads the URL
 * builder (`@sanity/image-url`); the URL builder lives in
 * `app/core/image/sanity-image-url.ts` and is imported
 * directly by the `<SanityImage>` Vue component, which
 * computes the crop-aware URL synchronously in a
 * `computed()` at SSR / prerender time. The generated HTML
 * embeds the resolved URL with the correct `rect=…` /
 * `w=…` / `h=…` parameters; no runtime API is required
 * (so the static deployment works without a `/api/…`
 * endpoint).
 *
 * **Image fallback.** When the editor has not picked a
 * hotspot / crop (the GROQ projection returns `hotspot: null`
 * / `crop: null` for an asset whose image schema did not
 * enable hotspot), the mapper emits the canonical `string`
 * URL only and omits the `*Meta` field. The rendering
 * components treat `undefined` `*Meta` as "no metadata, use
 * the plain asset URL". The static / api / generic-CMS paths
 * never emit `*Meta` (the static data files do not populate
 * it; the api and http-json adapters do not fill it in).
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
 * Image metadata (Task 130): each image field also projects
 * a `*Meta` sibling carrying the asset reference, hotspot,
 * crop, and intrinsic dimensions. The mapper translates the
 * nested `asset` / `hotspot` / `crop` shape into a flat
 * provider-neutral `ImageSourceMeta`; see `readImageMeta`.
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
  "imagesMeta": images[]{
    "assetRef": asset->_ref,
    "assetUrl": asset->url,
    hotspot{x, y, width, height},
    crop{top, bottom, left, right},
    "metadata": asset->metadata{width, height, "aspectRatio": width / height}
  },
  "coverImageMeta": coverImage{
    "assetRef": asset->_ref,
    "assetUrl": asset->url,
    hotspot{x, y, width, height},
    crop{top, bottom, left, right},
    "metadata": asset->metadata{width, height, "aspectRatio": width / height}
  },
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
 * `image.asset->url`; the matching `imageMeta` carries the
 * editor-picked hotspot + crop (when enabled on the schema).
 */
export const sanityAgentQuery = `
*[_type == "agent"]{
  _id,
  name,
  "slug": slug.current,
  role,
  bio,
  "image": image.asset->url,
  "imageMeta": image{
    "assetRef": asset->_ref,
    "assetUrl": asset->url,
    hotspot{x, y, width, height},
    crop{top, bottom, left, right},
    "metadata": asset->metadata{width, height, "aspectRatio": width / height}
  },
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
 * `image.asset->url`; the matching `imageMeta` carries the
 * editor-picked hotspot + crop (when enabled on the schema).
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
  "imageMeta": image{
    "assetRef": asset->_ref,
    "assetUrl": asset->url,
    hotspot{x, y, width, height},
    crop{top, bottom, left, right},
    "metadata": asset->metadata{width, height, "aspectRatio": width / height}
  },
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
  imagesMeta?: unknown
  coverImageMeta?: unknown
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
  imageMeta?: unknown
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
  imageMeta?: unknown
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
 * Read a `hotspot{x,y,width,height}` projection from the Sanity
 * document. Returns `undefined` when the field is absent,
 * `null`, or any value whose `x` / `y` / `width` / `height` is
 * not a finite number in `0..1`. The Sanity editor UI uses
 * normalized coordinates; the mapper mirrors that contract
 * and lets the rendering layer fall back to the URL-only meta
 * when the projection is malformed.
 *
 * All four fields are required. Sanity always populates
 * `width` and `height` for editor-picked hotspots; a record
 * that pre-dates the Sanity version that introduced
 * `width` / `height` (or an external document that omits
 * one) is rejected and the meta falls back to the URL-only
 * path. This is the same defensive contract the mapper
 * applies to every other malformed sub-field.
 */
function readHotspot(value: unknown): ImageHotspot | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as { x?: unknown, y?: unknown, width?: unknown, height?: unknown }
  if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.width !== 'number' || typeof v.height !== 'number') return undefined
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.width) || !Number.isFinite(v.height)) return undefined
  if (v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1 || v.width < 0 || v.width > 1 || v.height < 0 || v.height > 1) return undefined
  return { x: v.x, y: v.y, width: v.width, height: v.height }
}

/**
 * Read a `crop{top,bottom,left,right}` projection from the
 * Sanity document. Returns `undefined` when the field is
 * absent, `null`, or any value whose `top` / `bottom` / `left`
 * / `right` is not a finite number in `0..1`. A crop region
 * whose `top + bottom >= 1` or `left + right >= 1` is
 * degenerate (the kept region has zero size) and is treated
 * as "no crop".
 */
function readCrop(value: unknown): ImageCrop | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as { top?: unknown, bottom?: unknown, left?: unknown, right?: unknown }
  if (
    typeof v.top !== 'number' || typeof v.bottom !== 'number'
    || typeof v.left !== 'number' || typeof v.right !== 'number'
  ) return undefined
  if (!Number.isFinite(v.top) || !Number.isFinite(v.bottom) || !Number.isFinite(v.left) || !Number.isFinite(v.right)) return undefined
  if (v.top < 0 || v.top > 1 || v.bottom < 0 || v.bottom > 1 || v.left < 0 || v.left > 1 || v.right < 0 || v.right > 1) return undefined
  if (v.top + v.bottom >= 1 || v.left + v.right >= 1) return undefined
  return { top: v.top, bottom: v.bottom, left: v.left, right: v.right }
}

/**
 * Read a `metadata{width,height,aspectRatio}` projection
 * from the Sanity document. Returns `undefined` when the
 * field is absent, `null`, or any value whose `width` /
 * `height` is not a positive finite number. The mapper also
 * recomputes `aspectRatio` as `width / height` when missing
 * so the rendering layer never has to divide.
 */
function readAssetMetadata(value: unknown): ImageAssetMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as { width?: unknown, height?: unknown, aspectRatio?: unknown }
  if (typeof v.width !== 'number' || typeof v.height !== 'number') return undefined
  if (!Number.isFinite(v.width) || !Number.isFinite(v.height)) return undefined
  if (v.width <= 0 || v.height <= 0) return undefined
  const aspectRatio = typeof v.aspectRatio === 'number' && Number.isFinite(v.aspectRatio) && v.aspectRatio > 0
    ? v.aspectRatio
    : v.width / v.height
  return { width: v.width, height: v.height, aspectRatio }
}

/**
 * Convert the GROQ-projected `*Meta` shape (a Sanity
 * image-input object flattened to `{ assetRef, assetUrl,
 * hotspot?, crop?, metadata? }`) into the provider-neutral
 * `ImageSourceMeta`. Returns `undefined` when the projection
 * is absent or when the asset is missing / malformed — the
 * mapper treats "no metadata" as "the editor did not pick a
 * hotspot / crop on this asset", which is the same code path
 * the static / api / generic-CMS paths take (they never emit
 * `*Meta`).
 *
 * The function is intentionally tolerant: a Sanity record
 * whose image field is `null` (no image uploaded), whose
 * `asset._ref` is missing, or whose `hotspot` / `crop` /
 * `metadata` fields are missing or wrong-typed returns
 * `undefined`. The mapper never throws on a malformed image
 * projection — the canonical `string` URL on
 * `coverImage` / `image` / `images[]` is still emitted as a
 * fallback so the boundary record remains valid.
 */
function readImageMeta(value: unknown): ImageSourceMeta | undefined {
  if (!value || typeof value !== 'object') return undefined
  const v = value as { assetRef?: unknown, assetUrl?: unknown, hotspot?: unknown, crop?: unknown, metadata?: unknown }
  if (typeof v.assetRef !== 'string' || v.assetRef === '') return undefined
  if (typeof v.assetUrl !== 'string' || v.assetUrl === '') return undefined
  const meta: ImageSourceMeta = {
    assetRef: v.assetRef,
    assetUrl: v.assetUrl,
  }
  const hotspot = readHotspot(v.hotspot)
  if (hotspot !== undefined) meta.hotspot = hotspot
  const crop = readCrop(v.crop)
  if (crop !== undefined) meta.crop = crop
  const assetMetadata = readAssetMetadata(v.metadata)
  if (assetMetadata !== undefined) meta.metadata = assetMetadata
  return meta
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
  const coverImageMeta = readImageMeta(d.coverImageMeta)
  const statusRaw = readString(d, 'status')
  const status
    = statusRaw === 'available'
      || statusRaw === 'sold'
      || statusRaw === 'rented'
      || statusRaw === 'reserved'
      || statusRaw === 'hidden'
      ? statusRaw
      : 'available'

  const images = readStringArray(d, 'images') ?? []
  let imagesMeta: ImageSourceMeta[] | undefined
  const rawImagesMeta = d.imagesMeta
  if (Array.isArray(rawImagesMeta)) {
    const list: ImageSourceMeta[] = []
    for (const entry of rawImagesMeta) {
      const m = readImageMeta(entry)
      if (m !== undefined) list.push(m)
    }
    if (list.length > 0) imagesMeta = list
  }

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
    images,
    coverImage,
    coverImageMeta,
    imagesMeta,
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
  const imageMeta = readImageMeta(d.imageMeta)

  return {
    id,
    name,
    slug,
    role,
    bio,
    image,
    imageMeta,
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
  const imageMeta = readImageMeta(d.imageMeta)
  const sizeUnit = readString(d, 'sizeUnit') === 'imperial' ? 'imperial' : 'metric'

  return {
    id,
    name,
    slug,
    status,
    location,
    description,
    image,
    imageMeta,
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
