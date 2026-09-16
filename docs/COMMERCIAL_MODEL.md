# Commercial Packaging & Licensing Model

This document defines a **practical packaging and licensing model** for selling the Real Estate Website Template to real agencies. It is the commercial counterpart to:

- `docs/COMMERCIAL_DELIVERY.md` — the 9-phase operational workflow from signed agreement to signed handoff record.
- `docs/COMMERCIAL_DELIVERY.md` §11 — the list of decisions that are **named, not decided** by the operational guide; this document picks up that list and gives it a practical packaging shape.
- `docs/CLIENT_ONBOARDING.md` — the agency-side information collection (the upstream input to every commercial engagement).
- `docs/SANITY_OPERATIONS.md` (when Sanity is the CMS) — the post-implementation operations guide; the maintenance tier in §7 below is the commercial counterpart to its operator / maintenance workflow (§4).
- `docs/ROADMAP.md` §5c — the Client Project Bootstrap, the entry point every implementation engagement uses.

## 1. What this document is, and what it is not

### 1.1 What this document is

- A **commercial packaging model**: a small, operationally meaningful set of delivery models and service tiers the operator offers to a real agency.
- A **comparison surface**: for each delivery model, what the agency receives, what the operator retains, who owns hosting / CMS / domain / source-code, what ongoing updates and support look like, and what exit / handoff looks like.
- A **default recommendation** for the current stage of the product (the v1.3 first-client phase), with explicit alternatives for agencies whose requirements do not fit the default.
- A **cost-breakdown frame**: the document separates implementation fees, recurring maintenance, direct third-party costs, and optional custom development. It does not name specific prices (prices are a commercial-agreement decision per `docs/COMMERCIAL_DELIVERY.md` §11).

### 1.2 What this document is NOT

- **Not a contract template.** No clause in this document is contractually binding. Pricing, license text, maintenance-fee numbers, source-code escrow arrangements, governing law, indemnification, termination notice periods, and jurisdiction-specific data-processing addenda are **commercial-agreement decisions**, recorded in the agreement between the implementer / operator and the agency. This document only describes the practical surface the agreement names.
- **Not a legal opinion.** This document is a packaging frame for a real product, not legal advice. An agency and an implementer / operator who need a binding agreement consult qualified counsel in their own jurisdiction.
- **Not an exhaustive list of every commercial variation.** The four delivery models in §2 and the three service tiers in §6 are the practical default surface. A bespoke engagement that combines elements (e.g., one-time implementation + a recurring managed-service fee + a source-code escrow arrangement + custom-developed features) is a normal commercial-agreement decision; this document names each element so the agreement can pick and choose.
- **Not a guarantee of any specific outcome.** The implementer / operator does not guarantee uptime, response time, lead-delivery rates, business outcomes, or any other result beyond the scope the agreement names. A **support target** is a non-binding operational cadence the operator aims for; a **contractual SLA** is a binding commitment the agreement names. SLAs and exact response times are **commercial-agreement decisions**, recorded in the agreement between the implementer / operator and the agency; this document does not assert a default SLA, and no tier ships a built-in contractual SLA. The named cadences in §7 below are support-target baselines for context, not contractual commitments.

### 1.3 The existing principle this document preserves

`docs/COMMERCIAL_DELIVERY.md` §8.4 (and §11) records the principle this document does not disturb:

> Source-code ownership, license, repository hosting location, repository access level, transfer timing, transfer mechanism, and mirror / escrow arrangement are **commercial-agreement decisions, not technical decisions**. The implementer / operator does not assert that the agency owns the source-code repository by default, does not assert the repository must live on the agency's Git host, and does not assert that any specific license is the default.

This document treats that principle as a hard rule. No delivery model in §2 changes it; no tier in §6 changes it; no maintenance scope in §7 changes it. Source-code ownership is described as a **commercial-agreement decision** at every point where it appears.

## 2. The four delivery models (compared)

The implementer / operator typically offers one of four delivery models. Each model is named below with the same nine dimensions, so an agency can compare them side by side:

| Dimension | Model A — One-time implementation + optional maintenance | Model B — Implementation + recurring managed-service fee | Model C — Recurring subscription / website-as-a-service | Model D — Source-code handoff / licensed source delivery |
| --- | --- | --- | --- | --- |
| **What the agency receives** | A live production site, the branded source code (per agreement), the credentials and accounts, the documentation, the handoff record, and an acceptance window. | A live production site + managed operations on a recurring retainer: named SLA, named operator role, monthly / quarterly summary. | A live production site hosted on operator-owned infrastructure + bundled lead delivery + a bundled CMS edit allowance + an SLA. | The rebranded source-code repository, a license (per agreement), the documentation, and the build instructions. The agency operates the site themselves (or hires another operator). |
| **What the operator retains after handoff** | Nothing by default. The optional maintenance add-on adds the operator's role on the agency's accounts (see Model B). | A delegated role on the agency's hosting account, secret manager, DNS console (when the agreement names it), and CMS; a named on-call representative; the agreed SLA. | The hosting account, the deployment platform, the secret manager, the DNS console, the TLS certificate, and the analytics / monitoring / error-tracking accounts, for the duration of the contract. The agency retains read-only access to production data per the agreement. | Nothing. The operator's role ends at delivery. Optional paid support at per-incident rates is a separate commercial line. |
| **Hosting responsibility** | Agency-owned. The agency holds the hosting account; the operator receives a delegated role scoped to the engagement. | Agency-owned. The operator receives a delegated role scoped to the maintenance scope. | Operator-owned for the duration of the contract; agency receives a service-level commitment and read-only access to the production data. Account transfer at end of contract only if the agreement names it. | Agency-owned (the agency operates the site themselves). |
| **CMS responsibility (when a CMS is used)** | Agency-owned (organisation + project + billing). The operator is a project member during the build and transfers the role per the agreement; at least one agency-side Administrator remains at all times. | Same as Model A on the platform side; the operator retains an Editor or Developer role scoped to the maintenance contract. | Agency-owned organisation + project + billing; the operator manages day-to-day operations (publishing, dataset hygiene, incident response) within the maintenance scope. The agency retains the only-Administrator role. | Agency-owned; the agency operates it themselves. |
| **Domain responsibility** | Always agency-owned. The implementer / operator is never the registrar owner and never holds the only-admin registrar access under any model. The DNS access scope (none / read-only / read + write) is delegated per the agreement. | Same as Model A. The DNS access scope is per the maintenance contract. | Always agency-owned. The operator may own or delegate the DNS console access per the agreement. | Always agency-owned. |
| **Source-code / repository access** | Per the commercial agreement. Typical: agency owns the rebranded repository (operator-hosted, agency-hosted, or third-party-hosted). Transfer timing per the agreement. The implementer / operator does not default to agency-owned or operator-hosted. | Per the commercial agreement. Typical: same as Model A, with the maintenance scope adding an agreed operator role on the agency's repository. | Operator-owned source code. The agency receives the deployed artifact + the agency's content, not the source code. Source-code license per the agreement. | Agency-owned source code (the model is built around this). The operator transfers the rebranded repository at delivery, with the agreed license and access level. |
| **Ongoing updates** | The agency owns the decision. A separate maintenance contract (Model B) is the typical path. | Bundled into the recurring fee (within the maintenance scope: dependency updates, security patches, dependency-rotation deploys, monthly smoke checks). | Bundled into the subscription (dependency updates, security patches, platform updates, operator-managed monitoring). | Not included. The agency updates the codebase themselves or contracts a third party. |
| **Support expectations** | Bounded by the acceptance window. No operational support scope after handoff unless a maintenance contract is in place. | Operational support scope per the maintenance contract; a contractual SLA only when the contract explicitly names one (typically associated with an explicitly priced managed-service retainer). The non-aggressive best-effort support target documented in `docs/SANITY_OPERATIONS.md` §7.1 / `docs/COMMERCIAL_DELIVERY.md` §9.4 is the recommended baseline for a typical managed-service engagement; the exact cadence is a commercial-agreement decision. | Operational support scope per the subscription agreement; a contractual SLA typically tighter than Model B because the operator owns the entire stack — but the exact cadence is a commercial-agreement decision, not a template default. | Optional per-incident support at per-incident or per-hour rates; no SLA. |
| **Exit / handoff implications** | At handoff the operator's delegated roles are dropped. The agency owns every account going forward. | At end of contract the operator's delegated roles are dropped; the agency already owns the accounts; the maintenance handoff does not transfer any account (per `docs/COMMERCIAL_DELIVERY.md` §9.5). | At end of contract the operator-held accounts transfer to the agency **only when the agreement names it**; otherwise the operator retains the accounts and the agency receives the agreed service-level exit (a documented migration path, a final data export, a transition period). The agency's CMS organisation, project, dataset, and business data always remain agency-owned. | The source-code transfer happens at delivery per the agreement; the operator's role ends there. No accounts change hands. |

