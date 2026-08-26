# Commercial Delivery Guide

This guide is the **umbrella checklist for taking a real-agency engagement from an approved commercial agreement to a signed client acceptance and final handoff**. It does not duplicate the technical procedures; it names them, sequences them, and points every step at the canonical document.

This guide is **operator-facing**. It is written for the implementer, the deployment operator, and the agency owner who is signing off on the deliverable. It pairs with:

- `docs/CLIENT_ONBOARDING.md` — the upstream "what to collect from the agency" checklist (the agency-side information, the production-readiness blockers, the handoff table).
- `docs/REBRANDING.md` — the rebrand workflow that the implementation phase runs end-to-end.
- `docs/DEPLOYMENT.md` — the deployment procedure (env-var lifecycle, static vs Node/Nitro, smoke checks, rollback).
- `docs/SANITY_OPERATIONS.md` — the post-implementation Sanity operations guide (only when Sanity is the CMS).
- `docs/SANITY_VALIDATION.md` — the one-time Sanity validation procedure.
- `docs/MULTI_TENANT.md` — multi-tenant deployment guidance (only relevant when more than one agency is hosted behind a single build).

This guide is also **commercial-agreement-agnostic**. It assumes a written commercial agreement exists between the agency and the implementer / operator, and that the agreement names the license model, the maintenance posture, and the pricing. The pricing model, the license model, and the maintenance fee are **commercial-agreement decisions**, not technical decisions. They are named in §10 but never decided here.

## 1. Workflow at a glance

The delivery has nine phases. Each phase has a clear entry condition (what must be true to start) and a clear exit condition (what must be true to move on). The implementer and the agency sign off on the exit condition before the next phase starts.

| # | Phase | Entry condition | Exit condition | Canonical reference |
| --- | --- | --- | --- | --- |
| 1 | Pre-project requirements | Commercial agreement signed | A named agency tenant, a written scope, an agency point of contact | This guide §2 |
| 2 | Branding and content collection | Phase 1 signed off | Every agency identity, asset, locale, and content field is captured in writing | `docs/CLIENT_ONBOARDING.md` §2.1; this guide §3 |
| 3 | Implementation and rebrand | Phase 2 captured | Working tree rebranded; `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm test:e2e` / `pnpm generate` all green | `docs/REBRANDING.md` §1–§15; this guide §4 |
| 4 | CMS setup (when used) | Phase 3 ready for content | CMS project created, populated, validated; Studio deployed; agency Administrator named | `docs/SANITY_OPERATIONS.md` §2; `docs/SANITY_VALIDATION.md`; `studio/README.md`; this guide §5 |
| 5 | Deployment | Phase 3 (and Phase 4 when used) ready | Production URL live, smoke checks pass, deploy artifact retained | `docs/DEPLOYMENT.md` §3–§11; this guide §6 |
| 6 | Client acceptance | Phase 5 live on production | Acceptance criteria signed off by the agency; production sign-off record captured | This guide §7 |
| 7 | Handoff | Phase 6 signed off | Access tables signed; backups handed over; source-code terms recorded per the commercial agreement | `docs/CLIENT_ONBOARDING.md` §4; this guide §8 |
| 8 | Optional maintenance | Maintenance agreement active | Named operator role on the CMS / host / repo; named SLAs; named escalation cadence | `docs/SANITY_OPERATIONS.md` §4; `docs/DEPLOYMENT.md` §10–§11; this guide §9 |
| 9 | End of contract | Maintenance term ended or project engagement concluded | Operator access removed per the agreement; backups returned or destroyed; source-code access adjusted per the agreement | `docs/SANITY_OPERATIONS.md` §8; `docs/CLIENT_ONBOARDING.md` §4; this guide §10 |

The phases are sequential. Phase 5 (deployment) and Phase 4 (CMS setup) overlap when the CMS is in use — the Studio deploy, the dataset creation, and the Sanity env vars are part of the deploy surface. A real engagement may also loop back from Phase 6 to Phase 3 when client acceptance finds a rebrand defect; the loop is bounded by the acceptance window named in the commercial agreement.

## 2. Pre-project requirements

The deliverable cannot start until every item in this section is in writing. The implementer owns the checklist; the agency owns the inputs.

### 2.1 Commercial agreement

The commercial agreement is signed before any technical work starts. The agreement names (at minimum):

