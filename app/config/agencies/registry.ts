import type { SiteConfig } from '~/types/site.types'
import { defaultAgencyConfig } from './default.agency'
import { validateAgencyConfig } from './agency.schema'
import { defaultI18nLocales } from '../i18n'
import { resolveTheme, themes } from '../../themes'
import type { AgencyConfig } from '~/types/agency.types'

/**
 * Minimal multi-tenant agency registry.
 *
 * The v1.x template ships as a single-agency website; the
 * registry is the smallest possible foundation that lets a future
 * deployment host multiple agencies behind a single build without
 * touching the page components. The registry is **not** a
 * multi-tenant backend: there is no auth, no billing, no
 * persistence, no admin. It is a key/value map that maps a
 * hostname to a pre-validated {@link AgencyConfig} + a
 * pre-resolved {@link SiteConfig}.
 *
 * **Server-only.** This file must not be imported from any
 * client-bundled module. The intended call sites are the
 * server-only plugin `app/plugins/tenancy.server.ts` (which
 * runs on every Nitro request) and the Vitest test file at
 * `app/config/agencies/registry.test.ts` (Node-only). The
 * client composable `app/composables/useSiteConfig.ts` never
 * touches this file; the SSR payload is the only channel
 * through which the resolved `SiteConfig` reaches the client.
 *
 * **How a request is resolved.**
 *
 *  1. The server-only plugin `app/plugins/tenancy.server.ts` runs
 *     on every Nitro request, reads `useRequestURL().hostname`,
 *     and calls its local `seedSiteConfig(host)` helper.
 *  2. `seedSiteConfig` calls {@link selectAgencyByHost} with the
 *     normalized hostname. If a registered entry's `hosts` list
 *     matches, that entry is used. Otherwise the default entry
 *     (whose id is {@link DEFAULT_TENANT_ID}) is used.
 *  3. The entry's pre-resolved `siteConfig` seeds the shared
 *     `useState('site-config')` so the SSR markup, the Nuxt
 *     payload, and the client hydration all agree on the active
 *     agency.
 *
 * **Request isolation.** `useState` is per-request in Nuxt — every
 * SSR request gets its own state. The plugin runs once per
 * request; the resolved value is serialized into the payload and
 * re-hydrated on the client. Client-side SPA navigation reuses
 * the SSR value (the host does not change on intra-site
 * navigation), so cross-tenant leakage is impossible.
 *
 * **Adding a tenant.** A rebrand adds one entry to
 * {@link agencyRegistry}:
 *
 * ```ts
 * export const agencyRegistry: AgencyRegistry = Object.freeze({
 *   [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
 *   acme: buildEntry(acmeAgencyConfig, ['acme.example.com', 'www.acme.example.com']),
 * })
 * ```
 *
 * No service or component changes. The resolver picks the right
 * entry per hostname automatically.
 */

/**
 * Single registry entry. Each entry owns:
 *
 *  - `id` — the tenant id (unique across the registry).
 *  - `config` — the validated {@link AgencyConfig} (the same
 *    shape every component consumes via `useSiteConfig()`).
 *  - `siteConfig` — the pre-resolved {@link SiteConfig} (agency
 *    + theme tokens) the plugin seeds into `useState`. Pre-built
 *    so the per-request resolver is a free read.
 *  - `hosts` — the hostnames that resolve to this entry. The
 *    default tenant intentionally has an empty list — it is
 *    reached only via the fallback when no other entry matches.
 */
export interface AgencyRegistryEntry {
  readonly id: string
  readonly config: AgencyConfig
  readonly siteConfig: SiteConfig
  readonly hosts: readonly string[]
}

/**
 * The agency registry. A frozen `Record<string, AgencyRegistryEntry>`
 * keyed by tenant id. Adding a tenant is a one-file change.
 */
export interface AgencyRegistry {
  readonly [id: string]: AgencyRegistryEntry
}

/**
 * The id of the default tenant. The fallback target of
 * {@link selectAgencyByHost} when no `hosts` list matches the
 * supplied hostname.
 */
export const DEFAULT_TENANT_ID = 'default'

