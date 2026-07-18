# Release Notes — v1.0.0

Real Estate Website Template — version 1.0.0.

## Release summary

v1.0 is the first stable release of the Real Estate Website
Template. It is **release-ready based on the verifiable checks
documented in this file** (lint, build, static generation, source-level
review, and configuration validation) and the documented rebrand
workflow (verified end-to-end with a temporary second-agency
configuration; see "Rebranding verification" below). Browser-level
accessibility, runtime performance, CI, automated tests, and
provider-specific deployment (Vercel, Netlify, Cloudflare, etc.)
are explicitly **not** part of the v1.0 release and are deferred to
v1.0.x and v1.1 (see "Explicitly deferred from v1.0" below).

It ships a Nuxt 4 application that renders a 7-page
public site (home, properties listing, property detail, developments
listing, agents listing, about, contact), a static-data contract
validated by Zod at module load, a configuration-driven branding
system, English / Spanish i18n, and a complete SEO infrastructure
(per-page meta, JSON-LD, sitemap, robots). Every branding surface
(identity, logo, favicon, theme tokens, typography, contact data,
social links, locale, currency, measurement unit, module flags,
properties, agents, developments, home data, visible copy, structured
agency address) is configurable through `app/config/agencies/*.agency.ts`
and the theme registry in `app/themes/`. A real rebrand replaces the
sample data, the placeholder images, the i18n copy, and the agency
config — no component edits required.

The v1.0 release is the validated code state at commit
`edac775` ("Se finalizan correcciones de pre-release v1.0") plus
four release-candidate documentation corrections applied in the
v1.0.0 commit on the `release/v1.0.0` branch, plus the
documentation refinements in the v1.0.0 final-correction commit
on the same branch (Task 082, M27 — re-verification of the
second-agency rebrand path and the `pnpm generate`
static-export path; see "Rebranding verification", "Static-
generation verification", and "Milestone-divergence note"
below). The lead-capture work that exists on the
`feature/lead-capture-v1.1` branch (commit `343abeb`) is **not**
part of v1.0.

## Public routes (7)

| Route | Description |
| --- | --- |
| `/` | Home page (hero, search, featured, services, categories, locations, about, testimonials, contact CTA). One page-level `<h1>`. |
| `/properties` | Property catalog with filter (operation, type, location), sort (featured, price ascending, price descending), pagination, and accent-insensitive location search. |
| `/properties/[slug]` | Property detail with accessible Swiper 12 carousel, real estate listing JSON-LD, related properties, breadcrumb, and contact card. 404 for unknown / hidden slugs. |
| `/developments` | Development showcase listing with status badges, location, price range, units, bedrooms, area, delivery date. |
| `/agents` | Team directory with per-agent phone / email / WhatsApp deep links and Person JSON-LD. |
| `/about` | Story, values, trust statistics, contact CTA. |
| `/contact` | Contact-methods column (tel / mailto / WhatsApp / address / business hours) and a documented placeholder form (visible `placeholderNotice` and permanently `disabled` submit). |

Plus the SEO infrastructure routes: `/sitemap.xml` and
`/robots.txt` (Nitro), gated on `NUXT_PUBLIC_SITE_URL` and
`agency.modules.*`.

## Property listing, filtering, sorting, and pagination

- URL state: `?operation=&type=&location=&sort=&page=`. Empty values
  are stripped; `?page=1` is omitted; out-of-range page values
  silently clamp to the last page.
- Filter: exact match on `operation` and `type`; case-insensitive
  and accent-insensitive substring match on `location` against
  `location + city + state + country`. Unicode NFD normalization,
  no external dependency.
- Sort: `featured` (default), `price-asc`, `price-desc`. Every
  sort branch uses `id.localeCompare(otherId)` as the tiebreaker so
  equal-scoring / equal-priced properties render in the same order
  across SSR and CSR.
- Pagination: `BasePagination` UI primitive + generic `paginate`
  utility. Renders `null` when `totalPages <= 1`. Accessible markup:
  `<nav aria-label>`, `<ol>`, `aria-current="page"`, decorative
  `aria-hidden` ellipses, `sr-only` live region.
- Mobile collapse: filter form is collapsed by default on `< sm`
  behind a "Filters" toggle that reflects the active filter count.
  The form retains `method="get" action="/properties"` so it
  submits natively without JavaScript.

## Property detail and accessible carousel

