import type {
  PropertyType,
  PropertyOperationType,
  PropertyStatus,
} from '../types/property.types'

/**
 * Selectable option describing a property type. `labelKey` is an i18n key
 * (never raw text) and `icon` is a Nuxt Icon name. Used by category grids,
 * search selects and any UI that needs to enumerate property types.
 */
export interface PropertyTypeOption {
  value: PropertyType
  labelKey: string
  icon: string
}

export const PROPERTY_TYPE_OPTIONS: PropertyTypeOption[] = [
  { value: 'house', labelKey: 'properties.types.house', icon: 'mdi:home-outline' },
  { value: 'apartment', labelKey: 'properties.types.apartment', icon: 'mdi:office-building-outline' },
  { value: 'land', labelKey: 'properties.types.land', icon: 'mdi:image-filter-hdr' },
  { value: 'commercial', labelKey: 'properties.types.commercial', icon: 'mdi:storefront-outline' },
  { value: 'office', labelKey: 'properties.types.office', icon: 'mdi:briefcase-outline' },
]

export interface PropertyOperationOption {
  value: PropertyOperationType
  labelKey: string
}

export const OPERATION_TYPE_OPTIONS: PropertyOperationOption[] = [
  { value: 'sale', labelKey: 'properties.operations.sale' },
  { value: 'rent', labelKey: 'properties.operations.rent' },
]

/** i18n key for a given property type. */
export const propertyTypeLabelKey = (type: PropertyType): string =>
  `properties.types.${type}`

/** i18n key for a given operation type. */
export const operationTypeLabelKey = (type: PropertyOperationType): string =>
  `properties.operations.${type}`

/** i18n key for a given property status. */
export const propertyStatusLabelKey = (status: PropertyStatus): string =>
  `properties.status.${status}`
