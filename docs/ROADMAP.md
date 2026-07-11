# Roadmap

This document summarizes the current implementation state of the Real Estate Website Template, the active task, and the upcoming sequence. It is the canonical entry point for resuming work in a new OpenCode session.

For architecture, theming, data models, i18n rules, and component conventions, see the topic-specific docs in `docs/`. For per-implementation details and the rationale behind individual decisions, see the JSDoc on the corresponding source file. This file is intentionally short and summarises state; it does not duplicate larger docs.

## 1. Project Purpose

A modular, configuration-driven real estate website template that can be rebranded to any agency without editing components. Public site only for the MVP — properties, developments, agents, contact, and lead capture UI over static data. See `docs/SPEC.md` and `docs/REBRANDING.md` for the full scope and the rebrand workflow.

## 2. Current Implementation State

The MVP public site is functional end-to-end with static data.

| Area | State |
| --- | --- |
| Stack and docs scaffolding (`AGENTS.md`, `docs/*.md`, `package.json`, `nuxt.config.ts`) | Complete |
| Theme system + CSS variables + `useSiteConfig` + agency/theme/i18n config | Complete |
| Layout shell (`AppHeader`, `AppFooter`, `AppNavbar`, `AppMobileMenu`, `AppLanguageSwitcher`, `AppLogo`) | Complete |
| UI primitives (`BaseButton`, `BaseInput` area, `BaseCard`, `BaseContainer`, `BaseHeading`, `BaseIcon`, `BaseSection`, `BaseBadge`) | Complete |
| Shared components (`ResponsiveImage`, `CurrencyText`, `SectionHeader`, `CtaBlock`, `SocialLinks`, `FeatureItem`) | Complete |
| Feature components (`PropertyCard`, `PropertyGrid`, `PropertyGallery`, `DevelopmentCard`, `AgentCard`, `Home*`) | Complete |
| Pages: `/`, `/properties`, `/properties/[slug]`, `/developments`, `/agents`, `/about`, `/contact` | Complete |
| i18n (English + Spanish locale files, `useI18n` everywhere) | Complete |
| SEO (`usePageSeo`, canonical URLs, `og:url`, OG/Twitter cards, `NUXT_PUBLIC_SITE_URL`) | Complete |
| JSON-LD structured data (`useJsonLd`, per-page `RealEstateAgent` / `ItemList` / `RealEstateListing` / `ContactPage` / `AboutPage`) | Complete |
| Dynamic `/sitemap.xml` and `/robots.txt` Nitro routes (gated by `agency.modules.*`) | Complete |
| Listing query / sort / filter service (`propertiesService.filter`, accent-insensitive, stable order) | Complete |
| Mobile filter collapse (`< sm` viewport) | Complete; explicit hydration gate keeps SSR + no-JS form visible |
| Property sample-data runtime validation (`propertySchema`, `propertyListSchema`) | Complete; `coverImage` and required strings are non-empty |
| Lead capture UI (`/contact` form) | UI placeholder only, no backend wiring |
| Per-development detail page (`/developments/[slug]`) | Not implemented |
| Per-agent detail page (`/agents/[slug]`) | Not implemented |
| Lightbox / advanced property gallery | Not implemented |
| Pagination | Audit complete; `BasePagination` + paginate utility scheduled (Task 071) |
| Breadcrumbs | Complete on the property detail page; `SeoBreadcrumbs` + `BreadcrumbList` JSON-LD shipped (Task 070) |
| Structured `PostalAddress` data on agency / property | Not implemented |
| Admin / dashboard / auth / backend / CRM | Not implemented (out of MVP scope) |

### Notes on the current state

* `app/app.vue` is no longer the `<NuxtWelcome />` placeholder — it renders `<NuxtRouteAnnouncer>` inside `<NuxtLayout>` and hosts `<NuxtPage>`. The line in `AGENTS.md` that still describes the app as a draft on top of `<NuxtWelcome />` is a stale description; the page tree, layout, and feature modules are wired up. (The AGENTS.md text is intentionally not updated from this roadmap task.)
* `git status` is clean. The branch `master` is one commit ahead of `origin/master` (the latest local commit is `0ccb8b3` "Se mejora la responsividad de los filtros del listado de propiedades para móvil" — improvement of mobile filter responsiveness).
* Validation pipeline (`pnpm lint`, `pnpm build`) passes. `pnpm lint` reports 0 errors and 0 warnings after the M13 work. `pnpm build` completes successfully (a known unrelated `@nuxt/image` warning about missing `sharp` binaries for `win32-x64` is emitted; it is not a build failure).

