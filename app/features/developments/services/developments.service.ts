import type { Development } from '../types/development.types'
import { sampleDevelopments } from '../data/developments'

/**
 * Developments business logic.
 *
 * Mirrors the structure of `propertiesService`: every consumer goes
 * through this service so the static data can later be swapped for an
 * API response (e.g. `$fetch('/api/developments')`) without changing
 * components. Methods are synchronous over static data, which keeps
 * SSR rendering deterministic.
 *
 * The development model is intentionally simpler than the property
 * model: there is no `status: 'hidden'` field, so `getAll` returns the
 * full catalog as-is. If a future task adds a visibility flag, the
 * same `filter(property => property.status !== 'hidden')` pattern used
 * by `propertiesService` is the place to wire it in.
 */
export const developmentsService = {
  /** Every development in the catalog, in insertion order. */
  getAll(): Development[] {
    return sampleDevelopments
  },

  /**
   * Look up a single development by its slug. Returns `undefined` when
   * the slug is unknown so callers can map that to a proper 404 (e.g.
   * via `createError({ statusCode: 404, ... })`).
   */
  getBySlug(slug: string): Development | undefined {
    return sampleDevelopments.find(development => development.slug === slug)
  },

  /**
   * Featured developments for showcases such as the homepage. The
   * `featured` boolean defaults to `false` on the data model, so
   * records that pre-date the field are never selected.
   */
  getFeatured(limit?: number): Development[] {
    const featured = sampleDevelopments.filter(development => development.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },

  /**
   * Find developments similar to `current` using only existing
   * data-model fields. The result is consumed by the related-developments
   * section on the development detail page.
   *
   * Weighted score over the visible catalog:
   *
   *   +2  same `status` (e.g. both pre-sale)
   *   +2  same primary city (the part of `location` after the last
   *       comma; see below)
   *   +1  area overlap (the two ranges `[areaFrom, areaTo]` intersect)
   *   +1  typical bedroom count matches
   *
   * Excluded: the current development itself.
   *
   * The location match uses the part of `location` after the last
   * comma, which holds the city. `Development.location` is a free-text
   * string (e.g. `"Valle Oriente, Monterrey"`) — splitting on `,` and
   * trimming the last segment is enough for the static catalog without
   * introducing a new `city` field on the data model. When a future
   * task adds a structured `Development.address` (mirroring
   * `Property.city`), this helper is the place to swap to it.
   *
   * Results are sorted by score (desc), then by `featured` (desc),
   * then by `id` (asc) for a deterministic order, and capped at
   * `limit`.
   *
   * Graceful fallback: when the rule produces no positive-score
   * candidates (e.g. a single-development catalog), the function
   * falls back to `getFeatured(limit)` filtered by the same exclusion
   * predicate so the current development is never surfaced as its own
   * related listing.
   */
  getRelated(current: Development, limit = 3): Development[] {
    const isRelatedCandidate = (development: Development) =>
      development.id !== current.id

    const candidates = this.getAll().filter(isRelatedCandidate)

    const cityOf = (location: string): string => {
      const parts = location.split(',').map(part => part.trim()).filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : ''
    }

    type Scored = { development: Development; score: number }
    const scored: Scored[] = candidates.map((development) => {
      let score = 0
      if (development.status === current.status) score += 2
      const currentCity = cityOf(current.location)
      if (currentCity && cityOf(development.location) === currentCity) {
        score += 2
      }
      if (
        typeof development.areaFrom === 'number'
        && typeof development.areaTo === 'number'
        && typeof current.areaFrom === 'number'
        && typeof current.areaTo === 'number'
        && development.areaFrom <= current.areaTo
        && development.areaTo >= current.areaFrom
      ) {
        score += 1
      }
      if (
        typeof development.bedrooms === 'number'
        && development.bedrooms === current.bedrooms
      ) {
        score += 1
      }
      return { development, score }
    })

    const positives = scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.development.featured !== b.development.featured) {
          return a.development.featured ? -1 : 1
        }
        return a.development.id.localeCompare(b.development.id)
      })
      .slice(0, limit)
      .map((entry) => entry.development)

    if (positives.length > 0) return positives
    return this.getFeatured(limit).filter(isRelatedCandidate)
  },
}
