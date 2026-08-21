# Release Notes — v1.2

Real Estate Website Template — version 1.2.

## Release summary

v1.2 is the third stable release of the Real Estate Website Template. It is **release-ready based on the verifiable checks documented in this file** (install, lint, unit tests, default Playwright suite, Studio typecheck, build, static generation, source-level review of the Sanity integration, the Sanity boundary regression test, the deterministic default Playwright environment, and the opt-in real-Sanity Playwright round-trip).

The headline feature is the **Sanity CMS provider driver** — a server-only integration of `@sanity/client` plus the GROQ → mapping → Zod boundary pipeline, wired through the existing `cms` data-source branch. A rebrand that switches a feature to Sanity sets `NUXT_<FEATURE>_CMS_PROVIDER=sanity` + `NUXT_<FEATURE>_DATA_SOURCE=cms` and the four shared `NUXT_SANITY_*` env vars (`NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`). v1.2 also ships the **Sanity Studio** as a separate project under `studio/` with the Property / Agent / Development document schemas and a focused Studio typecheck + test foundation, plus a **deterministic default Playwright environment** that decouples `pnpm test:e2e` from the operator's local `.env`, an **opt-in real-Sanity Playwright round-trip** (11 cases), and a **first-client operations guide** (`docs/SANITY_OPERATIONS.md`).

v1.2 ships a **1230-test Vitest suite** (47 files) plus the **62-case Playwright suite** (8 spec files, default deterministic mode) plus the **47-case Studio suite** (`pnpm studio:typecheck`). The `pnpm install --frozen-lockfile` build is reproducible on a clean checkout.

The v1.0.0 release (tag `v1.0.0` on `release/v1.0.0` at `456284c`) and the v1.1.0 release (tag `v1.1.0` on `feature/lead-capture-v1.1` at `e49597f`) are **not** changed by this release. After the final release-candidate verification, the `v1.2.0` tag is added to the current verified commit on `feature/lead-capture-v1.1`; the v1.0.0 tag, the `release/v1.0.0` branch, and the v1.1.0 tag are not force-pushed or re-tagged. **No dedicated `release/v1.2.0` branch is required.**

The Sanity work is **provider-scoped, server-only, and tenancy-isolated**. The `@sanity/client` driver lives at `server/utils/sanity-driver.ts` (the canonical Nuxt 4 server-only location); the read token (when the dataset is private) is read from `process.env` and never leaves the server bundle. The boundary regression test at `server/utils/sanity-boundary.test.ts` asserts no `app/` file imports `@sanity/client`, references `NUXT_SANITY_TOKEN`, or re-exports the provider driver. The Sanity Studio ships under `studio/` as a separate project (its own `package.json` / `pnpm-lock.yaml` / `node_modules`); the Studio deploys to Sanity's managed hosting at `<projectId>.sanity.studio`. One client = one agency = one isolated Sanity project (the v1.1.0 multi-tenant foundation in `app/config/agencies/registry.ts` is the host-side isolation contract; the Sanity project is the content-side isolation contract). The CMS data-source contract (`'static'` / `'api'` / `'cms'` per feature) is preserved; a rebrand that does not want Sanity keeps the `static` default and the v1.1.0 lead-capture pipeline.

## What's in v1.2

The v1.2 pilot work is documented in `docs/ROADMAP.md` entries 59–65 (Tasks 115, 116, 117, 117B, 118, 119, 120). The summary below mirrors the section structure of the v1.1.0 release notes.

### Generic CMS architecture (already shipped in v1.1.0 M13, M17, M20, M25)

The data-source adapter foundation (`app/core/data-source/`) ships the `DataSourceKind` set (`'static'` / `'api'` / `'cms'`), the async-first `DataSourceAdapter<T>` contract (`loadAll(): Promise<readonly T[]>` + `getAll(): readonly T[]`), the `selectDataSource(config, registry)` selector with the "fail clearly" guarantee, the five error classes (`DataSourceMissingConfigError` / `DataSourceHttpError` / `DataSourceTimeoutError` / `DataSourceInvalidPayloadError` / `DataSourceNotImplementedError`), the static adapter, the HTTP API adapter, the HTTP/JSON CMS adapter (provider-driver boundary), and the shared `server-data-source.ts` utility. The CMS adapter foundation (provider-driver boundary) was shipped in v1.1.0 M20 (Task 103); v1.2 adds the Sanity provider driver on top.

### Sanity provider integration (Task 116, v1.2 pilot 1)

The first provider-specific `CmsDriver<T>` implementation is the **Sanity driver** at `server/utils/sanity-driver.ts` (server-only location). The driver uses the official `@sanity/client` SDK to execute a GROQ projection against the agency's Sanity project + dataset. The driver is constructed per-feature (`CmsDriver<Property>` / `CmsDriver<Agent>` / `CmsDriver<Development>`); the GROQ query and the per-record `mapRecord` function are the only feature-specific pieces. The boundary Zod schema is supplied to the adapter separately; the adapter validates the driver's output and memoise the array.