- Swiper 12 carousel for the main image with custom real
  `<button type="button">` previous and next controls, no loop, no
  rewind. Keyboard arrow navigation (in-viewport only). Touch and
  mouse drag. Visible translated image counter. Custom thumbnail
  strip with `aria-current` on the active thumbnail.
- LCP-first image strategy: the SSR HTML contains the first image
  as a plain `ResponsiveImage` with `loading="eager"` and
  `fetchpriority="high"` via a `<ClientOnly>` `#fallback` slot.
  The Swiper replaces it after hydration using the same `src`
  (browser cache prevents a duplicate download).
- `prefers-reduced-motion: reduce` sets Swiper's `speed` to 0 via
  VueUse's `usePreferredReducedMotion`.
- Related properties: weighted score (same `propertyType` +3,
  same `operationType` +2, same `city` +2, same `country` +1,
  same `developmentId` +2, same `agentId` +1, price within 30%
  +1) with a stable `id` tiebreaker and a featured-property
  fallback for single-property catalogs.

## Agent and development listings

- Agents: 4 sample records (hand-written `Agent` interface).
  Per-agent phone, email, WhatsApp deep links rendered as
  semantic anchor tags. `ItemList` JSON-LD with `Person` entries
  tied to the agency via `worksFor: RealEstateAgent`.
- Developments: 4 sample records (hand-written `Development`
  interface). Status badge (pre-sale / under-construction /
  ready-to-deliver / sold-out), location, price range, units,
  bedrooms, area, delivery date. Each card's only action is a
  "Contact" CTA pointing to `/contact` (no per-record detail
  page in v1.0).

## Contact-method behavior

The v1.0 contact page renders two columns. The left column is the
contact-methods card list, built from the agency config and
filtered on field presence:

- Phone → real `tel:{phone}` anchor.
- WhatsApp → real `https://wa.me/{digits}` anchor (digits derived
  by stripping non-digit characters from the configured number).
- Email → real `mailto:{email}` anchor.
- Address → plain text (no anchor).
- Business hours → plain text (no anchor).

The right column is the documented placeholder form: a
fully-styled, fully-labeled form with a `disabled` submit and a
visible i18n `placeholderNotice` explaining that submission is
not enabled in this template yet. The form is not submittable;
it is a documented placeholder. The lead-capture branch
(`feature/lead-capture-v1.1`, commit `343abeb`) ships a real
`POST /api/contact` endpoint with three pluggable server-only
delivery adapters; that branch is **not** part of the v1.0
release.

A no-JavaScript user can complete the contact journey in 1
click from `/contact` via `tel:`, `mailto:`, or `https://wa.me/`.
The methods column is also the failed-delivery fallback if a
future lead-capture branch ships a server-side failure mode.

## Branding and theme configuration

A rebrand replaces the agency config, the theme tokens, the
sample data, the placeholder images, the i18n copy, and (for
production) the `NUXT_PUBLIC_SITE_URL` env var. No component
edits. The full rebrand workflow is documented in
`docs/REBRANDING.md` §2 (8 steps). The agency config is
validated by Zod at module load (strict structural rules,
permissive format warnings surfaced via `console.warn`).

## English and Spanish i18n

- `i18n/locales/en.json` and `i18n/locales/es.json` with
  identical key structure (379 keys per locale).
- `no_prefix` strategy: bare paths in URLs (no `/en/` or `/es/`
  prefix); the active locale is stored in a cookie and detected
  by `@nuxtjs/i18n`.
- `useI18n` is the only i18n surface. No hardcoded visible UI
  text in components.

## SEO, sitemap, robots, and JSON-LD

- Per-page SEO via `usePageSeo` + `useSeoMeta` + canonical link.
  Gated on `NUXT_PUBLIC_SITE_URL`. When the env var is empty,
  canonical and `og:url` are deliberately omitted.
- Open Graph + Twitter Card: `og:title`, `og:description`,
  `og:image` (agency logo or per-page cover), `og:site_name`,
  `og:locale`, `twitter:summary_large_image` with the same image.
- JSON-LD coverage:
  - `RealEstateAgent` on `/` (home).
  - `ItemList` of `ListItem` on `/properties` (with global
    positions so the structured data mirrors the visible cards
    across pages).
  - `RealEstateListing` on `/properties/[slug]` (deliberately
    omits `address` and `geo` because the placeholder data has
    no structured address or coordinates).
  - `ItemList` of related properties on `/properties/[slug]`
    (always emitted; empty list when no related properties).
  - `BreadcrumbList` on `/properties/[slug]` (three-item trail:
    Home › Properties › {title}).
  - `ItemList` of `Person` on `/agents` (each agent's
    `worksFor` references the agency home page).
  - `ContactPage` on `/contact` (with `mainEntity:
    RealEstateAgent` sharing the home `@id`).
  - `AboutPage` on `/about` (with `mainEntity: RealEstateAgent`
    sharing the home `@id`).