/**
 * Build a validated registry entry from a raw {@link AgencyConfig}
 * + the hostnames that resolve to it.
 *
 * The validation runs once at module load (the same as the
 * existing `site.config.ts` did for the default agency) so the
 * per-request resolver is a free read. Format issues are surfaced
 * via `console.warn` with a `[agency:<id>]` prefix so a
 * misconfigured tenant is easy to spot in the server logs.
 *
 * The SiteConfig is constructed inline (validated agency +
 * resolved theme) rather than going through
 * `app/config/site.config.ts → buildSiteConfig`. Keeping the
 * construction local to the registry avoids the circular
 * coupling with `site.config.ts` (the registry validates; the
 * default `siteConfig` re-exports the result for the no-SSR
 * fallback). Both paths produce the same `SiteConfig` shape for
 * the same agency.
 */
function buildEntry(
  raw: AgencyConfig,
  hosts: readonly string[],
): AgencyRegistryEntry {
  const { agency, warnings } = validateAgencyConfig(raw, {
    themes,
    i18nLocales: defaultI18nLocales,
  })

  for (const warning of warnings) {
    console.warn(`[agency-registry:${agency.id}] ${warning}`)
  }

  const siteConfig: SiteConfig = Object.freeze({
    agency,
    theme: resolveTheme(agency.theme),
  })

  return Object.freeze({
    id: agency.id,
    config: agency,
    siteConfig,
    hosts: Object.freeze([...hosts]),
  })
}

/**
 * The agency registry.
 *
 * The v1.x minimal multi-tenant foundation ships **only** the
 * default tenant, with an empty `hosts` list. Every unknown
 * hostname resolves to this entry via the fallback in
 * {@link selectAgencyByHost}, so the current single-agency
 * behavior is preserved out of the box (a `pnpm dev` on
 * `localhost:3000`, a `pnpm preview` on `127.0.0.1:3000`, and a
 * `pnpm generate` static export all render the default agency).
 *
 * A rebrand that wants true multi-tenant deployment adds entries
 * here with their `hosts` list. No service or component changes.
 */
export const agencyRegistry: AgencyRegistry = Object.freeze({
  [DEFAULT_TENANT_ID]: buildEntry(defaultAgencyConfig, []),
})

/**
 * Normalize a hostname for registry lookup.
 *
 * The normalization is intentionally minimal:
 *
 *  - `null` / `undefined` → `''`.
 *  - Whitespace is trimmed.
 *  - An empty / whitespace-only input → `''`.
 *  - The port segment is stripped (`localhost:3000` → `localhost`).
 *  - The result is lowercased.
 *
 * The normalization does **not** strip a leading `www.` (a
 * rebrand that owns both `example.com` and `www.example.com`
 * lists both), and does **not** resolve IP literals (a rebrand
 * that owns both `192.0.2.1` and `[2001:db8::1]` lists both).
 * Future revisions can add IDN / IDNA / IPv6 normalization
 * without breaking the registry shape — the registry stores
 * whatever strings the operator lists.
 */
export function normalizeHostname(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  const colonIndex = trimmed.indexOf(':')
  const hostPart = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex)
  return hostPart.toLowerCase()
}

/**
 * Resolve the active agency entry by hostname.
 *
 * Behaviour:
 *
 *  - The hostname is normalized via {@link normalizeHostname}.
 *  - If the normalized hostname is non-empty, the registry is
 *    walked and the first entry whose `hosts` list contains the
 *    hostname is returned. Comparison is exact (after
 *    normalization); the registry does no fuzzy matching.
 *  - If no entry matches (or the normalized hostname is empty),
 *    the entry whose id is `defaultId` is returned. The default
 *    id defaults to {@link DEFAULT_TENANT_ID}.
 *  - If the `defaultId` is not registered, a `TypeError` is
 *    thrown — a misconfigured registry should fail loudly rather
 *    than silently return `undefined`.
 *
 * The function is pure (no `useState`, no `useNuxtApp`) so it is
 * trivially unit-testable without booting a Nuxt context.
 */
export function selectAgencyByHost(
  registry: AgencyRegistry,
  host: string | null | undefined,
  defaultId: string = DEFAULT_TENANT_ID,
): AgencyRegistryEntry {
  const normalized = normalizeHostname(host)
  if (normalized !== '') {
    for (const entry of Object.values(registry)) {
      if (entry.hosts.includes(normalized)) {
        return entry
      }
    }
  }
  const fallback = registry[defaultId]
  if (!fallback) {
    throw new TypeError(
      `[agency-registry] default tenant id "${defaultId}" is not registered. `
      + `Registered ids: ${Object.keys(registry).join(', ') || '(none)'}.`,
    )
  }
  return fallback
}