import type { SiteConfig } from '~/types/site.types'
import { resolveTenantContext } from '../../server/utils/tenant-context'

/**
 * Tenant resolution plugin (server-only).
 *
 * Runs on every Nitro request, reads the request's hostname via
 * Nuxt's request-URL helper, and seeds the shared
 * `useState('site-config')` with the resolved {@link SiteConfig}
 * (Task 102: also seeds `useState('site-config-url')` with the
 * per-tenant canonical site URL).
 *
 * **Why server-only.** The Nuxt payload already carries the
 * resolved SiteConfig from SSR to the client; the client does
 * not need to re-resolve. The `.server.ts` suffix is a Nuxt
 * convention that restricts the plugin to the server bundle —
 * the file is never bundled into the client output.
 *
 * **Why this plugin owns the seed.** The tenant registry and
 * hostname resolver live in `app/config/agencies/registry.ts`
 * and are imported **only** by this server-only plugin (plus
 * the Vitest test file under `app/config/agencies/`). The
 * `useSiteConfig()` composable in `app/composables/` is
 * client-safe — it never touches the registry. This split keeps
 * the multi-tenant surface out of the client bundle by code
 * organization, not by tree-shaking; a future change cannot
 * reintroduce the leak without removing the `.server.ts`
 * suffix on this file.
 *
 * **Why `useRequestURL()` (not `useRequestEvent()`).** Nuxt's
 * `useRequestURL()` returns the parsed URL for the current
 * request (server) or page (client), and exposes `.hostname`
 * (already lowercased by the URL parser in modern Node / Nitro).
 * We pass it through `resolveTenantContext`, which uses the
 * registry's `normalizeHostname` for defensive normalization
 * (port stripping, whitespace trimming, case folding) so a
 * request to `EXAMPLE.com:3000` resolves the same agency as
 * `example.com`.
 *
 * **Why the suffix is `.server.ts`.** Plugins in `app/plugins/`
 * that end in `.server.ts` are server-only by Nuxt convention.
 * The M16 multi-tenant foundation never needs the resolver on
 * the client (the SSR payload is the source of truth); a future
 * cross-tenant navigation (e.g. a "Switch to Acme Real Estate"
 * link) is a full page reload, so SSR re-resolves automatically.
 *
 * **Per-tenant canonical URL (Task 102).** The resolver returns
 * the per-tenant canonical site URL (per-tenant env-var override
 * with fallback to the global `NUXT_PUBLIC_SITE_URL`). The
 * resolved URL is seeded into `useState('site-config-url')` so
 * `usePageSeo()` can pick it up during SSR. The default tenant
 * (no per-tenant override) resolves to the global env-var value,
 * preserving the existing single-tenant behavior byte-identically.
 */

/**
 * Seed the shared `useState` singletons with the resolved
 * tenant context (SiteConfig + per-tenant siteUrl).
 *
 * The function is not exported (it lives only inside this
 * server-only module) so the seed path cannot reach the client
 * bundle. Two `useState` calls are issued per request:
 *
 *   - `'site-config'` — the existing singleton that
 *     `useSiteConfig()` reads on both the server and the client.
 *     Carries the active `AgencyConfig` + theme.
 *   - `'site-config-url'` — the new Task 102 singleton that
 *     `usePageSeo()` reads for the canonical URL. Carries the
 *     per-tenant canonical site URL (with global fallback).
 *     The seeded value is the empty string when neither a
 *     per-tenant override nor the global env var is set;
 *     `usePageSeo` treats the empty value as "no canonical
 *     URL configured" and falls back to its own empty-URL
 *     behavior (no canonical link, no `og:url`).
 */
function seedSiteConfig(host: string | null | undefined): void {
  const ctx = resolveTenantContext(host)

  const state = useState<SiteConfig>('site-config')
  state.value = ctx.siteConfig

  const urlState = useState<string>('site-config-url', () => '')
  urlState.value = ctx.siteUrl
}

export default defineNuxtPlugin(() => {
  const url = useRequestURL()
  seedSiteConfig(url.hostname)
})