## 3. Completed Milestones

The following milestones are committed to the repository. Treat them as the baseline; do not re-implement them in upcoming tasks.

1. **M0 — Project bootstrap.** Nuxt 4 with the `app/` directory convention, Tailwind CSS v4 via `@tailwindcss/vite`, Pinia, Zod v4, `@nuxtjs/i18n` (English + Spanish), Nuxt Image, Nuxt Icon, VueUse, Swiper. ESLint auto-resolved by `@nuxt/eslint`. Documentation set in `docs/`, `AGENTS.md`, `package.json` scripts (`dev`, `build`, `generate`, `preview`, `lint`, `lint:fix`).
2. **M1 — Theme + branding + i18n foundation.** `app/themes/default.theme.ts` + `app/themes/index.ts` (token-to-CSS-variable resolution), `app/config/agencies/default.agency.ts`, `app/config/site.config.ts`, `app/config/navigation.ts`, `app/config/seo.ts`, `app/config/i18n.ts`, `app/composables/useSiteConfig.ts`, and the matching `app/types/*.types.ts`. The active theme id is applied as `data-theme` on `<html>`.
3. **M2 — Layout shell and UI primitives.** `AppHeader`, `AppNavbar`, `AppMobileMenu`, `AppLanguageSwitcher`, `AppLogo`, `AppFooter`; `BaseButton`, `BaseIcon`, `BaseCard`, `BaseContainer`, `BaseSection`, `BaseHeading`, `BaseBadge`. All consume theme tokens (`var(--color-*)`, `var(--radius-*)`); no hardcoded brand colors.
4. **M3 — Home page.** `HomeHero`, `HomePropertySearch`, `HomeSearchBar`, `HomeFeaturedProperties`, `HomeCategories`, `HomeLocations`, `HomeServices`, `HomeAbout`, `HomeTestimonials`, `HomeContactCta` — all reading data from `app/features/home/data/*`.
5. **M4 — Properties module (catalog + detail).** `features/properties/{components,constants,data,schemas,services,types}/`. `PropertyCard`, `PropertyGrid`, `PropertyGallery`, the listing page (`/properties`) with filter form, the detail page (`/properties/[slug]`) with 404 handling, related properties, area/measurement rendering, and per-property `RealEstateListing` JSON-LD.
6. **M5 — Developments module (catalog only).** `features/developments/{components,data,types}/`, `DevelopmentCard`, the listing page (`/developments`). No detail page yet — the `Development.slug` field is reserved for the future route.
7. **M6 — Agents module (catalog only).** `features/agents/{components,data,types}/`, `AgentCard`, the listing page (`/agents`) with `ItemList` JSON-LD.
8. **M7 — Contact + lead capture UI.** `/contact` page with agency contact methods, WhatsApp CTA, and a placeholder form (no backend). `ContactPage` JSON-LD. Lead feature folder reserved at `app/features/leads/`.
9. **M8 — SEO refactor + sitemap/robots.** Per-page `usePageSeo` + `useSeoMeta` + canonical URLs gated by `NUXT_PUBLIC_SITE_URL`; dynamic `/sitemap.xml` and `/robots.txt` Nitro routes in `server/routes/`, gated by `agency.modules.*` and the same env var.
10. **M9 — JSON-LD structured data.** `core/composables/useJsonLd.ts`, plus per-page payloads: `RealEstateAgent` (home, shared `@id` from the home page absolute URL), `ItemList` of `ListItem` (properties catalog), `RealEstateListing` + `ItemList` of related properties (property detail), `ItemList` of `Person` (agents), `ContactPage` and `AboutPage` with `mainEntity: RealEstateAgent` (sharing the same `@id`).
11. **M10 — Property listing service hardening.** `propertiesService` with `getAll`, `getBySlug`, `getFeatured`, `getRelated` (weighted score), and `filter` (operation / type exact match, location substring against `location + city + state + country` with case-insensitive and accent-insensitive Unicode NFD normalization, stable sort tiebreak on `id` ascending). Type guard `isPropertySort`, canonical URL strips the query string, unknown `?sort=` values are coerced to `featured`. Documented in `docs/DATA_MODELS.md` Section 9.
12. **M11 — Property schema hardening.** `property.schema.ts` (`propertySchema`, `propertyListSchema`) with a compile-time guard against the `Property` interface. `coverImage` and all required string fields are `.min(1)`; `images` and `amenities` are non-empty per entry; the schema is the runtime boundary used to validate the static catalog at module load.
13. **M12 — Mobile filter responsiveness.** The `/properties` filter form is collapsed by default on `< sm` viewports behind a "Filters" toggle button that reflects the active filter count, and the form is always visible on `sm+`. The form retains `method="get" action="/properties"` so it submits natively.
14. **M13 — Mobile filter SSR / hydration fix (Task 067).** Added an explicit `isHydrated` gate in `app/pages/properties/index.vue`. The form uses `v-show="!isHydrated || !isMobile || isFilterOpen"` so the SSR HTML and no-JavaScript clients always render the form. The mobile toggle uses `v-if="isHydrated && isMobile"` so it only enters the DOM after the client takes over AND the viewport is in the mobile range. `isHydrated` is flipped to `true` at the end of `onMounted`, so the first client-side reactive update uses the real `matchMedia` value with no flash. The form still uses `v-show` (not `v-if`) so its DOM and selected values are preserved across collapse/expand. The same commit fixed the eight pre-existing `vue/first-attribute-linebreak` warnings on the file.
15. **M14 — Pagination audit (Task 068).** Pagination is part of the v1.0 template scope and is **not** deferred because the current placeholder catalog is small. The placeholder record count is not a reason to skip the build; the template must be production-ready for any agency on day one. The agreed architecture is: URL state via `?page=N`; page `1` is omitted from generated URLs; invalid `?page=` values (missing, empty, zero, negative, decimal, array, out-of-range, non-numeric) normalize safely; filter changes reset to `?page=1`; sort changes and pagination links preserve the existing `?operation=&type=&location=&sort=` query; `propertiesService.filter()` is unchanged; the page layer paginates the local placeholder data; the pagination UI must be reusable for a future API or CMS source. The build target is a reusable `BasePagination` UI primitive plus a small generic pagination utility. The component must render nothing when `totalPages <= 1`.
16. **M15 — Breadcrumb audit (Task 069).** Visible breadcrumbs and `BreadcrumbList` JSON-LD land on `/properties/[slug]` only. Listing pages (`/properties`, `/developments`, `/agents`) and the top-level pages (`/`, `/about`, `/contact`) do not get visible breadcrumbs in v1.0 because they are themselves top-level destinations. Reusable `SeoBreadcrumbs` shared component + typed `BreadcrumbItem` + `BreadcrumbList` JSON-LD via the existing `useJsonLd`. The component renders `null` when `items.length <= 1`. The trail is `Home › Properties › {property.title}`. i18n strategy is `no_prefix` so breadcrumb URLs are bare paths; `toAbsoluteUrl()` handles the absolute-URL conversion.
17. **M16 — Breadcrumbs MVP (Task 070).** New shared component `app/components/shared/SeoBreadcrumbs.vue` + new `BreadcrumbItem` type in `app/types/breadcrumb.types.ts` + new `common.breadcrumb` i18n key (English `Breadcrumb`, Spanish `Migas de pan`). Wired into `app/pages/properties/[slug].vue` with a three-item trail (`Home › Properties › {property.title}`) and a third JSON-LD payload via the existing `useJsonLd` composable — a `BreadcrumbList` with 1-based positions, absolute URLs via `toAbsoluteUrl`, and the current item using `canonicalUrl.value` with a `toAbsoluteUrl('/properties/${slug}')` fallback. The existing `RealEstateListing` and related-properties `ItemList` JSON-LD payloads are unchanged. The standalone "Back to properties" block on the property detail page is removed because the breadcrumb's second item points to the same destination. No breadcrumbs are added to listing or top-level pages. `docs/REBRANDING.md` Section 14 documents the trail, the reusable component, the `common.breadcrumb` key, and the future reuse on agent and development detail pages.

