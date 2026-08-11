import type { SiteConfig } from '~/types/site.types'
import {
  agencyRegistry,
  DEFAULT_TENANT_ID,
  selectAgencyByHost,
} from '~/config/agencies/registry'

/**
 * Tenant resolution plugin (server-only).
 *
 * Runs on every Nitro request, reads the request's hostname via
 * Nuxt's request-URL helper, and seeds the shared
 * `useState('site-config')` with the resolved {@link SiteConfig}.
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
 * We pass it through the registry's `normalizeHostname` for
 * defensive normalization — port stripping, whitespace trimming,
 * case folding — so a request to `EXAMPLE.com:3000` resolves
 * the same agency as `example.com`.
 *
 * **Why the suffix is `.server.ts`.** Plugins in `app/plugins/`
 * that end in `.server.ts` are server-only by Nuxt convention.
 * The M16 multi-tenant foundation never needs the resolver on
 * the client (the SSR payload is the source of truth); a future
 * cross-tenant navigation (e.g. a "Switch to Acme Real Estate"
 * link) is a full page reload, so SSR re-resolves automatically.
 */

/**
 * Seed the shared `useState('site-config')` with the SiteConfig
 * matching the supplied hostname.
 *
 * Resolves the active agency via {@link selectAgencyByHost} and
 * assigns the entry's pre-resolved `siteConfig` to the shared
 * `useState('site-config')`. The plugin calls this on every
 * request; the function is not exported (it lives only inside
 * this server-only module) so the seed path cannot reach the
 * client bundle.
 */
function seedSiteConfig(host: string | null | undefined): void {
  const entry = selectAgencyByHost(agencyRegistry, host, DEFAULT_TENANT_ID)
  const state = useState<SiteConfig>('site-config')
  state.value = entry.siteConfig
}

export default defineNuxtPlugin(() => {
  const url = useRequestURL()
  seedSiteConfig(url.hostname)
})