- `/sitemap.xml` (Nitro): lists every public route gated by
  `agency.modules.*`, per-property URLs from
  `propertiesService.getAll()`. 503 with hint when
  `NUXT_PUBLIC_SITE_URL` is empty.
- `/robots.txt` (Nitro): allows crawling and advertises the
  sitemap when the env var is set; `Disallow: /` with a hint
  when empty.

## Structured agency address

- `contact.structuredAddress` is an optional `PostalAddress`
  companion (5 fields: `streetAddress`, `addressLocality`,
  `addressRegion`, `postalCode`, `addressCountry`).
- The free-text `contact.address` remains the source of truth
  for the visible footer and contact card.
- The `agencyPostalAddress(agency)` helper at
  `app/core/utils/postal-address.ts` returns a `PostalAddress`
  object with only the non-empty fields, or falls back to the
  plain `address` string. The three agency `RealEstateAgent`
  nodes (home, contact `mainEntity`, about `mainEntity`) share
  the same `toAbsoluteUrl('/')` `@id`.
- Migration-safe: an agency that does not configure
  `structuredAddress` continues to work with the plain-string
  `address` in JSON-LD.

## Rebranding verification

The v1.0 release candidate was re-verified end-to-end as part of
Task 082 (M27) with a temporary second-agency configuration
(`app/config/agencies/second.agency.ts`) that exercises a
different value on every documented verification axis. The agency
was registered through the documented rebrand path (swap the
import in `app/config/site.config.ts`). Because only one permanent
theme is registered, a temporary alternative theme
(`app/themes/coastal.theme.ts`, registered in
`app/themes/index.ts` as `coastal`) was also created and selected
from the temporary agency. The cross-config Zod validation
(`defaultLocale` ⊆ `availableLocales`, theme id in the registry,
locales registered in `defaultI18nLocales`) accepted the new
agency. `pnpm lint` and `pnpm build` reported 0 errors / 0
warnings and completed successfully. The disabled-module flag
(`developments: false`, `testimonials: false`) was accepted by
the configuration validation, the navigation generator omitted
the `Developments` quick-link, the home page omitted the
`HomeTestimonials` section, and the static-generated sitemap
omitted the `/developments` entry (see the table below).
`NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate`
prerendered 171 routes successfully on the temporary agency
configuration. The temporary agency and theme files were then
deleted, the default agency and theme registry were restored,
and the same `pnpm lint`, `pnpm build`, and
`NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate`
pipeline was re-run on the default v1.0 configuration: all three
passed. The restored default sitemap includes `/developments`
(12 entries vs 11 with the temporary agency), confirming the
disabled-module gate is the only difference. **No temporary
implementation remains in the final diff.**

### Axes tested (Task 082, M27 — re-verification)