## 4. Current Work

### Active task

**Task 071 — Pagination MVP.** Owner: the next OpenCode session.

The breadcrumb audit and build (M15 / Task 069 and M16 / Task 070) are complete; the property detail page now ships a visible breadcrumb trail plus a matching `BreadcrumbList` JSON-LD. The next active task implements pagination per the architecture recorded in M14. The build target is a reusable `BasePagination` UI primitive plus a small generic pagination utility; the component must render nothing when `totalPages <= 1`, must be reusable for a future API or CMS source, and must not depend on the current placeholder record count. The page layer paginates the local placeholder data; `propertiesService.filter()` stays unchanged. The full build checklist lives in Section 5; the next session should:

* Read `app/pages/properties/index.vue`, `app/features/properties/services/properties.service.ts`, and `app/features/properties/data/properties.ts` to understand the existing filter / sort flow and the data shape.
* Add `app/core/utils/paginate.ts` with a small generic pagination utility and a `parsePageParam` helper that normalises invalid `?page=` values silently (matching the existing `?sort=` coercion pattern).
* Add `app/components/ui/BasePagination.vue` with `currentPage`, `totalPages`, `baseHref`, `query`, `siblings`, `boundaries` props. The component renders `null` when `totalPages <= 1`.
* Wire `?page=` into `app/pages/properties/index.vue`: read the query, run `parsePageParam`, slice the filtered + sorted list with the paginate helper, render `<BasePagination>` below `<PropertyGrid>`. Filter submit and clear reset to `?page=1`; sort changes preserve `?page=N`.
* Add `properties.pagination.*` i18n keys to both `i18n/locales/en.json` and `i18n/locales/es.json`.
* Update `docs/DATA_MODELS.md` Section 9 with the `page` row and the validation / coercion table.
* Re-run `pnpm lint` and `pnpm build`. Update the roadmap (Section 3) with M17 once the build ships.

