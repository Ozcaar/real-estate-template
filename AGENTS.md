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

* **Property gallery lightbox** — not implemented. Audit first (Task 074), then build (Task 075).
* **Real external data integration** — the MVP reads from static data under `app/features/*/data/*.ts`. A CMS, API, or external image source is not wired in; the schemas are the runtime boundary that will validate the future source.

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