**Configuration model.** The configuration is shared across the three features, not duplicated per feature. The four env vars are documented in `docs/DEPLOYMENT.md` and `docs/CMS_EVALUATION.md`:

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_SANITY_PROJECT_ID` | yes when `cms` is in use | — | The Sanity project ID. |
| `NUXT_SANITY_DATASET` | yes when `cms` is in use | `production` | The dataset name. |
| `NUXT_SANITY_API_VERSION` | yes when `cms` is in use | `2024-01-01` | Pinned Sanity API version. |
| `NUXT_SANITY_TOKEN` | no (server-only) | `''` | Optional read token for private datasets. |

Per-feature activation: `NUXT_<FEATURE>_CMS_PROVIDER=sanity` + `NUXT_<FEATURE>_DATA_SOURCE=cms` for each feature that should switch to Sanity. The loader respects the kind: `'static'` returns the bundled static adapter, `'api'` returns the HTTP API adapter, `'cms'` returns the Sanity provider driver via the shared server-data-source utility.

**Image strategy.** The Sanity GROQ projection resolves image assets to `cdn.sanity.io/images/...` URLs. `nuxt.config.ts → image.domains` adds `cdn.sanity.io` so the IPX provider accepts the remote URLs. Hotspot / crop-aware URL building (`@sanity/image-url`) is intentionally deferred to a future task; the pilot uses the direct projected asset URLs.

**Boundary regression test.** `server/utils/sanity-boundary.test.ts` asserts that no `app/` file imports `@sanity/client`, references `NUXT_SANITY_TOKEN`, or re-exports `createSanityDriver` / `createSanityClientConfig`. The boundary test also asserts the file-location invariant (`server/utils/sanity-driver.ts`) and the `nuxt.config.ts` `image.domains` entry.

### Sanity Studio (Tasks 117, 117B, v1.2 pilots 2 and 3)

The Studio ships as a separate project under `studio/` at the repo root:

```text
studio/
├── package.json           Studio dependencies (sanity, react, styled-components, …)
├── pnpm-lock.yaml         The Studio's own lockfile (independent of the root)
├── sanity.config.ts       The Studio config (project ID, plugins, schemas)
├── sanity.cli.ts          The CLI config (for `sanity` commands)
├── tsconfig.json          TypeScript config
├── vitest.config.ts       Vitest config (schema tests)
├── schemas/               The three document schemas
│   ├── index.ts
│   ├── property.ts
│   ├── agent.ts
│   ├── development.ts
│   └── schemas.test.ts
└── README.md              Setup / deploy / access workflow
```

The Studio is **isolated** from the Nuxt runtime: it is a separate npm project with its own dependencies; the Nuxt app does not import anything from the Studio, the Studio does not import anything from the Nuxt app; the two communicate via the Sanity project ID + dataset.

**Project + dataset.** The Studio reads `SANITY_STUDIO_PROJECT_ID` (required) and `SANITY_STUDIO_DATASET` (optional, default `production`) from the environment at startup. The config refuses to boot when the project ID is empty or unset (`studio/sanity.config.ts` throws a clear error). The agency's Sanity organisation owns the project and the billing.

**Document schemas.** Three document schemas ship under `studio/schemas/`:

- `studio/schemas/property.ts` — Property (matches the runtime `Property` model: title, slug, description, operationType, propertyType, price, currency, amenities, coverImage, images, location, city, state, country, coordinates, bedrooms, bathrooms, parkingSpaces, sizeUnit, constructionSize, landSize, agent reference, development reference, status, featured).
- `studio/schemas/agent.ts` — Agent (name, slug, role, bio, image, phone, email, whatsapp, specialties).
- `studio/schemas/development.ts` — Development (name, slug, status, location, description, image, priceFrom, priceTo, currency, sizeUnit, units, bedrooms, areaFrom, areaTo, deliveryDate, featured).

Each schema declares the field names, enum values, required fields, and reference targets that match the runtime Zod schemas. The Studio's `schemas.test.ts` pins the field-name parity (41 cases).

**Vision plugin (developer tool, dev-only).** The Vision plugin (GROQ playground) is bundled only when `NODE_ENV !== 'production'`. The deployed Studio at `<projectId>.sanity.studio` does NOT include Vision; the agency editors do not need it.

**`SANITY_STUDIO_*` exposure rule.** Every `SANITY_STUDIO_*` env var is inlined into the Studio's Vite-built JavaScript bundle at build time. The bundle is publicly served at `<projectId>.sanity.studio`. The operator MUST NOT place a token, a key, or any other secret in a `SANITY_STUDIO_*` env var. The Studio's only configuration is the project ID + dataset name; secrets live in the Nuxt app's runtime config (`NUXT_SANITY_TOKEN`, read server-only from `process.env`).

**Grouping and UX polish.** The Property schema groups its fields into seven tabs (Content / Pricing / Details / Media / Location / References / Status). The Details tab hides bedrooms / bathrooms / parking spaces / construction size when `propertyType === 'land'` (the only conditional relevance rule — the values are preserved in the document, so changing the type back to "house" / "apartment" restores the previous values). Every editor-facing field carries an in-line description with format guidance (e.g. "Three-letter ISO 4217 code (e.g. USD, EUR, MXN)."). Required-field rules chain human-readable `.error(...)` messages ("Title is required." instead of "Field is required"). Enum titles are human-readable ("For sale" / "For rent" / "Hidden (not visible in the catalog)"). Document previews surface the cover image + human-readable subtitle (e.g. "For sale · Monterrey · Available").

### Real end-to-end Sanity validation (Task 118, v1.2 pilot 4)

The validation procedure is documented at `docs/SANITY_VALIDATION.md` (Sections 0–14). The procedure verifies:

- Real content is created via the Studio (not via a static fixture).
- The published dataset is read by the Nuxt app via the `@sanity/client` driver.
- The GROQ projection returns the documented shape (slug, images, references, coordinates, enums, etc.).
- The mapping produces a `Property` / `Agent` / `Development` shape that passes the boundary Zod schema.
- The page render displays the data correctly (cover image, gallery, agent card, development card, related listings).
- The reference resolution links a property to its agent and its development.
- The image pipeline renders Sanity CDN URLs through Nuxt Image.

**Fixtures-based integration test.** `server/utils/sanity-integration.test.ts` ships 14 deterministic cases (realistic Sanity-shape fixtures that exercise the agent / development / property pipelines, image preservation, reference resolution, coordinates preservation, amenities preservation, and the boundary-schema rejection path). The fixtures use the exact shape the GROQ projection returns from a real Sanity dataset.

**Opt-in real-Sanity round-trip.** `tests/e2e/sanity-real-validation.spec.ts` ships 11 cases (3 API endpoints + 2 cross-list reference resolutions + 1 Agent detail + 1 Development detail + 4 image-loading regression assertions). The spec is opt-in: `SANITY_REAL_E2E=1` + a running dev server with a real Sanity dataset behind it. The default `pnpm test:e2e` does NOT set this flag; the real-Sanity suite is excluded by `testIgnore` in the default deterministic mode.

**Deterministic default Playwright environment.** `playwright.config.ts` branches on `SANITY_REAL_E2E` at config-load time. Default mode: `reuseExistingServer: false`, fresh `pnpm preview` on port 3001, `webServer.env` overrides `NUXT_PROPERTIES_DATA_SOURCE` / `NUXT_AGENTS_DATA_SOURCE` / `NUXT_DEVELOPMENTS_DATA_SOURCE` to `'static'` and clears `NUXT_SANITY_PROJECT_ID` / `NUXT_SANITY_TOKEN`. The default 62-case deterministic suite is independent of the operator's local `.env`. Opt-in mode: `reuseExistingServer: true`, reuses the operator's dev server on port 3000 (`http://localhost:3000`).

