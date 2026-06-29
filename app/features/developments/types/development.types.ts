/**
 * Development domain model.
 *
 * Mirrors `docs/DATA_MODELS.md`. Kept inside the developments feature (not
 * the global `types/`) because it is owned by this module. The shape is
 * backend-friendly so the static MVP data can later be replaced by an API
 * response without touching components.
 */
import type { MeasurementUnit } from '~/types/agency.types'

export type DevelopmentStatus =
  | 'pre-sale'
  | 'under-construction'
  | 'ready-to-deliver'
  | 'sold-out'

export interface Development {
  /** Unique development identifier. */
  id: string
  /** Display name (agency content, not an i18n key). */
  name: string
  /** Slug reserved for a future detail page (`/developments/[slug]`). */
  slug: string
  /** Current build / sales status. */
  status: DevelopmentStatus
  /** Location: neighborhood, city, state (agency content). */
  location: string
  /** Short marketing description (agency content). */
  description: string
  /** Cover image path (served from `public/`). */
  image: string
  /** Starting price in the configured currency. Optional. */
  priceFrom?: number
  /** Ending price in the configured currency. Optional. */
  priceTo?: number
  /** ISO 4217 currency code. Defaults to the agency currency at render time. */
  currency?: string
  /** Total number of units in the development. */
  units?: number
  /** Typical bedroom count, e.g. 2 or 3. */
  bedrooms?: number
  /**
   * Unit of `areaFrom` and `areaTo`. Defaults to the agency
   * `measurementUnit` when omitted so a record that pre-dates this field
   * continues to render correctly.
   *
   * The number is rendered **as-is** in the declared unit — the template does
   * not perform automatic m² ↔ ft² conversion. When a real agency mixes
   * units in the same catalog, set this per record.
   */
  sizeUnit?: MeasurementUnit
  /** Smallest unit size. */
  areaFrom?: number
  /** Largest unit size. */
  areaTo?: number
  /** Expected delivery date as an ISO 8601 string (`YYYY-MM` or `YYYY-MM-DD`). */
  deliveryDate?: string
  /** Whether to highlight this development in showcases. */
  featured?: boolean
}
