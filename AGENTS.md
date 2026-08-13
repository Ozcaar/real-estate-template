# AGENTS.md — Real Estate Website Template

## Project state

The application shell in `app/app.vue` is wired up. It renders `<NuxtRouteAnnouncer />` inside `<NuxtLayout>`, which hosts `<NuxtPage />` for the route tree. The shell also keeps the document language in sync with the active locale via `useHead({ htmlAttrs: { lang: locale } })`.

The architecture, folder layout, data models, theme system, branding strategy, and component conventions are specified in `docs/`.

**Read `docs/OPENCODE.md` first**, then the relevant document for the task.

If there is any conflict between this file, docs, and actual project files, use this priority order:

1. `package.json` and existing source code
2. `docs/OPENCODE.md`
3. Task-specific docs inside `docs/`
4. This `AGENTS.md`

## Stack

* **Nuxt 4** using the `app/` directory convention, not root-level `pages/`
* **Vue 3**
* **TypeScript**
* **Tailwind CSS v4** via `@tailwindcss/vite`
* **Pinia**
* **Zod v4**
* **i18n** with `@nuxtjs/i18n` using English and Spanish
* **UI libraries**: Swiper, VueUse, Nuxt Image, Nuxt Icon

Always check `package.json` before assuming exact dependency versions.

## Package manager

Use `pnpm`.

```bash
pnpm install         # install + postinstall → nuxt prepare
pnpm dev             # dev server on localhost:3000
pnpm build           # production build
pnpm generate        # static export
pnpm preview         # preview production build
pnpm lint            # eslint .
pnpm lint:fix        # eslint . --fix
pnpm test            # vitest run (single-shot, CI-friendly)
pnpm test:watch      # vitest (interactive watch mode)
pnpm test:e2e        # playwright test (Chromium smoke tests)
pnpm test:e2e:install  # playwright install --with-deps chromium (one-time setup)
```

`postinstall` runs `nuxt prepare` automatically — no manual step needed.

## Architecture

The project uses a **feature-first architecture**.

Every business module lives under `features/` and owns its own:

* `api/`
* `components/`
* `composables/`
* `stores/`
* `types/`
* `schemas/`
* `services/`
* `data/`
* `constants/`
* `utils/`

Shared app infrastructure belongs outside features.

| Directory                | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `components/ui/`         | Generic UI primitives — prefix with `Base`                         |
| `components/layout/`     | Layout shells — prefix with `App`                                  |
| `components/shared/`     | Cross-feature reusable components                                  |
| `features/*/components/` | Domain-specific components                                         |
| `core/`                  | Business-agnostic infrastructure such as API client, currency, SEO |
| `config/`                | Agency config, navigation, SEO                                     |
| `themes/`                | Design tokens per theme                                            |
| `i18n/locales/`          | `en.json`, `es.json`                                               |

## Core conventions

### i18n

No hardcoded visible text.

All UI strings must use translation keys with `$t('key')`.

When adding or changing a visible string, update both:

* `i18n/locales/en.json`
* `i18n/locales/es.json`

### Branding and themes

No hardcoded brand colors.

Use CSS variables such as:

```css
var(--color-primary)
var(--color-secondary)
var(--color-accent)
var(--radius-md)
```

Tailwind utility classes are allowed for:

* layout
* spacing
* responsiveness
* typography structure
* flex/grid behavior

Do not use Tailwind color classes for brand colors unless they are mapped to theme tokens.

### Components

Components should receive data via props.

Do not fetch data directly inside presentational components.

API calls and business logic belong in:

* services
* composables
* stores, when state is needed

### Stores

Global stores are only for app-wide state.

Feature-specific stores must live inside their feature folder.

### Pages

Pages should stay thin.

A page may:

* compose feature components
* load route-level data
* set SEO metadata
* pass props to components

A page should not contain heavy business logic or large UI implementations.

## Naming conventions

