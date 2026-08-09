import type { Agent } from '../types/agent.types'
import { sampleAgents } from '../data/agents'

/**
 * Agents business logic.
 *
 * Mirrors the structure of `developmentsService`: every consumer goes
 * through this service so the static data can later be swapped for an
 * API response (e.g. `$fetch('/api/agents')`) without changing
 * components. Methods are synchronous over static data, which keeps
 * SSR rendering deterministic.
 *
 * The agent model is intentionally simpler than the development
 * model: there is no `status: 'hidden'` field, no `featured` flag,
 * and no `deliveryDate` / `units` / `priceFrom` / `areaFrom`
 * numeric fields. The detail page therefore does not need a
 * `getFeatured` or `getRelated` helper — the listing is small
 * (4 records in the static catalog) and a "related agents" section
 * has no obvious relatedness signal in the data model. When a
 * future task adds one (e.g. `specialty` overlap, shared
 * `developmentId` on the property model, or a "team lead" graph),
 * the `getRelated` method is the place to add it.
 */
export const agentsService = {
  /** Every agent in the catalog, in insertion order. */
  getAll(): Agent[] {
    return sampleAgents
  },

  /**
   * Look up a single agent by its slug. Returns `undefined` when
   * the slug is unknown so callers can map that to a proper 404
   * (e.g. via `createError({ statusCode: 404, ... })`).
   *
   * Slug lookups are case-sensitive. The static catalog ships
   * already-lowercase slugs; the lookup is case-sensitive so a
   * future agency that adds a mixed-case slug (e.g. an agent
   * named "McDonald" with the slug `mcdonald`) gets a stable
   * 404 for the wrong-case path. The development and property
   * services use the same case-sensitive contract.
   */
  getBySlug(slug: string): Agent | undefined {
    return sampleAgents.find(agent => agent.slug === slug)
  },
}
