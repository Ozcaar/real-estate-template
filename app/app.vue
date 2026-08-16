<script setup lang="ts">
import { useSiteConfig } from '~/composables/useSiteConfig'

// Keep the document language in sync with the active locale.
//
// Tenant-aware default locale (Task 102). The
// `@nuxtjs/i18n` module's deployment-scoped `defaultLocale`
// is still the first-pass default on the server. When no
// `i18n_locale` cookie is present, we honor the active
// tenant's `agency.defaultLocale` so the SSR HTML's
// `<html lang>` reflects the tenant. The cookie check
// preserves the documented user-override path: a user that
// has explicitly switched languages keeps their choice
// across tenant navigations and page reloads. The override
// runs server-only because the client-side i18n module
// already re-derives the locale from the cookie on every
// hydration — running it twice would be redundant.
const { locale, locales, setLocale } = useI18n()
const site = useSiteConfig()

if (import.meta.server) {
  const cookie = useCookie('i18n_locale')
  if (!cookie.value) {
    const tenantDefault = site.value.agency.defaultLocale
    if (tenantDefault && locales.value.some(l => l.code === tenantDefault)) {
      setLocale(tenantDefault)
    }
  }
}

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