### Working tree

`git status` is clean after the M13 work. The branch is one commit ahead of `origin/master` (commit `0ccb8b3`); the M13 changes are still in the working tree and must be committed before opening Task 071.

## 5. Upcoming Tasks

The remaining tasks, in order. Each task should follow the same lifecycle: read the relevant `docs/`, plan in this file, implement, run `pnpm lint` + `pnpm build`, then advance the milestone status here.

1. **Task 072 — Structured Address / PostalAddress Audit.** Decide whether the agency and the property records should carry a schema.org `PostalAddress` payload (street, city, state, postal code, country), and which fields are needed. Coordinate with the rebranding flow in `docs/REBRANDING.md`.
2. **Task 073 — Structured Address / PostalAddress Build.** Extend `AgencyConfig` and `Property` models, add the Zod schemas, surface the values on the home / contact / property detail pages, and emit `PostalAddress` inside the existing `RealEstateAgent` / `RealEstateListing` JSON-LD.
3. **Task 074 — Property Gallery Enhancement Audit.** Audit `PropertyGallery` for keyboard navigation, swipe support, fullscreen / lightbox need, deep-linkable slides, and accessibility. Coordinate with `Swiper` (already a dependency).
4. **Task 075 — Property Gallery Lightbox MVP.** Build a lightbox overlay (or `Swiper` modal) for the property detail gallery, preserving focus trap, `Esc` to close, and the existing LCP behavior on the main image.
5. **Task 076 — Documentation and Accessibility Review.** Update `docs/REBRANDING.md`, `docs/DESIGN.md`, and `docs/DATA_MODELS.md` to reflect everything shipped in tasks 071–075; run an `axe` / Lighthouse pass on the affected routes.

## 6. Deferred Work

Tracked separately so they are not lost but are explicitly not part of the next ten tasks.