### 2.1 When to pick each model

| Model | Best fit | Avoid when |
| --- | --- | --- |
| **A — One-time implementation + optional maintenance** | Agency wants predictable up-front cost, has or is willing to acquire basic internal IT capacity (or hire a freelancer), and is comfortable owning hosting / DNS / TLS / backups day-to-day. The maintenance contract is a low-friction upsell that does not lock the agency into a recurring expense. | The agency has zero internal IT capacity and does not want a hosting / DNS / secret-manager responsibility at all. |
| **B — Implementation + recurring managed-service fee** | Agency owns hosting / domain / CMS but wants a named operator with a service-level commitment for incident response, dependency updates, and post-publish smoke checks. The agency retains the only-Administrator role on every account. | The agency does not want any hosting / DNS / CMS ownership responsibility at all (then Model C is a better fit). |
| **C — Recurring subscription / website-as-a-service** | Agency wants a turn-key experience: the operator owns the hosting stack, the deploys, the secret manager, the monitoring, and the in-month content-change allowance. Agency's brand assets and business data remain agency-owned; the deploy / host / secret-manager accounts remain operator-owned for the contract's duration. | The agency is uncomfortable with operator-owned infrastructure (a common concern for agencies with internal compliance / procurement policies); the agency prefers fixed up-front cost over a recurring expense; the agency's growth path includes a planned internal IT team. |
| **D — Source-code handoff / licensed source delivery** | Agency has internal engineering capacity, plans to maintain the site themselves (or via an internal team / a third party), and wants full source-code control from day one. The implementer / operator's role ends at delivery. | The agency does not have internal engineering capacity; the agency does not want a hosting / DNS / secret-manager responsibility. |

### 2.2 Combinations

A real engagement can combine elements from multiple models. The most common combinations:

