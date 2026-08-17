import { z } from 'zod'
import type {
  Development,
  DevelopmentStatus,
} from '../types/development.types'
import type { MeasurementUnit } from '~/types/agency.types'

/**
 * Runtime validation for the development domain model.
 *
 * Mirrors `docs/DATA_MODELS.md` and the TypeScript types in
 * `development.types.ts`. The hand-written interface remains the
 * canonical type; this schema is the runtime boundary so any
 * external data (the bundled MVP catalog today, an HTTP API
 * response tomorrow, a CMS adapter in a future task) is
 * validated with the same rules before it reaches services and
 * components — no UI changes required when the source is
 * swapped.
 *
 * **Field rules.**
 *
 *  - `id`, `name`, `slug`, `status`, `location`, `description`,
 *    `image` are required. The slug is the canonical
 *    `/developments/[slug]` route parameter; a missing or
 *    empty slug would 404 the detail page.
 *  - `priceFrom` / `priceTo` are optional non-negative numbers.
 *    The pair represents a price range; the detail page also
 *    handles a single-value price when `priceTo` is omitted or
 *    equal to `priceFrom`.
 *  - `units` and `bedrooms` are optional non-negative integers.
 *    Omitted means "unknown / not published".
 *  - `currency` is an optional ISO 4217 string (defaults to the
 *    agency currency at render time).
 *  - `sizeUnit` is an optional `'metric' | 'imperial'` enum.
 *    Defaults to the agency `measurementUnit` at render time.
 *  - `areaFrom` / `areaTo` are optional non-negative numbers.
 *  - `deliveryDate` is an optional ISO 8601 string (the
 *    rendered page treats it as opaque text; the schema
 *    enforces a non-empty string when present).
 *  - `featured` is an optional boolean (defaults to `false`).
 *
 * The schema is consumed by:
 *
 *  - the static adapter at module load
 *    (`server/utils/developments.ts` → `createStaticDataSource({ schema: developmentListSchema })`)
 *    so a malformed record fails at startup rather than at
 *    first request;
 *  - the api adapter at response-parse time
 *    (`createApiDataSource({ schema: developmentListSchema })`) so
 *    the remote source is held to the same rules as the bundled
 *    static data.
 *
 * The compile-time guard at the bottom pins the schema output
 * to the canonical {@link Development} interface so the two
 * cannot drift.
 */

export const developmentStatusSchema = z.enum([
  'pre-sale',
  'under-construction',
  'ready-to-deliver',
  'sold-out',
]) satisfies z.ZodType<DevelopmentStatus>

export const developmentSizeUnitSchema = z.enum([
  'metric',
  'imperial',
]) satisfies z.ZodType<MeasurementUnit>

export const developmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: developmentStatusSchema,
  location: z.string().min(1),
  description: z.string().min(1),
  image: z.string().min(1),
  priceFrom: z.number().nonnegative().optional(),
  priceTo: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  units: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  sizeUnit: developmentSizeUnitSchema.optional(),
  areaFrom: z.number().nonnegative().optional(),
  areaTo: z.number().nonnegative().optional(),
  deliveryDate: z.string().min(1).optional(),
  featured: z.boolean().optional(),
}) satisfies z.ZodType<Development>

export const developmentListSchema = z.array(developmentSchema)

/**
 * Type inferred from the schema. Kept assignable to the canonical
 * {@link Development} interface via the assertion below, so the
 * schema and the type cannot drift.
 */
export type DevelopmentInput = z.infer<typeof developmentSchema>

// Compile-time guard: the schema output and the hand-written interface
// must stay structurally identical. If either side changes, this fails
// to compile.
const _typeCheck: DevelopmentInput extends Development
  ? Development extends DevelopmentInput
    ? true
    : never
  : never = true
void _typeCheck