* **Per-development detail page** (`/developments/[slug]`) — `Development.slug` is reserved; the route, the development `DevelopmentCard` deep link, and the sitemap entry are all waiting on the build.
* **Per-agent detail page** (`/agents/[slug]`) — `Agent.id` is reserved; the route, the agent detail block, and the JSON-LD are waiting on the build.
* **Real lead capture** — `app/features/leads/` is a `.gitkeep`. The contact form is a UI placeholder; wiring a real backend, `Lead` schema, and submission endpoint is out of the MVP.
* **Blog / content module** — `agency.modules.blog` ships `false` by default; the route and the home section are not implemented.
* **Testimonials module** — `agency.modules.testimonials` ships `true`; the section is implemented (`HomeTestimonials`) but has no dedicated route or admin.
* **Property comparison, saved properties, accounts, scheduling, valuation, PDF brochures** — all future-phase features from `docs/SPEC.md` Section 7 / `docs/ROADMAP.md` (legacy) Section 5.
* **Admin / dashboard / auth / CMS / CRM / maps / external image storage / payments** — explicitly out of MVP scope per `docs/SPEC.md` Section 7.
* **Dark mode** — `docs/DESIGN.md` calls dark mode optional for the MVP and the token system already supports it via a `[data-theme='dark']` selector, but no implementation exists.
* **Multi-agency / multi-tenant deployment** — `docs/REBRANDING.md` describes the path, but the runtime still resolves a single `activeAgency` at boot.

## 7. Important Architectural Decisions

These are the decisions a new session needs to know to avoid re-litigating them. Each is enforced by the codebase; do not undo them without updating the relevant `docs/` file.

* **Nuxt 4 feature-first architecture** under `app/features/<domain>/{api,components,composables,constants,data,schemas,services,stores,types,utils}/`. Shared infrastructure lives under `app/components/{ui,layout,shared}/`, `app/core/`, `app/config/`, `app/themes/`, and `app/composables/`. See `docs/ARCHITECTURE.md` and `AGENTS.md` "Architecture".
* **Agency branding is configuration-driven.** All agency identity, contact details, social links, currency, measurement unit, and enabled modules live in `app/config/agencies/*.agency.ts` and are read through `useSiteConfig()`. Components never hardcode agency content. See `docs/REBRANDING.md`.
* **Theme tokens are CSS variables, not Tailwind palette classes.** The active theme is resolved by `app/themes/index.ts` and serialized into `var(--color-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--font-*)` on `<html data-theme="…">`. Components use the variables; Tailwind color utilities are not used for brand colors.
* **i18n keys everywhere.** No hardcoded visible UI text. Every `$t('key')` is defined in both `i18n/locales/en.json` and `i18n/locales/es.json`.
* **Listing filters use URL query parameters.** `/properties?operation=&type=&location=&sort=`. The `applyFilters` handler in the page only navigates with non-empty / non-default values, and the canonical URL strips the query string for SEO. Documented in `docs/DATA_MODELS.md` Section 9 and `docs/REBRANDING.md` Section 11.
* **Location matching is case-insensitive and accent-insensitive** (Unicode NFD + combining-mark strip, no external dependency). Implemented in `propertiesService.filter`. Documented in `docs/DATA_MODELS.md` Section 9.
* **Default sorting is stable across SSR and CSR.** Every sort branch uses `id.localeCompare(otherId)` as a tiebreaker so equal-scoring or equal-priced properties render in the same order in both passes. The `ItemList` JSON-LD mirrors the visible order via `position: index + 1`.
* **Mobile filters use an inline collapse, not a modal sheet.** A `< sm` viewport collapses the filter form behind a "Filters" toggle button that reflects the active filter count. The form keeps `method="get" action="/properties"` so it still submits natively without JavaScript.
* **LCP images use `loading="eager"` + `fetchpriority="high"`** (the home hero in `HomeHero.vue` and the property detail cover inside `PropertyGallery.vue`). All other images rely on `<ResponsiveImage>`'s `lazy` / `auto` defaults. The wrapper forwards both attributes to `<NuxtImg>`. Documented in `docs/REBRANDING.md` Section 12.
* **JSON-LD uses stable canonical entity identifiers.** The home page's `RealEstateAgent.@id` is the absolute home URL; the contact page's `ContactPage.mainEntity` and the about page's `AboutPage.mainEntity` reuse the same `@id` so search engines treat the agency as a single knowledge-graph node. Per-listing `RealEstateListing` uses `canonicalUrl` as `@id` when `NUXT_PUBLIC_SITE_URL` is set.
* **Property sample data is validated through Zod** at module load via `propertyListSchema` in `app/features/properties/schemas/property.schema.ts`. A bad record prevents the app from booting — this is intentional.
* **Empty required property strings are rejected by the schema.** `coverImage`, `title`, `slug`, `description`, `location`, `city`, `state`, `country`, `currency`, and every `images[i]` / `amenities[i]` entry are `.min(1)`. The agency config has its own validation in `app/config/agencies/default.agency.ts`.
* **Global stores are reserved for app-wide state only.** `app/stores/` is a `.gitkeep`. The current MVP has no global Pinia store; per-feature stores would live under their feature folder. See `docs/ARCHITECTURE.md` Section 7.
* **`server/routes/` is the right home for Nitro endpoints** (current files: `sitemap.xml.ts`, `robots.txt.ts`). The `app/server/` path does not exist; do not create it.
* **ESLint is auto-resolved by `@nuxt/eslint`.** Do not add a manual ESLint config.
* **Pagination is in v1.0 scope regardless of the placeholder catalog size.** The shipped `app/features/properties/data/properties.ts` is placeholder content for a single template demonstration, not a production agency. The template must be production-ready for any agency on day one, so `BasePagination` and the pagination utility are scheduled in Task 071 — they are not gated on the placeholder catalog reaching a threshold. Audit decision recorded in M14.
* **Breadcrumbs are in v1.0 scope for the property detail page only.** Listing pages and top-level pages do not get visible breadcrumbs in v1.0 because they are themselves top-level destinations. The `SeoBreadcrumbs` shared component + `BreadcrumbList` JSON-LD payload shipped in M16 will be reused unchanged by the future `/agents/[id]` and `/developments/[slug]` detail pages — each one only needs a different three-item `items` array. Audit decision recorded in M15.