**Sharp / IPX fix.** The `@nuxt/image` default IPX provider uses the `sharp` native module for image processing. On Windows x64, `pnpm install --frozen-lockfile` did not install the `sharp` prebuilt binary (it was a `@nuxt/image` optional dep, and the install scripts that download the prebuilt binary were skipped). The IPX provider returned `HTTP 500` on every `/_ipx/...cdn.sanity.io...` URL because the in-memory `sharp` module had no native binary. The fix: make `sharp@^0.32.6` and `ipx@^2.1.1` explicit direct dependencies in `package.json` so the install scripts run; on a Windows host, `node install/libvips` + `node install/dll-copy` + `node install/prebuild-install/bin.js` from `node_modules/.pnpm/sharp@0.32.6/node_modules/sharp/` download the `sharp-win32-x64.node` prebuilt binary and the libvips DLLs. After the fix and a dev-server restart, every IPX source returns `200 OK` with `content-type: image/png`. The `sharp` install is reproducible from the lockfile alone (`pnpm install --frozen-lockfile`); `node -e "require('sharp')(...).png().toBuffer()..."` produces a valid PNG with `sharp v = 0.32.6` + `libvips v = 8.14.5`.

### Editor workflow polish (Task 119, v1.2 pilot 5)

The three Studio document schemas were polished for a non-technical agency editor:

- **Human-readable enum titles** — `For sale` / `For rent`, `Available` / `Sold` / `Rented` / `Reserved` / `Hidden (not visible in the catalog)`, `Pre-sale` / `Under construction` / `Ready to deliver` / `Sold out`, etc.
- **In-line field descriptions** — every editor-facing field carries a short description with format guidance (e.g. "Three-letter ISO 4217 code (e.g. USD, EUR, MXN).", "A square portrait (1:1) for best results. The hotspot is enabled so you can pick the focal point.", "International format with country code (e.g. '+52 55 1234 5678').").
- **Helpful required-field messages** — every `Rule.required()` chain ends with a `.error('Field name is required.')` so the editor sees the failing field name instead of the generic "Field is required".
- **Helpful numeric validation messages** — every `Rule.min(0)` / `Rule.integer()` chain ends with a `.error('X must be 0 or greater.')` / `.error('X must be a whole number.')` message.
- **Helpful slug generation** — the slug widget is auto-generated from the title / name; the editor can override. The slug is the canonical URL parameter for the public route.
- **Image / gallery guidance** — cover image: "The primary visual on the catalog card and the detail page. Use a landscape image (16:9 or 4:3) for best results." Gallery: "Additional images shown in the property gallery (the cover image is the first image the visitor sees). Add 2 to 5 high-quality images."
- **Reference-field guidance** — agent: "The agent who manages this listing. Pick from the existing agents in the dataset (leave empty if unassigned)." Development: "The development this listing belongs to. Leave empty for standalone listings."
- **Clearer location / contact labels** — `location` is now titled "Street address" with description "The full street address or a human-readable location (e.g. '123 Main Street, Polanco')."; city / state / country descriptions spell out the format with examples.
- **Conditional relevance** — `bedrooms`, `bathrooms`, `parkingSpaces`, and `constructionSize` are hidden when `propertyType === 'land'`. The values are preserved in the document; switching the type back restores them. No other conditional rules (the runtime has no notion of "land-only" filtering, and a simpler field-count model is easier to teach).
- **Human-readable preview subtitles** — Property previews show "For sale · Monterrey · Available"; Development previews show "Monterrey · Pre-sale"; Agent previews show the role. The select projection gained `operationType` so the prepare function can read it.
- **Sanity history vs dataset export** — the Studio's "History" panel (and `pnpm exec sanity documents mutations` API) provides recent-change rollback. Plan-dependent retention: Free 3 days, Growth 90 days, Enterprise 365 days (with custom retention potentially available). Long-term backup uses `sanity datasets export` + `sanity datasets import`.