| Axis | Default | Temporary second-agency | Verified by |
| --- | --- | --- | --- |
| `id` | `default` | `coastal-acme` | `<title>`; `og:site_name`; JSON-LD `RealEstateAgent.name`; `__NUXT_DATA__` payload |
| `name` | "Real Estate Agency" | "Coastal Acme Real Estate" | `<title>`; `og:site_name`; logo `alt`; footer copyright; JSON-LD `RealEstateAgent.name` |
| `slogan` | "Find your ideal property" | "Coastal Acme finds your place by the sea" | Footer tagline (`agency.slogan \|\| $t('footer.tagline')`) |
| `theme` (id + tokens) | `default` (teal `#0F766E`, Inter font stack) | `coastal` (steel-blue `#0E5C8A`, Lato font stack, larger radii) | `<html data-theme="coastal">`; `<style id="agency-theme">` CSS variables; `__NUXT_DATA__` theme tokens; font-family `var(--font-heading)` |
| `defaultLocale` | `en` | `es` | Declared in `AgencyConfig.defaultLocale` and surfaced in `__NUXT_DATA__`. (The active i18n module default is `nuxt.config.ts → i18n.defaultLocale`, set to `en`. The agency's `defaultLocale` is part of the rebrand contract but is not yet wired into the i18n module's default; the language switcher exposes both `en` and `es` for either agency.) |
| `availableLocales` | `['en', 'es']` | `['es', 'en']` (reordered; both registered in `defaultI18nLocales`) | Language switcher renders both options in either order; cross-config Zod accepted |
| `currency` | `USD` | `MXN` | Declared in `AgencyConfig.currency` and surfaced in `__NUXT_DATA__`. (Per-record `currency` takes priority on `PropertyCard`; agency default is the documented fallback.) |
| `measurementUnit` | `metric` | `imperial` | Declared in `AgencyConfig.measurementUnit`; per-record `sizeUnit` fallback documented |
| `contact.phone` / `whatsapp` / `email` / `address` / `businessHours` | US placeholders (`+1 800 555 1234`, `example@email.com`, `123 Main Street, Anytown, USA`, `Mon-Fri 9am-5pm`) | Mexican placeholders (`+52 55 5555 1234`, `+52 1 55 5555 1234`, `hola@coastal-acme.test`, `Av. Constitución 1500, Col. Centro, Puerto Vallarta, Jalisco, México`, `Lun-Vie 9am-6pm`) | Footer "Contact" column; home contact-CTA row; `tel:` / `mailto:` / `https://wa.me/...` anchors; JSON-LD `RealEstateAgent.telephone` / `email` / `address` |
| `contact.structuredAddress` (5-field PostalAddress) | 3 fields (no `addressRegion` / `postalCode`) | 5 fields (full Mexican PostalAddress) | JSON-LD `RealEstateAgent.address` (an `@type: PostalAddress` object with `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry`) |
| `social` (Facebook, Instagram, LinkedIn, TikTok, YouTube) | 5 platforms | 3 platforms (Facebook, Instagram, LinkedIn) | Footer social icons (3 vs 5); JSON-LD `RealEstateAgent.sameAs` (3 vs 5 entries) |
| `modules` | `properties` / `developments` / `agents` / `testimonials` / `contact` all enabled; `blog` disabled (default) | `developments` + `testimonials` disabled; `properties` / `agents` / `contact` enabled; `blog` disabled (unchanged) | (a) Cross-config Zod accepted the disabled flags; (b) Sitemap omitted `/developments`; (c) `AppHeader` and `AppFooter` quick-links nav omitted `Developments`; (d) Home page omitted the `HomeTestimonials` section; (e) Property, agent, contact, and home sections rendered normally. |
| Cross-config Zod validation | passes | passes | `validateAgencyConfig` accepted both configurations without error or warning. |
| Static generation (`pnpm generate`) with `NUXT_PUBLIC_SITE_URL` | passes | passes | 171 routes prerendered in both configurations; the supplied URL appears in canonical, `og:url`, `og:image`, JSON-LD `@id` / `url`, the sitemap `<loc>` entries, and the `Sitemap:` line of `robots.txt`. |
| `pnpm lint` | 0 errors, 0 warnings | 0 errors, 0 warnings | ESLint clean in both configurations. |
| `pnpm build` | succeeds | succeeds | Nitro build in both configurations. Pre-existing unrelated `@nuxt/image` Windows `sharp` warning is emitted (documented as non-fatal in `docs/REBRANDING.md` §13). |
| Default re-verification after restoration | n/a | n/a | After deleting the temporary agency and theme and restoring the defaults, `pnpm lint`, `pnpm build`, and `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` all passed. The default sitemap contains 12 entries including `/developments` (vs 11 for the temporary agency), confirming the disabled-module gate is the only difference. |

### What the verification does **not** claim

- **Browser-level accessibility.** No browser, no axe, no NVDA / VoiceOver. The v1.0 accessibility was reviewed at the source level by M22 (Task 076).
- **Runtime performance.** No Lighthouse, no WebPageTest, no production-network measurement. The `pnpm build` and `pnpm generate` outputs are size counts only.
- **Provider-specific deployment.** The static generation was performed with `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` on a Windows development host. Vercel, Netlify, Cloudflare Pages, and other static hosts are **not** validated by this build. A rebrand deploying to a specific provider must validate the provider's deployment behavior separately.
- **CI.** No continuous integration is configured.
- **Cross-config Zod validation** is exercised but the **second-agency file is not added to the agency's multi-file `.gitignore` workflow or to a CI matrix**; the verification is a one-time execution during the v1.0 release-candidate preparation.

## Static-generation verification

The v1.0 release candidate was also verified against the documented
`pnpm generate` deployment path. The exact command category is:

```bash
NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate
```

(On Windows PowerShell, the equivalent is `$env:NUXT_PUBLIC_SITE_URL = 'https://example.test'; pnpm generate`.)

The generated static output is under `.output/public/` and contains:

- The 7 public pages: `index.html` (`/`), `about/index.html`, `contact/index.html`, `agents/index.html`, `properties/index.html`, the 6 property detail pages (`properties/<slug>/index.html`).
- A `developments/index.html` page (with the default agency that has `modules.developments: true`).
- The SEO infrastructure routes: `sitemap.xml` and `robots.txt`. Both are pre-rendered at build time (configured in `nuxt.config.ts → nitro.prerender.routes`).
- The Nuxt asset bundles under `_nuxt/` and image-optimized variants under `_ipx/`.

**Generated `sitemap.xml` (with the default agency, `NUXT_PUBLIC_SITE_URL=https://example.test`):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.test/</loc></url>
  <url><loc>https://example.test/about</loc></url>
  <url><loc>https://example.test/contact</loc></url>
  <url><loc>https://example.test/agents</loc></url>
  <url><loc>https://example.test/properties</loc></url>
  <url><loc>https://example.test/properties/modern-hillside-villa</loc></url>
  <url><loc>https://example.test/properties/downtown-skyline-apartment</loc></url>
  <url><loc>https://example.test/properties/coastal-family-home</loc></url>
  <url><loc>https://example.test/properties/prime-commercial-space</loc></url>
  <url><loc>https://example.test/properties/garden-view-building-lot</loc></url>
  <url><loc>https://example.test/properties/executive-office-suite</loc></url>
  <url><loc>https://example.test/developments</loc></url>
</urlset>
```

**Generated `robots.txt` (with the default agency, `NUXT_PUBLIC_SITE_URL=https://example.test`):**

```text
User-Agent: *
Allow: /

Sitemap: https://example.test/sitemap.xml
```

### Static-generation findings

- The supplied `NUXT_PUBLIC_SITE_URL` is used in the `<loc>` of every sitemap entry, in the `Sitemap:` line of `robots.txt`, in `<link rel="canonical">`, in `og:url`, in `og:image`, in the JSON-LD `@id` and `url` fields, and in the `__NUXT_DATA__` payload.
- When the temporary agency disabled `developments` and `testimonials`, the sitemap correctly omitted the `/developments` entry. The disabled-modules gate works end-to-end through static generation: `server/routes/sitemap.xml.ts` reads `siteConfig.agency.modules.*` at build time and includes / excludes accordingly. After restoration of the default agency, the sitemap contains 12 entries including `/developments` (vs 11 for the temporary agency) — confirming the disabled-module gate is the only difference between the two sitemaps.
- **v1.0 exposes no `/api/contact` endpoint.** A `Get-ChildItem -Recurse` of the generated `.output/public/` for `*api*` and `contact.*` files returns zero matches. The only "contact" output is the static page at `/contact/index.html`. The lead-capture branch (`feature/lead-capture-v1.1`, commit `343abeb`) ships a `POST /api/contact` Nitro endpoint; that branch is **not** part of v1.0 and is **not** present in the v1.0 static output.
- The pre-existing unrelated `@nuxt/image` Windows `sharp` warning is emitted during static generation on Windows. The warning is documented as non-fatal in `docs/REBRANDING.md` §13 and in the "Known Windows sharp warning" section below.
- 171 routes are prerendered on the development host in both configurations (default and temporary agency). Route count and prerender timing are size/perf measurements only, not runtime performance validation.
- The static-export verification was performed on a Windows development host. Provider-specific deployment (Vercel, Netlify, Cloudflare Pages, etc.) is **not** validated by this build. A rebrand deploying to a specific provider must validate the provider's deployment behavior separately.

## Milestone-divergence note