* UI primitives: `BaseButton.vue`, `BaseInput.vue`, `BaseCard.vue`
* Layout components: `AppHeader.vue`, `AppFooter.vue`, `AppShell.vue`
* Composables: `useProperties.ts`, `useAgencyTheme.ts`
* Pinia stores: `usePropertyStore.ts`, `useFavoritesStore.ts`
* Zod schemas: `property.schema.ts`, `contact.schema.ts`
* Types: `property.types.ts`, `agency.types.ts`
* Services: `property.service.ts`, `lead.service.ts`

## Current gaps

MVP scope and task order are defined in `docs/ROADMAP.md`. The roadmap is the canonical list of completed milestones, the active task, and the upcoming sequence — do not duplicate that list here. This section is the short list of verified current gaps a new session needs to know about.

The folder structure, Tailwind setup, i18n locale files, agency config, theme tokens, components, pages, layouts, and SEO config all exist. Do not reimplement them.

Verified current gaps:

* **Property gallery fullscreen lightbox** — intentionally deferred (audit decision recorded in `docs/ROADMAP.md` M20, build decisions in M21). The Swiper carousel MVP shipped in M21 covers the three real gaps the audit identified (mobile swipe, keyboard arrow navigation, desktop prev/next) without the complexity cost of a generic modal system. A fullscreen lightbox with focus trap, body-scroll lock, Escape handler, and backdrop click remains a future task; a real-estate user wanting a larger view can use the browser's built-in image controls on the current main image.
* **Real lead capture** — v1.1.0 is released (tag `v1.1.0` at `e49597f` on `feature/lead-capture-v1.1`). v1.0.0 is released on the `release/v1.0.0` branch (tag `v1.0.0` at `456284c`) and ships a documented placeholder form. v1.1.0 ships a real `POST /api/contact` endpoint with **four** pluggable server-only delivery adapters (`disabled`, `log`, `webhook`, `email`), a shared Zod schema (`app/features/leads/schemas/lead.schema.ts`), a 16 KB body limit, a 5-per-10-minute **per-process** rate limit (`server/services/leads/lead.service.ts`), a `website` honeypot, a PII-redacted `log` adapter, an HMAC-SHA-256 signed webhook adapter, and a Nodemailer-backed SMTP email adapter with full HTML escaping. The visible form on `/contact` is gated by `agency.leads.enabled` and defaults to `false` in the sample agency (`app/config/agencies/default.agency.ts`), so a rebrand ships the same v1.0.0 placeholder behavior until it explicitly opts in. The contact-methods column (`tel:`, `mailto:`, `https://wa.me/`) is always available as the no-JS and failed-delivery fallback. The v1.1.0 branch also ships a Vitest foundation (`vitest.config.ts`, 13 test files, 389 tests) covering the lead-capture Zod schema, all four adapters, the adapter selector, the lead service pipeline (including the rate-limit window expiry), the `POST /api/contact` endpoint transport guards, the property service (filter / sort / isPropertySort), the `paginate` / `parsePageParam` utilities, the `buildWhatsAppLink` helper, the `agencyPostalAddress` JSON-LD builder, and the agency configuration schema. The v1.1.0 branch additionally ships a Playwright smoke-test foundation (`playwright.config.ts` + `tests/e2e/smoke.spec.ts`, 13 cases) and a single-platform GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` (Chromium only, no matrix).
* **Individual development detail page** (`/developments/[slug]`) — post-v1.0. The `Development.slug` field is reserved in the type definition; v1.0 ships the `/developments` listing only. A future v1.x release can add the route without changing the data shape.
* **Real external data integration** — the data-source foundation (v1.1.0 M13) shipped the `DataSourceKind` set (`'static'` / `'api'` / `'cms'`), the async-first `DataSourceAdapter<T>` contract (`loadAll()` + `getAll()`), the selector, the four error classes, and the static adapter. The v1.1.0 M17 build ships the real HTTP API adapter (`createApiDataSource` at `app/core/data-source/adapters/api-adapter.ts`) and wires the property service to it through a same-origin Nitro endpoint: setting `NUXT_PROPERTIES_DATA_SOURCE=api` + `NUXT_PROPERTIES_API_URL=https://example.test/properties` switches the source at runtime. **Final architecture (M17).** The api-adapter module and the three `NUXT_PROPERTIES_*` env vars are owned exclusively by the server-only property loader at `server/utils/properties.ts` (the canonical Nuxt 4 location for server-only utilities). The loader reads the env vars, constructs the appropriate adapter (static by default, api when configured), eagerly fetches the remote list on the server, and exposes the resolved public list through `loadPropertiesServer()`. **No permanent process-lifetime cache is retained for successful API results.** Each call to `loadPropertiesServer()` constructs a fresh adapter and awaits its `loadAll()`; a later request observes the latest upstream data, not a stale snapshot. Concurrent in-flight calls share a single fetch via an in-flight `pending` promise that is cleared on settle (success or failure), so the next call performs a new fetch. The api is therefore fetched on every call, not "at most once per server lifetime". The loader is consumed by two surfaces: (1) the same-origin Nitro endpoint at `server/api/properties.get.ts`, which the app-side property service calls via `$fetch('/api/properties')` (loopback on the server, same-origin HTTP on the client); (2) the sitemap at `server/routes/sitemap.xml.ts`, which imports the loader directly. The property service (`app/features/properties/services/properties.service.ts`) is bundled to both server and client; it references only the same-origin path `/api/properties` (no external api URL, no env-var name string, no api-adapter import). Routes that do not need properties (`/about`, `/contact`, `/agents/*`, `/developments/*`) do not call `propertiesService.loadAll()` and do not trigger the api fetch. The service's `loadAll()` returns the data the Nitro endpoint emits; the pure helpers (`getAll(data)` / `getBySlug(data, slug)` / `filter(data, filters, sort)` / `getFeatured(data, limit?)` / `getRelated(data, current, limit = 3)`) take the loaded data as their first argument. The boundary regression test (`app/features/properties/services/properties.service.boundary.test.ts`) pins the contract: the service's source must not import the api-adapter module, the static-adapter module, the data-source contract runtime exports, any `NUXT_PROPERTIES_*` env-var name string, or any `process.env` / `typeof window` reference. The loader tests in `server/utils/properties.test.ts`, the endpoint tests in `server/api/properties.get.test.ts`, and the sitemap tests in `server/routes/sitemap.xml.test.ts` pin the server-side contract: the loader owns the env-var reads, the endpoint is a thin transport, and the sitemap does not import the app-side property service or any Nuxt app composable. The CMS adapter (Sanity, Contentful, Strapi, …) remains intentionally deferred to a future task and follows the same pattern (one file in `app/core/data-source/adapters/` plus a service-level registry entry).

ESLint config is auto-resolved by `@nuxt/eslint`; do not add a manual ESLint config unless the existing setup requires it.

## Validation

Form validation uses Zod schemas inside:

```txt
features/*/schemas/
```

Do not duplicate validation rules inside components.

## Before changing code

Before implementing a task:

1. Read `docs/OPENCODE.md`.
2. Read the task-specific doc in `docs/`.
3. Check existing folders and files.
4. Follow the feature-first structure.
5. Reuse existing types, schemas, services, composables, and theme tokens when available.

## After changing code

When relevant, run:

```bash
pnpm lint
pnpm build
```

If the build cannot be run or fails because of unrelated existing issues, mention it clearly.

## Do not

* Do not hardcode visible UI text.
* Do not hardcode brand colors.
* Do not place business logic inside presentational components.
* Do not create global stores for feature-only state.
* Do not add files outside the agreed architecture without a strong reason.
* Do not change the architecture without updating the related docs.
* Do not assume missing data models, routes, or theme tokens — check the docs first.
