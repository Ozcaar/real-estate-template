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
* `contact` — `phone`, `whatsapp`, `email`, `address` (required free-text), optional `structuredAddress` (schema.org `PostalAddress` companion for the JSON-LD), optional `businessHours`
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

## 3a. Configure the Structured Agency Address

The agency contact config carries two address fields that coexist:

* `contact.address` — required free-text human-readable address. This is the **only** source of truth for the visible UI: the footer (`app/components/layout/AppFooter.vue`) and the contact-page contact-method card (`app/pages/contact/index.vue`) both render it directly.
* `contact.structuredAddress` — **optional** schema.org `PostalAddress` companion. Consumed only by the JSON-LD builder (`app/core/utils/postal-address.ts`) on the home, contact and about `RealEstateAgent` nodes.

A rebrand that does not configure `structuredAddress` is unaffected — the JSON-LD falls back to the plain `contact.address` string it emitted before this build. A rebrand that wants `PostalAddress` structured data in the JSON-LD populates `structuredAddress` alongside `address`.

### Supported fields

The `structuredAddress` object accepts five optional fields, named after the schema.org `PostalAddress` properties so the JSON-LD builder can spread them directly into the payload:

| Field | schema.org property | Example |
| --- | --- | --- |
| `streetAddress` | `streetAddress` | `'123 Main Street'` |
| `addressLocality` | `addressLocality` | `'Anytown'` |
| `addressRegion` | `addressRegion` | `'California'` |
| `postalCode` | `postalCode` | `'94016'` |
| `addressCountry` | `addressCountry` | `'USA'` |

Every field is optional AND must be non-empty when supplied (the Zod schema uses `z.string().min(1).optional()`). Empty strings are rejected at module load. Fields that are absent or empty are omitted from the JSON-LD payload.

### Example

```ts
contact: {
  phone: '+1 555 123 4567',
  whatsapp: '+1 555 123 4567',
  email: 'hello@acme-realestate.com',
  address: '123 Main Street, Anytown, CA 94016, USA',
  structuredAddress: {
    streetAddress: '123 Main Street',
    addressLocality: 'Anytown',
    addressRegion: 'CA',
    postalCode: '94016',
    addressCountry: 'USA',
  },
  businessHours: 'Mon-Fri 9am-5pm',
},
```

The free-text `address` above stays the source of truth for the visible footer and contact card. The structured fields are only consumed by the JSON-LD on the home, contact and about pages.

### Fallback behaviour

The `agencyPostalAddress(agency)` helper at `app/core/utils/postal-address.ts` returns:

* a schema.org `PostalAddress` object with only the non-empty structured fields, when `structuredAddress` is present and at least one field is non-empty;
* the free-text `contact.address` string otherwise (no `structuredAddress`, or every field is empty / whitespace-only).

This means a rebrand that has not migrated still gets the legacy plain-string `address` in the JSON-LD, and a migrated agency gets a `PostalAddress` object. The two fields are independent — a rebrand can keep them in sync, or keep `address` as a marketing-friendly display and let `structuredAddress` carry the postal-accurate values.

### Free-text remains required

`contact.address` is **not** made optional. It is the source of truth for the visible UI, and the footer / contact card render it directly. Do not delete it. The `structuredAddress` companion is purely additive.

### Migration-safe

Every existing rebranded agency config that has populated `address` continues to work unchanged: the Zod schema is satisfied, the visible UI renders, and the three agency JSON-LD blocks fall back to the plain-string `address` they emitted before this build. No existing config needs to be touched to keep building.

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
* A disabled module also removes its entries from `/sitemap.xml`.

The default ships with `blog: false` because the blog module is not part of the MVP. Flip it to `true` once a blog implementation lands.

## 9. Step 7 — Configure the Production Site URL

`usePageSeo()` reads `runtimeConfig.public.siteUrl` to build absolute canonical URLs and Open Graph URLs. In development the value is empty; in production it must be set or the canonical and `og:url` tags will be omitted.

The template also serves `/sitemap.xml` and `/robots.txt` at runtime. Both are produced by Nitro server routes and read the same `NUXT_PUBLIC_SITE_URL` env var. With the env var empty, the sitemap returns 503 and `robots.txt` blocks all crawling. With the env var set, the sitemap lists every public route gated by `agency.modules.*` and excludes `status: 'hidden'` properties.

Set the env var in the deployment environment:

```bash
NUXT_PUBLIC_SITE_URL=https://www.acme-realestate.com
```

The value is read by `nuxt.config.ts` at build time. Trailing slashes are stripped automatically by `usePageSeo()` and by the sitemap/robots routes.