## 8. How to Resume Work in a New Session

1. **Read `AGENTS.md`** for the project-wide rules (stack, conventions, naming, validation).
2. **Read `docs/OPENCODE.md`** (now includes the "Roadmap-first rule" in Section 0.1) and **`docs/ROADMAP.md` (this file)**. The roadmap is the canonical entry point for what is done, what is active, and what is next.
3. **Read the task-specific doc** in `docs/` for the task you are about to start. For the active task (Task 071), the relevant code is `app/pages/properties/index.vue`, `app/features/properties/services/properties.service.ts`, and `app/features/properties/data/properties.ts`; the relevant composable is `app/core/composables/usePageSeo.ts`.
4. **Check `git status` and `git log --oneline -10`** to confirm the working tree state and the latest commits.
5. **Reuse existing primitives** — `usePageSeo`, `useJsonLd`, `useSiteConfig`, `propertiesService`, `BaseButton`, `BaseIcon`, `BaseSection`, `SectionHeader`, `CtaBlock`, `ResponsiveImage`, etc. — instead of building parallel helpers.
6. **Update i18n in both locales** when adding or changing visible strings.
7. **Run `pnpm lint` and `pnpm build`** before declaring the task done.
8. **Update this file** (see Section 9) so the next session starts from an accurate state.

## 9. Roadmap Update Policy

The roadmap is meant to be easy to keep current. After each completed task:

* Move the task from "Current work" to the matching milestone in Section 3, or add a new milestone if the work is large enough to deserve one. Do not list every historical commit — summarise by milestone.
* If a task is deferred, move it from "Upcoming tasks" to "Deferred work" with a one-line reason.
* If a new task is identified, append it to "Upcoming tasks" (preserving the order; new tasks go to the end of the queue, not the front).
* If an architectural decision changes, update Section 7 and the matching `docs/` file in the same change.
* Do not duplicate implementation details here. Implementation details belong in the JSDoc of the affected source file or in the relevant `docs/` file. This file is the index, not the documentation.
* Do not paste full task outputs, full diffs, or full file contents into this file. A short status line per milestone is enough.
