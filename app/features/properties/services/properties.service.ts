import type { Property } from '../types/property.types'
import { sampleProperties } from '../data/properties'

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
   * Featured properties for showcases such as the homepage.
   * @param limit Optional maximum number of properties to return.
   */
  getFeatured(limit?: number): Property[] {
    const featured = this.getAll().filter(property => property.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },
}