The release branch `release/v1.0.0` (M25, M26, M27) and the
preserved branch `feature/lead-capture-v1.1` (which carries a
**divergent** milestone history — it added its own M25 / M26
entries for the lead-capture architecture audit and build) have
different milestone numbers for the same milestone numbers
because they were developed on parallel branches. When the
lead-capture branch is later rebased or merged (e.g. for v1.1),
the merging session **must reconcile the milestone numbers** —
the lead-capture branch's M25 / M26 entries should be renumbered
(e.g. to v1.1 M0 / M1) or otherwise disambiguated to avoid
conflicting milestone numbers in the merged history. The release
branch is **not** to be force-pushed or re-tagged to incorporate
the lead-capture branch's numbering. See
[`docs/ROADMAP.md` "Milestone-divergence note"](ROADMAP.md#milestone-divergence-note)
for the full context.

## Deployment modes

The template supports two deployment targets. Both are
equivalent in scope at v1.0; the difference is in the
infrastructure target, not the v1.0 feature set.

* **`pnpm generate`** produces a static export under
  `.output/public/`. The dynamic Nitro routes
  (`/sitemap.xml`, `/robots.txt`) are pre-rendered so the
  static output includes the SEO infrastructure.
  `NUXT_PUBLIC_SITE_URL` must be set at build time when the
  SEO infrastructure routes need absolute URLs. The v1.0
  release's static-export behavior was verified with
  `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` on
  a Windows development host (see "Static-generation
  verification" below). Provider-specific deployment (Vercel,
  Netlify, Cloudflare Pages, etc.) is **not** validated by this
  build and must be tested by the rebrand for the chosen
  provider.
* **`pnpm build`** produces a Nitro server build under
  `.output/server/`. The same dynamic routes are served at
  request time, gated by the same env var. Use this target
  when a future v1.1 feature (such as the lead-capture
  endpoint on the `feature/lead-capture-v1.1` branch)
  requires Nitro server endpoints that a pure static host
  cannot serve.

The v1.0 release does **not** ship any Nitro-only API
endpoints. The lead-capture branch (post-v1.0) ships a
`POST /api/contact` endpoint that requires the Nitro server
build or a serverless preset that ships a Nitro server
runtime.

## Known Windows sharp warning

On Windows, `pnpm build` may emit a pre-existing `@nuxt/image`
warning similar to:

```text
[@nuxt/image] WARN sharp binaries for win32-x64 cannot be found.
```

This warning is currently **non-fatal**: the build completes
successfully, the generated site renders correctly, and the
template ships with SVG placeholder images that do not require
`sharp`. A rebrand that replaces the placeholders with raster
images (`webp`, `jpg`, `avif`) may want `sharp` to be installed
to allow on-the-fly resizing.

The warning is documented here so a rebrand deploying on
Windows is not surprised by it. If a rebrand wants to silence
the warning, run `pnpm rebuild sharp` (or
`pnpm install --shamefully-hoist` if the postinstall script
does not pick the platform-specific binary automatically). This
is a troubleshooting step, not a fix to the template; the
template itself does not claim the warning has been resolved.

## Explicitly deferred from v1.0

The following items are **not** in the v1.0 release. They are
documented here as the canonical "what is not in v1.0" list.
A future v1.0.x patch or a v1.1 release can add them; none
are required for v1.0.

| Item | Reason | Where |
| --- | --- | --- |
| Real lead capture | Post-v1.0. Preserved on `feature/lead-capture-v1.1` (commit `343abeb`). | v1.1 |
| Property-specific inquiry form | Post-v1.0. The v1.0 property detail page uses a "Contact" card linking to `/contact` and a `tel:` link. | v1.1+ |
| Individual development detail page (`/developments/[slug]`) | Post-v1.0. The `Development.slug` field is reserved. | v1.1+ |
| Individual agent detail page (`/agents/[slug]`) | Post-v1.0. The `Agent.id` field is reserved. | v1.1+ |
| Fullscreen property-gallery lightbox | Post-v1.0. The Swiper carousel covers the three real gaps (mobile swipe, keyboard nav, desktop prev/next) per `docs/ROADMAP.md` M20. | v1.1+ |
| Real API or CMS integration | Post-v1.0. The Zod-validated static data is the v1.0 contract. The `propertiesService`, `agents`, and `developments` modules are the runtime boundary. | v1.1+ |
| Automated tests | Post-v1.0. No test runner installed. The pure-function utilities and Zod schemas are unit-testable as-is. | v1.1+ |
| CI | Post-v1.0. No GitHub Actions workflow. | v1.1+ |
| Browser accessibility and performance certification | Post-v1.0. The M22 / M23 audits were static source-level reviews. A real browser pass with axe / Lighthouse / NVDA / VoiceOver is post-v1.0. | v1.1+ |
| Dark mode | Post-v1.0. The token system supports it via `[data-theme='dark']`; the implementation is post-v1.0. | v1.1+ |
| Multi-tenant deployment | Post-v1.0. `useSiteConfig` is `useState`-backed and supports the future pattern. | v1.1+ |
