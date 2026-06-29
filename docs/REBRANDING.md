# Rebranding Guide

This guide walks a new user through adapting the template for a specific real estate agency. Rebranding means changing the agency's identity, branding, content, and locale to match a real agency — without modifying components, pages, layouts, or composables.

Every rebranding step is a configuration or content edit. No component code needs to change.

## 1. Related Docs

Before starting, skim the relevant background documentation:

* `docs/THEMING.md` — branding tokens, CSS variables, theme strategy
* `docs/I18N.md` — translation rules and locale structure
* `docs/DATA_MODELS.md` — TypeScript models for agency, theme, and content
* `docs/ARCHITECTURE.md` — feature-first folder layout and ownership

## 2. Rebranding Checklist

The full rebrand touches, in order:

1. Update agency identity in `app/config/agencies/default.agency.ts`.
2. Replace logo, favicon, and 14 placeholder images under `public/images/`.
3. Replace sample data in the six `app/features/*/data/*.ts` files.
4. Replace visible copy in `i18n/locales/en.json` and `i18n/locales/es.json`.
5. Adjust the theme in `app/themes/default.theme.ts` or register a new one.
6. Toggle the modules the agency needs in the agency config.
7. Set the production `NUXT_PUBLIC_SITE_URL` env var.
8. Build and verify.

## 3. Step 1 — Update Agency Identity

The agency identity lives in `app/config/agencies/default.agency.ts`. Every component reads agency data from this single object via `useSiteConfig()`.

The agency config controls:

* `id` — unique slug for the agency
* `name` — display name
* `slogan` — short marketing slogan (optional)
* `logo` — public path to the agency logo
* `favicon` — public path to the favicon (optional)
* `theme` — theme id registered in `app/themes/index.ts`
* `defaultLocale` — locale used on first visit (e.g. `'en'`)
* `availableLocales` — array of enabled locales (e.g. `['en', 'es']`)
* `currency` — ISO 4217 code (`'USD'`, `'MXN'`, `'EUR'`, …) used to format prices
* `measurementUnit` — `'metric'` (m²) or `'imperial'` (ft²) for area display
* `contact` — `phone`, `whatsapp`, `email`, `address`, optional `businessHours`
* `social` — optional `facebook`, `instagram`, `linkedin`, `tiktok`, `youtube` URLs
* `modules` — booleans for `properties`, `developments`, `agents`, `blog`, `testimonials`, `contact`

There are two ways to rebrand:

### Option A — single-agency site

Edit `app/config/agencies/default.agency.ts` directly. This is the simplest path when the template will only ever serve one agency.

### Option B — multi-agency-ready site

1. Copy the file:

   ```ts
   // app/config/agencies/acme.agency.ts
   import type { AgencyConfig } from '~/types/agency.types'

   export const acmeAgencyConfig: AgencyConfig = {
     id: 'acme',
     name: 'Acme Real Estate',
     // …fill in the rest…
   }
   ```

2. Swap the import in `app/config/site.config.ts`:

   ```diff
   - import { defaultAgencyConfig } from './agencies/default.agency'
   + import { acmeAgencyConfig } from './agencies/acme.agency'

   - const activeAgency = defaultAgencyConfig
   + const activeAgency = acmeAgencyConfig
   ```

No component change is required. `useSiteConfig()` reads from `siteConfig.agency` and every consumer re-renders.

## 4. Step 2 — Replace Logo, Favicon, and Placeholder Images

Replace the placeholder assets the template ships with real agency assets. Keep the same paths so the data files keep working.

| Path | What it is used for |
| --- | --- |
| `public/images/logo.svg` | Agency logo used in the header, footer, and OG share fallback |
| `public/favicon.ico` | Browser tab icon |
| `public/images/home/hero.svg` | Home page hero background/illustration |
| `public/images/home/about.svg` | Home page "about" band illustration |
| `public/images/locations/location-01.svg` | Location tile 1 (currently Monterrey) |
| `public/images/locations/location-02.svg` | Location tile 2 (currently Guadalajara) |
| `public/images/locations/location-03.svg` | Location tile 3 (currently Mexico City) |
| `public/images/locations/location-04.svg` | Location tile 4 (currently Mazatlán) |
| `public/images/properties/property-01.svg` | Property card 1 image |
| `public/images/properties/property-02.svg` | Property card 2 image |
| `public/images/properties/property-03.svg` | Property card 3 image |
| `public/images/properties/property-04.svg` | Property card 4 image |
| `public/images/properties/property-05.svg` | Property card 5 image |
| `public/images/properties/property-06.svg` | Property card 6 image |
| `public/images/agents/agent-01.svg` | Agent portrait 1 |
| `public/images/agents/agent-02.svg` | Agent portrait 2 |
| `public/images/agents/agent-03.svg` | Agent portrait 3 |
| `public/images/agents/agent-04.svg` | Agent portrait 4 |
| `public/images/developments/development-01.svg` | Development cover 1 |
| `public/images/developments/development-02.svg` | Development cover 2 |
| `public/images/developments/development-03.svg` | Development cover 3 |
| `public/images/developments/development-04.svg` | Development cover 4 |