- **A + ongoing support incident retainer.** A Model A engagement with a separate per-incident support line — the agency pays a fixed implementation fee and an hourly rate for any post-handoff operator work, with no SLA. This is Model A with a small Model D tail.
- **B → C migration at renewal.** A Model B engagement that, on renewal, transitions to Model C — the operator's hosting account absorbs the agency's accounts (with the agreement's transfer posture named in writing) and the relationship becomes a subscription.
- **B → A migration at renewal.** A Model B engagement that, on renewal, ends the maintenance contract. The agency's accounts stay with the agency; the operator's delegated role is dropped per `docs/COMMERCIAL_DELIVERY.md` §10.1; the agency either takes operations in-house or contracts another operator.
- **A → D at end of engagement.** A Model A engagement that ends with the source-code transfer per the agreement. This is a Model A → Model D transition; the source-code transfer timing and mechanism are per the agreement.

The commercial agreement names the combination and the transitions. The implementer / operator does not assert that any combination is "the default".

## 3. Recommended default model + rationale

### 3.1 The recommendation

For the **current stage** of the product (the v1.3 first-client phase, with the Client Project Bootstrap shipped per `docs/ROADMAP.md` §5c), the recommended default is **Model A — One-time implementation + optional maintenance**, with **Model B** as the natural upsell for clients who want a named operator with an SLA.

### 3.2 Why Model A is the recommended default

- **Predictable up-front cost.** Most small / mid-sized agencies evaluate vendors on up-front cost; a fixed-fee implementation project matches how the agency budgets. A subscription (Model C) is a recurring expense that often needs additional procurement / finance approval.
- **Bounded implementation scope.** The Client Project Bootstrap (`docs/ROADMAP.md` §5c) + the documented rebrand workflow (`docs/REBRANDING.md` §1–§15) make the implementation phase's scope, time, and risk measurable. The dry-run in `docs/CLIENT_ONBOARDING.md` §6 measured the friction surface end-to-end; the answer is that the friction is bounded to data + theme + agency config + assets + deploy config. No generic application code is touched by a rebrand.
- **Low-friction upsell to Model B.** The optional maintenance contract in Model A is essentially a Model B retainer without the bundled infrastructure. The agency can start with Model A, learn the operational rhythm (deploys, smoke checks, dependency updates), and decide later whether to convert to Model B without any platform-side transition. The transition is a commercial-agreement decision, not a technical one.
- **Source-code ownership stays a commercial-agreement decision.** Model A is compatible with every source-code posture (agency-owned, operator-owned, joint, escrow). The implementer / operator does not assert that Model A requires source-code transfer; the agreement names the actual choice.
- **It does not lock the agency into a recurring expense.** A small agency that does not need monthly operator support does not pay for it. The optional maintenance contract is a discrete line item the agency can add, keep, or drop on each renewal.

### 3.3 Why Model B is the natural upsell

- The agency already owns every account under Model A; Model B adds an operator's delegated role on top of those accounts without changing account ownership.
- A named SLA + a named on-call representative + a monthly summary is the operationally meaningful upgrade most agencies want after the first 90 days of operation.
- The transition from A to B is a **commercial-agreement change**, not a platform migration. The agency's accounts stay with the agency; the agreement gains a maintenance scope.

### 3.4 When to lead with Model B instead

- The agency has zero internal IT capacity and is willing to delegate hosting / DNS / secret-manager operations to the operator under a managed-service retainer.
- The agency's procurement policy prefers a monthly recurring commitment over a large up-front fee.
- The agency has internal compliance / security policies that benefit from a single named operator with a documented SLA.

### 3.5 When to lead with Model C

- The agency wants a turn-key experience and is comfortable with operator-owned hosting accounts for the contract's duration.
- The agency has no internal IT capacity at all (not even a freelance contractor).
- The agency's procurement / finance model prefers a single monthly invoice covering both the platform and the integration work.

### 3.6 When to lead with Model D

- The agency has internal engineering capacity and plans to operate the site themselves.
- The agency's procurement / legal policy treats source code as a critical asset that must live on the agency's Git host.
- The agency is uncomfortable with any ongoing third-party operational role.

## 4. Source-code & licensing treatment (applies to every model)

The following are **commercial-agreement decisions** and are recorded in the agreement, not decided by this document. They appear in every model description above because the implementer / operator does not assert a default.

### 4.1 Source-code ownership

- The implementer / operator does NOT assert that the agency owns the rebranded source code by default. Per `docs/COMMERCIAL_DELIVERY.md` §8.4, ownership is a commercial-agreement decision.
- A Model A or Model B engagement with **agency-owned source code** is normal: the rebranded repository lives wherever the agreement names (the agency's Git host, the operator's Git host, a third-party host, or a one-time archive to the agency's owned storage).
- A Model C engagement with **operator-owned source code** is normal: the agency receives the deployed artifact + the agency's content; the source-code repository stays with the operator. The license the operator grants the agency is named in the agreement.
- A Model D engagement is, by definition, **agency-owned source code**: the source-code transfer is the deliverable. The license text + the access level + the transfer timing are named in the agreement.

### 4.2 Source-code license

- The license the implementer / operator grants the agency for the rebranded codebase is one of: the implementer's default license, a custom license, an open-source license, or a transfer-of-ownership clause. **Named in the commercial agreement.**
- The license is independent of source-code ownership. An agency that owns the source code may hold it under a non-open-source license; an agency that does not own the source code may hold a license that grants operational rights (run, modify, publish) without ownership transfer.

### 4.3 Source-code repository hosting location

- The implementer / operator does NOT assert that source-code ownership implies the repository must live on the agency's Git host. The agency-owned source code can live on the operator's Git host, a third-party host, or be delivered as a one-time archive to the agency's owned storage. **Named in the commercial agreement.**

### 4.4 Repository access level

- When the agency owns the repository, the agency's role is read-only / read + write / admin per the agreement. The implementer / operator's role on the repository (when the source code is agency-owned but the operator retains an operational role) is named per the agreement.

### 4.5 Source-code transfer timing

- At handoff, at end of contract, on a scheduled cadence, or on demand. **Named in the commercial agreement.**

### 4.6 Source-code transfer mechanism

- Ownership transfer, license grant, open-source release, archive delivery, or not at all. **Named in the commercial agreement.**

### 4.7 Mirror / escrow arrangement

- A third-party code-escrow agent holds a copy of the source-code repository to protect the agency's continuity if the operator discontinues the template. **Named in the commercial agreement.** When the agreement names an escrow agent, the release conditions, the release events (operator discontinuation, contract termination without renewal, certain insolvency events), and the escrow fees are also named in the agreement.

### 4.8 Operator's role on the source-code repository during maintenance

- When the source code is agency-owned but the operator retains an operational role (the Model B scenario), the operator's role is named in the maintenance contract: read-only / read + write / admin, on what cadence the role is renewed, and what happens to the role at end of contract.

## 5. Client-owned accounts vs operator-managed accounts

### 5.1 Always client-owned (under every model)

These accounts and assets are always agency-owned regardless of the delivery model. The implementer / operator does not assume ownership under any model.

| Account / asset | Owner | Notes |
| --- | --- | --- |
| **Domain registration** | The agency | The agency is the registrar owner. The implementer / operator is **never** the registrar owner and does **not** hold the only-admin registrar access under any model. The DNS access scope (none / read-only / read + write) is delegated per the agreement. |
| **Agency-supplied photography / logo / favicon** | The agency | Uploaded to the agency's CMS media store or external CDN. The implementer / operator does not retain copies on personal accounts. |
| **Agency's CMS organisation + billing** | The agency | When a CMS is used. The Sanity organisation (the billing entity) is the agency's; the implementer / operator is a member, not the owner. The agency's billing email receives the CMS's monthly / annual invoice. (See `docs/SANITY_OPERATIONS.md` §1.1 cardinal rule 2.) |
| **Agency's CMS project + dataset** | The agency | One client = one agency = one isolated CMS project. The agency's project is never shared with another agency. The agency owns the dataset and every business record in it. (See `docs/SANITY_OPERATIONS.md` §1.1 cardinal rule 1.) |
| **At least one CMS Administrator** | The agency | The agency is the sole owner of the only-Administrator role. This rule does not lapse during a maintenance engagement, during an incident, or at the handoff. (See `docs/SANITY_OPERATIONS.md` §1.1 cardinal rule 3.) |
| **Agency's business data** | The agency | The catalog, the contact / social / address data, the i18n translations, the lead-pipeline data (the destination's retention policy is the agency's), and any other business data supplied to the deliverable. |
| **Agency's dataset backups** | The agency | When a CMS is used. The export file is the agency's; the canonical backup location is the agency's owned storage. |
| **Agency's local `.env` files** (development only) | The agency | The committed `.env.example` carries only variable names and non-secret placeholders. Real values live in the agency's secret manager or the agency's local ignored `.env` and never in the committed source tree. |

### 5.2 Conditional on the delivery model

These accounts are conditional on the chosen model. The implementer / operator does NOT assume ownership or management of any of these accounts under any model without an explicit commercial-agreement decision.

| Account / asset | Model A | Model B | Model C | Model D |
| --- | --- | --- | --- | --- |
| **Hosting platform account** | Agency-owned; operator has delegated role scoped to the engagement. | Agency-owned; operator has delegated role scoped to the maintenance contract. | Operator-owned for the duration of the contract; agency has read-only access to production data. Transfer at end of contract only if the agreement names it. | Agency-owned; the agency operates the site themselves. |
| **Deployment platform** | Agency-owned; operator runs deploys within the engagement. | Agency-owned; operator runs deploys within the maintenance scope. | Operator-owned; operator runs deploys. | Agency-owned; agency runs their own deploys. |
| **Secret manager** | Agency-owned; operator populates production env vars during the engagement. | Agency-owned; operator maintains env vars within the maintenance scope. | Operator-owned; agency has read-only access when the agreement names it. | Agency-owned; agency maintains their own env vars. |
| **DNS provider console** | Agency-owned; operator access scoped per the agreement. | Agency-owned; operator access scoped per the maintenance contract. | Operator-owned for the duration of the contract; agency has delegated access when the agreement names it. | Agency-owned. |
| **TLS certificate** | Agency-owned (or operator-managed on the agency's behalf per the agreement). | Agency-owned (or operator-managed within the maintenance scope). | Operator-managed for the duration of the contract; renewal cadence per the agreement. | Agency-owned. |
| **Analytics / monitoring / error-tracking accounts** | Agency-owned or none. Per the agreement. | Agency-owned or none. Per the agreement. | Operator-owned or none. Per the agreement. | Agency-owned or none. Per the agreement. |
| **CI / CD account** | Agency-owned (or operator-shared during the engagement). | Agency-owned (or operator-shared within the maintenance scope). | Operator-owned for the duration of the contract. | Agency-owned. |

### 5.3 CMS-side operator role under maintenance (when a CMS is used)

Per `docs/SANITY_OPERATIONS.md` §2.3 (and mirrored for non-Sanity CMS providers):

- **Operator's role on the CMS project.** Editor (publishing only — the right role for an operator whose scope is the Nuxt deploy + post-deploy smoke checks + rollback + incident response), or Developer (publishing + developer infrastructure — datasets, tokens, CORS, webhooks, GraphQL, deploy). The agency always retains the only-Administrator role. **Named in the maintenance contract.**
- **Operator's access boundaries.** The operator does NOT delete documents in the published dataset unless the agency owner has approved the deletion in writing. The operator does NOT change the Studio schemas unless the maintenance contract explicitly includes schema work. The operator does NOT rotate the read token unless the agency owner has approved the rotation. (See `docs/COMMERCIAL_DELIVERY.md` §9.3 — the operator-access-boundaries paragraph.)

## 6. Service tiers (operationally meaningful, not artificially disabled)

Three practical tiers. The differences are **operationally meaningful** — they reflect what the operator actually delivers, not artificially disabled product features. The product surface is unchanged across tiers; what changes is the operator's scope, the included setup work, the included initial content population scope, the included maintenance commitment, and the included support target. Each tier is differentiated primarily by **operator effort** (setup work, integration, operational support) — not by product feature gates or runtime quotas. Every tier ships a complete product; the application does not enforce tier-level caps or feature restrictions.

### 6.1 Tier 1 — Launch (one-time implementation)

**Best for.** A small or new agency that wants a branded production site, is comfortable owning its own hosting / DNS / secret-manager / backups, and does not need the operator to lead the CMS or lead-pipeline setup on day one. The lead-capture pipeline ships with the product (see `docs/REBRANDING.md` §12); under Tier 1 the sample-agency default `leads.enabled = false` keeps the placeholder form behavior, and the operator provides the runbook + env-var template so the agency can flip the flag + configure an adapter when ready.

**Includes.**

- The agency identity + brand + assets + theme + locale copies + the documented rebrand workflow (`docs/REBRANDING.md` §1–§15) for one agency tenant.
- The Client Project Bootstrap CLI run (`pnpm bootstrap:client --id=<tenant> --name="<agency name>" --hostname=<host> ...`) per `docs/ROADMAP.md` §5c.
- **Initial asset replacement scope:** the operator replaces the **22 placeholder assets** the template ships at the paths documented in `docs/REBRANDING.md` §4 with the agency's photography / logo / favicon. **The application itself does not enforce this commercial quantity** — the 22 paths are the complete set the template ships; the agency that genuinely does not need a particular path (e.g., a single-brand agency that does not need a development-cover image) ships a smaller scope without fee adjustment.
- **Initial content population scope:** the operator populates up to **5 properties + 3 agents + 2 developments + 4 home-page locations + 3 testimonials + 4 home-page stats** in the bundled static data files (per `docs/REBRANDING.md` §5) as part of the initial rebrand setup. **The application itself does not enforce this commercial quantity** — the bundled data files accept as many records as the agency publishes; the number above is the operator-side scope of the initial population included in the engagement. The bundled placeholder sample ships 6 properties / 4 agents / 4 developments / 4 locations / 3 testimonials / 4 stats per `docs/REBRANDING.md` §16.1; a small agency that genuinely has fewer records ships a smaller scope without fee adjustment. A larger agency that wants more records populated during the initial rebrand pays for additional population as a change-order (see §8.4).
- **Lead-capture pipeline shipped and available.** The product ships a real lead-capture pipeline (`POST /api/contact` + four server-only delivery adapters per `docs/REBRANDING.md` §12). The sample-agency default `leads.enabled = false` keeps the placeholder form behavior. The operator provides the runbook (`docs/REBRANDING.md` §12.2 / §12.3 / §12.3b) and the env-var template (`NUXT_LEADS_ADAPTER` + adapter-specific fields) so the agency can flip the flag and configure an adapter when ready. The operator does not flip the flag or configure the adapter under Tier 1 — that is the agency's own work, supported by the operator's documentation.
- Locale copies reviewed in `i18n/locales/en.json` and `i18n/locales/es.json`.
- `NUXT_PUBLIC_SITE_URL` configured on the deployment's secret manager.
- A static (`pnpm generate`) or Node/Nitro (`pnpm build`) deployment chosen by the agency per `docs/DEPLOYMENT.md` §5.
- The 14-day acceptance window per `docs/COMMERCIAL_DELIVERY.md` §7.2.
- A signed handoff record per `docs/COMMERCIAL_DELIVERY.md` §8 + `docs/CLIENT_ONBOARDING.md` §4.
- One hour of post-handoff Q&A (a single session, scheduled within 30 days of handoff).

**Does NOT include.** Operator-led CMS configuration or integration. The product supports CMS data sources (`api` / `cms` per the per-feature `NUXT_<FEATURE>_DATA_SOURCE` env vars, with the `static` adapter as the bundled default); the operator's CMS scope under Tier 1 is the documentation only — the agency (or a future Tier 2 / Tier 3 engagement) wires the CMS later. Operator-led lead-pipeline configuration, destination integration, or operational support. The pipeline itself is shipped; the operator's role for lead capture under Tier 1 is the runbook + env-var template only. A maintenance contract (a separate line item — see Tier 2's included 90-day add-on or Tier 3's bundled retainer). Multi-tenant deployment support (Tier 1 is single-tenant by design). Custom theme / page / module development beyond the documented rebrand workflow.

**Handoff posture.** Agency owns every account; operator's delegated role is dropped per `docs/COMMERCIAL_DELIVERY.md` §8.1 / §10.1. The agency's IT (or a freelance contractor) takes over operations.

### 6.2 Tier 2 — Growth (one-time implementation + optional 90-day maintenance)

**Best for.** A small / mid-sized agency that wants the operator to lead the lead-pipeline setup (adapter selection + env-var configuration + smoke check) and the CMS integration (provider choice + Studio deploy + initial dataset migration), and a 90-day window of post-launch operator support with a non-aggressive best-effort support target.

**Includes everything in Tier 1, plus:**

- **Operator-led lead-pipeline enablement.** The operator flips `agency.leads.enabled = true` in the agency config, configures one of the four documented adapters (`disabled` / `log` / `webhook` / `email`) per the agency's choice, and populates the matching `NUXT_LEADS_*` env vars on the deployment's secret manager per `docs/DEPLOYMENT.md` §4.3 and `docs/REBRANDING.md` §12. The operator also runs the lead-pipeline smoke check end-to-end (`curl -X POST https://<host>/api/contact ...` per `docs/DEPLOYMENT.md` §10.3) to confirm the destination receives the stamped lead.
- A CMS configured for one or more features (`properties` / `agents` / `developments`) per the agency's choice:
  - **Sanity.** The Studio deployed to `<projectId>.sanity.studio`; the property / agent / development schemas committed; the agency's Administrator access named; the four shared `NUXT_SANITY_*` env vars + the per-feature `NUXT_<FEATURE>_CMS_PROVIDER=sanity` + `NUXT_<FEATURE>_DATA_SOURCE=cms` env vars populated. Per `docs/SANITY_OPERATIONS.md` §2 and `docs/SANITY_VALIDATION.md`.
  - **Generic HTTP/JSON CMS driver.** The agency-supplied JSON endpoint validated against the per-feature Zod boundary schema; the per-feature `NUXT_<FEATURE>_CMS_URL` env vars populated. Per `docs/CLIENT_ONBOARDING.md` §2.1 (CMS subsection).
- **Initial content population scope (broader):** up to **6 properties + 4 agents + 3 developments** populated by the operator during the initial migration (vs. 5 + 3 + 2 in Tier 1). The home-page content stays at the Tier 1 scope (4 locations + 3 testimonials + 4 stats respectively) unless the agreement names otherwise. **The application itself does not enforce this commercial quantity** — the bundled data files accept as many records as the agency publishes; the number above is the operator-side scope of the initial migration included in the engagement. Additional records during the initial rebrand are a change-order (see §8.4).
- Per-locale copy review against the agency's real estate copy (the agency-supplied copy is checked for completeness, consistency, and brand voice; placeholder strings are flagged).
- A 30-day acceptance window (vs. 14-day in Tier 1) per `docs/COMMERCIAL_DELIVERY.md` §7.2.
- A **90-day maintenance add-on included** (see §7 below): Nuxt deploy, Studio deploy (when Sanity is the CMS), Sanity-side env-var maintenance, content-pipeline validation, post-publish smoke checks per `docs/SANITY_OPERATIONS.md` §5, a **non-aggressive best-effort support target** appropriate to the engagement type (the maintenance contract may name a more specific cadence but does not need to commit to a contractual SLA for the 90-day window), a monthly summary. The contract may upgrade to a contractual SLA at any point during or after the 90-day window.

**Does NOT include.** Operator-owned hosting / DNS / secret-manager (the agency owns every account; the operator has delegated role for the maintenance scope). Contractual SLA — Tier 2's included 90-day add-on ships a non-binding best-effort support target, not a contractual SLA. (Tier 3 is the tier where contractual SLAs are typically named; see §6.3.) Schema work beyond the three shipped document types (Property / Agent / Development). Hotspot / crop-aware URL building (a future v1.x task per `docs/ROADMAP.md` §5b #8). Custom content types beyond Property / Agent / Development. Multi-tenant support (Tier 2 is single-tenant).

**Handoff posture.** Agency owns every account at handoff. The 90-day maintenance add-on begins at handoff signature and ends 90 days later; renewal is a separate commercial-agreement decision. The end-of-maintenance posture is the standard Model A exit (operator's delegated role dropped per `docs/COMMERCIAL_DELIVERY.md` §10.1).

### 6.3 Tier 3 — Scale (managed-service)

**Best for.** A mid / large agency, or a Tier 1 / Tier 2 agency whose growth trajectory has outgrown internal IT capacity, that wants the operator to own day-to-day operations on a recurring retainer with a named SLA.

**Includes everything in Tier 2, plus:**

- The **operator-managed service model** for the duration of the contract: the operator owns (or delegates) the hosting account, the deployment platform, the secret manager, the DNS console, the TLS certificate, and the analytics / monitoring / error-tracking accounts, for the contract's duration. The agency retains the only-Administrator role on the CMS organisation and the only-registrar-admin role on the domain registration.
- A **quarterly business review**: deploys shipped, smoke-check results, incidents + resolutions, content-pipeline uptime, recommended follow-ups (see `docs/SANITY_OPERATIONS.md` §4.6 for the template).
- **Contractual SLA per the maintenance agreement** (see §7 below). Tier 3 is the explicitly priced managed-service tier where aggressive response commitments are typically named. The maintenance agreement records the actual first-response cadence, the status-update cadence, the resolution time, and the escalation path — these are **commercial-agreement decisions**, not template defaults. The agreement may name the kind of tight commitment that is inappropriate as a non-contractual target (e.g., sub-hour first response for production incidents), with the corresponding fee structure supporting the commitment. **This document does not assert a default contractual SLA for any tier** — including Tier 3.
- **4 hours / month of small content / config changes** included (e.g., update a property record, swap a hero image, change a footer link, rotate a webhook secret). Additional hours are billed at the agreed per-hour rate.
- **Distributed-rate-limiter readiness.** Tier 3 deploys include the production-grade multi-process rate limiter (`docs/ROADMAP.md` §5b #6) when / if the operator-managed infrastructure supports it. (Currently the lead-capture rate limit is per-process; the upgrade is a future v1.x task. Tier 3 engagements are the natural place to deploy it first.)
- **Multi-tenant support** when the agency hosts more than one agency brand behind a single build (`docs/MULTI_TENANT.md`).
- **Schema work** within the three shipped document types (Property / Agent / Development) — adding a new field, adding a new enum value, adding a validation rule. Schema work beyond the three shipped types (e.g., SiteSettings, Page, Category, Testimonial per `docs/ROADMAP.md` §5b #9) is a custom-development line item.

**Does NOT include.** Schema work beyond the three shipped document types (without a custom-development line item). The hotspot / crop-aware URL building (a future v1.x task) without a custom-development line item. A map picker for the `coordinates` field (a future v1.x task per `docs/ROADMAP.md` §5b #10) without a custom-development line item. Source-code transfer (Tier 3 is operator-owned source code; the agency owns its content + its CMS organisation + its domain). End-of-contract infrastructure transfer (only when the agreement names it).

**Handoff posture.** At end of contract the operator-held accounts transfer to the agency **only when the commercial agreement names it**; otherwise the operator retains the accounts and the agency receives the agreed service-level exit (a documented migration path, a final data export, a transition period). The agency's CMS organisation, project, dataset, and business data always remain agency-owned. Per `docs/COMMERCIAL_DELIVERY.md` §10.3 (the operator-managed service branch).

### 6.4 What does NOT change between tiers

The product surface is unchanged across tiers. The v1.3 product ships the same capabilities to every tier — what changes is the **operator's scope, the included setup work for the CMS / lead pipeline, the initial content population scope, the included maintenance commitment, and the included support target**. The implementer / operator does not artificially disable a Tier 2 or Tier 3 feature in Tier 1; the agency that picks Tier 1 simply does not buy the operator's CMS setup work, the operator's lead-pipeline configuration, or the operator's maintenance retainer.

**Concretely:**

- **The catalog accepts as many records as the data source provides.** The product does not enforce tier-level record quotas, content caps, or feature gates. The numbers in §6.1 / §6.2 are the operator-side scope of the initial content population included in the engagement — not application-level limits.
- **The lead-capture pipeline is functional regardless of tier.** Every tier ships the `POST /api/contact` endpoint and the four delivery adapters. The difference between tiers is whether the **operator** flips the flag and configures an adapter (Tier 2 / Tier 3) or whether the agency does it themselves with the operator's runbook (Tier 1).
- **The CMS data sources are configurable regardless of tier.** The `api` / `cms` data sources work for any tenant; the difference between tiers is whether the **operator** wires the provider, deploys the Studio, and migrates the dataset (Tier 2 / Tier 3) or whether the agency / a future engagement does it.

This is the operationally meaningful distinction — every tier ships a working, complete product with no artificial product restrictions. The differences are in the operator's scope and the included services, not in the product's capabilities.

### 6.5 Tiers vs. delivery models

The tiers map to the delivery models as follows:

| Tier | Primary model | Optional add-on |
| --- | --- | --- |
| **Tier 1 — Launch** | Model A (one-time implementation + optional maintenance) | Model B (the maintenance contract is a separate line item). |
| **Tier 2 — Growth** | Model A (one-time implementation) | Model B (the 90-day maintenance add-on included). |
| **Tier 3 — Scale** | Model B (managed-service retainer; can transition to Model C at renewal) | Model D (source-code escrow; named in the agreement). |

A real engagement may combine any tier with any commercial-agreement variations (mirror / escrow, custom-developed features, multi-tenant registry, etc.). The commercial agreement records the combination.

## 7. Maintenance plan scope

### 7.1 What a maintenance plan may reasonably include

The maintenance plan is **optional** under Model A and **bundled** under Models B and C. The plan's scope, fee, and any contractual SLA are **commercial-agreement decisions**; this section names the practical baseline of operator work that a maintenance plan may reasonably include, plus the boundaries a maintenance plan does NOT cross without a separate scope line. The exact support target vs. contractual SLA distinction is documented in §7.3.

- **Nuxt deploy.** The operator maintains the env vars, the build, the smoke checks, and the rollback on the deployment side per `docs/COMMERCIAL_DELIVERY.md` §9.2 and `docs/SANITY_OPERATIONS.md` §4.1. **Client-owned deployment model:** the operator has delegated access on the agency's deploy account. **Operator-managed service model:** the operator has its own role on its own deploy account.
- **Studio deploy** (when Sanity is the CMS). The operator redeploys the Studio at `<projectId>.sanity.studio` with `cd studio && pnpm deploy` per `docs/SANITY_OPERATIONS.md` §4.2.
- **Sanity-side env vars** (when Sanity is the CMS). The operator maintains `NUXT_SANITY_PROJECT_ID`, `NUXT_SANITY_DATASET`, `NUXT_SANITY_API_VERSION`, optional `NUXT_SANITY_TOKEN`, and the per-feature `NUXT_<FEATURE>_CMS_PROVIDER` + `NUXT_<FEATURE>_DATA_SOURCE` on the deployment's secret manager per `docs/COMMERCIAL_DELIVERY.md` §9.2.
- **Content pipeline validation.** The operator runs the validation procedure (`docs/SANITY_VALIDATION.md` for Sanity; the `curl` smoke check for the generic HTTP/JSON driver) on published changes per `docs/SANITY_OPERATIONS.md` §5.
- **Post-deploy smoke checks.** The operator runs the safe-route smoke checks documented in `docs/DEPLOYMENT.md` §10 after every deploy.
- **Dependency updates.** The operator runs `pnpm install --frozen-lockfile` on every deploy and keeps the dependency tree current within the cadence the agreement names (recommended baseline: monthly, or on a security advisory).
- **Security patches.** The operator responds to security advisories on the dependency tree (Nuxt, Vue, the runtime env, the CMS SDK, the lead-delivery SDK) on the cadence the agreement names (recommended baseline: within 7 days for an advisory with a published patch; within 24 hours for an actively-exploited CVE).
- **Uptime monitoring.** The operator wires an external monitor (UptimeRobot, Better Uptime, the platform's native check) to the safe GET routes `/` and `/sitemap.xml`, per `docs/CLIENT_ONBOARDING.md` §2.3 and `docs/COMMERCIAL_DELIVERY.md` §3.10. The monitor target is the operator's choice; the monitor account ownership is per §5 above.
- **Error tracking.** The operator wires Sentry / GlitchTip / similar (or the platform's native error capture) to the Nuxt server output. The `log` lead-delivery adapter writes one `console.info` line per lead; the `webhook` / `email` adapters write `console.warn` / `console.error` on adapter failures. These are the structured-logging hooks an error tracker consumes most cheaply.
- **Analytics / SEO / monitoring posture.** The operator populates the agency's chosen analytics provider (Plausible / Google Analytics / Fathom / Matomo), the agency's chosen SEO posture (the template ships a complete default — sitemap, robots, canonical, JSON-LD), and the agency's chosen monitoring posture, per the agreement. None of these ship by default; every one is an operator add-on, per `docs/COMMERCIAL_DELIVERY.md` §3.10.
- **Limited monthly change allowance.** Tier 3 includes 4 hours / month of small content / config changes (e.g., update a property record, swap a hero image, change a footer link, rotate a webhook secret) as part of the contracted managed-service scope. Tier 2's included 90-day maintenance add-on does not include a monthly change allowance; every change is a separate change-order per the agreement. Tier 1 does not include maintenance by default. The change-allowance hours and the overage rate are **commercial-agreement decisions**, recorded in the maintenance contract.
- **Backups / operational checks.** The operator runs the recommended dataset-export cadence (`cd studio && pnpm exec sanity datasets export production ./backups/production-<YYYY-MM-DD>.tar.gz`) per `docs/SANITY_OPERATIONS.md` §6.2 and stores the export on the agency's owned storage. The cadence is per the maintenance contract (recommended baseline: weekly for active CMS projects; monthly for low-velocity projects).
- **Incident response.** The operator responds to incidents on the Nuxt / deploy side (env-var fixes, rollback, deploy fix, dataset restore, IPX / `sharp` Windows fix) per `docs/SANITY_OPERATIONS.md` §7. The agency owner responds on the Sanity content side.
- **Operational reporting.** The operator reports a monthly / quarterly summary to the agency per `docs/SANITY_OPERATIONS.md` §4.6 (deploys shipped, smoke-check results, incidents + resolutions, content-pipeline uptime, recommended follow-ups).
- **Deployment support.** The operator runs the deploy on demand (within the cadence the maintenance contract names — recommended baseline: deploy requests within 1 business day for a non-emergency change; within 4 hours for a hot fix).
- **CMS support.** The operator answers agency-side questions about the Studio, the published-dataset smoke check, the post-publish workflow, the dataset export / import cadence, and the per-feature Zod schema's field-level rules. The operator does NOT edit content on the agency's behalf (content is the agency's) unless the change falls within the limited monthly change allowance.

### 7.2 What a maintenance plan does NOT include (without a separate commercial-agreement line)

- **Schema work beyond the three shipped document types** (Property / Agent / Development). Adding SiteSettings, Page, Category, Testimonial, or any other document type is a custom-development line item.
- **Generic application code changes** (components, pages, layouts, composables, services, stores, runtime config). A new feature, a new module, a new page, or a new route is a custom-development line item.
- **Theme expansion.** A new theme, a new color palette beyond the documented brand guide, a new font stack, a new logo placement, or a new layout is a custom-development line item.
- **Multi-tenant deployment support** beyond what Tier 3 explicitly includes. Multi-tenant is a real undertaking (per-tenant registry, per-tenant env vars, per-tenant deploy hooks) and is named in the engagement scope.
- **Hotspot / crop-aware URL building** (a future v1.x task per `docs/ROADMAP.md` §5b #8) without a custom-development line item.
- **Map picker for the `coordinates` field** (a future v1.x task per `docs/ROADMAP.md` §5b #10) without a custom-development line item.
- **Auth-token support in the generic HTTP/JSON CMS driver** (a future v1.x task per `docs/ROADMAP.md` §5b #12) without a custom-development line item.
- **Distributed rate limiter** (a future v1.x task per `docs/ROADMAP.md` §5b #6) — Tier 3 deploys include it when / if the operator-managed infrastructure supports it; otherwise it is a custom-development line item.
- **CMS provider-specific drivers for Contentful / Strapi** (a future v1.x task per `docs/ROADMAP.md` §5b #13) without a custom-development line item.

These are explicitly **commercial-agreement decisions**, not maintenance scope. A maintenance plan that wants to cover them names them as a separate scope item with its own pricing and acceptance window.

### 7.3 Support targets vs. contractual SLAs (two different things)

A **support target** is a non-binding operational cadence the operator aims for. A **contractual SLA** is a binding commitment the maintenance agreement names, with the corresponding fee structure supporting the commitment. The two are different; conflating them is the most common commercial-doc mistake on this surface.

**Default for any non-managed-service support scope (e.g., the Tier 2 90-day add-on, a per-incident retainer):** the operator aims for a **non-aggressive best-effort support target** — a same-business-day or next-business-day response for non-emergency items, and a same-day response for confirmed production incidents. This is a **support target**, not a contractual SLA. The agreement may name a more specific cadence.

**Default for an explicitly priced managed-service tier (Tier 3):** the maintenance agreement names the contractual SLA. **No tier ships a default contractual SLA**, and this document does not assert one — the cadence is always a commercial-agreement decision. Aggressive response commitments (sub-hour first response for production incidents, hourly status until resolution, named escalation paths, named resolution times) are appropriate as **contractual SLAs** on an explicitly priced managed-service tier — the fee structure supports the commitment. (Typical examples named in real agreements include "first response within 30 minutes for a confirmed production incident" or "hourly status updates until resolution" — these are examples of contractual SLAs an agreement may name, not template defaults.)

**Context for both:** the canonical incident-communication cadences documented in `docs/COMMERCIAL_DELIVERY.md` §9.4 and `docs/SANITY_OPERATIONS.md` §7.1 are **recommended baselines** for an unspecified maintenance agreement; they are not template defaults.

**Change-order cadence (separate from incident response):** the agreement names the change-order process. A recommended baseline is 5 business days for a non-emergency change; 24 hours for a hot fix; same-day for a production incident confirmed by both sides. The agreement may name a different cadence.

**What the agreement always names:** the first-response cadence, the status-update cadence, the resolution time, the escalation path, the change-order cadence, and the change-allowance — all **commercial-agreement decisions**, not template defaults. The agreement may upgrade a non-managed-service support target to a contractual SLA at any renewal, or add an explicit managed-service tier mid-engagement, per the change-order process.

## 8. Cost breakdown (what's billed where)

The implementer / operator separates four cost categories so the agency can budget each independently. This document does not name prices — they are commercial-agreement decisions. The categories are:

### 8.1 Implementation fee (billed to the agency)

Billed at engagement signature per the agreement's payment milestones. Typical milestones: at signature, at the production-readiness gate (per `docs/REBRANDING.md` §16.1), at client acceptance (per `docs/COMMERCIAL_DELIVERY.md` §7), and at handoff signature. The fee covers the Tier 1 / Tier 2 / Tier 3 scope; named in the commercial agreement.

### 8.2 Recurring maintenance / managed-service fee (billed to the agency)

Billed monthly / quarterly per the maintenance contract. Covers the §7 maintenance scope. Model A engagements include the recurring fee only if the agency buys the optional maintenance add-on. Model B / Model C engagements include the recurring fee as part of the engagement.

### 8.3 Direct third-party costs (agency pays providers directly; NOT on the operator's invoice)

The agency pays these directly to the third party. The operator does not mark these up. The agency owns the relationship and the billing.

| Category | Typical providers | Typical cost drivers |
| --- | --- | --- |
| **Domain registration** | The agency's chosen registrar | Annual renewal; varies by TLD. |
| **Hosting platform** | Vercel, Netlify, Cloudflare, AWS, a bare Node server | The platform's billing cycle; the agency's traffic + build-minutes tier. |
| **TLS certificate** | Let's Encrypt (free, auto-renewed), the platform's managed cert, or the agency's existing cert | Free for Let's Encrypt; varies for paid CAs. |
| **CMS provider** | Sanity (Free / Growth / Enterprise), Contentful, Strapi, a hostable CMS, or the agency's own CMS | Sanity's monthly / annual invoice; varies by plan + dataset size. |
| **SMTP provider** (when the `email` lead adapter is selected) | The agency's email provider | Sending volume; varies by provider. |
| **Analytics provider** (when analytics is in scope) | Plausible, Google Analytics, Fathom, Matomo | The provider's billing model. |
| **Monitoring provider** (when monitoring is in scope) | UptimeRobot, Better Uptime, the platform's native check | The provider's billing model. |
| **Error tracking** (when error tracking is in scope) | Sentry, GlitchTip, the platform's native error capture | The provider's billing model. |
| **Code escrow** (when the agreement names an escrow agent) | A third-party code-escrow service | Annual escrow fee; named in the agreement. |

The implementer / operator does not include any of these in the implementation fee or the recurring maintenance fee. They are direct third-party costs the agency pays the providers directly.

### 8.4 Optional custom development (change-order or new project, per the agreement)

Billed per change-order or per new project scope. Covers any work beyond the Tier 1 / Tier 2 / Tier 3 scope, the §7 maintenance scope, and the documented rebrand workflow.

Typical custom-development line items:

- A new feature, a new module, a new page, a new route, or a new schema document type.
- A new theme, a new color palette, a new font stack, a new logo placement, or a new layout.
- An integration with a third-party system the template does not already integrate (a CRM, a transaction-management platform, an analytics platform beyond the documented `var(--color-*)` token system).
- A multi-tenant deployment for an agency that hosts multiple brands behind one build.
- A future v1.x capability that the agency wants before the template ships it (the hotspot / crop wiring, the map picker, the auth-token support in the generic HTTP/JSON driver, the distributed rate limiter, a provider-specific CMS driver).

Per `docs/COMMERCIAL_DELIVERY.md` §7.2: scope changes inside the acceptance window are no additional cost; scope changes outside the window are change-orders per the agreement.

## 9. Items intentionally left to the commercial agreement

The following are **commercial-agreement decisions**, not technical decisions, and are not decided by this document. They are recorded here to make the implementer / operator and the agency aware that they exist. Per `docs/COMMERCIAL_DELIVERY.md` §11 (which this document preserves verbatim), the implementer / operator does NOT decide any of these unilaterally.

### 9.1 Engagement-level commercial-agreement decisions

- **Pricing model.** Fixed-fee project, time-and-materials, milestone-based, retainer, or another structure.
- **License model.** The license the implementer / operator grants the agency for the rebranded codebase (the implementer's default license, a custom license, an open-source license, or a transfer-of-ownership clause).
- **Payment milestones.** The trigger, the amount, the invoicing cadence, the net-X terms, the late-payment handling.
- **Source-code ownership.** Whether the agency owns the rebranded source-code repository after handoff.
- **Source-code license.** The license text the operator grants the agency.
- **Repository hosting location.** Agency Git host / operator Git host / third-party host / one-time archive.
- **Repository access level.** Read-only / read + write / admin.
- **Source-code transfer timing.** At handoff / at end of contract / scheduled / on demand.
- **Source-code transfer mechanism.** Ownership transfer / license grant / open-source release / archive delivery / not at all.
- **Mirror / escrow arrangement.** Whether a third-party mirror / escrow agent holds a copy of the source-code repository; the release conditions; the release events; the escrow fees.
- **End-of-contract infrastructure transfer posture.** When the operator-managed service model is in effect, whether the operator-held accounts transfer to the agency at end of contract, and on what cadence.
- **Acceptance window.** The number of business days the agency has to sign off after the production sign-off.
- **Change-order process.** The process for scope changes inside and outside the acceptance window.
- **Termination clause.** The notice period and the obligations of both parties at termination.

### 9.2 Maintenance-level decisions (recorded in the maintenance contract)

- **Maintenance fee.** The recurring fee for the optional maintenance contract.
- **Maintenance scope.** What's in scope and what's out of scope for the recurring fee (per §7 above).
- **Operator's role on the CMS during maintenance.** Editor / Developer / other role appropriate to the maintenance scope. The agency retains the only-Administrator role regardless.
- **Operator's source-code repository role.** Read-only / read + write / admin; the renewal cadence; the end-of-contract posture.
- **SLA.** A contractual response-time commitment the maintenance agreement names. **No tier ships a default contractual SLA** — a contractual SLA only exists when an explicitly priced managed-service contract names one. The support-target vs. contractual-SLA distinction is documented in §7.3. The recommended baselines in `docs/COMMERCIAL_DELIVERY.md` §9.4 / `docs/SANITY_OPERATIONS.md` §7.1 are starting points for a typical managed-service agreement, not template defaults.
- **Change-allowance.** The hours / month of small content / config changes included in the recurring fee.
- **Dataset export cadence.** The recommended baseline is weekly for active CMS projects; the agreement names the actual cadence.

### 9.3 Items outside this document's scope (named but not decided)

The following are explicitly **not** decided by this document. They are recorded here so the implementer / operator and the agency know to address them in the agreement or in qualified counsel.

- **Liability cap, indemnification, warranty disclaimers.** Per the agreement; jurisdiction-specific.
- **Data-processing addendum (DPA).** Required in some jurisdictions for engagements that process personal data; the agreement names whether a DPA is in scope.
- **Privacy / cookie compliance.** The template ships no analytics, no marketing pixels, no cookies beyond the color-mode preference (per `docs/COMMERCIAL_DELIVERY.md` §3.10). Any jurisdiction-specific cookie banner, consent-management platform, or privacy policy is a separate engagement.
- **Insurance requirements.** Per the agreement; jurisdiction-specific.
- **Governing law and jurisdiction.** Per the agreement.
- **Force majeure, dispute resolution, and arbitration procedure.** Per the agreement.
- **Tax treatment (VAT, GST, sales tax).** Per the agreement; jurisdiction-specific.

The implementer / operator does not draft any of these clauses. The agreement and (where required) qualified counsel draft them.

## 10. A practical engagement shape (worked example)

The following example shows how a real engagement combines the surfaces described above. The example is illustrative — every clause below is a commercial-agreement decision in a real engagement.

- **Tier.** Tier 2 — Growth.
- **Model.** Model A (one-time implementation) + the 90-day maintenance add-on (Model B scope).
- **Hosting.** Agency-owned (Vercel).
- **CMS.** Sanity (Growth plan); per-feature `cms` for `properties` / `agents` / `developments`.
- **Lead pipeline.** `webhook` adapter; the agency-owned endpoint verifies the `X-Lead-Signature` header.
- **Acceptance window.** 30 days.
- **Maintenance fee.** Monthly recurring for 90 days, then month-to-month renewal.
- **Source-code ownership.** Agency-owned; repository hosted on the agency's GitHub organisation; access level = admin; transfer at handoff.
- **Source-code escrow.** None (per the agreement).
- **End-of-contract posture.** Model A end (operator's delegated roles dropped; agency already owns the accounts).
- **Third-party costs paid by the agency.** Vercel, Sanity, the webhook endpoint's compute, the domain renewal, the SMTP provider (when the agency later switches the lead adapter to `email`).
- **Custom development.** None in this example.

The commercial agreement records every line above. The handoff record references the agreement and does not duplicate it. The implementer / operator's role at handoff is the standard Model A role (delegated roles dropped; agency owns every account).

## 11. References

- `docs/COMMERCIAL_DELIVERY.md` — the workflow at a glance (§1); pre-project requirements (§2); content collection (§3); implementation (§4); CMS setup (§5); deployment (§6); acceptance (§7); handoff (§8); maintenance (§9); end-of-contract (§10); commercial-agreement decisions (§11).
- `docs/CLIENT_ONBOARDING.md` — agency-side information collection (§2.1, §2.2, §2.3); implementation sequence (§3); handoff table (§4); env-var template (§5); first-client rebrand dry-run (§6).
- `docs/REBRANDING.md` — the rebrand workflow (§1–§15); lead-capture pipeline (§12); production-readiness checklist (§16).
- `docs/DEPLOYMENT.md` — the deployment flow (§3–§11); the env-var lifecycle (§4); the static vs Node/Nitro capability matrix (§5); the post-deploy smoke checks (§10); the rollback procedure (§11).
- `docs/SANITY_OPERATIONS.md` — the Sanity CMS operations guide; cardinal rules (§1); one-time setup (§2); operator / maintenance workflow (§4); smoke validation after content changes (§5); export / backup expectations (§6); incident / recovery actions (§7); end-of-contract handoff (§8).
- `docs/MULTI_TENANT.md` — per-tenant hostname dispatch; per-tenant canonical URL; per-tenant lead delivery; unknown-host fallback.
- `docs/ROADMAP.md` §5c — Client Project Bootstrap (Phase A shipped); §5b — v1.3 backlog; §5 — upcoming tasks.
- `scripts/bootstrap-client.mjs` — the Client Project Bootstrap CLI; the entry point every Tier 1 / Tier 2 engagement uses.
- `docs/RELEASE_NOTES_v1.0.md`, `docs/RELEASE_NOTES_v1.1.md`, `docs/RELEASE_NOTES_v1.2.md` — the per-version release notes.
