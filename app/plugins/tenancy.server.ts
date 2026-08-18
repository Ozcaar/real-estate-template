import type { SiteConfig } from '~/types/site.types'
import { resolveTenantContext } from '../../server/utils/tenant-context'
import {
  applyTenantLocaleResolution,
  resolveTenantLocale,
} from '~/config/tenant-locale'

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
 *
 * **Per-tenant i18n first-pass resolution (Task 107 / 107B).**
 * When the `i18n_locale` cookie is absent, the plugin sets the
 * i18n module's locale to the active tenant's
 * `agency.defaultLocale` BEFORE the first SSR render. This makes
 * the i18n module's initial locale tenant-aware from the start
 * (the prior app.vue override ran AFTER the first render and
 * produced an SSR / hydration mismatch on the client when the
 * cookie was absent — the SSR HTML used the tenant's default
 * while the client i18n module used the deployment-wide
 * `defaultLocale: 'en'`). The override is purely additive: when
 * the cookie is set, the i18n module's `detectBrowserLanguage`
 * already set the locale, and the plugin does NOT touch it
 * (the documented user-override path is preserved). The
 * resolution is delegated to the pure function
 * {@link resolveTenantLocale} so the same inputs always produce
 * the same output (concurrent requests for different tenants
 * cannot share locale resolution).
 *
 * **Plugin-context i18n access (Task 107B).** The plugin reads
 * the i18n instance via `nuxtApp.$i18n` rather than the
 * `useI18n()` composable. `useI18n()` is designed for
 * component-setup contexts; calling it from a Nuxt plugin
 * can fail to resolve the Vue-i18n composer when the plugin
 * runs outside a component setup (the composer context may
 * not be available at that phase on some Nuxt 4 / i18n module
 * versions). The Nuxt app instance exposes the i18n composer
 * directly via `nuxtApp.$i18n`; this works reliably from a
 * Nuxt plugin on every platform.
 */

/**
 * Seed the shared `useState` singletons with the resolved
 * tenant context (SiteConfig + per-tenant siteUrl) AND set
 * the i18n module's first-pass locale when the user has no
 * `i18n_locale` cookie (Task 107 / 107B).
 *
 * The function is not exported (it lives only inside this
 * server-only module) so the seed path cannot reach the client
 * bundle. Three `useState` calls and at most one `setLocale`
 * call are issued per request:
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
 *   - `i18n.locale` — the i18n module's reactive locale ref.
 *     The plugin sets it ONLY when the `i18n_locale` cookie is
 *     absent AND the tenant's `defaultLocale` is a registered
 *     locale (or the i18n module's default is the documented
 *     last-resort fallback). When the cookie is set, the
 *     `detectBrowserLanguage` plugin already set the locale
 *     from the cookie value and the plugin does NOT override it.
 *
 * @param nuxtApp The Nuxt app instance, passed from the
 * `defineNuxtPlugin` callback. The i18n composer is read via
 * `nuxtApp.$i18n` (see the JSDoc above).
 */
function seedSiteConfig(
  host: string | null | undefined,
  nuxtApp: { $i18n?: { locale: unknown, locales: unknown, setLocale: unknown } },
): void {
  const ctx = resolveTenantContext(host)

  const state = useState<SiteConfig>('site-config')
  state.value = ctx.siteConfig

  const urlState = useState<string>('site-config-url', () => '')
  urlState.value = ctx.siteUrl

  // Per-tenant i18n first-pass locale (Task 107 / 107B).
  // Resolve the active locale from the cookie + tenant default
  // + i18n module default, and apply the result via
  // `applyTenantLocaleResolution` — which treats the resolution
  // as authoritative for all three outcomes and calls `setLocale`
  // exactly once when the current locale does not already
  // match. The pure `resolveTenantLocale` function is the
  // single source of truth for the priority order; the
  // client-side `app.vue` uses the same function with the same
  // inputs, so SSR and hydration produce the same initial locale.
  // No plugin-order assumption: the override is independent
  // of whether the i18n module's `detectBrowserLanguage` plugin
  // has already set the locale.
  const cookie = useCookie('i18n_locale')
  const i18n = nuxtApp.$i18n
  if (!i18n) {
    // The i18n module is not installed. The SSR continues with
    // the i18n module's deployment-scoped default (whatever that
    // is). Per-tenant locale resolution is not available in
    // this configuration — fall through without setting the
    // locale. The pure `resolveTenantLocale` / `applyTenantLocaleResolution`
    // contract still works for callers that read the resolved
    // locale (the contract is independent of whether the i18n
    // module is installed).
    return
  }
  // `nuxtApp.$i18n.locale` is a `Ref<string>` and
  // `nuxtApp.$i18n.locales` is a `Ref<LocaleObject[]>` — the same
  // shape `useI18n()` returns on the client. Reading `.value` on
  // both refs yields the underlying string / array (the structural
  // type in `tenant-locale.ts` consumes the refs via `.value`).
  const localeRef = i18n.locale as { value: string }
  const localesRef = i18n.locales as { value: Array<{ code: string }> }
  const setLocale = i18n.setLocale as (locale: string) => unknown
  const i18nDefaultLocale = String(localeRef.value ?? 'en')
  const availableLocaleCodes = localesRef.value.map(l => l.code)
  const resolution = resolveTenantLocale(
    typeof cookie.value === 'string' ? cookie.value : null,
    ctx.agency.defaultLocale,
    availableLocaleCodes,
    i18nDefaultLocale,
  )
  applyTenantLocaleResolution(resolution, { locale: localeRef, setLocale })
}

export default defineNuxtPlugin((nuxtApp) => {
  const url = useRequestURL()
  seedSiteConfig(url.hostname, nuxtApp)
})