Keep file names stable when possible. If a new filename is required, update the corresponding data file in Step 3.

SVG placeholders are fine for the MVP. For a real agency, replace them with photos exported as `.webp` or `.jpg` and update the paths in the data files.

## 5. Step 3 — Replace Sample Data

The template ships placeholder agency content in six data files. Each one is intentionally generic so a real agency can swap it without touching components.

| File | What to replace |
| --- | --- |
| `app/features/home/data/stats.ts` | Trust statistics: years of experience, properties sold, happy clients, etc. |
| `app/features/home/data/locations.ts` | Areas served: name, slug, image, and property count. |
| `app/features/home/data/testimonials.ts` | Client quotes: name, role, quote, rating. |
| `app/features/properties/data/properties.ts` | Property catalog: titles, descriptions, prices, locations, images. |
| `app/features/agents/data/agents.ts` | Team members: name, position, photo, email, phone, WhatsApp, bio. |
| `app/features/developments/data/developments.ts` | Development portfolio: name, description, location, cover, gallery, amenities. |

The values in these files are plain strings (titles, descriptions, addresses), not i18n keys. They are agency content.

Note that the shipped sample data mixes a US-style agency config (the address, phone, and default currency in `default.agency.ts`) with Mexico/Spanish-market examples (cities like Monterrey, Guadalajara, Mazatlán, and Mexican property names). For a real agency, align the agency identity, the locale, and the data files so the same market and language are consistent across all of them.

The data shapes are validated by Zod schemas under `app/features/*/schemas/`. If a value fails validation, the app will not boot. Refer to `docs/DATA_MODELS.md` for the exact field names and types.

The shipped sample data declares `sizeUnit: 'metric'` on every property and development record (in `app/features/properties/data/properties.ts` and `app/features/developments/data/developments.ts`). Set it explicitly per record when replacing the data — `'metric'` for a metric-market agency, `'imperial'` for a US-style agency. Omit the field only when the agency's `measurementUnit` is the correct fallback for every record in the catalog.

## 6. Step 4 — Replace Visible Copy

All visible UI text is stored in two locale files:

* `i18n/locales/en.json`
* `i18n/locales/es.json`

The two files must stay in sync. Adding a key to one without adding it to the other will cause the missing locale to fall back to English silently.

Group keys by domain. The shipped layout uses these top-level groups:

```txt
nav.*           navigation labels
common.*        reusable labels (Contact, View details, Learn more, …)
home.*          home page copy
properties.*    property catalog and detail
developments.*  development catalog
agents.*        agent directory
contact.*       contact page and form
footer.*        footer columns and tagline
seo.*           per-page SEO titles and descriptions
```

For per-page SEO titles and descriptions, edit the `seo.*` group. The active `useSeoMeta` call on each page references these keys.

For agency-specific copy that depends on the agency (for example a tagline shown in the footer), prefer reading from `useSiteConfig().agency` rather than duplicating a string in the locale files.

## 7. Step 5 — Adjust or Create a Theme

The default theme lives in `app/themes/default.theme.ts`. It defines color, font, radius, shadow, and layout tokens. The active theme is selected by id in the agency config (`agency.theme`) and resolved by `resolveTheme()` in `app/themes/index.ts`.

To tweak the default theme, edit the values in `app/themes/default.theme.ts`:

* `colors.*` — primary, secondary, accent, surface, foreground, muted, border, success, warning, error, and their foreground counterparts.
* `fonts.heading` / `fonts.body` / `fonts.serif` — font stacks.
* `radius.*` / `shadow.*` / `layout.*` — shape, elevation, and spacing tokens.

To add a new theme (for example a "luxury" theme):

1. Create `app/themes/luxury.theme.ts` exporting a `ThemeConfig`:

   ```ts
   import type { ThemeConfig } from '~/types/theme.types'

   export const luxuryTheme: ThemeConfig = {
     id: 'luxury',
     name: 'Luxury Theme',
     colors: { /* … */ },
     fonts:   { /* … */ },
     radius:  { /* … */ },
     shadow:  { /* … */ },
     layout:  { /* … */ },
   }
   ```

2. Register it in `app/themes/index.ts`:

   ```ts
   import { luxuryTheme } from './luxury.theme'

   export const themes: Record<string, ThemeConfig> = {
     [defaultTheme.id]: defaultTheme,
     [luxuryTheme.id]: luxuryTheme,
   }
   ```

3. Set `theme: 'luxury'` in the agency config.

`resolveTheme()` falls back to the default theme when an unknown id is supplied, so a typo will not crash the app — it will just render the default look.

## 8. Step 6 — Toggle Modules

The `modules` object in the agency config controls which features are visible. Every consumer (navigation, footer, home page, contact page) reads these flags.

```ts
modules: {
  properties:   true,
  developments: true,
  agents:       true,
  blog:         false,
  testimonials: true,
  contact:      true,
}
```

