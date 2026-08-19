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
  // `'webhook'` for production, `'email'` for SMTP delivery). The
  // adapter-specific credentials live outside the `public:` block so they
  // are never sent to the client bundle; only server-side code in
  // `server/services/leads/` reads them.
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '',
    },
    leadsAdapter: process.env.NUXT_LEADS_ADAPTER || 'disabled',
    leadsWebhookUrl: process.env.NUXT_LEADS_WEBHOOK_URL || '',
    leadsWebhookSecret: process.env.NUXT_LEADS_WEBHOOK_SECRET || '',
    leadsSmtpHost: process.env.NUXT_LEADS_SMTP_HOST || '',
    leadsSmtpPort: process.env.NUXT_LEADS_SMTP_PORT || '',
    leadsSmtpSecure: process.env.NUXT_LEADS_SMTP_SECURE || '',
    leadsSmtpUser: process.env.NUXT_LEADS_SMTP_USER || '',
    leadsSmtpPassword: process.env.NUXT_LEADS_SMTP_PASSWORD || '',
    leadsEmailFrom: process.env.NUXT_LEADS_EMAIL_FROM || '',
    leadsEmailTo: process.env.NUXT_LEADS_EMAIL_TO || '',
  },

  // Nuxt Image (Task 116). The v1.2 CMS pilots (Sanity) project image
  // asset URLs directly via `asset->url` in the GROQ projection. The
  // projected URLs are Sanity CDN URLs (`cdn.sanity.io/images/...`) and
  // pass through the existing `<ResponsiveImage>` wrapper (which uses
  // `NuxtImg`). Without an entry in `image.domains`, the IPX provider
  // rejects the remote URL. The list is intentionally minimal — only
  // the Sanity asset CDN — so a future CMS that projects from a
  // different host adds one explicit entry. The boundary regression
  // test in `server/utils/sanity-boundary.test.ts` asserts the entry
  // is present so a future refactor cannot accidentally remove it.
  image: {
    domains: ['cdn.sanity.io'],
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
      //
      // The `color-mode-init` inline script runs before Vue hydrates and
      // sets `<html data-color-mode="...">` so the first paint already
      // reflects the user's choice. The cookie is read by the documented
      // `core/utils/color-mode.ts` helpers (kept tiny so the script stays
      // small and is safe to inline). The fallback is `'system'`; the
      // matchMedia query resolves `'system'` to `'light'` or `'dark'`
      // based on the OS preference. The script is intentionally NOT
      // async / defer — it must execute before the first paint.
      script: [
        {
          innerHTML: `(function(){try{var m=document.cookie.match(/(?:^|; )color-mode=([^;]+)/);var p=m?decodeURIComponent(m[1]):'system';if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var d=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=p==='dark'||(p==='system'&&d===true)?'dark':'light';document.documentElement.setAttribute('data-color-mode',r);}catch(e){document.documentElement.setAttribute('data-color-mode','light');}})();`,
          tagPosition: 'head',
        },
      ],
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
