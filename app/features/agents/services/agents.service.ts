import type { Agent } from '../types/agent.types'
import { sampleAgents } from '../data/agents'
import {
  DEFAULT_DATA_SOURCE,
  selectDataSource,
  type DataSourceAdapter,
} from '../../../core/data-source/data-source'
import { createStaticDataSource } from '../../../core/data-source/adapters/static-adapter'

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
 *
 * **Data source.** The service consumes the bundled sample
 * catalog through the data-source adapter boundary (see
 * `app/core/data-source/`). A future release can swap the
 * source for an HTTP API or a headless CMS by registering a
 * new adapter and switching {@link DEFAULT_DATA_SOURCE} (or
 * supplying a per-feature `DataSourceConfig`) without changing
 * the service signatures pages and components depend on. The
 * static adapter ships without a Zod schema for `Agent`
 * because no agent schema exists yet; the data file is the
 * source of truth. When an agent schema is added in a future
 * pass, it is passed to `createStaticDataSource` as the
 * `schema` option exactly the way the property service does.
 */

/**
 * The agents data-source adapter. The selector throws
 * `DataSourceNotImplementedError` if the default kind ever
 * changes to a kind without a registered adapter.
 */
const agentsAdapter: DataSourceAdapter<Agent> = selectDataSource(
  DEFAULT_DATA_SOURCE,
  {
    static: createStaticDataSource<Agent>({
      data: sampleAgents,
      source: 'app/features/agents/data/agents.ts',
    }),
  },
)

/**
 * The cached, full list of agents. The service's `getAll()`
 * returns this list as-is (no hidden filtering because the
 * `Agent` model has no `status` field), matching the
 * pre-adapter behaviour exactly.
 */
const allAgents: readonly Agent[] = agentsAdapter.getAll()

export const agentsService = {
  /** Every agent in the catalog, in insertion order. */
  getAll(): Agent[] {
    return allAgents
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
    return allAgents.find(agent => agent.slug === slug)
  },
}
