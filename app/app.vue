<script setup lang="ts">
import { useSiteConfig } from '~/composables/useSiteConfig'
import {
  applyTenantLocaleResolution,
  resolveTenantLocale,
} from '~/config/tenant-locale'

// Keep the document language in sync with the active locale.
//
// **Tenant-aware i18n first-pass default (Task 107 / 107B).**
// The @nuxtjs/i18n module's deployment-scoped `defaultLocale`
// is still the last-resort fallback. When no `i18n_locale`
// cookie is present, we honor the active tenant's
// `agency.defaultLocale` so the SSR HTML's `<html lang>` and the
// first-pass translated content reflect the tenant.
//
// **Authoritative 3-outcome application (Task 107B).** The
// `applyTenantLocaleResolution` helper treats the resolved
// locale as authoritative for ALL three outcomes (cookie /
// tenant / fallback) and calls `setLocale` exactly once when
// the current locale does not already match the resolved
// locale. This makes the behavior independent of the i18n
// module's `detectBrowserLanguage` execution order: even if the
// i18n module's plugin has not yet set the locale from the
// cookie, the resolved cookie locale is applied
// unconditionally. The no-op optimization (skip when the current
// locale already matches) avoids unnecessary `setLocale` calls.
//
// **SSR / hydration consistency.** The same `resolveTenantLocale`
// pure function is used on both the server (via the
// `tenancy.server.ts` plugin) and the client (via this script).
// The function is pure — the same inputs always produce the
// same output, so SSR and hydration agree on the same initial
// locale without a per-request mutable state.
//
// **Cookie preservation.** When the `i18n_locale` cookie is
// present, the pure function reports `{ kind: 'cookie' }` and
// `applyTenantLocaleResolution` skips the `setLocale` call
// because the current locale already matches. The i18n
// module's `detectBrowserLanguage` plugin already set the
// locale from the cookie value; the override is a no-op.
// A user that has explicitly switched languages keeps their
// choice across tenant navigations and page reloads.
//
// **Client/server-safe shared module.** `resolveTenantLocale`
// and `applyTenantLocaleResolution` live in
// `app/config/tenant-locale.ts` (no server-only imports), so
// this client-bundled script can import them without pulling
// the tenant registry or `useRuntimeConfig` into the client
// bundle.
const { locale, locales, setLocale } = useI18n()
const site = useSiteConfig()

const cookie = useCookie('i18n_locale')
const resolution = resolveTenantLocale(
  typeof cookie.value === 'string' ? cookie.value : null,
  site.value.agency.defaultLocale,
  locales.value.map(l => l.code),
  String(locale.value ?? 'en'),
)
applyTenantLocaleResolution(resolution, { locale, setLocale })

useHead({
  htmlAttrs: { lang: locale },
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>