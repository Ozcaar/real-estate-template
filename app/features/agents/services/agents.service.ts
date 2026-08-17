// The agent service is bundled to BOTH the server and the
// client. The data source is server-only by code organization:
// the api-adapter module, the `NUXT_AGENTS_*` env vars, and the
// static / api source selection all live in
// `server/utils/agents.ts`. The service consumes the resolved
// public list through the same-origin Nitro endpoint at
// `/api/agents` (served by `server/api/agents.get.ts`), so the
// client bundle references only a same-origin path -- never
// the external API URL, never the `NUXT_AGENTS_*` env-var
// names, never the api-adapter module.
//
// `$fetch` is Nuxt 4's universal fetch. It is auto-imported
// on both server and client and resolves to a same-origin
// request on the server (loopback to the Nitro endpoint) and
// a same-origin HTTP request on the client. The TypeScript
// declaration below matches the auto-injected `$fetch` global;
// the runtime call uses no new dependency (the implementation
// is `ofetch`, which is a transitive dep of Nuxt).
import type { Agent } from '../types/agent.types'

declare const $fetch: <T = unknown>(url: string, options?: unknown) => Promise<T>

/**
 * Boundary note.
 *
 * This module is bundled to BOTH the server and the client.
 * It must NOT import the api-adapter module
 * (`app/core/data-source/adapters/api-adapter.ts`) and it must
 * NOT contain `NUXT_AGENTS_DATA_SOURCE`, `NUXT_AGENTS_API_URL`,
 * or `NUXT_AGENTS_API_TIMEOUT_MS` -- those are private
 * configuration that lives in `server/utils/agents.ts`. The
 * service consumes the resolved public list through the
 * same-origin Nitro endpoint at `/api/agents`; the client
 * bundle references only the same-origin path.
 *
 * The boundary regression test in
 * `app/features/agents/services/agents.service.boundary.test.ts`
 * pins this contract: a textual scan of this file fails the
 * suite if any of the api-adapter import, the env-var name
 * strings, or the `typeof window === 'undefined'` guard ever
 * reappears.
 */

/**
 * Agents business logic (Task 104).
 *
 * Mirrors the structure of `propertiesService` after the v1.1.0
 * M17 async contract evolution:
 *
 *  - `loadAll()` is async and returns the resolved public
 *    list from the same-origin Nitro endpoint. Pages consume
 *    it through Nuxt's `useAsyncData('agents:listing', () =>
 *    agentsService.loadAll())` so SSR awaits the load before
 *    rendering.
 *  - The pure helpers (`getBySlug(data, slug)`) take the
 *    loaded data as their first argument. They do not perform
 *    any I/O and do not call `loadAll()` themselves; the page
 *    resolves the data once and threads it through.
 *
 * The agent model is intentionally simpler than the property
 * model: there is no `status: 'hidden'` field, no `featured`
 * flag, and no `deliveryDate` / `units` / `priceFrom` /
 * `areaFrom` numeric fields. The detail page therefore does
 * not need a `getFeatured` or `getRelated` helper — the
 * listing is small (4 records in the static catalog) and a
 * "related agents" section has no obvious relatedness
 * signal in the data model. When a future task adds one
 * (e.g. `specialty` overlap, shared `developmentId` on the
 * property model, or a "team lead" graph), the `getRelated`
 * method is the place to add it.
 *
 * **Data source.** The service consumes the resolved public
 * list through the same-origin Nitro endpoint, which delegates
 * to the server-only loader at `server/utils/agents.ts`. The
 * loader owns the static / api source selection, reads the
 * `NUXT_AGENTS_*` env vars, and validates the result with
 * `agentListSchema`. A rebrand that wants a real HTTP API
 * configures `NUXT_AGENTS_DATA_SOURCE=api` +
 * `NUXT_AGENTS_API_URL` at deploy time; the service
 * signature is unchanged.
 */
export const agentsService = {
  /**
   * Async loader. Fetches the resolved public agent list from
   * the same-origin Nitro endpoint at `/api/agents`. Returns
   * the validated list (the Zod parse is the loader's
   * responsibility; the endpoint is a thin transport).
   *
   * Pages consume this through Nuxt's `useAsyncData` so SSR
   * awaits the load before rendering. The returned array is
   * typed as `readonly Agent[]` so a rebrand cannot mutate
   * the resolved list through this surface.
   */
  async loadAll(): Promise<readonly Agent[]> {
    return await $fetch<readonly Agent[]>('/api/agents')
  },

  /**
   * Look up a single agent by its slug. Returns `undefined`
   * when the slug is unknown so callers can map that to a
   * proper 404 (e.g. via `createError({ statusCode: 404, ...
   * })`).
   *
   * The pure helper takes the loaded data as its first
   * argument. It does NOT call `loadAll()` — the page
   * resolves the data once and threads it through. This is
   * the same shape `propertiesService.getBySlug` uses after
   * the v1.1.0 M17 async evolution.
   *
   * Slug lookups are case-sensitive. The static catalog ships
   * already-lowercase slugs; the lookup is case-sensitive so a
   * future agency that adds a mixed-case slug (e.g. an agent
   * named "McDonald" with the slug `mcdonald`) gets a stable
   * 404 for the wrong-case path. The development and property
   * services use the same case-sensitive contract.
   */
  getBySlug(agents: readonly Agent[], slug: string): Agent | undefined {
    return agents.find(agent => agent.slug === slug)
  },
}