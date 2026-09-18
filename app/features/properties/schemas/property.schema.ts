import { z } from 'zod'
import type {
  Property,
  PropertyType,
  PropertyOperationType,
  PropertyStatus,
} from '../types/property.types'
import type { MeasurementUnit } from '~/types/agency.types'
import { imageSourceMetaSchema } from '~/core/image/image-source.schema'

/**
 * Runtime validation for the property domain model.
 *
 * Mirrors `docs/DATA_MODELS.md` and the TypeScript types in
 * `property.types.ts`. The hand-written interfaces remain the canonical types;
 * this schema is the runtime boundary so that any external data (static MVP
 * data today, a CMS/API response later) can be validated with the same rules
 * before it reaches services and components — no UI changes required when the
 * source is swapped.
 */

export const propertyOperationTypeSchema = z.enum([
  'sale',
  'rent',
]) satisfies z.ZodType<PropertyOperationType>

export const propertyTypeSchema = z.enum([
  'house',
  'apartment',
  'land',
  'commercial',
  'office',
]) satisfies z.ZodType<PropertyType>

export const propertyStatusSchema = z.enum([
  'available',
  'sold',
  'rented',
  'reserved',
  'hidden',
]) satisfies z.ZodType<PropertyStatus>

export const propertySizeUnitSchema = z.enum([
  'metric',
  'imperial',
]) satisfies z.ZodType<MeasurementUnit>

export const propertyCoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
})

export const propertySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  operationType: propertyOperationTypeSchema,
  propertyType: propertyTypeSchema,
  price: z.number().nonnegative(),
  currency: z.string().min(1),
  location: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  parkingSpaces: z.number().int().nonnegative().optional(),
  sizeUnit: propertySizeUnitSchema.optional(),
  constructionSize: z.number().nonnegative().optional(),
  landSize: z.number().nonnegative().optional(),
  images: z.array(z.string().min(1)),
  /**
   * Non-empty by construction: the cover image is the LCP candidate on
   * the property detail page and the primary visual on the catalog card.
   * An empty string would render a broken `<img>` (or trigger the
   * `<PropertyGallery>` empty-state fallback) before any consumer code
   * could catch it. Tightening to `.min(1)` here lets the Zod parser
   * reject malformed records at module load, with no effect on the
   * existing sample data (every shipped record has a non-empty path).
   */
  coverImage: z.string().min(1),
  /**
   * Provider-neutral metadata for the cover image. Populated by the
   * Sanity mapper when the editor has saved a hotspot + crop on the
   * source asset; `undefined` (and therefore omitted from the parsed
   * record) for the static / api / generic-CMS paths and for Sanity
   * records without editorial crop metadata. The rendering layer
   * treats `undefined` as "no metadata, use the plain asset URL".
   */
  coverImageMeta: imageSourceMetaSchema.optional(),
  /**
   * Provider-neutral metadata for each gallery image. Same shape and
   * same fallback contract as `coverImageMeta`. Indexed in lockstep
   * with `images` — `imagesMeta[i]` (when present) corresponds to
   * `images[i]`. Records that pre-date the field ship with
   * `imagesMeta` absent; the renderer falls back to the plain URLs.
   */
  imagesMeta: z.array(imageSourceMetaSchema).optional(),
  amenities: z.array(z.string().min(1)),
  developmentId: z.string().optional(),
  agentId: z.string().optional(),
  coordinates: propertyCoordinatesSchema.optional(),
  status: propertyStatusSchema,
  featured: z.boolean(),
})

export const propertyListSchema = z.array(propertySchema)

/**
 * Type inferred from the schema. Kept assignable to the canonical {@link Property}
 * interface via the assertion below, so the schema and the types cannot drift.
 */
export type PropertyInput = z.infer<typeof propertySchema>

// Compile-time guard: the schema output and the hand-written interface must
// stay structurally identical. If either side changes, this fails to compile.
const _typeCheck: PropertyInput extends Property
  ? Property extends PropertyInput
    ? true
    : never
  : never = true
void _typeCheck
