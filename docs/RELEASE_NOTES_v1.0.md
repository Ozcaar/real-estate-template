# Release Notes — v1.0.0

Real Estate Website Template — version 1.0.0.

## Release summary

v1.0 is the first production-ready release of the Real Estate
Website Template. It ships a Nuxt 4 application that renders a 7-page
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
v1.0.0 commit on the `release/v1.0.0` branch. The lead-capture
work that exists on the `feature/lead-capture-v1.1` branch
(commit `343abeb`) is **not** part of v1.0.

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

The v1.0 release candidate was tested end-to-end with a temporary
second-agency configuration (`app/config/agencies/second.agency.ts`)
that exercises a different identity (`acme` vs `default`),
different default locale (`es` vs `en`), different currency
(`MXN` vs `USD`), different measurement unit (`imperial` vs
`metric`), different contact data (Mexican phone + Mexican
PostalAddress), different social links (3 platforms instead of
5), and different module flags (developments + testimonials
disabled). The agency was registered through the documented
rebrand path (swap the import in `app/config/site.config.ts`).
`pnpm lint` reported 0 errors and 0 warnings, and `pnpm build`
completed successfully. The cross-config Zod validation
(`defaultLocale` ⊆ `availableLocales`, theme id in the
registry, locales registered in `defaultI18nLocales`) accepted
the new agency. The temporary file was deleted and the
default agency was restored. The verification confirms that
the rebrand workflow documented in `docs/REBRANDING.md` §3
Option B works end-to-end for an agency that differs from the
sample on every meaningful axis.

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
  release is fully usable on a pure static host.
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
