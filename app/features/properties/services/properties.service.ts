import type { Property } from '../types/property.types'
import { sampleProperties } from '../data/properties'

/**
 * Typed filter shape consumed by {@link propertiesService.filter}. All fields
 * are optional; undefined means "do not filter on this criterion". Values are
 * compared case-insensitively against the matching property fields.
 */
export interface PropertyFilters {
  /** Match against `Property.operationType` (`sale` | `rent`). */
  operation?: string
  /** Match against `Property.propertyType` (`house`, `apartment`, ...). */
  type?: string
  /**
   * Free-text match against `Property.location`, `Property.city`,
   * `Property.state` and `Property.country` — the same places the
   * `HomeSearchBar` and `HomeLocations` sections link to.
   */
  location?: string
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Properties business logic.
 *
 * For the MVP this reads from local static data. Because every consumer goes
 * through this service, the data source can later be swapped for an `api/`
 * layer (e.g. `$fetch('/api/properties')`) without changing components. Methods
 * are synchronous over static data, which keeps SSR rendering deterministic.
 */
export const propertiesService = {
  /** All visible properties (excludes hidden ones). */
  getAll(): Property[] {
    return sampleProperties.filter(property => property.status !== 'hidden')
  },

  /**
   * Look up a single visible property by its slug. Returns `undefined` when
   * the property does not exist or is hidden, so callers can map that to a
   * proper 404 (e.g. via `createError({ statusCode: 404, ... })`).
   */
  getBySlug(slug: string): Property | undefined {
    return sampleProperties.find(
      property => property.slug === slug && property.status !== 'hidden',
    )
  },

  /**
   * Filter the visible property catalog by a typed set of criteria. Hidden
   * properties are always excluded. Empty / undefined filter values are
   * treated as "no constraint" so callers can pass a raw `useRoute().query`
   * shape without sanitizing it first.
   */
  filter(filters: PropertyFilters): Property[] {
    const operation = normalize(filters.operation)
    const type = normalize(filters.type)
    const location = normalize(filters.location)

    return this.getAll().filter((property) => {
      if (operation && normalize(property.operationType) !== operation) {
        return false
      }
      if (type && normalize(property.propertyType) !== type) {
        return false
      }
      if (location) {
        const haystack = [
          property.location,
          property.city,
          property.state,
          property.country,
        ]
          .map(normalize)
          .join(' ')
        if (!haystack.includes(location)) return false
      }
      return true
    })
  },

  /**
   * Featured properties for showcases such as the homepage.
   * @param limit Optional maximum number of properties to return.
   */
  getFeatured(limit?: number): Property[] {
    const featured = this.getAll().filter(property => property.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },
}
