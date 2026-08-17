// The developments service is bundled to BOTH the server and the
// client. The data source is server-only by code organization:
// the api-adapter module, the `NUXT_DEVELOPMENTS_*` env vars, and the
// static / api source selection all live in
// `server/utils/developments.ts`. The service consumes the resolved
// public list through the same-origin Nitro endpoint at
// `/api/developments` (served by `server/api/developments.get.ts`), so
// the client bundle references only a same-origin path -- never the
// external API URL, never the `NUXT_DEVELOPMENTS_*` env-var names,
// never the api-adapter module.
//
// `$fetch` is Nuxt 4's universal fetch. It is auto-imported on both
// server and client and resolves to a same-origin request on the
// server (loopback to the Nitro endpoint) and a same-origin HTTP
// request on the client. The TypeScript declaration below matches
// the auto-injected `$fetch` global; the runtime call uses no new
// dependency (the implementation is `ofetch`, which is a transitive
// dep of Nuxt).
import type { Development } from '../types/development.types'

declare const $fetch: <T = unknown>(url: string, options?: unknown) => Promise<T>

/**
 * Boundary note.
 *
 * This module is bundled to BOTH the server and the client.
 * It must NOT import the api-adapter module
 * (`app/core/data-source/adapters/api-adapter.ts`) and it must
 * NOT contain `NUXT_DEVELOPMENTS_DATA_SOURCE`,
 * `NUXT_DEVELOPMENTS_API_URL`, or `NUXT_DEVELOPMENTS_API_TIMEOUT_MS`
 * -- those are private configuration that lives in
 * `server/utils/developments.ts`. The service consumes the
 * resolved public list through the same-origin Nitro endpoint at
 * `/api/developments`; the client bundle references only the
 * same-origin path.
 *
 * The boundary regression test in
 * `app/features/developments/services/developments.service.boundary.test.ts`
 * pins this contract: a textual scan of this file fails the
 * suite if any of the api-adapter import, the env-var name
 * strings, or the `typeof window === 'undefined'` guard ever
 * reappears.
 */

/**
 * Developments business logic.
 *
 * Mirrors the structure of `propertiesService` /
 * `agentsService` after the v1.1.0 M17 async contract
 * evolution:
 *
 *  - `loadAll()` is async and returns the resolved public list
 *    from the same-origin Nitro endpoint. Pages consume it
 *    through Nuxt's `useAsyncData('developments:listing' /
 *    'developments:detail', () => developmentsService.loadAll())`
 *    so SSR awaits the load before rendering.
 *  - Pure helpers (`getBySlug(data, slug)`, `getFeatured(data,
 *    limit?)`, `getRelated(data, current, limit = 3)`) take the
 *    loaded data as their first argument. They do NOT call
 *    `loadAll()` themselves; the page resolves the data once
 *    and threads it through.
 *
 * The development model is intentionally simpler than the
 * property model: there is no `status: 'hidden'` field, so the
 * helpers operate on the full catalog. If a future task adds a
 * visibility flag, the same `filter(p => p.status !==
 * 'hidden')` pattern used by `propertiesService` is the place
 * to wire it in.
 *
 * **Data source.** The service consumes the resolved public
 * list through the same-origin Nitro endpoint, which delegates
 * to the server-only loader at `server/utils/developments.ts`.
 * The loader owns the static / api source selection, reads the
 * `NUXT_DEVELOPMENTS_*` env vars, and validates the result with
 * `developmentListSchema`. A rebrand that wants a real HTTP
 * API configures `NUXT_DEVELOPMENTS_DATA_SOURCE=api` +
 * `NUXT_DEVELOPMENTS_API_URL` at deploy time; the service
 * signature is unchanged.
 */
export const developmentsService = {
  /**
   * Async loader. Fetches the resolved public development list
   * from the same-origin Nitro endpoint at `/api/developments`.
   * Returns the validated list (the Zod parse is the loader's
   * responsibility; the endpoint is a thin transport).
   *
   * Pages consume this through Nuxt's `useAsyncData` so SSR
   * awaits the load before rendering. The returned array is
   * typed as `readonly Development[]` so a rebrand cannot
   * mutate the resolved list through this surface.
   */
  async loadAll(): Promise<readonly Development[]> {
    return await $fetch<readonly Development[]>('/api/developments')
  },

  /**
   * Look up a single development by its slug. Returns
   * `undefined` when the slug is unknown so callers can map
   * that to a proper 404 (e.g. via `createError({ statusCode:
   * 404, ... })`).
   *
   * The pure helper takes the loaded data as its first
   * argument. It does NOT call `loadAll()` — the page resolves
   * the data once and threads it through. This is the same
   * shape `propertiesService.getBySlug` /
   * `agentsService.getBySlug` use after the v1.1.0 M17 async
   * contract evolution.
   *
   * Slug lookups are case-sensitive. The static catalog ships
   * already-lowercase slugs; the lookup is case-sensitive so a
   * future agency that adds a mixed-case slug (e.g. a
   * development named "Mirador-Residencial" with the slug
   * `mirador-residencial`) gets a stable 404 for the wrong-case
   * path. The properties and agents services use the same
   * case-sensitive contract.
   */
  getBySlug(developments: readonly Development[], slug: string): Development | undefined {
    return developments.find(development => development.slug === slug)
  },

  /**
   * Featured developments for showcases such as the homepage.
   * The `featured` boolean defaults to `false` on the data
   * model, so records that pre-date the field are never
   * selected.
   */
  getFeatured(developments: readonly Development[], limit?: number): Development[] {
    const featured = developments.filter(development => development.featured)
    return typeof limit === 'number' ? featured.slice(0, limit) : featured
  },

  /**
   * Find developments similar to `current` using only existing
   * data-model fields. The result is consumed by the
   * related-developments section on the development detail
   * page.
   *
   * Weighted score over the visible catalog:
   *
   *   +2  same `status` (e.g. both pre-sale)
   *   +2  same primary city (the part of `location` after
   *       the last comma; see below)
   *   +1  area overlap (the two ranges `[areaFrom,
   *       areaTo]` intersect)
   *   +1  typical bedroom count matches
   *
   * Excluded: the current development itself.
   *
   * The location match uses the part of `location` after the
   * last comma, which holds the city. `Development.location`
   * is a free-text string (e.g. `"Valle Oriente,
   * Monterrey"`) — splitting on `,` and trimming the last
   * segment is enough for the static catalog without
   * introducing a new `city` field on the data model. When a
   * future task adds a structured `Development.address`
   * (mirroring `Property.city`), this helper is the place to
   * swap to it.
   *
   * Results are sorted by score (desc), then by `featured`
   * (desc), then by `id` (asc) for a deterministic order, and
   * capped at `limit`.
   *
   * Graceful fallback: when the rule produces no
   * positive-score candidates (e.g. a single-development
   * catalog), the function falls back to
   * `getFeatured(limit)` filtered by the same exclusion
   * predicate so the current development is never surfaced as
   * its own related listing.
   */
  getRelated(
    developments: readonly Development[],
    current: Development,
    limit = 3,
  ): Development[] {
    const isRelatedCandidate = (development: Development) =>
      development.id !== current.id

    const candidates = developments.filter(isRelatedCandidate)

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
    return this.getFeatured(developments, limit).filter(isRelatedCandidate)
  },
}