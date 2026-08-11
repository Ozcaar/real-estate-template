import type { SiteConfig } from '~/types/site.types'
import { siteConfig } from '~/config/site.config'

/**
 * Access the active site configuration (agency + theme).
 *
 * **Client-safe.** The composable is the only public surface a
 * component consumes to read the active agency + theme; it does
 * **not** import the tenant registry or the hostname resolver.
 * Both the registry and the resolver live in server-only modules
 * (the registry under `app/config/agencies/` and the resolver
 * plugin under `app/plugins/`) so the multi-tenant surface
 * cannot reach the client bundle by accident.
 *
 * The composable is backed by `useState('site-config')` so the
 * value is SSR-safe and survives client navigation. The shared
 * state is seeded by the server-only tenant-resolution plugin on
 * every request — that plugin runs before any composable is
 * invoked, so the `useState` value is already the resolved
 * `SiteConfig` by the time components mount.
 *
 * The `siteConfig` initializer is a **fallback** only: it is
 * consumed when the plugin has not run (a unit test that calls
 * `useSiteConfig()` without booting Nitro, a hypothetical
 * client-only navigation pattern). For the default deployment the
 * plugin runs on every request so the initializer is never the
 * value a component sees.
 *
 * The composable shape is unchanged from the v1.1.0 single-agency
 * build: components consume `site.value.agency` and
 * `site.value.theme` exactly as before. The tenant resolution is
 * transparent to consumers.
 */
export function useSiteConfig() {
  return useState<SiteConfig>('site-config', () => siteConfig)
}