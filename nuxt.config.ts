import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defaultI18nLocales } from './app/config/i18n'

// Pinia 3.x exposes its `import` + `production` export condition as a CommonJS
// build (`pinia.prod.cjs`). Nitro always adds the `production` condition for
// production builds, so the server bundle picks that CJS file, which does
// `import Vue from 'vue'` — but Vue 3's ESM has no default export, crashing SSR.
// Aliasing `pinia` to its ESM build (which uses named Vue imports) avoids it.
const req = createRequire(import.meta.url)
const piniaEsm = join(
  dirname(createRequire(req.resolve('@pinia/nuxt')).resolve('pinia')),
  'dist',
  'pinia.mjs',
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/i18n',
    '@nuxt/image',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
  ],

  css: ['~/assets/css/main.css'],

  // Apply the Pinia ESM alias to the app (Vite) bundle.
  alias: {
    pinia: piniaEsm,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  // Apply the same Pinia ESM alias to the Nitro server bundle.
  // Also prerender the SEO infrastructure routes so a `pnpm generate`
  // static export writes `sitemap.xml` and `robots.txt` into
  // `.output/public/`. Without this, Nitro's `crawlLinks` mode would
  // skip them because no page links to them.
  // `failOnError: false` lets the build pass when `NUXT_PUBLIC_SITE_URL`
  // is not set — the routes return a deliberate 503 (sitemap) or a
  // blocking `robots.txt`, which is a valid degraded response, not a
  // build failure. The production `pnpm generate` step is expected to
  // run with `NUXT_PUBLIC_SITE_URL` set, in which case both routes
  // prerender as 200.
  nitro: {
    alias: {
      pinia: piniaEsm,
    },
    prerender: {
      failOnError: false,
      routes: ['/sitemap.xml', '/robots.txt'],
    },
  },

  // Public runtime config. `siteUrl` is the base URL used by SEO metadata
  // (canonical links, `og:url`, and absolute Open Graph / Twitter image URLs).
  // It is empty by default so the app builds and runs without configuration;
  // when set (e.g. via `NUXT_PUBLIC_SITE_URL=https://example.com`), the SEO
  // helpers in `app/pages/index.vue` emit absolute URLs.
  //
  // Server-only runtime config. `leadsAdapter` selects the lead delivery
  // adapter at request time (`'disabled'` by default, `'log'` for dev,
  // `'webhook'` for production). `leadsWebhookUrl` and `leadsWebhookSecret`
  // are required when `leadsAdapter === 'webhook'`. They live outside the
  // `public:` block so they are not exposed to the client bundle; only
  // server-side code in `server/services/leads/` reads them.
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '',
    },
    leadsAdapter: process.env.NUXT_LEADS_ADAPTER || 'disabled',
    leadsWebhookUrl: process.env.NUXT_LEADS_WEBHOOK_URL || '',
    leadsWebhookSecret: process.env.NUXT_LEADS_WEBHOOK_SECRET || '',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      // The favicon is injected at runtime from agency config (see
      // `plugins/theme.ts`) so it can be rebranded without touching this file.
    },
  },

  // Feature-first component resolution. UI / layout / shared primitives are
  // registered without a path prefix so `<BaseButton>`, `<AppHeader>`, etc.
  // resolve by file name, and every `features/*/components/**` folder is
  // auto-scanned too.
  components: [
    { path: '~/components/ui', pathPrefix: false },
    { path: '~/components/layout', pathPrefix: false },
    { path: '~/components/shared', pathPrefix: false },
    { path: '~/features', pattern: '**/components/**', pathPrefix: false },
  ],

  // Auto-import composables/stores that live inside the core layer and feature
  // folders (the default `~/composables`, `~/utils` and `~/stores` are kept).
  imports: {
    dirs: [
      '~/core/composables',
      '~/features/**/composables',
      '~/features/**/stores',
    ],
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: defaultI18nLocales.map(code => ({
      code,
      ...(code === 'en'
        ? { language: 'en-US', name: 'English', file: 'en.json' }
        : { language: 'es-ES', name: 'Español', file: 'es.json' }),
    })),
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      redirectOn: 'root',
    },
  },
})