- **Scope.** What is in scope for the deliverable (the page set, the modules, the CMS provider, the lead pipeline, the locales). A scope change after the agreement is signed is a change-order, not a rebrand.
- **License model.** The license the implementer / operator grants the agency for the rebranded codebase (the implementer's default license, a custom license, an open-source license, or a transfer-of-ownership clause). **Commercial-agreement decision — not a technical decision.** See §10.
- **Pricing model.** The fee structure (fixed-fee project, time-and-materials, milestone-based, retainer). **Commercial-agreement decision.**
- **Maintenance posture.** Whether a maintenance contract exists, what it covers, what the renewal cadence is, what the SLA is, and what the escalation cadence is. **Commercial-agreement decision.**
- **Source-code ownership.** Whether the agency owns the rebranded source-code repository after handoff, whether the operator retains it, or whether a third-party license applies. See §10.
- **Infrastructure ownership model.** Whether the production infrastructure (hosting account, deployment platform, secret manager, DNS / registrar access, monitoring / analytics accounts) is **client-owned** (the agency holds the accounts; the operator receives delegated access for the duration of the engagement and / or the maintenance contract) or **operator-managed** (the operator holds the accounts as part of a managed-service engagement; the agency receives a service-level commitment and may or may not receive account transfer at the end of the contract). The model is named in the commercial agreement and drives §3.9, §6, §8, §9, and §10. **Commercial-agreement decision.**
- **Domain ownership stance.** Who owns the domain registration (the agency, by default) and what level of DNS access is delegated to the operator (if any). The agency retains control of its domain and business data under either infrastructure model. **Commercial-agreement decision.**
- **Source-code repository location and access.** Whether the rebranded repository is hosted on the agency's Git host, the operator's Git host, or a third-party host; whether the agency holds a read-only / read + write / admin role; the transfer timing (if any); and whether a mirror / escrow arrangement applies. See §10.
- **Acceptance window.** The number of business days the agency has to sign off on the deliverable after the production sign-off; the rework scope inside the window; the change-order process outside the window.
- **Termination clause.** The notice period for an ongoing-maintenance engagement; the obligations of both parties at termination; the data-return / data-destruction expectations at termination; whether infrastructure transfers at termination (client-owned model keeps accounts on the agency; managed-service model may or may not transfer the operator-held accounts).

The implementer does not start Phase 2 (branding and content collection) until the commercial agreement is signed.

### 2.2 Named points of contact

The agency names a single point of contact for the project (the "agency owner"). The agency owner:

- Approves scope changes during the project.
- Receives every credential and access grant.
- Signs the production sign-off record (Phase 6).
- Signs the handoff record (Phase 7).
- Is the sole approver of any operator access at Phase 9.

The implementer names a single point of contact for the project (the "implementer lead"). The implementer lead:

- Drives the rebrand.
- Drives the deploy.
- Drives the client-acceptance process.
- Drives the handoff process.

Two named points of contact, in writing, in the commercial agreement or its first addendum.

### 2.3 Scope confirmation

The implementer and the agency owner walk through the scope one more time before content collection starts. The walkthrough confirms:

- The page set (`/`, `/properties`, `/properties/[slug]`, `/agents`, `/agents/[slug]`, `/developments`, `/developments/[slug]`, `/about`, `/contact`).
- The enabled modules (`agency.modules` flags).
- The active locales (`agency.availableLocales`).
- The CMS provider (none, the generic HTTP/JSON driver, Sanity, or a future provider).
- The lead-delivery adapter (or the explicit default `disabled`).
- The deployment target (static `pnpm generate` or Node / Nitro `pnpm build`).
- The hostname(s) and the `www.` redirect preference.
- The analytics / SEO / monitoring posture for the deliverable (or "not in scope").

A scope confirmation in writing is the entry condition for Phase 2.

### 2.4 Pre-project requirements checklist

- [ ] Commercial agreement signed and dated.
- [ ] License model named in the agreement.
- [ ] Pricing model named in the agreement.
- [ ] Maintenance posture named in the agreement (project-based vs ongoing-maintenance).
- [ ] Source-code ownership stance named in the agreement.
- [ ] Infrastructure ownership model named in the agreement (client-owned deployment vs operator-managed service).
- [ ] Domain ownership stance named in the agreement (the agency retains control of its domain and business data).
- [ ] Source-code repository location and access named in the agreement (the agency's Git host, the operator's Git host, a third-party host, or no transfer).
- [ ] Acceptance window named in the agreement.
- [ ] Termination clause named in the agreement.
- [ ] Agency point of contact named in writing.
- [ ] Implementer point of contact named in writing.
- [ ] Scope walkthrough completed; scope confirmation signed.

## 3. Branding and content collection

The implementer collects the agency-side information the rebrand needs. The full agency-side information checklist is in `docs/CLIENT_ONBOARDING.md` §2.1; this section names the subset the implementer confirms before Phase 3 (implementation) starts.

### 3.1 Agency identity and branding

- [ ] Legal / display name (`agency.name`).
- [ ] Optional short marketing slogan (`agency.slogan`).
- [ ] Unique agency slug (`agency.id`, lowercase letters + digits + dashes).
- [ ] Active currency (`agency.currency`, ISO 4217 code).
- [ ] Measurement unit (`agency.measurementUnit`, `'metric'` or `'imperial'`).
- [ ] Default locale (`agency.defaultLocale`, e.g. `'en'` or `'es'`).
- [ ] Available locales (`agency.availableLocales`, subset of the i18n module's registered locales).
- [ ] Optional business hours (e.g. `Mon-Fri 9am-5pm`).

### 3.2 Logo, favicon, and photography

- [ ] **Logo.** Vector (`SVG`) preferred, PNG fallback. Target path `public/images/logo.svg`.
- [ ] **Favicon.** `ICO` or `PNG`. Target path `public/favicon.ico`.
- [ ] **Hero and about photography.** At minimum one hero image and one about-page image.
- [ ] **Location tiles.** Four location images for the home page.
- [ ] **Property covers.** One cover image per listed property (recommended six or more).
- [ ] **Agent portraits.** One portrait per listed agent (recommended three or more).
- [ ] **Development covers.** One cover per listed development (recommended two or more).

The full asset path map is in `docs/REBRANDING.md` §4. The implementer keeps the agency's photography on the agency's owned storage after the rebrand — the implementer does not retain copies on personal accounts.

### 3.3 Colors, typography, and imagery

- [ ] **Theme palette.** Primary, secondary, accent, surface, foreground, muted, border, success, warning, error. The agency may already have a brand guide; otherwise the implementer proposes and the agency confirms. No hardcoded brand colors are allowed in components — the palette is consumed through CSS variables (`var(--color-*)`).
- [ ] **Heading and body font families.** Free Google Fonts are acceptable; licensed fonts need the agency's written approval.
- [ ] **Photography guidance.** Resolution, aspect ratio, file-size budget, and any required retouching.

### 3.4 Contact, social, and address

- [ ] Primary phone number with country code (`agency.contact.phone`).
- [ ] WhatsApp number with country code (often the same as phone; required for `https://wa.me/` link normalization).
- [ ] Primary email address (the contact form, the footer, the JSON-LD `email` field).
- [ ] Physical address (free-text for the visible footer + contact card; optional `PostalAddress` companion for the JSON-LD when the agency wants structured data).
- [ ] Social links the agency wants surfaced (Facebook, Instagram, LinkedIn, TikTok, YouTube — any subset is fine).

### 3.5 Domain, hostname, and DNS ownership

The agency retains control of its domain under both infrastructure models. The registrar account is the agency's by default; the operator is NOT the registrar owner and does NOT hold the only-admin registrar access regardless of the deployment model. The DNS access scope (none / read-only / read + write) is delegated per the commercial agreement and the maintenance contract.

- [ ] The hostname the agency will use (e.g. `www.example.com`).
- [ ] The `www.` redirect preference (canonicalize to apex, or keep `www.`).
- [ ] Domain registrar owner named (the agency, by default).
- [ ] DNS access delegated to the implementer / operator (none / read-only / read + write) per the commercial agreement.
- [ ] DNS provider named (the agency owns the DNS provider console; the implementer / operator may have delegated access when the agreement names it).
- [ ] TLS certificate procurement path (Let's Encrypt, the platform's managed cert, or the agency's existing cert). The certificate may live on the agency's owned DNS / hosting or on the operator's managed platform depending on the infrastructure model.
- [ ] Per-tenant hostnames for a multi-tenant deployment (the hostname(s) for the agency's build target).

### 3.6 Property, agent, and development content

- [ ] **Property catalog.** The full list of properties with title, slug, description, location, city, state, country, price, currency, bedrooms, bathrooms, area, size unit, amenities, images, status, featured, agent reference, development reference. The Zod boundary schema at `app/features/properties/schemas/property.schema.ts` is the runtime validator.
- [ ] **Agent roster.** Name, slug, role, bio, image, phone, email, WhatsApp, specialties. The Zod boundary schema at `app/features/agents/schemas/agent.schema.ts` is the runtime validator.
- [ ] **Development portfolio.** Name, slug, status, location, description, image, price range, units, bedrooms, area range, delivery date, currency, size unit, featured. The Zod boundary schema at `app/features/developments/schemas/development.schema.ts` is the runtime validator.
- [ ] **Home-page auxiliary content.** Stats (years in business, properties sold, clients served, areas served), locations, testimonials.

The implementer may migrate the content from a CSV / spreadsheet / previous CMS export / handwritten records; the agency owns the source content, the implementer owns the per-record schema mapping. The agency-side source format is not the deliverable's concern.

### 3.7 CMS ownership

When the deliverable uses a CMS, the agency names who owns the CMS account. The default expectation: the agency owns the CMS account from day one, the implementer is a project member during the build, and the agency is the sole owner of the CMS Administrator role after handoff. The full CMS ownership model is in `docs/CLIENT_ONBOARDING.md` §2.1 (CMS subsection) and `docs/SANITY_OPERATIONS.md` §1 (cardinal rules).

- [ ] CMS provider named (none / generic HTTP/JSON driver / Sanity / Contentful / Strapi / other).
- [ ] CMS account owner named (the agency owns the billing).
- [ ] At least one CMS Administrator named on the agency side.
- [ ] CMS editor / contributor access scope named.
- [ ] Image / media ownership confirmed (the agency's photography is uploaded to the agency's own media store; the implementer does not retain copies).
- [ ] Content migration responsibility assigned (the implementer performs the initial migration; the agency owns subsequent migrations unless a maintenance agreement names the operator).

### 3.8 Lead destination

- [ ] Live lead capture in scope for the deliverable (yes / no / deferred).
- [ ] Lead-delivery adapter named (`disabled` / `log` / `webhook` / `email`).
- [ ] When `webhook`: the agency-side endpoint URL and a fresh 32+ character random secret (`NUXT_LEADS_WEBHOOK_SECRET`).
- [ ] When `email`: SMTP credentials (host, port, secure flag, user, password, `From:` address, `To:` address).
- [ ] Lead retention policy at the destination (the template does not persist leads; the destination owns retention).
- [ ] Webhook signature verification plan on the agency side (the agency-side endpoint must verify `X-Lead-Signature` with `NUXT_LEADS_WEBHOOK_SECRET`).

### 3.9 Deployment ownership and access

The deployment ownership and access posture is **conditional on the infrastructure ownership model** named in §2.1. The two models are:

- **Client-owned deployment model.** The agency holds the hosting account, the deployment platform's billing, the secret manager, and the related accounts. The implementer / operator receives delegated access (typically a project-level or member-level role on the agency's account) for the duration of the engagement and / or the maintenance contract. The agency owns the accounts at every phase of the engagement and after handoff.
- **Operator-managed service model.** The operator holds the hosting account, the deployment platform's billing, the secret manager, and the related accounts as part of the managed-service engagement. The agency receives a service-level commitment and access to the production URL; account ownership transfers at the end of the contract only if the commercial agreement names it.

The implementer / operator does NOT assume it owns or manages hosting, the deployment platform, the secret manager, DNS / registrar access, or monitoring / analytics accounts under either model — the assignment is per the commercial agreement.

- [ ] Infrastructure ownership model confirmed (client-owned deployment vs operator-managed service).
- [ ] Hosting platform named (or "to be decided before Phase 5").
- [ ] Hosting account owner named (the agency under the client-owned model; the operator under the managed-service model).
- [ ] Implementer / operator access scope named during the build (delegated access on the agency's account under the client-owned model; the operator's own role under the managed-service model).
- [ ] DNS provider and DNS records identified.
- [ ] TLS certificate path named.
- [ ] Per-tenant or single-tenant deployment confirmed.

### 3.10 Analytics, SEO, and monitoring posture

The analytics / monitoring / error-tracking accounts are owned per the infrastructure ownership model (the agency's accounts under the client-owned model; the operator's accounts under the managed-service model — or none for the deliverable in either case). The implementer / operator does NOT assume it owns or manages these accounts under either model; the assignment is per the commercial agreement.

- [ ] Analytics provider named (Plausible / Google Analytics / Fathom / Matomo / none for the deliverable).
- [ ] Analytics account owner named (the agency, the operator, or none).
- [ ] SEO requirements named (sitemap, robots, canonical, JSON-LD — all shipped; specific structured-data requirements beyond the default).
- [ ] Monitoring provider named (UptimeRobot / Better Uptime / platform-native / none for the deliverable).
- [ ] Monitoring account owner named (the agency, the operator, or none).
- [ ] Error tracking provider named (Sentry / GlitchTip / platform-native / none for the deliverable).
- [ ] Error tracking account owner named (the agency, the operator, or none).

The template ships zero analytics, zero monitoring, and zero error tracking. Every one of these is an operator add-on, not a template default. The agency's chosen provider is configured at deploy time; the configuration does not require any application code change.

### 3.11 Content collection checklist (exit condition for Phase 2)

- [ ] Agency identity and branding fields captured.
- [ ] Logo, favicon, and photography assets received.
- [ ] Theme palette and typography approved.
- [ ] Contact, social, and address fields captured.
- [ ] Domain ownership / DNS / TLS path confirmed.
- [ ] Property / agent / development catalog received.
- [ ] CMS ownership and account plan confirmed (when used).
- [ ] Lead destination and adapter confirmed.
- [ ] Deployment ownership and access plan confirmed (the infrastructure ownership model is named; account owners are named; delegated access scopes are named).
- [ ] Analytics / SEO / monitoring posture confirmed (the account owner is named per provider, or "none for the deliverable").
- [ ] Agency-side content sign-off captured in writing.

## 4. Implementation and rebrand

The implementation phase runs the rebrand end-to-end against the content captured in Phase 2. The canonical procedure is `docs/REBRANDING.md`; the dry-run that validates the procedure against a fictional agency is `docs/CLIENT_ONBOARDING.md` §6. The implementer follows the documented sequence.

### 4.1 Configuration steps

The rebrand configures the agency and the theme. No generic application code is touched.

- [ ] `app/config/agencies/<your-agency>.agency.ts` created and filled with the agency's identity, contact, social, modules, and `leads.enabled` flag.
- [ ] `app/config/agencies/registry.ts` updated with a new entry under the agency's `id` with the production hostnames (`example.com`, `www.example.com`) and any development hostname used during the build.
- [ ] `app/config/site.config.ts` updated so the `siteConfig` constant uses the new agency as the fallback.
- [ ] `app/themes/<your-theme>.theme.ts` created (or `app/themes/default.theme.ts` updated) with the agency's brand palette and font stack.
- [ ] `app/themes/index.ts` updated to register the new theme.
- [ ] `agency.theme` set to the new theme id in the agency config.

### 4.2 Asset replacement

- [ ] `public/images/logo.svg` replaced with the agency's logo.
- [ ] `public/favicon.ico` replaced with the agency's favicon.
- [ ] Home, about, location, property, agent, and development images replaced per the path map in `docs/REBRANDING.md` §4.
- [ ] Image filenames preserved when possible; new filenames updated in the matching data file.

### 4.3 Content replacement

- [ ] `app/features/properties/data/properties.ts` replaced with the agency's catalog.
- [ ] `app/features/agents/data/agents.ts` replaced with the agency's team roster.
- [ ] `app/features/developments/data/developments.ts` replaced with the agency's development portfolio.
- [ ] `app/features/home/data/{stats,locations,testimonials}.ts` replaced with agency-specific content.
- [ ] Each record passes Zod validation at module load (the runtime boundary schemas reject malformed entries and the build fails fast).
- [ ] (Optional) `i18n/locales/en.json` and `i18n/locales/es.json` updated with agency-specific copy where the shipped labels do not fit.
- [ ] **Golden test assertions** updated to reference the new agency's slugs and city names (the friction surface documented in `docs/CLIENT_ONBOARDING.md` §6.3).

### 4.4 Local validation pipeline

The implementer runs the validation pipeline before declaring the rebrand ready. The pipeline is the same one `docs/DEPLOYMENT.md` §8 names for the production deploy; the implementer runs it locally first.

- [ ] `pnpm install --frozen-lockfile` — exit 0.
- [ ] `pnpm test` — every Vitest file green.
- [ ] `pnpm lint` — 0 errors / 0 warnings.
- [ ] `pnpm build` — completes.
- [ ] `pnpm preview` — local manual walk-through of `/`, `/properties`, `/properties/<slug>`, `/agents`, `/agents/<slug>`, `/developments`, `/developments/<slug>`, `/contact`, `/about`. The agency's name, logo, slogan, contact info, and brand colors render correctly.
- [ ] (When applicable) `NUXT_PUBLIC_SITE_URL=https://example.test pnpm generate` — the static export ships.

### 4.5 Implementation exit checklist

- [ ] Every agency field is the agency's own.
- [ ] Every placeholder asset is replaced.
- [ ] Every sample data file is replaced.
- [ ] Locale copies are reviewed.
- [ ] Golden test assertions updated.
- [ ] Local validation pipeline is green.
- [ ] Manual preview walk-through is clean.

## 5. CMS setup

When the deliverable uses a CMS, this phase runs in parallel with Phase 4 (implementation) and feeds into Phase 5 (deployment). When the deliverable does not use a CMS, this phase is skipped.

The canonical procedures are `docs/SANITY_OPERATIONS.md` (for Sanity), `docs/CLIENT_ONBOARDING.md` §2.1 (CMS subsection, for the generic HTTP/JSON driver and provider-agnostic setup), `docs/SANITY_VALIDATION.md` (Sanity-specific validation), and `studio/README.md` (the Studio developer's manual).

### 5.1 Provider selection (already confirmed in Phase 2)

The provider was named during content collection. The CMS owner and the per-feature data source are confirmed.

- [ ] CMS provider confirmed (Sanity / Contentful / Strapi / generic HTTP/JSON driver / other).
- [ ] Per-feature data source confirmed (`static` / `api` / `cms` for properties, agents, developments).
- [ ] CMS account ownership confirmed (the agency owns the billing).

### 5.2 Sanity setup (when Sanity is the CMS)

- [ ] Sanity project created on the agency's Sanity organisation (`studio/README.md` §1, `docs/SANITY_VALIDATION.md` §2).
- [ ] `production` dataset created with public visibility (`studio/README.md` §5, `docs/SANITY_VALIDATION.md` §3).
- [ ] Studio installed locally + configured with project id + dataset (`studio/README.md` §2–§3).
- [ ] Studio schemas committed (Property / Agent / Development document schemas).
- [ ] Studio typecheck + tests green (`pnpm studio:typecheck`).
- [ ] Studio deployed to Sanity's managed hosting (`cd studio && pnpm deploy`).
- [ ] Agency Administrator access granted on the Sanity project (`studio/README.md` §8).

### 5.3 Generic HTTP/JSON CMS driver (when used)

- [ ] Public or IP-allow-listed JSON endpoint exposed by the agency or the CMS provider.
- [ ] Endpoint URL recorded for the deployment's secret manager (`NUXT_PROPERTIES_CMS_URL` + the matching agents / developments env vars).
- [ ] Endpoint returns records already in the canonical `Property` / `Agent` / `Development` shape (the boundary Zod schema validates the response after parsing).
- [ ] Test request from the deployment's network succeeds.

### 5.4 Content migration

- [ ] Source content migrated into the CMS project (the implementer runs the initial migration; the agency owns subsequent migrations unless a maintenance agreement names the operator).
- [ ] Image / media store populated with the agency's photography.
- [ ] Studio "Validation" panel clean (every required field is filled).
- [ ] Smoke publish: one Property / Agent / Development published end-to-end through the Studio and observed through the Nuxt app.

### 5.5 CMS validation (when Sanity is the CMS)

- [ ] `docs/SANITY_VALIDATION.md` §0–§13 procedure run end-to-end.
- [ ] Real Studio content → published dataset → `@sanity/client` → GROQ projection → mapping → Zod boundary → same-origin Nitro endpoint → Nuxt page render verified.
- [ ] Opt-in `pnpm test:e2e:sanity` Playwright spec passes (11 cases; requires `SANITY_REAL_E2E=1` against a running dev server).
- [ ] Default `pnpm test:e2e` Playwright suite (62 cases across 8 spec files) passes in deterministic mode.

### 5.6 CMS setup exit checklist

- [ ] CMS project live on the agency's account.
- [ ] Studio deployed and reachable at `<projectId>.sanity.studio` (Sanity) or the agency's chosen editor URL.
- [ ] Agency Administrator named in writing.
- [ ] Initial catalog migrated and smoke-published.
- [ ] Validation procedure green.
- [ ] CMS-related env vars recorded for the deploy (Phase 5).

## 6. Deployment

The deploy runs against the rebrand (Phase 4) and, when used, the CMS (Phase 5). The canonical procedure is `docs/DEPLOYMENT.md`; this section names the entry / exit conditions and the operator-side acceptance gates.

### 6.1 Pre-flight

The pre-flight posture is **conditional on the infrastructure ownership model** named in §2.1.

- [ ] Infrastructure ownership model confirmed for the deploy (client-owned deployment vs operator-managed service).
- [ ] Hostname + TLS path confirmed (the agency's hostname + a TLS certificate that covers it; the certificate may live on the agency's owned DNS / hosting or on the operator's managed platform).
- [ ] DNS records ready (the DNS provider points at the platform's edge; access scoped per the commercial agreement).
- [ ] Hosting platform account ready. **Client-owned model:** the agency owns the account; the implementer / operator has a delegated role scoped to the engagement. **Operator-managed model:** the operator owns the account; the agency has a service-level commitment on the production URL.
- [ ] Secret manager ready on the platform's side for the production env vars. **Client-owned model:** the secret manager is the agency's; the implementer / operator has a delegated role to write the production secrets during the deploy. **Operator-managed model:** the secret manager is the operator's; the agency does not have direct access (or has read-only access when the agreement names it).
- [ ] Build target chosen: static `pnpm generate` or Node / Nitro `pnpm build` (see `docs/DEPLOYMENT.md` §5 for the capability matrix).

### 6.2 Environment-variable configuration

The full env-var checklist is in `docs/DEPLOYMENT.md` §4. The operator configures at deploy time:

- [ ] `NUXT_PUBLIC_SITE_URL` — the agency's canonical hostname.
- [ ] Per-feature data-source env vars (`NUXT_PROPERTIES_*`, `NUXT_AGENTS_*`, `NUXT_DEVELOPMENTS_*`) when the relevant feature uses `api` or `cms`.
- [ ] Lead-delivery env vars (`NUXT_LEADS_*`) when `agency.leads.enabled` is `true` and a non-`disabled` adapter is selected.
- [ ] Per-tenant overrides (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`, `NUXT_LEADS_<KEY>__<TENANT_ID>`) for a multi-tenant deploy.
- [ ] CMS env vars (`NUXT_SANITY_*` for Sanity; `NUXT_<FEATURE>_CMS_URL` for the generic HTTP/JSON driver).

Secrets are never committed to the repository. The platform's secret manager is the source of truth; the secret manager is the agency's under the client-owned deployment model and the operator's under the operator-managed service model. The agency retains at least Administrator / read access to every secret that affects the production URL under either model.

### 6.3 Build and ship

- [ ] `pnpm install --frozen-lockfile` on the build environment.
- [ ] `pnpm lint` — 0 errors / 0 warnings.
- [ ] `pnpm test` — every Vitest file green.
- [ ] `pnpm build` (Node / Nitro) or `NUXT_PUBLIC_SITE_URL=https://<agency-host> pnpm generate` (static).
- [ ] `pnpm test:e2e` — every Playwright case green.
- [ ] Build artifact uploaded to the platform (`.output/public/` for static; `.output/server/index.mjs` + `.output/public/` for Node / Nitro).

### 6.4 Post-deployment smoke checks

The full smoke check list is in `docs/DEPLOYMENT.md` §10. The operator runs every check from a host on the public internet (not from the deployment's private network). The minimum smoke checks the deploy must pass before Phase 7 (client acceptance) starts:

- [ ] `curl -I https://<host>/` returns `200 OK` and `Content-Type: text/html`.
- [ ] `curl -I https://<host>/properties` returns `200 OK`; the rendered HTML carries the agency's real catalog (titles + prices + locations matching the replaced sample data).
- [ ] `curl -I https://<host>/about` returns `200 OK`; the rendered HTML carries the agency's identity.
- [ ] `curl -I https://<host>/contact` returns `200 OK`; the contact-methods column is present.
- [ ] `curl -I https://<host>/sitemap.xml` returns `200 OK`; the body is a valid `<urlset>` with agency URLs.
- [ ] `curl -I https://<host>/robots.txt` returns `200 OK`; the body contains `Sitemap: https://<host>/sitemap.xml` and a `User-Agent: *` block.
- [ ] `curl -X POST https://<host>/api/contact -H "Content-Type: application/json" -d '{"name":"Smoke Test","email":"smoke@example.test","phone":"+1 555 000 0001","message":"Smoke test from the deploy runbook.","locale":"en"}'` (when live lead capture is enabled) returns `200 OK` and the destination receives the lead.
- [ ] `curl https://<host>/properties | grep -o '<title>[^<]*</title>'` (when a remote data source is in use) shows the agency's real catalog, not the bundled sample data.
- [ ] The home page `<script type="application/ld+json">` block's `RealEstateAgent.@id` is the home page's absolute URL.

### 6.5 Deployment exit checklist

- [ ] Production URL live on the agency's hostname.
- [ ] Every smoke check passes.
- [ ] Build artifact retained per the platform's retention policy (the default in most platforms is 5–10 builds).
- [ ] Rollback procedure confirmed (the operator can re-deploy the previous build; `docs/DEPLOYMENT.md` §11).
- [ ] Deploy logs retained for the production sign-off record.

## 7. Client acceptance

Client acceptance is the **agency's signed sign-off on the deliverable running in production**. The acceptance is the gate between Phase 6 and Phase 7 (handoff); without it, the deliverable is not handed over.

### 7.1 Technical acceptance criteria

The agency walks the deliverable against the documented acceptance criteria. Every criterion is binary (pass / fail); the implementer resolves every failure inside the acceptance window named in the commercial agreement.

**Branding and theme verified.**

- [ ] The agency's name appears in the header, footer, contact page, and JSON-LD `RealEstateAgent.name`.
- [ ] The agency's logo appears in the header and footer (and the OG share fallback).
- [ ] The agency's favicon renders in the browser tab.
- [ ] The theme palette renders correctly: primary, secondary, accent, surface, foreground, muted, border colors match the approved palette.
- [ ] The typography renders correctly: heading and body fonts match the approved font stack.
- [ ] No hardcoded brand colors leak through Tailwind utility classes (every brand color is read through `var(--color-*)`).

**Correct tenant hostname resolution (multi-tenant deployments).**

- [ ] `curl -H 'Host: <agency-apex>' http://<edge>/` renders the agency's identity (name, theme, contact info).
- [ ] `curl -H 'Host: <www.subdomain>' http://<edge>/` renders the same agency identity (or the apex canonicalizes correctly per the agency's preference).
- [ ] An unknown hostname resolves to the registry's default tenant via the documented fallback (`docs/MULTI_TENANT.md` §5).
- [ ] The per-tenant canonical URL (`NUXT_PUBLIC_SITE_URL__<TENANT_ID>`) is in effect at the agency hostname.

**Responsive route walk.**

- [ ] Desktop (`>= 1024px`): every page renders the documented desktop layout (header, hero, grid, footer).
- [ ] Tablet (`>= 640px` and < 1024px`): every page renders the documented tablet layout (collapsing grid, persistent filter form on `/properties`).
- [ ] Mobile (`< 640px`): every page renders the documented mobile layout (hamburger menu, single-column grid, filter collapse on `/properties`).
- [ ] Light / dark color mode (when enabled) flips cleanly on toggle; the anti-FOUC inline script prevents a flash of the wrong palette on reload.
- [ ] No uncaught browser errors in the dev console on any public route.

**Forms and leads verified.**

- [ ] `/contact` form submits when `agency.leads.enabled` is `true` and the configured adapter is reachable.
- [ ] The destination receives the stamped lead within seconds (webhook inbox, SMTP inbox, or `log` stdout depending on the adapter).
- [ ] The honeypot silently succeeds (200 OK) without dispatching the adapter.
- [ ] The 5-per-10-minute per-process rate limit engages on the 6th submission within the window.
- [ ] The contact-methods column (`tel:`, `mailto:`, `https://wa.me/`) is always present (no-JS and failed-delivery fallback).
- [ ] The property inquiry form on `/properties/[slug]` stamps the lead with the correct `source: 'property_inquiry'` and `PropertyReference`.

**SEO and canonical configuration verified.**

- [ ] `<link rel="canonical">` on every page resolves to the agency's hostname.
- [ ] `og:url` and `og:image` on every page resolve to the agency's hostname and the agency's social image.
- [ ] `/sitemap.xml` includes every public property / agent / development + the top-level pages, scoped to the agency's `agency.modules` flags.
- [ ] `/robots.txt` includes `Sitemap: https://<host>/sitemap.xml` and a `User-Agent: *` block.
- [ ] `<script type="application/ld+json">` payloads on `/`, `/about`, `/contact`, `/properties`, `/properties/[slug]`, `/agents`, `/agents/[slug]`, `/developments`, `/developments/[slug]` are valid JSON and reference the agency's canonical URL.
- [ ] The `RealEstateAgent.@id` is stable across the home, about, and contact pages (the same knowledge-graph node).

**CMS publishing verified (when used).**

- [ ] The agency can sign in to the Studio at `<projectId>.sanity.studio` (Sanity) or the equivalent editor URL.
- [ ] A new Property / Agent / Development created in the Studio and published appears on the public site within the documented staleness window (immediately on Node / Nitro; on the next `pnpm generate` for static).
- [ ] A `status: 'hidden'` flip removes the record from the public catalog without removing it from the dataset.
- [ ] The Sanity Studio's "Validation" panel is clean (every required field has a value).
- [ ] When the dataset is private, the `NUXT_SANITY_TOKEN` is set on the deployment's secret manager.

**Production smoke checks completed.**

- [ ] Every smoke check in §6.4 passes from a host on the public internet.
- [ ] No `5xx` responses on any public route.
- [ ] The lead-pipeline smoke check (when live) returns `200 OK` and the destination receives the lead.

**Backups and handoff information recorded.**

- [ ] The dataset-export cadence is named (`docs/SANITY_OPERATIONS.md` §6.2).
- [ ] The most recent dataset export is stored on the agency's owned storage.
- [ ] The deployment's secret-manager access list is recorded for the handoff.
- [ ] The source-code access posture (read / write / admin) is recorded per the commercial agreement.
- [ ] The implementer's local ignored `.env` files are inventoried (the implementer cleans them at the end of the engagement; see §10).

### 7.2 Acceptance window and rework

The agency has the acceptance window named in the commercial agreement to walk the criteria and report findings. Inside the window, the implementer resolves findings at no additional cost. Outside the window, every finding is a change-order and follows the change-order process in the commercial agreement.

The agency signs the production sign-off record (a dated document naming the criteria, the findings, the resolutions, and the final state) before Phase 7 (handoff) starts.

### 7.3 Acceptance exit checklist

- [ ] Every technical acceptance criterion signed off by the agency owner.
- [ ] Findings resolved (or formally accepted with a documented reason).
- [ ] Production sign-off record signed by the agency owner and the implementer lead.
- [ ] Acceptance window closed.

## 8. Handoff

The handoff is the **moment the agency takes ownership of the deliverable**. The full handoff table is in `docs/CLIENT_ONBOARDING.md` §4; this section names the deliverables and the access split the operator captures before leaving the engagement.

**The handoff checklist is conditional on the infrastructure ownership model** named in §2.1 (client-owned deployment vs operator-managed service) and on the source-code ownership / repository hosting stance. Each subsection names the items that apply under each model; the implementer / operator walks the matching list.

### 8.1 Deliverables by category

**Website deployment.**

- [ ] The production URL is live and reachable on the agency's hostname.
- [ ] The build artifact is retained on the platform per the platform's retention policy.
- [ ] The deploy primitive (the platform's "redeploy" / "rollback to previous build" button) is documented in the handoff record.
- [ ] The rollback procedure is documented (`docs/DEPLOYMENT.md` §11) and walked through with the agency owner.
- [ ] **Client-owned deployment model:** the agency owns the hosting account; the operator's delegated deploy role is downgraded or removed per the maintenance contract.
- [ ] **Operator-managed service model:** the operator retains the hosting account for the duration of the contract; the agency has a documented path to request a deploy / rollback through the operator (a support channel, a ticketing workflow, or the operator's named on-call rotation).

**CMS / Studio access (when used).**

- [ ] The Studio is deployed at `<projectId>.sanity.studio` (Sanity) or the agency's chosen editor URL.
- [ ] At least one CMS Administrator is named on the agency side.
- [ ] Editor / contributor roles are granted to the agency-side team members the agency names.
- [ ] The CMS project's billing is on the agency's account.
- [ ] (When a private dataset) the read token is on the deployment's secret manager; the agency's secret-manager administrator is named.

**Documentation.**

- [ ] `README.md` is updated to point at the agency's hostname and the canonical source-code repository (wherever the agreement names that repository to live — the agency's Git host, the operator's Git host, or a third-party host).
- [ ] `docs/DEPLOYMENT.md`, `docs/CLIENT_ONBOARDING.md`, `docs/REBRANDING.md`, `docs/SANITY_OPERATIONS.md` are committed and version-controlled.
- [ ] The handoff record (the access table below, the production sign-off record, the post-deploy smoke-check results) is stored on the agency's owned storage; when the commercial agreement grants the agency source-code ownership, the handoff record is also committed to the agency's canonical source-code repository.

**Credentials and access transfer.**

The credentials list applies under the client-owned deployment model and (where relevant) under the operator-managed service model; the implementer / operator does NOT assume it owns the accounts under either model. Items are conditional on the deploy model and on the agreements.

- [ ] **Hosting platform account.** **Client-owned model:** ownership / billing on the agency; operator's delegated role downgraded or removed per the maintenance contract. **Operator-managed model:** ownership on the operator for the duration of the contract; the agency does NOT receive the account credentials unless the commercial agreement names an account transfer at end of contract.
- [ ] **Domain registrar.** Ownership on the agency under both models; the implementer / operator is NEVER the registrar owner and does NOT hold the only-admin registrar access.
- [ ] **DNS provider console access.** **Client-owned model:** delegated access scoped per the commercial agreement. **Operator-managed model:** the operator may own or delegate the DNS console access per the agreement.
- [ ] **TLS certificate.** The certificate is documented (the agency's owned certificate, the platform's managed cert, or the operator's managed cert) and the renewal cadence is recorded.
- [ ] **Secret manager.** **Client-owned model:** the agency's secret manager; the operator's delegated role is downgraded or removed per the maintenance contract. **Operator-managed model:** the operator's secret manager; the agency has read-only access when the agreement names it (the read-only access lets the agency inspect the configuration without changing it).
- [ ] **SMTP credentials (when `email` adapter).** On the deployment's secret manager; rotation cadence documented; the agency retains the ability to rotate the credentials regardless of who owns the secret manager.
- [ ] **Webhook URL + secret (when `webhook` adapter).** On the deployment's secret manager; signature verification documented on the agency side.
- [ ] **Sanity account (when used).** CMS organisation ownership on the agency; at least one agency-side Administrator; operator role (Editor / Developer / Contributor) per the maintenance contract.
- [ ] **Analytics / monitoring / error-tracking accounts.** Account ownership per the agreement (the agency's accounts under the client-owned model; the operator's accounts under the managed-service model — or none for the deliverable). The agency retains access to the production data the accounts hold regardless of account ownership.

**Backups.**

- [ ] The most recent Sanity dataset export (when used) is stored on the agency's owned storage.
- [ ] The platform's build artifacts are retained per the platform's retention policy.
- [ ] The previous build artifact (the one Phase 5 deployed) is retained for rollback.
- [ ] **Source-code backups.** A copy of the rebranded source code is stored on the agency's owned storage when the commercial agreement grants the agency source-code ownership OR when the agreement names an escrow / mirror arrangement.

**Source-code repository access (only when the commercial agreement includes it).**

The repository ownership, hosting location, access level, transfer timing, mirror / escrow arrangement, and source-code license are **commercial-agreement decisions**, not technical decisions, and are NOT decided by this guide. The implementer / operator does NOT assume that source-code ownership implies the repository must live on the agency's Git host; the agency-owned source code can live on the operator's Git host, a third-party host, or be delivered as a one-time archive.

- [ ] When the agreement grants the agency source-code ownership: a copy of the source-code repository lives wherever the agreement names (the agency's Git host, the operator's Git host, a third-party host, or a one-time archive to the agency's owned storage). The agency receives the agreed access level (read-only / read + write / admin). Transfer timing is per the agreement (at handoff, at end of contract, or scheduled). A mirror / escrow arrangement may apply when the agreement names it.
- [ ] When the agreement does NOT grant the agency source-code ownership: the source-code repository stays with the implementer / operator; the agency does NOT receive the source code; the deployed artifact is the agency's. This item is **conditional on the commercial agreement** — the implementer / operator does not assert that the agency owns the source code by default.

### 8.2 Client-owned assets, data, and accounts

The following are always client-owned (independent of the commercial agreement and the infrastructure ownership model). The agency retains control of its domain and business data under both models:

- The agency's photography, logo, favicon, and any other agency-supplied assets.
- The agency's property / agent / development catalog.
- The agency's contact, social, and address data.
- The agency's domain registration (the agency is the registrar owner under both models; the implementer / operator is NEVER the registrar owner and does NOT hold the only-admin registrar access regardless of the deploy model).
- The agency's CMS account and project (when used; the CMS organisation is the agency's, the Administrator role is the agency's, the dataset is the agency's — per `docs/SANITY_OPERATIONS.md` §1).
- The agency's business data: the property / agent / development catalog, the lead-pipeline data (the stamped shape is the agency's; the destination's retention policy is the agency's), the i18n translations (when agency-supplied), the contact / social / address data, and any other business data the agency supplied to the deliverable.
- The agency's dataset backups (when a CMS is in use): the export file is the agency's; the canonical backup location is the agency's.

The following are conditional on the commercial agreement (NOT always client-owned):

- The hosting account, the deployment platform, the secret manager, the DNS provider console (beyond the registrar itself), the TLS certificate, and the analytics / monitoring / error-tracking accounts may be agency-owned under the client-owned deployment model or operator-managed under the operator-managed service model. The assignment is per the commercial agreement; the implementer / operator does NOT assume it owns or manages these accounts.

The implementer / operator does not retain copies of any client-owned asset, data, or account on personal accounts or storage after the handoff.

### 8.3 Infrastructure ownership model

The infrastructure ownership model is named in the commercial agreement (§2.1) and drives every other ownership question in this guide. The two supported models are:

**Client-owned deployment model (the default expectation).** The agency owns the hosting account, the deployment platform, the secret manager, the DNS provider console (beyond the registrar itself), the TLS certificate, and the analytics / monitoring / error-tracking accounts. The implementer / operator receives **delegated access** scoped to the engagement and / or the maintenance contract — a project-level or member-level role on the agency's account, never the only-admin role. The agency is the sole owner of the only-admin access on every account. The operator's delegated role is downgraded or removed at the end of the engagement or the maintenance contract per §10. The handoff under this model transfers **no accounts** — the agency already owns them; the handoff confirms the access scope and removes the operator's delegated role.

**Operator-managed service model.** The operator owns the hosting account, the deployment platform, the secret manager, the DNS provider console, the TLS certificate, and the analytics / monitoring / error-tracking accounts as part of the managed-service engagement. The agency receives a **service-level commitment** on the production URL (and on the lead-pipeline destination, the backup cadence, the uptime target, the response cadence) and may receive read-only access to the production data without holding account ownership. Account transfer at end of contract is **conditional on the commercial agreement** — a managed-service engagement may or may not transfer the operator-held accounts to the agency. The handoff under this model confirms the service-level commitment, the agency's read-only access (when the agreement names it), and the end-of-contract transfer posture.

**The model is NOT decided by this guide.** The implementer / operator and the agency choose the model in the commercial agreement based on the agency's operational capacity, the maintenance scope, and the long-term ownership stance. The handoff checklist in §8.1 and the maintenance / end-of-contract checklists in §9 and §10 are walked against the model named in the agreement.

**What the operator does NOT assume under either model.** The implementer / operator does NOT assume it owns or manages the hosting account, the deployment platform, the secret manager, the DNS / registrar access, or the monitoring / analytics accounts. The assignment is per the commercial agreement; the implementer / operator confirms the model before requesting any delegated access.

### 8.4 Contract-dependent source-code and license rights

The following are **commercial-agreement decisions**, not technical decisions, and are NOT decided by this guide. The implementer / operator does NOT assume that source-code ownership implies the repository must live on the agency's Git host; the agency-owned source code can live on the operator's Git host, a third-party host, or be delivered as a one-time archive.

- **Source-code ownership.** Whether the agency owns the rebranded source-code repository after handoff, whether the operator retains it, or whether a third-party license applies. Named in the commercial agreement.
- **Source-code license.** The license the implementer / operator grants the agency for the rebranded codebase (the implementer's default license, a custom license, an open-source license, or a transfer-of-ownership clause). Named in the commercial agreement.
- **Repository hosting location.** Where the rebranded repository lives — the agency's Git host, the operator's Git host, a third-party host, or no live repository (a one-time archive to the agency's owned storage). Named in the commercial agreement; independent of ownership.
- **Repository access level.** The role the agency holds on the source-code repository — read-only, read + write, or admin — when the agency owns the repository. Named in the commercial agreement.
- **Transfer timing.** When the source-code transfer happens — at handoff, at end of contract, on a scheduled cadence, or on demand. Named in the commercial agreement.
- **Source-code transfer mechanism.** Whether the source code is transferred by ownership transfer, by license grant, by open-source release, by archive delivery, or not at all. Named in the commercial agreement.
- **Mirror / escrow arrangement.** Whether a mirror of the source-code repository is held by a third party (a code escrow agent) to protect the agency's continuity in case the operator discontinues the template. Named in the commercial agreement.
- **Operator's role on the source-code repository.** Whether the operator retains a read-only, read + write, or admin role on the agency's repository after handoff, and on what cadence the role is renewed. Named in the commercial agreement or the maintenance contract.

The implementer / operator and the agency record the source-code and license terms in the commercial agreement. The handoff record references the commercial agreement; it does not duplicate the terms. The handoff checklist in §8.1 ("Source-code repository access") is walked against the agreement; the implementer / operator does NOT default to "agency owns the source code on the agency's Git host" — that combination is one of many possible combinations, and the agreement names the actual choice.

### 8.5 Handoff exit checklist

The handoff exit checklist is **conditional on the infrastructure ownership model** and the source-code / repository stance named in the commercial agreement. Every item below is checked against the model; the implementer / operator does NOT default to a client-owned model and does NOT assume the source code lives on the agency's Git host.

- [ ] Production sign-off record signed (Phase 6).
- [ ] Handoff record signed by the agency owner and the implementer lead.
- [ ] Infrastructure ownership model confirmed in writing (client-owned deployment vs operator-managed service).
- [ ] **Client-owned deployment model:** the agency owns the hosting account, the deployment platform, the secret manager, the DNS provider console, the TLS certificate, and the analytics / monitoring / error-tracking accounts. The operator's delegated role on every account is downgraded or removed per the maintenance contract. No account is transferred at handoff — the agency already owns the accounts.
- [ ] **Operator-managed service model:** the operator retains the hosting account, the deployment platform, the secret manager, the DNS provider console, the TLS certificate, and the analytics / monitoring / error-tracking accounts for the duration of the contract. The agency has the agreed service-level commitment, the agreed read-only access to the production data, and the agreed end-of-contract transfer posture. The end-of-contract transfer is per the commercial agreement; it is NOT a default.
- [ ] **Domain and DNS:** the agency's domain registration is documented; the registrar owner is the agency; the operator does NOT hold the only-admin registrar access regardless of the deploy model.
- [ ] **CMS (when used):** the CMS organisation is the agency's; at least one agency-side Administrator is named; the operator's CMS role is per the maintenance contract.
- [ ] **Credentials and access:** the credentials list in §8.1 is walked against the model. SMTP credentials, webhook URL + secret, Sanity read token, and every other secret that affects the production URL are documented; the agency retains the ability to rotate the credentials regardless of secret-manager ownership.
- [ ] **Source-code and license:** the source-code ownership, license, repository hosting location, access level, transfer timing, transfer mechanism, and mirror / escrow arrangement are recorded per the commercial agreement. The handoff record references the agreement; it does not duplicate the terms. **The implementer / operator does NOT assume the source code lives on the agency's Git host; the agreement names the actual hosting location.**
- [ ] **Backups:** the most recent dataset export is stored on the agency's owned storage (when used); build artifacts are retained per the platform's retention policy; a source-code backup is stored on the agency's owned storage when the commercial agreement names an escrow / mirror arrangement or grants the agency source-code ownership.
- [ ] Documentation updated and version-controlled.
- [ ] Agency owner has confirmed they can deploy, rollback, and update content according to the named model (self-service under the client-owned model; through the operator's support channel under the managed-service model).

## 9. Optional maintenance

When the commercial agreement names an ongoing-maintenance contract, a named operator (the implementer, a third-party operator, or the agency's in-house team) takes responsibility for the deliverable's continued operation between Phase 8 and Phase 9. The maintenance contract names the scope, the SLAs, the renewal cadence, and the escalation path.

The maintenance contract **does NOT** extend the agency's ownership of the platform, the CMS, the dataset, the deploy, or the source-code repository. The agency always retains the ownership rights defined in §8.2 and §8.3; the maintenance contract only adds the operator's role on top.

**The maintenance contract is conditional on the infrastructure ownership model.** Under the client-owned deployment model, the operator receives **delegated access** on the agency's accounts scoped to the maintenance scope; the agency retains ownership of every account and the only-admin role on every account. Under the operator-managed service model, the operator retains the accounts and the agency receives a service-level commitment; the operator's accounts are not transferred to the agency at maintenance-contract signature (the transfer is per the commercial agreement's end-of-contract terms, not the maintenance contract).

### 9.1 Operator role on the CMS

The operator's CMS role is named in the maintenance contract. The role choices and their scope are in `docs/SANITY_OPERATIONS.md` §2.3:

- **Editor** — when the operator only publishes content and does not need developer-infrastructure access. The common case for an operator whose scope is the Nuxt deploy and the post-deploy smoke checks.
- **Developer** — when the operator needs both content publishing AND developer-infrastructure responsibilities (datasets, tokens, CORS, webhooks, GraphQL, deploy).
- **Contributor is not appropriate** for an operator who must publish production content.

The role is renewed on the cadence the maintenance contract names (typically annual). Removing the role is NOT required when ongoing maintenance is contracted; the role is renewed, not removed and re-added.

The CMS role is **independent of the infrastructure ownership model**: under either model, the agency retains the only-Administrator role on the CMS organisation (per `docs/SANITY_OPERATIONS.md` §1.1 rule 3). The operator's role is Editor or Developer per the maintenance contract, not Administrator.

### 9.2 Operator responsibilities under maintenance

The maintenance contract names the operator's responsibilities. The canonical reference is `docs/SANITY_OPERATIONS.md` §4 for Sanity and `docs/DEPLOYMENT.md` §4, §8, §10, §11 for the Nuxt side. The typical scope:

- **Nuxt deploy.** The operator maintains the env vars, the build, the smoke checks, and the rollback on the deployment side. **Client-owned model:** the operator has delegated access on the agency's deploy account. **Operator-managed model:** the operator has its own role on its own deploy account.
- **Studio deploy.** The operator maintains the Studio deploy at `<projectId>.sanity.studio` when the operator has the Developer role. The Studio is the agency's; the operator has the Developer role on the agency's CMS project.
- **Sanity-side env vars.** The operator maintains `NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`, and the per-feature `NUXT_<FEATURE>_CMS_PROVIDER` + `NUXT_<FEATURE>_DATA_SOURCE` on the deployment's secret manager. The secret manager is the agency's under the client-owned model and the operator's under the operator-managed model; the operator's access scope to the secret manager is per the maintenance contract.
- **Content pipeline validation.** The operator runs the validation procedure (`docs/SANITY_VALIDATION.md`) on published changes (the agency's content, the operator's deploy).
- **Incident response.** The operator responds to incidents (bad publish, schema drift, deploy failure) on the Nuxt side. The agency owner responds on the Sanity content side (the operator's role does not extend to dataset structural changes).
- **Operational reporting.** The operator reports a monthly or quarterly summary (deploys shipped, smoke-check results, incidents + resolutions, content-pipeline uptime, recommended follow-ups) to the agency.

### 9.3 Operator access boundaries

The operator does NOT delete documents in the published dataset unless the agency owner has approved the deletion in writing. The operator does NOT change the Studio schemas unless the maintenance contract explicitly includes schema work. The operator does NOT rotate the read token unless the agency owner has approved the rotation. The boundary protects the agency's content from accidental operator-driven change.

### 9.4 SLAs and escalation

The maintenance contract names:

- A single point of contact on each side (the agency owner for the agency; the operator's named representative for the operator).
- A shared communication channel (email, Slack, a shared incident-response page).
- A first-response cadence (a recommended baseline is ~30 minutes for an incident confirmed by either side).
- A status-update cadence (a recommended baseline is hourly until resolution).
- An escalation path (a recommended baseline is the agency owner for agency-side issues; the operator's lead for operator-side issues).

The maintenance contract may name a different cadence (faster for production-critical incidents, slower for non-critical) or a different escalation path. The agency's incident-response policy (if no maintenance contract is in place) is the source of truth for the cadence the agency wants the operator to follow.

### 9.5 Maintenance handoff

When the maintenance contract is signed, the operator receives:

- A copy of the production sign-off record.
- A copy of the handoff record.
- **Client-owned deployment model:** delegated access on the agency's hosting account, the agency's secret manager, the DNS provider console (when the agreement names it), and any other infrastructure account the maintenance scope touches. The delegated access is scoped to the maintenance scope; the agency retains the only-admin role on every account.
- **Operator-managed service model:** the operator continues to hold the accounts; no transfer happens at maintenance-contract signature. The agency receives a service-level commitment and any read-only access the agreement names.
- The Sanity project role scoped to the maintenance scope (Editor or Developer per §9.1). The CMS organisation is the agency's under both models.
- The agency's communication channel and the agency's named point of contact.
- The maintenance contract (the source of truth for the operator's responsibilities, the SLAs, and the escalation path).

The maintenance handoff does NOT require a new deploy. The agency continues to operate the deliverable; the operator joins the agency's operational cycle. The handoff does NOT extend the agency's ownership of any account the agency already owns, and it does NOT transfer accounts the operator owns to the agency (account transfer is per the commercial agreement's end-of-contract terms, not the maintenance contract).

## 10. End of contract

When the maintenance contract ends (or the project-based engagement ends), the operator's platform access is removed. The agency's platform access is preserved. The source-code side of the handoff is determined by the commercial agreement (see §8.4).

The end-of-contract access removal is **conditional on the infrastructure ownership model**:

- **Client-owned deployment model.** The agency already owns the hosting account, the secret manager, the DNS provider console, the TLS certificate, and the analytics / monitoring / error-tracking accounts. The end-of-contract step is to **drop the operator's delegated access** on every account — the agency does NOT receive new accounts at end of contract because the agency already owns them. The implementer / operator's delegated roles are removed or downgraded per the maintenance contract.
- **Operator-managed service model.** The operator owns the accounts. The end-of-contract step is to **transfer the operator-held accounts to the agency when the commercial agreement names it** — or, when the agreement does NOT name an account transfer, the operator retains the accounts and the agency receives the agreed service-level exit (a documented migration path, a final data export, a transition period). The implementer / operator does NOT default to "accounts transfer at end of contract"; the commercial agreement names the actual transfer posture.

### 10.1 Operator access removal (canonical reference: `docs/SANITY_OPERATIONS.md` §8)

The agency owner is the sole approver of the access removal. The operator does NOT remove their own access. The removal is the **last step of the engagement**, not a delayed step.

- [ ] **Operator Sanity role removed.** The agency owner signs in to <https://www.sanity.io/manage>, picks the project, opens **Members**, and removes the operator's Sanity account. The role-removal cadence and any intermediate downgrades (e.g., to **Viewer** for a read-only audit trail) are named in the maintenance contract.
- [ ] **Operator API token revoked.** The agency owner opens the project's **API → Tokens** and revokes every token the operator's Sanity account created or was associated with.
- [ ] **Operator deployment access removed.** **Client-owned model:** the agency drops the operator's delegated role on the agency's hosting account and the agency's secret manager. **Operator-managed model:** the agency (or the operator, per the commercial agreement) either transfers the accounts to the agency, or the operator retains the accounts and the agency receives the agreed service-level exit. The implementer / operator does NOT default to either posture; the commercial agreement names the actual one.
- [ ] **Source-code access adjusted per the commercial agreement.** The agency-owned source code can live on the agency's Git host, the operator's Git host, a third-party host, or be delivered as a one-time archive — the agreement names the actual hosting location. When the agreement names a transfer timing, the transfer happens at that timing. When the agreement names an escrow / mirror arrangement, the escrow / mirror is in place. When the agreement does NOT grant the agency source-code ownership, the source-code repository stays with the operator (or whoever the agreement names).
- [ ] **Operator local working tree cleaned.** The operator deletes the local ignored `.env` files (the local env-var files the operator used during the build) and any operator-owned working copies of the codebase.
- [ ] **Operator backups returned or destroyed.** The operator's working copy of the most recent dataset export is returned to the agency (the agency's cloud storage, the agency's local archive, or a shared location the agency nominates) OR destroyed, as the maintenance contract and the applicable retention / security policy name. Operator backups must NEVER be stored in unauthorized personal storage.
- [ ] **Operator Studio deploy access removed.** The operator's redeploy access to the Studio is gone with the Sanity role removal.
- [ ] **Operator's documentation handed over.** The operator's handoff record (the access table, the production sign-off record, the post-deploy smoke-check results, the post-deploy incident log, the maintenance summaries) is given to the agency. The agency keeps the record; the operator's working tree does not retain a copy.

### 10.2 End-of-contract handoff record

The end-of-contract handoff record is signed by both parties and dated. The record references the commercial agreement (for source-code and license terms, repository hosting location, transfer timing, mirror / escrow arrangement, account transfer posture) and the maintenance contract (for operator access scope and SLA). The record is stored on the agency's owned storage; the operator may keep a copy only as the commercial agreement and applicable retention policy name.

### 10.3 Agency's post-engagement posture

After the access removal, the agency is the sole owner of:

- The CMS organisation (billing) and the project.
- The Studio deploy at `<projectId>.sanity.studio` (when used).
- The published dataset.
- The read token (when used).
- The dataset backups (per the retention policy in the commercial agreement).
- The post-handoff documentation.
- The agency's business data (the catalog, the contact / social / address data, the i18n translations, the lead-pipeline data).
- The domain registration (under both models).

The agency's post-engagement posture for the **infrastructure accounts** (hosting, deployment platform, secret manager, DNS provider console, TLS certificate, analytics / monitoring / error-tracking) is **conditional on the infrastructure ownership model**:

- **Client-owned deployment model.** The agency was the sole owner of every infrastructure account throughout the engagement; the post-engagement posture is the same as the in-engagement posture. The operator's delegated roles are dropped at end of contract; the accounts are not transferred because the agency already owns them.
- **Operator-managed service model.** The agency is the sole owner of the infrastructure accounts ONLY when the commercial agreement names an account transfer at end of contract. When the agreement does NOT name a transfer, the operator retains the accounts and the agency receives the agreed service-level exit. The implementer / operator does NOT default to either posture.

The source-code repository ownership, hosting location, and access level are per the commercial agreement (§8.4). The agency may sign a new contract with the same operator (or a different operator) to re-establish the operator's platform access. The new contract is independent of the prior contract; the handoff documentation is the agency's reference for what the new operator needs.

### 10.4 End-of-contract checklist

- [ ] Commercial agreement's termination clause followed (the notice period observed; the obligations of both parties fulfilled).
- [ ] Infrastructure ownership model confirmed in writing for the end-of-contract posture.
- [ ] **Client-owned deployment model:** operator's delegated role on every agency-owned account is dropped (hosting, secret manager, DNS provider console, analytics / monitoring / error-tracking). No account is transferred because the agency already owns the accounts.
- [ ] **Operator-managed service model:** accounts transfer to the agency when the commercial agreement names it; when the agreement does NOT name a transfer, the operator retains the accounts and the agency receives the agreed service-level exit.
- [ ] **Domain and DNS:** the agency's domain registration is preserved; the registrar owner is the agency.
- [ ] Operator Sanity role removed (when a CMS is in use); operator's API tokens revoked.
- [ ] Source-code access adjusted per the commercial agreement (the agency-owned source code lives wherever the agreement names; the operator's role on the repository is dropped or downgraded per the agreement; mirror / escrow arrangement is in place when the agreement names it).
- [ ] Operator's documentation handed over to the agency.
- [ ] Operator backups returned or destroyed.
- [ ] End-of-contract handoff record signed by both parties and stored on the agency's owned storage.

## 11. Commercial-agreement decisions (named, not decided)

The following are **commercial-agreement decisions**, not technical decisions. They are named in this guide only to make the implementer / operator and the agency aware that they exist; the implementer / operator does NOT decide them unilaterally.

- **Pricing model.** Fixed-fee project, time-and-materials, milestone-based, retainer, or another structure. Named in the commercial agreement.
- **License model.** The license the implementer / operator grants the agency for the rebranded codebase. Named in the commercial agreement.
- **Maintenance fee.** The recurring fee for the optional maintenance contract (when one is in place). Named in the maintenance contract.
- **Infrastructure ownership model.** Whether the production infrastructure is **client-owned** (the agency holds the accounts; the operator receives delegated access) or **operator-managed** (the operator holds the accounts as part of a managed-service engagement; the agency receives a service-level commitment). Drives §3.9, §6, §8.3, §9, and §10. Named in the commercial agreement.
- **Domain ownership stance.** The agency retains control of its domain and business data under both models. The registrar is the agency's; the implementer / operator is NEVER the registrar owner. The DNS access delegation scope is per the commercial agreement. Named in the commercial agreement.
- **Source-code ownership.** Whether the agency owns the rebranded source-code repository after handoff. Named in the commercial agreement.
- **Source-code license.** The license the implementer / operator grants the agency for the rebranded codebase. Named in the commercial agreement.
- **Repository hosting location.** Where the rebranded repository lives — the agency's Git host, the operator's Git host, a third-party host, or a one-time archive to the agency's owned storage. **Source-code ownership does NOT imply the repository must live on the agency's Git host;** the agreement names the actual hosting location. Named in the commercial agreement.
- **Repository access level.** The role the agency holds on the source-code repository (read-only / read + write / admin) when the agency owns the repository. Named in the commercial agreement.
- **Source-code transfer timing.** When the source-code transfer happens — at handoff, at end of contract, on a scheduled cadence, or on demand. Named in the commercial agreement.
- **Source-code transfer mechanism.** Whether the source code is transferred by ownership, licensed, released as open source, delivered as an archive, or not at all. Named in the commercial agreement.
- **Source-code escrow / mirror arrangement.** Whether a third-party mirror or escrow agent holds a copy of the source-code repository. Named in the commercial agreement.
- **End-of-contract infrastructure transfer posture.** When the agreement uses the operator-managed service model, whether the operator-held accounts transfer to the agency at end of contract, and on what cadence. Named in the commercial agreement.
- **Acceptance window.** The number of business days the agency has to sign off after the production sign-off. Named in the commercial agreement.
- **Change-order process.** The process for scope changes inside and outside the acceptance window. Named in the commercial agreement.
- **Termination clause.** The notice period and the obligations of both parties at termination. Named in the commercial agreement.
- **Operator role on the CMS during maintenance.** Editor, Developer, or another role appropriate to the maintenance scope. The agency retains the only-Administrator role regardless. Named in the maintenance contract.
- **SLA.** The response-time commitment for production incidents under maintenance. Named in the maintenance contract.
- **Escalation path.** The single point of contact on each side and the escalation procedure. Named in the maintenance contract.

The implementer / operator and the agency record the answers in the commercial agreement (and the maintenance contract, when one is in place). The handoff record references the agreement; it does not duplicate the answers.

## 12. References

- `docs/CLIENT_ONBOARDING.md` — the upstream agency-side information checklist (§2.1), the production-readiness blockers (§2.2), the optional enhancements (§2.3), the implementation sequence (§3), the handoff table (§4), the environment-variable template (§5), and the first-client rebrand dry-run (§6).
- `docs/REBRANDING.md` — the rebrand workflow (§1–§15) and the production-readiness checklist (§16).
- `docs/DEPLOYMENT.md` — the deployment flow (§3–§11), the env-var lifecycle (§4), the static vs Node/Nitro capability matrix (§5), the post-deploy smoke checks (§10), and the rollback procedure (§11).
- `docs/SANITY_OPERATIONS.md` — the Sanity CMS post-implementation operations guide (cardinal rules §1, one-time setup §2, client editing workflow §3, operator / maintenance workflow §4, smoke validation §5, export / backup expectations §6, incident / recovery actions §7, end-of-contract handoff §8).
- `docs/SANITY_VALIDATION.md` — the one-time Sanity validation procedure.
- `docs/MULTI_TENANT.md` — multi-tenant deployment guidance (per-tenant hostname dispatch, per-tenant canonical URL, per-tenant lead delivery configuration).
- `docs/CMS_EVALUATION.md` — the CMS provider evaluation (Sanity, Contentful, Strapi) and the Sanity recommendation.
- `studio/README.md` — the Studio developer's manual (project creation, dataset creation, Studio install + deploy, schema contract, schema tests, the wire-the-Nuxt-app env-var table).
- `docs/RELEASE_NOTES_v1.0.md` — the v1.0.0 release notes.
- `docs/RELEASE_NOTES_v1.1.md` — the v1.1.0 release notes (lead-capture pipeline, four pluggable delivery adapters, static-vs-Nitro trade-off).
- `docs/RELEASE_NOTES_v1.2.md` — the v1.2 release notes (CMS data-source foundation, Sanity provider driver, Studio hardening, Studio UX polish, first-client operations guide).
- `docs/ROADMAP.md` — the implementation state and the milestone log.
