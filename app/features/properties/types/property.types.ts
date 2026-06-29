/**
 * Property domain model.
 *
 * Mirrors `docs/DATA_MODELS.md`. Kept inside the properties feature (not the
 * global `types/`) because it is owned by this module. The shape is
 * backend-friendly so the static MVP data can later be replaced by an API
 * response without touching components.
 */
import type { MeasurementUnit } from '~/types/agency.types'

export type PropertyOperationType = 'sale' | 'rent'

export type PropertyType =
  | 'house'
  | 'apartment'
  | 'land'
  | 'commercial'
  | 'office'

export type PropertyStatus =
  | 'available'
  | 'sold'
  | 'rented'
  | 'reserved'
  | 'hidden'

export interface PropertyCoordinates {
  lat: number
  lng: number
}

export interface Property {
  id: string
  title: string
  slug: string
  description: string
  operationType: PropertyOperationType
  propertyType: PropertyType
  price: number
  currency: string
  location: string
  city: string
  state: string
  country: string
  bedrooms?: number
  bathrooms?: number
  parkingSpaces?: number
  /**
   * Unit of `constructionSize` and `landSize`. Defaults to the agency
   * `measurementUnit` when omitted so a record that pre-dates this field
   * continues to render correctly.
   *
   * The number is rendered **as-is** in the declared unit — the template does
   * not perform automatic m² ↔ ft² conversion. When a real agency mixes
   * units in the same catalog, set this per record.
   */
  sizeUnit?: MeasurementUnit
  constructionSize?: number
  landSize?: number
  images: string[]
  coverImage: string
  amenities: string[]
  developmentId?: string
  agentId?: string
  coordinates?: PropertyCoordinates
  status: PropertyStatus
  featured: boolean
}