When a module is `false`:

* Its primary navigation entry is hidden (in the header and mobile menu).
* Its footer link is hidden.
* Its home page section is hidden (where applicable).
* Its dedicated route still exists; disabling the module does not 404 the route, it just removes the entry points.

The default ships with `blog: false` because the blog module is not part of the MVP. Flip it to `true` once a blog implementation lands.

## 9. Step 7 — Configure the Production Site URL

`usePageSeo()` reads `runtimeConfig.public.siteUrl` to build absolute canonical URLs and Open Graph URLs. In development the value is empty; in production it must be set or the canonical and `og:url` tags will be omitted.

Set the env var in the deployment environment:

```bash
NUXT_PUBLIC_SITE_URL=https://www.acme-realestate.com
```

The value is read by `nuxt.config.ts` at build time. Trailing slashes are stripped automatically by `usePageSeo()`.

When `siteUrl` is empty, `canonicalUrl` returns `null` and pages skip emitting canonical and `og:url` tags — this is intentional for local development.

## 10. Step 8 — Build and Verify

Run the validation pipeline:

```bash
pnpm install
pnpm lint
pnpm build
```

Then manually open the following routes and confirm they render the new agency:

* `/` — home
* `/properties` — property catalog
* `/properties/{slug}` — at least one property detail
* `/contact` — contact page
* `/about` — about page
* `/agents` — agent directory
* `/developments` — development portfolio

For each route, check:

* The logo in the header is the new asset.
* The footer shows the new agency name and contact data.
* The currency symbol matches `agency.currency`.
* The area unit matches `agency.measurementUnit` (m² or ft²).
* The primary color matches the active theme.
* The WhatsApp link opens with the configured number.
* The Open Graph image (view source → `<meta property="og:image">`) is the agency logo or property cover.

## 11. Troubleshooting

### My logo does not show

* Confirm `agency.logo` in the agency config points to an existing file under `public/` (for example `/images/logo.svg`).
* Confirm the file actually exists in the public folder.
* Clear the Nuxt build cache (`rm -rf .nuxt .output`) and rebuild.

### My favicon does not update

* The favicon is resolved from `agency.favicon` if set, otherwise it falls back to `/favicon.ico`.
* Browsers cache the favicon aggressively. Hard refresh (Ctrl+Shift+R) or open a private window to verify.

### My nav link is missing

* The `mainNavigation` array filters entries by `agency.modules.*`. Confirm the relevant module is `true` in the agency config.
* The home and nav use the same flag, so if the section is missing on the home page, the nav entry will also be missing.

### My WhatsApp link is wrong

* `agency.contact.whatsapp` is the source of truth. The template normalizes human-formatted numbers to digits automatically.
* Confirm the value contains the country code (for example `+52…` or `52…` for Mexico).
* If the value contains spaces or dashes, the normalization step will strip them.

### My colors do not apply

* Confirm `agency.theme` matches a registered id in `app/themes/index.ts`. Unknown ids silently fall back to the default theme.
* Confirm `data-theme` is set on the `<html>` element (the `theme.ts` plugin does this from the resolved theme id).
* Confirm the components use `var(--color-*)` and not Tailwind palette classes (for example `bg-teal-700` will not follow the theme).

### My currency symbol is wrong

* `agency.currency` must be a valid ISO 4217 code (`USD`, `MXN`, `EUR`, …).
* Each property in `app/features/properties/data/properties.ts` also has its own `currency` field. The card uses the per-record value, not the agency default, so a per-record override will win.

### My property area is wrong

* The unit shown next to a property's or development's area (`m²` or `ft²`) is determined by the record's `sizeUnit` field first, falling back to `agency.measurementUnit` when `sizeUnit` is omitted.
* The template does **not** perform automatic m² ↔ ft² conversion. The stored number must already be in the declared unit.
* If a record has `sizeUnit: 'metric'` and the agency is imperial, the record's number is still rendered as m² (per-record wins).
* To switch a single record's unit, change both `sizeUnit` and the underlying number so they stay consistent. To switch the whole catalog, change every record's `sizeUnit` (or remove it to fall back to the agency default) and update the numbers in the same pass.

### A section is missing

* Check `agency.modules.*` for the relevant feature. The home page reads `site.agency.modules` to gate each section.
* Check the i18n key. A missing `seo.*` key will make `useSeoMeta` emit an empty value silently.

### Canonical or og:url is missing

* `usePageSeo()` only emits canonical and `og:url` when `NUXT_PUBLIC_SITE_URL` is set.
* Confirm the env var is set at build time (it is read from `runtimeConfig`, which is baked at build time).
* View the page source and confirm the meta tags are present.

### My translated copy is missing

* Confirm the key exists in BOTH `i18n/locales/en.json` and `i18n/locales/es.json`.
* If only one file has the key, the other locale will fall back to the i18n default (usually English).
* Confirm the key is referenced as `key.path` in `$t('key.path')` calls.
