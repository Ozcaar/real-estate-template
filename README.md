# Real Estate Website Template

A reusable, white-label real estate website template built with **Nuxt 4**,
**Vue 3**, **TypeScript** and **Tailwind CSS v4**. It is designed to be
customized per agency through configuration and theme tokens — without editing
component internals.

## Stack

- Nuxt 4 (`app/` directory convention)
- Vue 3 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Pinia, Zod v4
- `@nuxtjs/i18n` (English + Spanish)
- Swiper, VueUse, Nuxt Image, Nuxt Icon

## Architecture

The project uses a **feature-first** architecture. Business modules live under
`app/features/*` and own their `components/`, `composables/`, `services/`,
`stores/`, `types/`, `schemas/`, `data/`, `constants/` and `utils/`. Shared
infrastructure lives outside features:

- `app/components/{ui,layout,shared}/` — generic UI primitives (`Base*`), layout
  shells (`App*`) and cross-feature components.
- `app/config/` — agency configuration, navigation and SEO defaults.
- `app/themes/` — design tokens per theme (serialized to CSS variables).
- `app/core/` — business-agnostic utilities (currency, theme tokens).
- `i18n/locales/` — `en.json` and `es.json`.

See `docs/` for the full specification (`ARCHITECTURE.md`, `THEMING.md`,
`COMPONENTS.md`, `DATA_MODELS.md`, `I18N.md`, `DESIGN.md`, `ROADMAP.md`) and
`AGENTS.md` for contributor conventions.

## Customization

- **Branding/identity:** edit `app/config/agencies/default.agency.ts` (name,
  logo, favicon, contact, social links, currency, enabled modules). Swap the
  active agency in `app/config/site.config.ts`.
- **Theme:** edit/add a theme in `app/themes/` and reference it by `id` from the
  agency config. Tokens are exposed as CSS variables such as
  `var(--color-primary)` and `var(--radius-md)`.
- **Copy:** all visible UI text uses i18n keys in `i18n/locales/en.json` and
  `es.json`.

## Setup

```bash
pnpm install
```

`postinstall` runs `nuxt prepare` automatically.

## Scripts

```bash
pnpm dev        # dev server on http://localhost:3000
pnpm build      # production build
pnpm generate   # static export
pnpm preview    # preview the production build
pnpm lint       # eslint .
pnpm lint:fix   # eslint . --fix
pnpm test       # vitest run (single-shot, CI-friendly)
pnpm test:watch # vitest (interactive watch mode)
```

## Deployment modes

The template supports two deployment targets.

* **`pnpm generate`** produces a static export under `.output/public/`. The dynamic Nitro routes (`/sitemap.xml`, `/robots.txt`) are pre-rendered so the static output includes the SEO infrastructure. `NUXT_PUBLIC_SITE_URL` must be set at build time when the SEO infrastructure routes need absolute URLs. The v1.0.0 release is fully usable on a pure static host.
* **`pnpm build`** produces a Nitro server build under `.output/server/`. The same dynamic routes are served at request time, gated by the same env var. The v1.1.0 lead-capture pipeline (`POST /api/contact` with the `disabled`, `log`, `webhook`, and `email` adapters) requires this target — a pure static host cannot serve server endpoints. An agency that ships static-only builds keeps the placeholder form behavior and the contact-methods column is the canonical completion path.

v1.0.0 (tag `v1.0.0` on `release/v1.0.0` at `456284c`) does **not** ship any Nitro-only API endpoints; both targets are equivalent in scope at v1.0.0. v1.1.0 ships the `POST /api/contact` endpoint and requires the Nitro server build or a serverless preset that ships a Nitro server runtime.