When `siteUrl` is empty, `canonicalUrl` returns `null` and pages skip emitting canonical and `og:url` tags — this is intentional for local development.

The template also emits **JSON-LD structured data** automatically on the pages that benefit from it. The home page, properties catalog, property detail, agents, and contact page each emit a schema.org payload as a `<script type="application/ld+json">` block. `NUXT_PUBLIC_SITE_URL` is required for absolute URLs in the structured data; with the env var empty, `@id`, `url`, and other absolute-URL fields are omitted (matching the canonical-URL fallback).

| Page | Schema |
| --- | --- |
| `/` | `RealEstateAgent` (with `@id` to the agency home page) |
| `/properties` | `ItemList` of `ListItem` (one per visible property card) |
| `/properties/{slug}` | `RealEstateListing` (with `floorSize` as a `QuantitativeValue` carrying an explicit `unitCode`) + `ItemList` of `ListItem` for the related properties (one per related card; `itemListElement` is `[]` when there are no related properties) |
| `/agents` | `ItemList` of `Person` (each agent's `worksFor` references the agency home page) |
| `/contact` | `ContactPage` with `mainEntity: RealEstateAgent` (sharing the home page's `@id`) |
| `/about` | `AboutPage` with `mainEntity: RealEstateAgent` (sharing the home page's `@id`) |

The home page, contact page, and about page share a `RealEstateAgent.@id` (the home page's absolute URL) so search engines treat the agency as a single knowledge-graph node. The properties catalog and agents list each emit one entry per visible record; the property detail page emits one `RealEstateListing` per page plus a second `ItemList` of `ListItem` for the related properties. The related `ItemList` is **always emitted** (the page does not gate its registration on `related.length`); when there are no related properties the `itemListElement` is an empty array, which is a valid but inert `ItemList` and is handled gracefully by Google's structured-data parser. The visible related-properties section is separately gated on `v-if="related.length"` so the user never sees an empty section — the two gates are independent. No configuration is required to enable or disable JSON-LD — it is wired into the page setup and produces the same output across SSG, SSR and runtime Nitro server modes.

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

## 11. Property Listing Query Behavior

The `/properties` page reads four optional query params and routes them through `propertiesService.filter()`. The same shape is consumed by the in-page filter form on `/properties` and by deep links from the home page (`HomeSearchBar`, `HomeCategories`, `HomeLocations`).

| Key | Allowed values | Default | Effect |
| --- | --- | --- | --- |
| `operation` | `sale`, `rent` | (none) | Exact match on `Property.operationType`, case-insensitive |
| `type` | `house`, `apartment`, `land`, `commercial`, `office` | (none) | Exact match on `Property.propertyType`, case-insensitive |
| `location` | free text | (none) | Substring match against `location + city + state + country` joined with spaces. **Case-insensitive** and **accent-insensitive**: `Mexico` matches `México`, `Queretaro` matches `Querétaro`, `Leon` matches `Nuevo León` |
| `sort` | `featured`, `price-asc`, `price-desc` | `featured` | `featured` puts `featured: true` records first, ties broken by `id` ascending. `price-asc` / `price-desc` sort by `Property.price` with the same `id` tiebreaker |

**URL hygiene.** Empty values are stripped from the URL. The default sort (`featured`) is also omitted — `/properties?sort=featured` is normalized to bare `/properties`. Unknown `?sort=` values (for example `?sort=newest`) are silently coerced to `featured` so a malformed URL never returns zero results or crashes the page. The canonical URL strips the entire query string for SEO, so `/properties?operation=sale&type=house&sort=price-asc` and `/properties?operation=rent&type=apartment&sort=price-desc` both canonicalize to `/properties`.

**Stable order.** Every sort branch uses `id.localeCompare(otherId)` as a tiebreaker so equal-scoring or equal-priced properties always render in the same order across SSR and CSR (no hydration mismatch). The `ItemList` JSON-LD on the listing page reflects the same order as the visible cards via `position: index + 1`.

**Sample data shape.** When replacing the sample data (Step 3), every record's `operationType` and `propertyType` must be one of the allowed values above, or the record will fail Zod validation at module load and the app will not boot. To add a new value (for example a new `propertyType`), extend both the `PropertyOperationType` / `PropertyType` unions in `app/features/properties/types/property.types.ts` and the matching Zod enums in `app/features/properties/schemas/property.schema.ts`, then add the corresponding label to `properties.types.*` / `properties.operations.*` in both locale files.

## 12. Above-the-Fold Image Performance

The home page hero and the property detail cover image are both LCP candidates. Both use the same two-attribute pattern to ensure the browser starts their network request as early as possible:

```vue
<ResponsiveImage
  :src="image"
  :alt="t('…')"
  ratio="4/3"
  rounded="xl"
  loading="eager"
  fetchpriority="high"
  sizes="100vw lg:50vw"
/>
```

The two key attributes are:

* `loading="eager"` — overrides `<ResponsiveImage>`'s default `'lazy'` so the browser starts downloading the image immediately, not when it scrolls into view.
* `fetchpriority="high"` — tells the browser the image is an LCP candidate, so it should prioritize the network request ahead of other resources (scripts, other images, etc.).

Both attributes are forwarded to `<NuxtImg>` (which passes them through to the underlying `<img>`). Any new above-the-fold image (for example on the future development detail page) should follow the same pattern. The exact `sizes` value depends on the layout (`100vw` for full-width, `50vw` for a 2-column split, `33vw` for a 3-column grid, etc.) — keep the `loading="eager" + fetchpriority="high"` pair constant and tune `sizes` per layout.

**Re-verify LCP when replacing placeholder images.** When the agency replaces `public/images/home/hero.svg` or any property cover with a real photo (Step 2), the image format changes (SVG → JPEG/PNG/WebP/AVIF) and the file size typically grows. The `loading="eager" + fetchpriority="high"` pattern is format-agnostic, but the `sizes` attribute may need to be re-tuned for the new asset dimensions. Export the new asset as WebP or AVIF for the best LCP.

## 13. Troubleshooting

### My logo does not show

* Confirm `agency.logo` in the agency config points to an existing file under `public/` (for example `/images/logo.svg`).
* Confirm the file actually exists in the public folder.
* Clear the Nuxt build cache (`rm -rf .nuxt .output`) and rebuild.

### My favicon does not update

* The favicon is resolved from `agency.favicon` if set, otherwise it falls back to `/favicon.ico`.
* Browsers cache the favicon aggressively. Hard refresh (Ctrl+Shift+R) or open a private window to verify.

### The build emits a Windows `sharp` warning

* On Windows, `pnpm build` may emit a pre-existing `@nuxt/image` warning similar to:

  ```text
  [@nuxt/image] WARN sharp binaries for win32-x64 cannot be found.
  ```

  This warning is currently **non-fatal**: the build completes successfully, the generated site renders correctly, and the template ships with SVG placeholder images that do not require `sharp`. A rebrand that replaces the placeholders with raster images (`webp`, `jpg`, `avif`) may want `sharp` to be installed to allow on-the-fly resizing.
* The warning is **not** a v1.0 release-blocker. It is documented here so a rebrand deploying on Windows is not surprised by it.
* If a rebrand wants to silence the warning, run `pnpm rebuild sharp` (or `pnpm install --shamefully-hoist` if the postinstall script does not pick the platform-specific binary automatically). This is a troubleshooting step, not a fix to the template; the template itself does not claim the warning has been resolved.

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

### My sitemap shows the wrong domain

* Check that `NUXT_PUBLIC_SITE_URL` is set at build time. The sitemap reads the same env var as canonical URLs and `og:url`. The value is baked at build time, so rebuild after changing it.

### My sitemap includes a sold property

* Verify the property's `status` is not `hidden`. The sitemap uses `propertiesService.getAll()`, which already filters out `status: 'hidden'`. Sold, reserved, rented, and available properties are still public listing states and should appear in the sitemap.

### My translated copy is missing

* Confirm the key exists in BOTH `i18n/locales/en.json` and `i18n/locales/es.json`.
* If only one file has the key, the other locale will fall back to the i18n default (usually English).
* Confirm the key is referenced as `key.path` in `$t('key.path')` calls.

### My location search returns zero results

* The search is case-insensitive and accent-insensitive, so `Mexico` matches `México` and `Queretaro` matches `Querétaro`. If the search still returns zero, confirm the value is a substring of one of the catalog's `location`, `city`, `state`, or `country` fields. The search joins the four fields with spaces and does a substring match, so a search for `New York` will match a property with `city: 'New York'`.
* If the property is in the catalog but the search still misses, check the property's data file (`app/features/properties/data/properties.ts`) — the matching field may be empty or have a typo.

### My sort doesn't appear to work

* Confirm the `?sort=` value is one of `featured`, `price-asc`, `price-desc`. An unknown value (for example `?sort=newest` or `?sort=price`) is silently coerced to `featured` — there is no error, the page just shows the default order.
* The default sort is `featured` and is omitted from the URL, so the URL alone doesn't tell you the active sort. `/properties?sort=featured` is normalized to bare `/properties`.
* The sort is stable: equal-scoring or equal-priced properties always render in the same order, broken by `id` ascending.

### My LCP image looks slow

* Confirm the above-the-fold image uses both `loading="eager"` and `fetchpriority="high"`. The `<ResponsiveImage>` wrapper's defaults are `'lazy'` and `'auto'` respectively, so both attributes must be set at the call site. Check `app/features/home/components/HomeHero.vue` (home hero) and `app/pages/properties/[slug].vue` via `<PropertyGallery>` (property detail cover).
* Re-verify the LCP after replacing the placeholder image — a real photo may be much larger than the SVG placeholder, and the `sizes` attribute may need to be re-tuned. Export the new asset as WebP or AVIF for the best LCP.

## 14. Breadcrumbs

The template ships a visible, accessible breadcrumb trail plus a matching `BreadcrumbList` JSON-LD on the property detail page (`/properties/{slug}`). Listing pages and the top-level pages (`/`, `/about`, `/contact`, `/properties`, `/developments`, `/agents`) do not get visible breadcrumbs in v1.0 — they are themselves top-level destinations and a one-step `Home` link would add no navigation value.

### Property detail trail

The shipped trail is:

```txt
Home › Properties › {property.title}
```

`Home` and `Properties` are resolved from the existing `nav.*` i18n keys (`nav.home`, `nav.properties`). The current item is the property's own `title` (a free-text agency string, not an i18n key). The component is generic over its `items` prop, so any future detail page can build the same trail with one extra array — for example, `/agents/{id}` will use `Home › Agents › {agent.name}` and `/developments/{slug}` will use `Home › Developments › {development.name}`.

### Reusable component

The visible trail is rendered by `app/components/shared/SeoBreadcrumbs.vue` with a typed `BreadcrumbItem[]` from `app/types/breadcrumb.types.ts`:

```ts
export interface BreadcrumbItem {
  label: string
  to?: string          // omit on the current (final) item
  ariaLabel?: string   // optional screen-reader-only override
}
```

To add a breadcrumb to a new detail page:

1. Build a `BreadcrumbItem[]` in the page setup. Resolve i18n keys via `$t(...)` before passing them in.
2. Render `<SeoBreadcrumbs :items="breadcrumbItems" class="mb-6" />` near the start of the page content.
3. Register a `BreadcrumbList` JSON-LD via `useJsonLd`, mirroring the same `items` array — see the property detail page (`app/pages/properties/[slug].vue`) for the exact pattern. Linked items use `toAbsoluteUrl(item.to)`; the current item uses `canonicalUrl.value` with a `toAbsoluteUrl('/...')` fallback.

### Landmark label

The `<nav>` element's `aria-label` comes from the `common.breadcrumb` translation key:

| Locale | Value |
| --- | --- |
| English | `Breadcrumb` |
| Spanish | `Migas de pan` |

Add or rename this key in both `i18n/locales/en.json` and `i18n/locales/es.json` if a rebrand prefers different copy. Do not hardcode the landmark label inside the component — it is always i18n-driven.

### Future reuse

The component is intentionally generic. When the future per-development and per-agent detail pages land (Tasks deferred in `docs/ROADMAP.md` §6), each one only needs:

* A three-item `BreadcrumbItem[]` with `Home`, the section, and the record's name.
* A matching `BreadcrumbList` JSON-LD via the existing `useJsonLd` composable.

No new component, no new composable, no new i18n key. The `common.breadcrumb` key is shared across every breadcrumb in the app.

## 15. Property Gallery

The property detail page ships a Swiper-based carousel for the main image and an accessible thumbnail strip for navigation. The gallery is a presentation concern — the data shape (`Property.images`, `Property.coverImage`) is unchanged and a rebrand never needs to touch the gallery component.

### Data shape

* `Property.images: string[]` — the full photo set. Ordered; the first entry is the default cover.
* `Property.coverImage: string` — the cover image path. Used as the fallback when `images` is empty (a record that only declares a cover image still renders).
* The carousel never requires more than these two fields. Replacing the sample data with a CMS export does not change the gallery behaviour.

### Carousel behaviour

* **Multiple images.** A Swiper carousel renders one slide per image with real `<button type="button">` previous and next controls. The thumbnail strip below the carousel mirrors the slides; clicking a thumbnail calls `swiper.slideTo(index)`. A visible counter (`Image N of T`) lives between the controls and updates as a plain `<p>` for sighted users. Swiper's own `.swiper-notification` element (`wrapperLiveRegion: true` by default) is the single screen reader announcement source; a second `aria-live` on the counter would announce the same slide change twice and has therefore been deliberately avoided.
* **Single image.** A single image renders without thumbnails, arrows, or counter — just the `ResponsiveImage` with the LCP attributes.
* **Empty `images` array.** `displayImages` falls back to `[coverImage]`, so a record that only declares a cover image still renders as a single image. The cover-image fallback is preserved from the pre-carousel implementation.
* **Swipe and drag.** Swiper's default touch + mouse drag works on every viewport.
* **Keyboard.** Arrow keys move between slides. Keyboard navigation is enabled only when the carousel is in the viewport (`onlyInViewport: true`) so the page-level Tab order is not hijacked when the user is on a different section.
* **No loop, no rewind.** The first slide has the previous control disabled; the last slide has the next control disabled. The `disabled` attribute is set on the native `<button>` element so screen readers announce the boundary.
* **Autoplay and pagination dots are not enabled.** The thumbnail strip is the richer pagination.

### First-image LCP contract

The first image is the property detail page LCP candidate. The contract is preserved across the Swiper integration:

* The SSR HTML contains the first image as a plain `ResponsiveImage` (the `<ClientOnly>` `#fallback` slot) with `loading="eager"` and `fetchpriority="high"`.
* After hydration the Swiper replaces the fallback with its own DOM. The first slide uses the same `ResponsiveImage` with the same `loading="eager"` and `fetchpriority="high"` attributes. The same `src` is used on both sides, so the browser cache prevents a duplicate download.
* Later main images use `loading="lazy"` and no high fetch priority. Thumbnails always use `loading="lazy"`.

### Lazy loading

* Every later main image (slide 2+) is `loading="lazy"`.
* Every thumbnail is `loading="lazy"`.
* The carousel's first image is the only `loading="eager"` request.

### Reduced motion

`prefers-reduced-motion: reduce` sets Swiper's transition `speed` to 0 via VueUse's `usePreferredReducedMotion` composable. Slide changes become instantaneous; swipe and keyboard navigation still work. The carousel does not invent unsupported Swiper configuration options.

### Fullscreen lightbox

A fullscreen lightbox (focus trap, body-scroll lock, Escape-close, backdrop click) is **intentionally deferred** to a future audit. A real-estate user wanting a larger view can use the browser's built-in image controls on the current main image; introducing a generic modal system solely for the gallery is not justified by the current placeholder data. The carousel MVP covers the three real gaps the audit identified — mobile swipe, keyboard arrow nav, and desktop prev/next — without the complexity cost.

### Translation keys

Under `properties.detail.gallery`:

| Key | English | Spanish | Used by |
| --- | --- | --- | --- |
| `viewImage` | `View image {n} of {total}` | `Ver imagen {n} de {total}` | Thumbnail button `aria-label` (reused from the pre-carousel implementation) |
| `thumbnails` | `Property images` | `Imágenes de la propiedad` | `<ul>` `aria-label` (reused from the pre-carousel implementation) |
| `ariaLabel` | `Property image carousel` | `Carrusel de imágenes de la propiedad` | Swiper `aria-roledescription` |
| `previous` | `Previous image` | `Imagen anterior` | Prev button label + Swiper A11y `prevSlideMessage` |
| `next` | `Next image` | `Imagen siguiente` | Next button label + Swiper A11y `nextSlideMessage` |
| `first` | `This is the first image` | `Esta es la primera imagen` | Swiper A11y `firstSlideMessage` |
| `last` | `This is the last image` | `Esta es la última imagen` | Swiper A11y `lastSlideMessage` |
| `slideLabel` | `Image {n} of {total}` | `Imagen {n} de {total}` | Swiper A11y `slideLabelMessage` and `itemRoleDescriptionMessage` |
| `counter` | `Image {n} of {total}` | `Imagen {n} de {total}` | Visible counter element |

A rebrand that needs different copy can edit these nine keys in both `i18n/locales/en.json` and `i18n/locales/es.json` without touching any component code.

## 12. Lead Capture and Delivery

The template ships a configurable lead-capture pipeline that posts
contact-form submissions to a single Nitro endpoint
(`POST /api/contact`) and routes the stamped lead through one of
three pluggable server-side adapters: `disabled`, `log`, or
`webhook`. The visible `/contact` form is driven by
`agency.leads.enabled`; the active delivery adapter is selected
at request time by server-only runtime config.

The form's structure, the schema, and the adapter boundary are all
generic. A rebrand that wants email delivery, a CRM webhook, or a
queue-backed delivery can add a new adapter without changing the
form, the schema, or the endpoint.

### 12.1 Form interactivity

```ts
// app/config/agencies/<your-agency>.agency.ts
export default {
  // ... existing fields ...
  leads: {
    enabled: false, // true to enable live lead capture
  },
}
```

When `leads.enabled === false` (the default in the sample
agency), the visible form keeps the historical placeholder
behavior: a visible `contact.form.placeholderNotice` and a
permanently disabled submit button. The contact-methods column
(tel / mailto / WhatsApp / address / business hours) is the
canonical completion path and is always rendered.

When `leads.enabled === true`, the form is fully interactive and
posts to `POST /api/contact`. The form's state machine is
`idle ? submitting ? success | validation | error`, with field-level
`aria-invalid` / `aria-describedby` and one mutually exclusive
`role="status"` / `role="alert"` region.

### 12.2 Server-only runtime config

The active delivery adapter is selected at request time by
server-only runtime config. These env vars are read by Nitro at
boot, never sent to the client bundle, and never logged.

| Env var                       | Default       | Required when                         |
| ----------------------------- | ------------- | ------------------------------------- |
| `NUXT_LEADS_ADAPTER`          | `disabled`    | any submission path                   |
| `NUXT_LEADS_WEBHOOK_URL`      | `''`          | adapter is `webhook`                  |
| `NUXT_LEADS_WEBHOOK_SECRET`   | `''`          | adapter is `webhook`                  |

`NUXT_LEADS_ADAPTER` accepts one of three values:

- `disabled` — the default. The endpoint returns 503 on every
  submission. The form is still wired so a rebrand that flips
  `leads.enabled` and the adapter together goes live without code
  changes.
- `log` — useful in development. The endpoint writes a single
  `console.info` line per accepted lead, with **no name, email,
  phone, message content, IP, or user-agent** in the line. Only
  the lead id, source, presence booleans, and message length.
- `webhook` — production. The endpoint POSTs the stamped lead
  as JSON to `NUXT_LEADS_WEBHOOK_URL` with a 5-second timeout,
  no redirect following, and an `X-Lead-Signature` HMAC SHA-256
  header over the exact JSON payload. The agency-side endpoint
  verifies the signature with `NUXT_LEADS_WEBHOOK_SECRET`.

### 12.3 Webhook signature

The webhook adapter signs the exact JSON payload sent to the
upstream. The agency-side endpoint verifies the signature with
the shared secret using a constant-time comparison. The header
is `X-Lead-Signature` with the value `sha256=<hex>`:

```ts
// agency-side endpoint pseudocode
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(body: string, header: string | undefined, secret: string): boolean {
  if (!header) return false
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

A 5-second timeout caps each delivery. Non-2xx responses,
timeouts, and network errors all become a generic 502 response
at the endpoint; the upstream body is never exposed to the
client.

#### Webhook response → transport mapping

The webhook adapter's `LeadDeliveryResult` is mapped to an HTTP
status at the endpoint level. Provider details, webhook URLs,
secrets, and stack traces are never exposed to the client.

| Upstream / failure          | Adapter result                                  | Endpoint status |
| --------------------------- | ----------------------------------------------- | --------------- |
| 2xx response                | `{ ok: true }`                                  | 200             |
| 401 or 403 from upstream     | `{ ok: false, errorCode: 'auth', retryable: false }` | 502             |
| Other non-2xx (500, 502, 503, 3xx, …) | `{ ok: false, errorCode: 'transport', retryable: true }` | 502             |
| `fetch` network error / DNS failure | `{ ok: false, errorCode: 'transport', retryable: true }` | 502             |
| 5-second `AbortController` timeout | `{ ok: false, errorCode: 'transport', retryable: false }` | 502             |
| Missing URL or missing secret | `{ ok: false, errorCode: 'unsupported', retryable: false }` | 502             |

The `retryable` field is an internal hint used by the endpoint's
server-side logging (retryable failures at `error`, non-retryable
at `warn`); the client never sees it. The 5-second timeout is
intentionally non-retryable because retrying immediately is
unlikely to help an overloaded upstream and the per-process
rate limiter at the service layer is the dedicated anti-retry
mechanism.

### 12.4 Deployment requirements

The lead-capture pipeline requires a **server-capable** Nitro
deployment:

- `pnpm build` produces `.output/server/index.mjs` and the
  endpoint is reachable at `/api/contact`. This is the
  recommended deploy target.
- Serverless presets (Cloudflare Workers, Vercel, Netlify) that
  ship a Nitro server runtime also work as long as the runtime
  supports `crypto.randomUUID`, `node:crypto.createHmac`, and the
  global `fetch`. The default Nitro presets used by `pnpm build`
  satisfy all three.

A **pure static** `pnpm generate` deployment does **not**
include server routes and cannot serve `/api/contact`. An agency
that ships static-only builds keeps the placeholder form
behavior and the contact methods column is the canonical
completion path. `pnpm generate` does not error on the lead
module — the server route is simply not emitted in the static
output.

### 12.5 No-JavaScript and failed-delivery fallback

The form is not progressively enhanced for no-JS POST in the
MVP. A no-JS user sees the placeholder form (or, when
`leads.enabled === true`, the form with a disabled submit and
no native action target). The contact methods column is the
no-JS completion path: `tel:`, `mailto:`, and `https://wa.me/`
are real anchor tags that work without JavaScript.

When `leads.enabled === true` and a submission fails, the
form re-renders with the entered values intact and a
non-provider-specific `contact.form.error` message. The user
can switch to the contact methods column at any time without
leaving the page.

### 12.6 Privacy stance

The endpoint does not persist leads. The configured delivery
adapter is the only place that sees the stamped lead shape, and
the stamped shape carries no IP, no user-agent, and no cookies.
The `log` adapter writes no PII; the `webhook` adapter sends
the stamped lead to the agency-side endpoint under the
agency's own retention policy.

The template makes no claim of GDPR, CCPA, or LFPDPPP
compliance. A rebrand that requires a privacy policy, a consent
checkbox, or a data-subject-access flow should add those on top
of the shipped pipeline. The end-to-end audit of retention,
export, and deletion is the agency's responsibility, not the
template's.

### 12.7 Rebranding checklist addition

1. Decide whether you want live lead capture or the
   placeholder form. The default is the placeholder.
2. To enable live capture, set `leads.enabled: true` in your
   agency config.
3. Set `NUXT_LEADS_ADAPTER` in the deploy environment
   (`disabled`, `log`, or `webhook`).
4. For `webhook`, set `NUXT_LEADS_WEBHOOK_URL` to a URL you
   control (a Cloudflare Worker, a Make / Zapier / n8n hook,
   or your own server) and set `NUXT_LEADS_WEBHOOK_SECRET` to
   a random 32+ character string. The agency-side endpoint
   must verify the `X-Lead-Signature` header.
5. Confirm the contact methods column is correct for the
   agency. It remains the no-JS and failed-delivery fallback.
6. If you need a privacy policy, consent checkbox, or data
   retention schedule, add it on top of the shipped pipeline.

### 12.8 Troubleshooting

**The form posts but nothing arrives.** Confirm the
`NUXT_LEADS_ADAPTER` env var is set in the deploy environment
(not in `.env.local` if the deploy platform does not load it).
Restart the server after the env var change. The endpoint
returns 503 when the adapter is `disabled` and the agency has
enabled the form.

**The form posts and the endpoint returns 502.** Inspect the
agency-side webhook endpoint. The endpoint returns 502 when
the upstream returns non-2xx, times out after 5 seconds, or
refuses the connection. The agency-side body is logged
server-side at `warn`; the client never sees it.

**The form posts and the endpoint returns 429.** A
per-request-key rate limit of **5 accepted attempts per 10
minutes** is in effect. The request key is opaque — it is
derived from the request IP (honoring `x-forwarded-for` when
behind a trusted proxy) and the `user-agent` header (truncated
to 200 chars to bound the key size). The limit is in-memory and
**per process**: a multi-process deployment (PM2 cluster,
Cloudflare Workers isolates) shares no state between instances,
so a determined attacker can multiply their effective rate by
the number of processes. Validation failures and honeypot trips
do **not** consume the budget — only submissions that would be
delivered count against the window. A rebrand that needs a
higher rate or a distributed limiter can move it to a Nitro
storage driver backed by an external KV in a future v1.x task.

**The form is interactive but the lead never reaches
`pnpm dev` stdout.** Confirm `NUXT_LEADS_ADAPTER=log` is set
in `.env.local` (Nitro reads `.env` / `.env.local` in dev) and
restart `pnpm dev`. The `log` adapter writes one line per
accepted lead to the dev server's stdout.

### 12.9 Endpoint transport behavior

The `POST /api/contact` endpoint is implemented in
`server/api/contact.post.ts` and applies four transport-level
guards **before** the lead service runs. These guards are not
re-exercised by the adapter unit tests; they are the endpoint's
responsibility.

| Guard              | Trigger                                  | Status | Body |
| ------------------ | ---------------------------------------- | ------ | ---- |
| Method             | Anything other than `POST`               | 404 (Nitro file-based routing for the `.post.ts` extension) | standard 404 |
| Content type       | `Content-Type` does not contain `application/json` | 415 | `{ ok: false, error: 'unsupported_media_type' }` |
| Body size          | Raw body > 16 KB (16 × 1024 bytes), checked **before** JSON parsing | 413 | `{ ok: false, error: 'payload_too_large' }` |
| JSON parse         | Body present but malformed JSON          | 400 | `{ ok: false, error: 'validation', issues: [] }` |

The body-size limit is checked before any JSON parsing, so an
oversized payload never reaches the Zod schema, the rate
limiter, or the delivery adapter. The 16 KB ceiling is
generous — the form's longest plausible payload (a 4000-char
message plus the other fields) is well under 4 KB serialized.

The body parse failure path returns `200` with an empty
`issues` array because the schema re-runs as a safety net
on the parsed body; a malformed JSON never reaches the schema
itself, so a separate `issues` list would be misleading. A
real validation failure (a well-formed JSON object that fails
the Zod schema) returns `400` with a populated `issues` array
of `{ path, message }` pairs.

The full HTTP transport mapping is documented in
`docs/DATA_MODELS.md` §5.6.

### 12.10 Automated tests

The lead-capture pipeline ships with a Vitest foundation that
covers the pure-function / branch-rich surface end-to-end:

| Test file | Cases | What it covers |
| --------- | ----- | -------------- |
| `app/features/leads/schemas/lead.schema.test.ts` | 37 | Every `leadInputSchema` field rule (name 2–120, email 0–254, phone 6–32, message 10–4000, honeypot, locale 2–12, trim, cross-field contact-channel) |
| `server/services/leads/adapters/disabled.test.ts` | 3 | `disabledAdapter` id, errorCode, no-throw on empty lead |
| `server/services/leads/adapters/log.test.ts` | 9 | `logAdapter` id, `ok:true`, one `console.info` per lead, exact log line shape, **no PII** in the log line, field-presence fallbacks |
| `server/services/leads/adapters/webhook.test.ts` | 18 | `webhookAdapter` id, upstream 200 / 401 / 403 / 500 / 502 / 503 / 3xx / network error / AbortError, missing URL / secret / both, exact JSON payload, `content-type: application/json` header, `X-Lead-Signature: sha256=<64-hex>` header (verified by recomputing HMAC SHA-256 of the mock-received body), `redirect: 'manual'`, `AbortSignal` for the 5-second timeout |
| `server/services/leads/adapters/index.test.ts` | 9 | Registry exports, selection by `NUXT_LEADS_ADAPTER` id, missing / unknown / whitespace ids, default fallback to `disabled` |
| `server/services/leads/lead.service.test.ts` | 28 | Full pipeline: honeypot silent path (no adapter call), schema validation mapping, rate limit (5-per-window cap, 6th blocked, validation failures and honeypot trips do not consume the budget, request keys are tracked independently), lead stamping (UUID `id`, ISO `receivedAt`, `source: 'contact'`, forwarded fields, locale fallback), delivery mapping (`ok` / `disabled` / `transport` / `auth` / `rate_limited` / `unsupported`), non-object body rejection (string, null, array) |

Run the tests with:

```bash
pnpm test        # single-shot, CI-friendly (vitest run)
pnpm test:watch  # interactive watch mode (vitest)
```

The current implementation ships **104 tests** that pass on
three consecutive `pnpm test` runs. The configuration lives in
`vitest.config.ts`; the `#imports` alias resolves to a tiny
stub at `tests/stubs/imports.ts` so the adapter pipeline can
be exercised without booting a Nitro server.

What the Vitest suite does **not** cover (intentionally — these
require a Nitro server):

- The four endpoint transport guards in `server/api/contact.post.ts` (method, content type, body size, JSON parse). The endpoint's response shape and the `LeadSubmitStatus` mapping are documented in §12.9 and `docs/DATA_MODELS.md` §5.6.
- The `checkRateLimit` window expiry itself. The rate limiter is tested for the 5-per-window cap, the 6th-rejection behavior, and the independence of request keys; the 10-minute window expiry is not directly exercised. Adding it would require `vi.useFakeTimers()` and is deferred.
- A live end-to-end test against a real upstream. The webhook adapter tests use `vi.spyOn(globalThis, 'fetch')` to mock the upstream; the agency-side signature verification pseudocode in §12.3 is the reference implementation.

A rebrand that wants to extend the test surface (for example to
exercise the endpoint transport guards or the rate-limit window
expiry) can add a `*.test.ts` file under the matching directory
and Vitest will pick it up automatically — no config change
needed.