### Client onboarding + operations documentation (Task 120, v1.2 pilot 6)

The first-client operations guide is at `docs/SANITY_OPERATIONS.md`. The guide is the post-implementation operations workflow after the project is live and is structured into:

- **§1 Ownership model (the cardinal rules).** One client = one agency = one isolated Sanity project. The agency owns the project and billing. The agency always retains Administrator access. Operator access depends on the maintenance agreement. The agency's photography is uploaded to the agency's own media store. Sanity secrets are not committed to the repository.
- **§2 One-time setup.** A 9-step table indexing the existing guides: collect Sanity-side inputs → create the Sanity project on the agency's organisation → create the `production` dataset → install the Studio locally → deploy the Studio → grant the agency Administrator access → configure the Nuxt app's server-side Sanity env vars on the deployment's secret manager → run the one-time Sanity validation procedure → capture the handoff record. Plus the Sanity plan + role implications (Free / Growth / Enterprise; the five roles — Administrator / Editor / Developer / Contributor / Viewer — and their capabilities) and the public vs private dataset choice.
- **§3 Client editing workflow.** The agency's normal day-to-day: sign in → create document → override slug → upload images → set status → publish → verify the change is live.
- **§4 Operator / maintenance workflow.** The operator's responsibility when a maintenance contract is in place: maintain the Nuxt deploy, maintain the Studio deploy, maintain the Sanity-side env vars, validate content changes against the live dataset, respond to incidents, report operational summaries. Plus the operator's role choice under the maintenance agreement.
- **§5 Smoke validation after content changes.** The "did my change go live?" check: the Studio confirms the publish → the Sanity dataset shows the change → the Nuxt app's same-origin API returns the change → → the public page renders the change.
- **§6 Export / backup expectations.** Document history (recent-change rollback; plan-dependent retention) vs dataset export (long-term backup). The current Sanity CLI shape: `sanity datasets export <dataset> <destination>` and `sanity datasets import -d <dataset> <source> --replace`. The export is a gzipped tarball. Backup ownership is the agency's; operator access to or retention of a working copy depends on the maintenance agreement and applicable retention/security policy.
- **§7 Incident / recovery actions.** A 7-row incident-response table covering bad publish, Studio unreachable, `DataSourceInvalidPayloadError`, 5xx data-source env vars, bad batch of records (use Studio History for recent rollback, dataset export for long-term), leaked read token (rotate immediately), corrupt dataset (restore from backup).
- **§8 End-of-contract handoff.** Eight access removal steps; the access removal cadence; the agency's post-handoff posture. Source-code ownership is determined by the commercial agreement, not by these platform rules.

The one-time Sanity validation procedure (`docs/SANITY_VALIDATION.md`) covers the pre-flight, project creation, dataset creation, Studio install + configure, content creation, dataset verification, Nuxt configure, dev server, page render verification, reference resolution verification, published-dataset-only behavior verification, cleanup, re-running the validation, and failure modes + diagnostics. The Studio developer's manual (`studio/README.md`) covers the Studio-specific setup (project creation, dataset creation, Studio install + configure, populate-the-dataset workflow, Studio deploy, access grant, schema tests, typecheck, wire-the-Nuxt-app env-var table, schema contract table, and the explicit "What this Studio does NOT do" list).

### Test counts at HEAD

| Surface | Count | Command |
| --- | --- | --- |
| Vitest unit suite | **1230 tests / 47 files** | `pnpm test` |
| Playwright default deterministic suite | **62 cases / 8 spec files** | `pnpm test:e2e` |
| Playwright opt-in real-Sanity suite | **11 cases** | `pnpm test:e2e:sanity` (requires `SANITY_REAL_E2E=1`) |
| Studio typecheck + tests | **47 cases / 2 files** | `pnpm studio:typecheck` |
| Static generation (deterministic) | **203 prerendered routes** | `NUXT_PUBLIC_SITE_URL=https://example.test NUXT_PROPERTIES_DATA_SOURCE=static NUXT_AGENTS_DATA_SOURCE=static NUXT_DEVELOPMENTS_DATA_SOURCE=static NUXT_SANITY_PROJECT_ID= NUXT_SANITY_TOKEN= pnpm generate` |

## Validation summary

The v1.2 release-candidate verification is reproducible from a clean checkout:

```bash
pnpm install --frozen-lockfile     # exit 0; the lockfile is the source of truth
pnpm test                          # 1230/1230 across 47 files
pnpm test:e2e                      # 62/62 across 8 spec files (default deterministic mode)
pnpm studio:typecheck              # 47/47 across 2 files
pnpm lint                          # 0 errors / 0 warnings
pnpm build                         # completes; emits the documented @nuxt/image Windows sharp warning (non-fatal)
NUXT_PUBLIC_SITE_URL=https://example.test NUXT_PROPERTIES_DATA_SOURCE=static NUXT_AGENTS_DATA_SOURCE=static NUXT_DEVELOPMENTS_DATA_SOURCE=static NUXT_SANITY_PROJECT_ID= NUXT_SANITY_TOKEN= pnpm generate   # 203 prerendered routes
git diff --check                   # clean
```

