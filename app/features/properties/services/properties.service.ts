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

/**
 * Allow-list of sort orders the listing page can request. New options
 * (e.g. `bedrooms-desc`, `area-desc`) can be added here without touching
 * the data model — the sort operates on existing fields only.
 *
 * `featured` is the default: properties with `featured: true` come first,
 * ties broken by `id` ascending for a deterministic order across SSR
 * and CSR (no hydration mismatch).
 */
export type PropertySort = 'featured' | 'price-asc' | 'price-desc'

const VALID_SORTS: readonly PropertySort[] = ['featured', 'price-asc', 'price-desc'] as const

export function isPropertySort(value: unknown): value is PropertySort {
  return typeof value === 'string' && (VALID_SORTS as readonly string[]).includes(value)
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase()
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}


/**
 * Accent-insensitive text normalization: lowercase, trim, and strip
 * diacritics (combining marks) so that searches like "Mexico" match
 * "México" or "Queretaro" match "Querétaro". Uses the Unicode NFD
 * decomposition + combining-mark strip pattern (no external dependency).
 * Applied to the location filter only — operation and property type
 * values are enums that never contain diacritics, so the simpler
 * `normalize` helper is sufficient for those.
 */
function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
   * Filter the visible property catalog by a typed set of criteria, then
   * sort the result. Hidden properties are always excluded. Empty /
   * undefined filter values are treated as "no constraint" so callers can
   * pass a raw `useRoute().query` shape without sanitizing it first.
   *
   * The default sort (`featured`) puts `featured: true` records first and
   * breaks ties by `id` ascending, which is stable across SSR and CSR
   * (no hydration mismatch). Price-based sorts always use `id` ascending
   * as the tiebreaker so equal-priced properties render in a deterministic
   * order.
   *
   * **Service contract.** This method owns the listing query and sort
   * behavior: `operation` (sale/rent exact match), `type` (property type
   * exact match), `location` (case-insensitive and accent-insensitive
   * substring match against `location` + `city` + `state` + `country`),
   * and the `sort` allow-list (`featured` / `price-asc` / `price-desc`).
   * The query shape consumed by callers (the URL
   * `?operation=...&type=...&location=...&sort=...` params, the
   * `PropertySort` type, the `isPropertySort` type guard) is documented
   * in `docs/DATA_MODELS.md` Section 9 — "Listing Query & Sort Shape".
   * Any change to the filter logic, the sort weights, the
   * accent-insensitive normalization, or the type guard must keep that
   * doc in sync (and vice versa).
   */
  filter(filters: PropertyFilters, sort: PropertySort = 'featured'): Property[] {
    const operation = normalize(filters.operation)
    const type = normalize(filters.type)
    const location = normalizeText(filters.location)

    const filtered = this.getAll().filter((property) => {
      if (operation && normalize(property.operationType) !== operation) {
        return false
      }
      if (type && normalize(property.propertyType) !== type) {
        return false
      }
      if (location) {
        const haystack = [
          slugify(property.location),
          slugify(property.city),
          slugify(property.state),
          slugify(property.country),
        ]
          .map(normalizeText)
          .join(' ')
        if (!haystack.includes(slugify(location))) return false
      }
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
        break
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id))
        break
      case 'featured':
      default:
        sorted.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1
          return a.id.localeCompare(b.id)
        })
        break
    }
    return sorted
  },

  /**
   * Featured properties for showcases such as the homepage.
   * @param limit Optional maximum number of properties to return.
   */
  getFeatured(limit?: number): Property[] {
    const featured = this.getAll().filter(property => property.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },

  /**
   * Find properties similar to `current` using only existing data-model
   * fields. The result is consumed by the related-properties section on the
   * property detail page.
   *
   * Weighted score over the visible catalog:
   *
   *   +3  same propertyType
   *   +2  same operationType
   *   +2  same city
   *   +1  same country (only when city did not already match)
   *   +2  same developmentId (sibling units in the same project)
   *   +1  same agentId
   *   +1  price within 30% of `current.price`
   *
   * Excluded: the current property itself and any record whose status is
   * not `available` or `reserved` (sold, rented and hidden properties are
   * not surfaced as related listings).
   *
   * Results are sorted by score (desc), then by `featured` (desc), then
   * by `id` (asc) for a deterministic order, and capped at `limit`.
   *
   * Graceful fallback: when the rule produces no positive-score
   * candidates (e.g. a single-property catalog), the function falls
   * back to `getFeatured(limit)` filtered by the same exclusion
   * predicate so the current property is never surfaced as its own
   * related listing and sold / rented records are never included.
   */
  getRelated(current: Property, limit = 3): Property[] {
    const isRelatedCandidate = (property: Property) =>
      property.id !== current.id
      && (property.status === 'available' || property.status === 'reserved')

    const candidates = this.getAll().filter(isRelatedCandidate)

    type Scored = { property: Property; score: number }
    const scored: Scored[] = candidates.map((property) => {
      let score = 0
      if (property.propertyType === current.propertyType) score += 3
      if (property.operationType === current.operationType) score += 2
      if (property.city === current.city) {
        score += 2
      } else if (property.country === current.country) {
        score += 1
      }
      if (
        current.developmentId !== undefined
        && property.developmentId === current.developmentId
      ) {
        score += 2
      }
      if (
        current.agentId !== undefined
        && property.agentId === current.agentId
      ) {
        score += 1
      }
      if (
        current.price > 0
        && Math.abs(property.price - current.price) / current.price <= 0.3
      ) {
        score += 1
      }
      return { property, score }
    })

    const positives = scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.property.featured !== b.property.featured) {
          return a.property.featured ? -1 : 1
        }
        return a.property.id.localeCompare(b.property.id)
      })
      .slice(0, limit)
      .map((entry) => entry.property)

    if (positives.length > 0) return positives
    return this.getFeatured(limit).filter(isRelatedCandidate)
  },
}
