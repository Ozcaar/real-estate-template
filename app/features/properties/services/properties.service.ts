// The property service is bundled to BOTH the server and the
// client. The data source is server-only by code organization:
// the api-adapter module, the `NUXT_PROPERTIES_*` env vars, and
// the static / api source selection all live in
// `server/utils/properties.ts`. The service consumes the
// resolved public list through the same-origin Nitro endpoint
// at `/api/properties` (served by
// `server/api/properties.get.ts`), so the client bundle
// references only a same-origin path -- never the external
// API URL, never the `NUXT_PROPERTIES_*` env-var names, never
// the api-adapter module.
//
// `$fetch` is Nuxt 4's universal fetch. It is auto-imported
// on both server and client and resolves to a same-origin
// request on the server (loopback to the Nitro endpoint) and
// a same-origin HTTP request on the client. The TypeScript
// declaration below matches the auto-injected `$fetch` global;
// the runtime call uses no new dependency (the implementation
// is `ofetch`, which is a transitive dep of Nuxt).
import type { Property } from '../types/property.types'

declare const $fetch: <T = unknown>(url: string, options?: unknown) => Promise<T>

/**
 * Boundary note.
 *
 * This module is bundled to BOTH the server and the client.
 * It must NOT import the api-adapter module
 * (`app/core/data-source/adapters/api-adapter.ts`) and it must
 * NOT contain `NUXT_PROPERTIES_DATA_SOURCE`,
 * `NUXT_PROPERTIES_API_URL`, or `NUXT_PROPERTIES_API_TIMEOUT_MS`
 * -- those are private configuration that lives in
 * `server/utils/properties.ts`. The service consumes the
 * resolved public list through the same-origin Nitro endpoint
 * at `/api/properties`; the client bundle references only the
 * same-origin path.
 *
 * The boundary regression test in
 * `app/features/properties/services/properties.service.boundary.test.ts`
 * pins this contract: a textual scan of this file fails the
 * suite if any of the api-adapter import, the env-var name
 * strings, or the `typeof window === 'undefined'` guard ever
 * reappears.
 */

/**
 * Typed filter shape consumed by {@link propertiesService.filter}. All fields
 * are optional; undefined means "do not filter on this criterion". Values are
 * compared case-insensitively against the matching property fields.
 */
export interface PropertyFilters {
  operation?: string
  type?: string
  location?: string
}

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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export const propertiesService = {
  async loadAll(): Promise<readonly Property[]> {
    return await $fetch<readonly Property[]>('/api/properties')
  },

  getAll(properties: readonly Property[]): Property[] {
    return properties.filter(property => property.status !== 'hidden')
  },

  getBySlug(properties: readonly Property[], slug: string): Property | undefined {
    return properties.find(
      property => property.slug === slug && property.status !== 'hidden',
    )
  },

  filter(
    properties: readonly Property[],
    filters: PropertyFilters,
    sort: PropertySort = 'featured',
  ): Property[] {
    const operation = normalize(filters.operation)
    const type = normalize(filters.type)
    const location = normalizeText(filters.location)

    const visible = this.getAll(properties)
    const filtered = visible.filter((property) => {
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

  getFeatured(properties: readonly Property[], limit?: number): Property[] {
    const featured = this.getAll(properties).filter(property => property.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },

  getRelated(
    properties: readonly Property[],
    current: Property,
    limit = 3,
  ): Property[] {
    const isRelatedCandidate = (property: Property) =>
      property.id !== current.id
      && (property.status === 'available' || property.status === 'reserved')

    const candidates = this.getAll(properties).filter(isRelatedCandidate)

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
    return this.getFeatured(properties, limit).filter(isRelatedCandidate)
  },
}