The current validation result for each step (recorded at release-prep time):

- `pnpm install --frozen-lockfile` — exit 0; no `--frozen-lockfile` drift after the v1.2 work.
- `pnpm test` — **1230 / 1230 across 47 files** (8.4 s wall clock).
- `pnpm test:e2e` — **62 / 62 across 8 spec files** (default deterministic mode; the Sanity spec is excluded via `testIgnore`).
- `pnpm test:e2e:sanity` — **11 / 11 cases pass** (the post-restart real-Sanity round-trip; requires `SANITY_REAL_E2E=1` and a running dev server).
- `pnpm studio:typecheck` — **47 / 47 cases pass** (2 test files: 41 `schemas.test.ts` + 6 `sanity.config.test.ts`).
- `pnpm lint` — **0 errors / 0 warnings**.
- `pnpm build` — completes; the documented `@nuxt/image` Windows `sharp` warning is emitted as expected (the warning is about the build output's traced deps, not the dev server's runtime).
- `NUXT_PUBLIC_SITE_URL=https://example.test NUXT_PROPERTIES_DATA_SOURCE=static NUXT_AGENTS_DATA_SOURCE=static NUXT_DEVELOPMENTS_DATA_SOURCE=static NUXT_SANITY_PROJECT_ID= NUXT_SANITY_TOKEN= pnpm generate` — **203 prerendered routes** in `.output/public/`. The deterministic static baseline (6 Properties + 4 Agents + 4 Developments from the bundled sample data) is independent of the operator's local Sanity `.env`; explicit env overrides force static for all three features.
- `git diff --check` — **exit 0**.

### Why the release-prep generate produced 57 routes instead of the historical 203

The first release-prep run of `pnpm generate` reported **57 prerendered routes** rather than the historical 203-route deterministic static baseline. The verified facts are:

- The operator's local `.env` at `E:\dev\inmoviliaria-template\.env` sets `NUXT_PROPERTIES_DATA_SOURCE=cms` + `NUXT_PROPERTIES_CMS_PROVIDER=sanity` (and the same for agents and developments) plus `NUXT_SANITY_PROJECT_ID` / `NUXT_SANITY_DATASET` / `NUXT_SANITY_API_VERSION`. Nuxt's dev server and the static export both automatically read `.env` at process start.
- The operator's Sanity test dataset contains fewer records than the bundled static sample data (the test dataset has 1 Property, 1 Agent, 1 Development; the bundled static data has 6 Properties, 4 Agents, 4 Developments). The route generation is therefore **dataset-dependent**: when the data source is `cms`, the generator follows the CMS dataset's records; when the data source is `static`, the generator follows the bundled sample data.
- The 57-route result is the **observed test-dataset result**. The 203-route result is the **verified deterministic static baseline**.

The release notes do **not** claim the 57 → 203 difference is fully explained by the missing 11 catalog records. Nuxt's static export generates the documented page surfaces (the per-record detail pages, the per-record sitemap entries, and the platform's per-route / `/_payload.json` artifacts); the exact prerender route accounting for a given dataset is the generator's output and was not exhaustively decomposed for this release-prep audit. The conservative statement is: **CMS-driven generation uses the remote dataset; route generation is therefore dataset-dependent; 57 is the observed test-dataset result; 203 is the verified deterministic static baseline.**

The fix is an **explicit static-data environment** that overrides the operator's `.env` for the duration of the validation, without modifying the local `.env` file. The deterministic static generate command (run with explicit env overrides; Nuxt's process env takes precedence over `.env` for these names) is:

```bash
NUXT_PUBLIC_SITE_URL=https://example.test \
NUXT_PROPERTIES_DATA_SOURCE=static \
NUXT_AGENTS_DATA_SOURCE=static \
NUXT_DEVELOPMENTS_DATA_SOURCE=static \
NUXT_SANITY_PROJECT_ID= \
NUXT_SANITY_TOKEN= \
pnpm generate
```

