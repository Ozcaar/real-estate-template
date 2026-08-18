import { useRuntimeConfig } from '#imports'
import type { AgencyConfig } from '../../app/types/agency.types'
import type { SiteConfig } from '../../app/types/site.types'
import {
  agencyRegistry,
  DEFAULT_TENANT_ID,
  selectAgencyByHost,
  type AgencyRegistry,
} from '../../app/config/agencies/registry'

/**
 * Server-only per-tenant context resolver (Task 102).
 *
 * A pure per-request function that resolves the active tenant's
 * `AgencyConfig`, pre-resolved `SiteConfig`, the **per-tenant
 * canonical site URL**, and the tenant's default locale.
 *
 * **Why this lives in `server/utils/`.** `server/utils/` is the
 * canonical Nuxt 4 location for server-only utilities: the files
 * are auto-imported by Nitro and bundled exclusively to the
 * server output, never to the client. The registry is server-only,
 * the per-tenant env-var dispatch is server-only, and the
 * resolved `TenantContext` is consumed only by Nitro routes
 * (`server/routes/sitemap.xml.ts`, `server/routes/robots.txt.ts`)
 * and the server-only tenant-resolution plugin
 * (`app/plugins/tenancy.server.ts`). A future change cannot
 * reintroduce the leak without moving this file out of
 * `server/utils/`.
 *
 * **Per-tenant canonical site URL.** The default tenant uses
 * `runtimeConfig.public.siteUrl` (sourced from `NUXT_PUBLIC_SITE_URL`),
 * which is the documented single-tenant knob and is preserved
 * byte-identically by this resolver. A multi-tenant deployment
 * adds a per-tenant override via the
 * `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` env-var convention (the
 * tenant id is uppercased and any non-alphanumeric character is
 * replaced with `_` for the env-var name). The per-tenant
 * override takes precedence over the global; an unset or empty
 * override falls back to the global. Example: a deployment
 * hosting `acme.example.com` and `coastal.example.com` sets
 *
 * ```sh
 * NUXT_PUBLIC_SITE_URL=https://example.com
 * NUXT_PUBLIC_SITE_URL__ACME=https://acme.example.com
 * NUXT_PUBLIC_SITE_URL__COASTAL=https://coastal.example.com
 * ```
 *
 * and registers two entries in `agencyRegistry` whose `hosts`
 * lists resolve those hostnames.
 *
 * **Per-tenant default locale.** Sourced from
 * `agency.defaultLocale` (always populated by the agency schema).
 * The `@nuxtjs/i18n` module's deployment-scoped `defaultLocale`
 * is still the first-pass default for clients with no cookie
 * preference; the tenant-aware override is wired in
 * `app/app.vue` via `useI18n()` so the SSR HTML `lang`
 * attribute reflects the active tenant when no
 * `i18n_locale` cookie is present. The pure locale
 * resolver (`resolveTenantLocale`) and the application step
 * (`applyTenantLocaleResolution`) live in the client/server-safe
 * shared module `app/config/tenant-locale.ts` (Task 107B); this
 * file (server-only) imports them for the server plugin's
 * use but does not re-export them.
 *
 * **No module-level state.** Every call constructs a fresh
 * `TenantContext` from the registry + `process.env` +
 * `useRuntimeConfig()`. Two concurrent requests on different
 * hostnames cannot share config; clearing `process.env` or
 * unsetting the runtime config between tests is sufficient to
 * reset the resolver. The `agencyRegistry` itself is the only
 * piece of cross-call state, and it is `Object.freeze`-ed at
 * module load so it cannot be mutated by the resolver.
 *
 * **Per-tenant lead delivery configuration** is intentionally
 * **not** part of this resolver. It is a separate, future
 * Task 105 concern (per-tenant `NUXT_LEADS_*__<TENANT_ID>`
 * env-var convention + adapter selector / adapter wiring).
 * Today, lead delivery is global via `runtimeConfig.leadsAdapter`
 * and the matching `NUXT_LEADS_*` env vars — that behavior is
 * preserved by every consumer that does not yet read from
 * `resolveTenantContext`.
 */