This produces **203 prerendered routes** in `.output/public/` — the historical deterministic static baseline (the operator's `.env` is unchanged). The Nuxt configuration reads the explicit env at process start and does not consult `.env` for these env vars; the explicit empty strings for `NUXT_SANITY_PROJECT_ID` / `NUXT_SANITY_TOKEN` defeat the Sanity driver's fail-fast project-ID check (the Sanity driver refuses to boot when `NUXT_SANITY_PROJECT_ID` is empty, so an empty string is required to force the loader to the static path). The 203-route count is the verified deterministic static baseline for the v1.2 release candidate. A rebrand that ships with the bundled static sample data sees the same 203 routes; a rebrand that ships with a Sanity dataset sees the route count driven by the CMS dataset.

## Validated configurations (rebrand verification)

The v1.2 release-candidate verification covers the documented static-data and CMS-data paths:

| Path | Static-data default | Sanity CMS path |
| --- | --- | --- |
| `/`, `/properties`, `/agents`, `/developments`, `/about`, `/contact` | Renders correctly with the bundled sample data (default `NUXT_*_DATA_SOURCE=static`). | Renders correctly when each feature is switched to Sanity via `NUXT_<FEATURE>_CMS_PROVIDER=sanity` + `NUXT_<FEATURE>_DATA_SOURCE=cms` and the four `NUXT_SANITY_*` env vars are set. |
| `/properties/[slug]`, `/agents/[slug]`, `/developments/[slug]` | 404 for unknown slugs; renders for known slugs. | Same — the GROQ → mapping → Zod pipeline emits the same boundary shape. |
| `/sitemap.xml`, `/robots.txt` | 200 with the tenant-aware `siteConfig.modules` filter. | Same — the sitemap imports the loader directly and the tenant resolver does not depend on the data source. |
| `POST /api/contact` | 503 when `agency.leads.enabled = false` (the v1.0 placeholder behavior); 200 / 4xx / 5xx as documented when `agency.leads.enabled = true` and an adapter is configured. | Same — the lead-capture pipeline is independent of the data source. |
| `/_ipx/...cdn.sanity.io...` | n/a | 200 with `content-type: image/png` after the sharp / IPX fix on Windows x64 (see the "Sharp / IPX fix" section above). |
| `<title>`, `<meta>`, JSON-LD `<script type="application/ld+json">">` | Matches the bundled sample data. | Matches the Sanity document. |

## Known limitations (intentional, deferred from v1.2)

The following items are **not** in the v1.2 release. They are documented here as the canonical "what is not in v1.2" list. A future v1.x patch or a v2 release can add them; none are required for v1.2.

| Limitation | Reason | Where |
| --- | --- | --- |
| **Provider-specific drivers for Contentful, Strapi, etc.** | The Sanity driver is the first provider-specific driver (Task 116). A Contentful or Strapi driver would carry a per-record `mapRecord` step that converts the provider's native document shape into `Property` / `Agent` / `Development`; the contract stays the same. **Provider-specific credentialed SDK drivers belong under `server/` to enforce a structural server-only boundary.** The Sanity implementation lives under `server/utils/sanity-driver.ts`; credentialed provider SDKs are not safe to import from a `app/` path that may reach the client bundle, because code under `app/` participates in the application module graph and can be imported by client-reachable code (a page, a component, a composable, an auto-import). Placing the driver under `server/` gives it a structural server-only boundary (Nuxt 4 bundles `server/utils/` exclusively to the Nitro server output and never to the client), which prevents accidental client-side imports by construction. The provider-agnostic boundary contract (`CmsDriver<T>`) and the HTTP/JSON generic adapter stay under `app/core/data-source/`; only the provider-specific driver file moves to `server/utils/`. A future Contentful / Strapi driver would live at `server/utils/contentful-driver.ts` / `server/utils/strapi-driver.ts` and be wired through the existing `cms` data-source branch via a per-feature `NUXT_<FEATURE>_CMS_PROVIDER` env var. Putting a credentialed provider SDK driver under `app/` would weaken this structural server-only boundary; a future rebrand that imports the driver from a page / component / composable could make accidental client imports possible, and the credentialed SDK would then reach the client bundle. The release notes do **not** claim that tree-shaking inherently leaks the SDK to the browser — Nuxt 4's auto-import surface and module graph are documented to be configurable; the structural placement under `server/` is the documented enforcement mechanism. | v1.x+ |
| **Sanity Studio schema management** | The current Studio ships the three document schemas (Property, Agent, Development). The Studio does NOT include SiteSettings, Page, Testimonial, Category, or any other content type. A future task can add the additional content types. | v1.x+ |
| **Sanity Studio customisation** | The default Sanity Studio is sufficient for the pilot. A custom theme or a custom desk structure (e.g. grouping properties by city) is a future task. | v1.x+ |
| **Sanity Studio preview / draft integration** | The Nuxt integration reads the published dataset only (`useCdn: true` in `server/utils/sanity-config.ts`). The Studio's `presentationTool` (the preview plugin) is intentionally NOT added. A future task can add a preview driver without touching the Studio config. | v1.x+ |
| **`@sanity/image-url` integration** | The GROQ projection returns the raw asset URL. The hotspot / crop-aware URL builder is deferred. | v1.x+ |
| **Map picker for the `coordinates` field** | The default Studio editing surface for the Property's `coordinates` field is two numeric inputs (latitude / longitude). A visual map input would require a custom input component (with a map provider such as Mapbox) and is deferred. | v1.x+ |
| **Sanity Studio webhooks / Nitro revalidation** | The Nuxt app fetches the dataset on every loader call (no permanent cache). The Studio's webhook → Nitro endpoint is a future task. | v1.x+ |
| **Per-feature api adapter for agents and developments** | **Already shipped.** The per-feature api adapter is wired for all three features: `NUXT_PROPERTIES_DATA_SOURCE=api` + `NUXT_PROPERTIES_API_URL` switches the property service to the api source (v1.1.0 M17); `NUXT_AGENTS_DATA_SOURCE=api` + `NUXT_AGENTS_API_URL` switches the agents service (v1.1.0 M21); `NUXT_DEVELOPMENTS_DATA_SOURCE=api` + `NUXT_DEVELOPMENTS_API_URL` switches the developments service (v1.1.0 M22). The same `createApiDataSource` factory + `agentListSchema` / `developmentListSchema` boundary schemas back all three. The three api adapters share the no-permanent-cache + in-flight coalescing contract documented in `server/utils/{properties,agents,developments}.ts`. This item is **not** future work — it is shipped. | n/a (shipped) |
| **Api / CMS adapter retry / cache layer** | The api and CMS adapters are intentionally thin transports (no retries, no response cache, no pagination protocol). A shared `$fetch` retry policy + a response-cache layer would be a future task. | v1.x+ |
| **Distributed rate limiter** (Sanity-side or Nuxt-side) | The shipped lead-capture rate limiter is per-process. A multi-process deployment shares no state between instances; the upgrade is a future v1.x task. | v1.x+ |
| **Production multi-tenant deployment** | The minimal v1.1.0 M16 foundation is shipped. The v1.1.0 release notes documented the deferred production multi-tenant follow-ups: persistence (load the registry from a database or JSON file instead of the bundled `agencyRegistry` constant), env-var indirection (`NUXT_TENANT_REGISTRY_URL`), per-tenant runtime overrides (currency, locale), a debug / admin endpoint, and IPv6 / IDN / IDNA hostname normalization. None ship in v1.2. | v1.x+ |
| **GDPR / CCPA / LFPDPPP compliance** | The template makes no claim of compliance. A rebrand that requires a privacy policy, a consent checkbox, or a data-subject-access flow should add those on top of the shipped pipeline. | v1.x+ |
| **Real browser accessibility certification (axe, Lighthouse, NVDA, VoiceOver)** | The v1.0 accessibility was reviewed at the source level. A real browser pass is post-v1.2. | v1.x+ |
| **Blog / Testimonials modules** | `agency.modules.blog` ships `false`; the route and the home section are not implemented. `agency.modules.testimonials` ships `true`; the section is implemented (`HomeTestimonials`) but has no dedicated route or admin. | v1.x+ |
| **Property comparison, saved properties, accounts, scheduling, valuation, PDF brochures** | All future-phase features from `docs/SPEC.md` Section 7. | v1.x+ |
| **Admin / dashboard / auth / CRM / maps / external image storage / payments** | Explicitly out of MVP scope per `docs/SPEC.md` Section 7. | v1.x+ |

## Known Windows `sharp` warning

On Windows x64, `pnpm build` may emit a pre-existing `@nuxt/image` warning similar to:

```text
[@nuxt/image] WARN sharp binaries for win32-x64 cannot be found.
```

This warning is **non-fatal**: the build completes successfully, the generated site renders correctly, and the template ships with SVG placeholder images that do not require `sharp`. v1.2 makes `sharp@^0.32.6` and `ipx@^2.1.1` explicit direct dependencies in `package.json` (they were already present as transitive optional dependencies of `@nuxt/image`). On a Windows host, the install scripts run (`node install/libvips` + `node install/dll-copy` + `node install/prebuild-install/bin.js`) and download the `sharp-win32-x64.node` prebuilt binary and the libvips DLLs. A rebrand that replaces the placeholders with raster images (`webp`, `jpg`, `avif`) sees no warning on a Windows host; the IPX pipeline renders the raster images through the `sharp` binary.

## Migration from v1.1.0

A v1.1.0 deployment that does not want Sanity at v1.2:

- No code changes required. The Sanity provider driver lives at `server/utils/sanity-driver.ts` (server-only). The Nuxt app continues to use the bundled static data when `NUXT_<FEATURE>_DATA_SOURCE` is left at the default `'static'` value.
- The static export behavior is unchanged. `pnpm generate` still works and the static site renders the bundled sample data.
- The Nitro server build behavior is unchanged for the static path. The Sanity provider driver is only loaded when `NUXT_<FEATURE>_CMS_PROVIDER=sanity` + `NUXT_<FEATURE>_DATA_SOURCE=cms` are set; otherwise the loader returns the static adapter.

A v1.1.0 deployment that wants Sanity at v1.2:

1. Upgrade to the v1.2 codebase.
2. Create the Sanity project on the agency's Sanity organisation (or use an existing project). The agency owns the project.
3. Create the `production` dataset with public visibility.
4. Configure the four `NUXT_SANITY_*` env vars on the deployment's secret manager: `NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN` (private dataset only).
5. Set the per-feature activation env vars on the deployment's secret manager: `NUXT_PROPERTIES_DATA_SOURCE=cms`, `NUXT_PROPERTIES_CMS_PROVIDER=sanity` (and the same for agents and developments).
6. Install the Studio locally (`cd studio && pnpm install`), configure `studio/.env` with `SANITY_STUDIO_PROJECT_ID` + `SANITY_STUDIO_DATASET=production`, then deploy the Studio (`cd studio && pnpm deploy`). The deployed Studio lives at `<projectId>.sanity.studio`.
7. Grant the agency's editors the right role (Administrator on the Free plan, Editor on the Growth plan).
8. Create the Property / Agent / Development documents in the Studio, publish.
9. Verify the change is live on the public site (`pnpm test:e2e:sanity` runs the live round-trip; the `curl https://<host>/api/properties` smoke check confirms the published record is fetched on every request on a Node deploy).
10. The contact methods column remains the no-JS and failed-delivery fallback; the lead-capture pipeline is independent of the data source.
11. If the agency needs a privacy policy, consent checkbox, or data retention schedule, add it on top of the shipped pipeline.

## What the v1.2 release does **not** claim

- **Provider-specific drivers for Contentful, Strapi, etc.** The Sanity driver is the first provider-specific driver; the Contentful / Strapi / etc. drivers follow the same pattern but are not in v1.2. **Provider-specific credentialed SDK drivers belong under `server/` to enforce a structural server-only boundary** (the Sanity implementation lives at `server/utils/sanity-driver.ts`; credentialed provider SDKs are not safe to import from a `app/` path that may reach the client bundle, because code under `app/` participates in the application module graph and can be imported by client-reachable code; placing the driver under `server/` gives it a structural server-only boundary that prevents accidental client-side imports by construction). Putting a credentialed provider SDK driver under `app/` would weaken this structural server-only boundary; a future rebrand that imports the driver from a page / component / composable could make accidental client imports possible. The release notes do **not** claim that tree-shaking inherently leaks the SDK to the browser — Nuxt 4's auto-import surface and module graph are documented to be configurable; the structural placement under `server/` is the documented enforcement mechanism.
- **Sanity Studio preview / draft integration.** The Nuxt integration reads the published dataset only.
- **Multi-region or multi-tenant Sanity.** One client = one agency = one isolated Sanity project. The production multi-tenant follow-ups are deferred.
- **Distributed rate limiter.** The lead-capture rate limiter is per-process.
- **Real external data integration beyond Sanity.** The data-source adapter foundation (`static` / `api` / `cms`) is generic; the **HTTP API adapter and the HTTP/JSON CMS adapter are shipped for all three features** (Property, Agent, Development); the **Sanity provider driver is shipped for all three features**. A future Contentful / Strapi / etc. provider would carry a per-record `mapRecord` step that converts the provider's native document shape into `Property` / `Agent` / `Development`; the contract stays the same. The provider-specific driver file lives under `server/utils/` (not `app/`).
- **GDPR / CCPA / LFPDPPP compliance.** A rebrand that requires it adds it on top.
- **Real browser accessibility certification.** The v1.0 accessibility was reviewed at the source level. A real browser pass is post-v1.2.

## Release sequence (Task 121 + Task 122)

The v1.2 release is gated by two final tasks:

- **Task 121 — v1.2 release preparation (the current task).** Audit the release-candidate documentation; correct stale test counts, stale references, and inaccurate deferred-feature entries; record the deterministic static generate baseline; verify the release validation is independent of the operator's local Sanity `.env`. The artifact is this file (`docs/RELEASE_NOTES_v1.2.md`) plus the ROADMAP entry for Task 121.
- **Task 122 — v1.2 final verification.** Run the full release-candidate verification on the verified release commit: `pnpm install --frozen-lockfile` → `pnpm test` (1230 / 1230) → `pnpm test:e2e` (62 / 62 in default deterministic mode) → `pnpm studio:typecheck` (47 / 47) → `pnpm lint` (0 errors / 0 warnings) → `pnpm build` (completes) → deterministic static `pnpm generate` (203 routes) → `git diff --check` (clean). The opt-in real-Sanity Playwright round-trip (`pnpm test:e2e:sanity`, 11 / 11) is also re-run against the verified release commit. The release commit is the verified `feature/lead-capture-v1.1` HEAD at the time Task 122 runs.

The `v1.2.0` tag is **created only after Task 122 succeeds** and the verified release commit exists. The tag is added directly to the verified `feature/lead-capture-v1.1` commit (the same release-process pattern as v1.1.0 — no dedicated `release/v1.2.0` branch).

## Release artifacts

- **Source tag:** `v1.2.0` will be added directly to the verified `feature/lead-capture-v1.1` commit (the same release-process pattern as v1.1.0 — no dedicated `release/v1.2.0` branch).
- **Release notes:** this file (`docs/RELEASE_NOTES_v1.2.md`).
- **Documentation set:** the v1.1.0 + v1.2 ROADMAP entries (59–65 in `docs/ROADMAP.md`), the canonical Sanity validation procedure (`docs/SANITY_VALIDATION.md`), the Sanity first-client operations guide (`docs/SANITY_OPERATIONS.md`), the Studio developer's manual (`studio/README.md`), and the CMS evaluation rationale (`docs/CMS_EVALUATION.md`).
- **The v1.0.0 tag and the `release/v1.0.0` branch are not force-pushed or re-tagged. The v1.1.0 tag is not re-tagged.**

## References

- `docs/ROADMAP.md` — the canonical implementation state and the milestone log (v1.2 entries 59–65).
- `docs/CMS_EVALUATION.md` — the provider evaluation that selected Sanity.
- `docs/SANITY_VALIDATION.md` — the one-time Sanity validation procedure.
- `docs/SANITY_OPERATIONS.md` — the post-implementation Sanity operations guide.
- `studio/README.md` — the Sanity Studio developer's manual.
- `docs/DEPLOYMENT.md` — the Nuxt-side deployment procedure (env-var checklist, static-vs-Nitro decision, hostname + TLS, lead delivery, smoke checks, rollback).
- `docs/CLIENT_ONBOARDING.md` — the upstream agency-side info checklist (the agency-owned Sanity project + billing contract; the platform access split before the implementer leaves the engagement).
- `docs/RELEASE_NOTES_v1.0.md` — the v1.0.0 release notes.
- `docs/RELEASE_NOTES_v1.1.md` — the v1.1.0 release notes.
- `docs/REBRANDING.md` — the rebrand workflow for the Nuxt app.
- `docs/DATA_MODELS.md` — the runtime boundary schemas.
- `AGENTS.md` — the contributor conventions and the "Current gaps" section.
- `README.md` — the project README.
- <https://www.sanity.io/docs> — the Sanity documentation.
- <https://status.sanity.io> — the Sanity status page (first stop during a Sanity-side outage).