export interface TenantContext {
  /** The active tenant id (registry key). */
  readonly id: string
  /** The resolved tenant's `AgencyConfig` (already validated). */
  readonly agency: AgencyConfig
  /** The pre-resolved `SiteConfig` (agency + theme tokens). */
  readonly siteConfig: SiteConfig
  /**
   * The normalized canonical site URL for this tenant (trailing
   * slash stripped). Resolution order:
   *
   *  1. `process.env.NUXT_PUBLIC_SITE_URL__<TENANT_ID>`
   *     (per-tenant override; non-empty wins).
   *  2. `runtimeConfig.public.siteUrl` (the documented global
   *     knob, sourced from `NUXT_PUBLIC_SITE_URL`).
   *
   * Empty string when neither is configured (a deployment that
   * has neither set the global env var nor a per-tenant
   * override). Consumers (sitemap, robots, `usePageSeo`) treat
   * the empty value as "no canonical URL configured" and fall
   * back to their own empty-URL behavior.
   */
  readonly siteUrl: string
  /**
   * The tenant's default locale (from `agency.defaultLocale`,
   * always populated). This is the locale the SSR HTML's
   * `lang` attribute should reflect when no `i18n_locale`
   * cookie is present.
   */
  readonly defaultLocale: string
}

const ENV_TENANT_PREFIX = 'NUXT_PUBLIC_SITE_URL__'

function readEnv(raw: string | undefined | null): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

/**
 * Resolve the canonical site URL for a tenant.
 *
 * Pure helper exported for the test surface (so the test does
 * not have to import the entire resolver). The env-var dispatch
 * uses `process.env` directly — `runtimeConfig.public.siteUrl`
 * does not support per-tenant overrides, and adding a
 * `runtimeConfig.public.tenantSites` map would couple the
 * multi-tenant deployment to the public runtime config shape
 * (the per-tenant URLs are deployment-only; they should never
 * need to be on the public config surface).
 */
export function resolveTenantSiteUrl(
  tenantId: string,
  globalSiteUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const upperTenant = tenantId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  const tenantKey = `${ENV_TENANT_PREFIX}${upperTenant}`
  const tenantRaw = readEnv(env[tenantKey])
  const tenantNormalized = tenantRaw.replace(/\/+$/, '')
  if (tenantNormalized !== '') return tenantNormalized
  return readEnv(globalSiteUrl).replace(/\/+$/, '')
}

/**
 * Resolve the active tenant's context for a Nitro request.
 *
 * The function is pure from the perspective of request state:
 * every call constructs a fresh `TenantContext`. The only
 * shared state is the registry (defaulting to the production
 * `agencyRegistry`; injectable for tests) and the process-wide
 * `runtimeConfig` + `process.env`, both of which are
 * deployment-scoped (not per-request).
 *
 * The `registry` parameter is a thin dependency-injection seam
 * for the test surface: tests pass a custom registry with
 * isolated entries to exercise the multi-tenant matching +
 * fallback paths without `vi.doMock` gymnastics. Production
 * callers always omit the second argument and use the bundled
 * default registry.
 */
export function resolveTenantContext(
  rawHost: string | null | undefined,
  registry: AgencyRegistry = agencyRegistry,
): TenantContext {
  const entry = selectAgencyByHost(registry, rawHost, DEFAULT_TENANT_ID)
  const config = useRuntimeConfig()
  const globalSiteUrl = String(config.public.siteUrl ?? '')
  const siteUrl = resolveTenantSiteUrl(entry.id, globalSiteUrl)

  return {
    id: entry.id,
    agency: entry.config,
    siteConfig: entry.siteConfig,
    siteUrl,
    defaultLocale: entry.config.defaultLocale,
  }
}