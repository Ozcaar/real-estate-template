# CMS Provider Evaluation

This document evaluates Sanity, Contentful, and Strapi as the first production CMS provider for the real-estate template. It is the basis for the v1.2 pilot decision. The evaluation does not implement any provider; the recommendation is followed by a future task that adds the provider-specific driver behind the existing `CmsDriver<T>` abstraction.

The current state of the data-source machinery is documented in `docs/DATA_MODELS.md` and `app/core/data-source/cms-driver.ts`. The summary that drives this evaluation:

- The contract is `CmsDriver<T>` with one method: `dispatch(): Promise<readonly T[]>`. The adapter (`createCmsDataSource<T>`) validates the dispatch result against the boundary Zod schema (`propertyListSchema`, `agentListSchema`, `developmentListSchema`) and memoises the array.
- The first concrete driver is `createHttpJsonCmsDriver<T>` — a thin transport that fetches a JSON array from a configured endpoint. It does not expose authentication configuration today.
- The current loaders wire the cms kind into `server/utils/properties.ts`, `server/utils/agents.ts`, and `server/utils/developments.ts` via `NUXT_*_DATA_SOURCE=cms` + `NUXT_*_CMS_URL`. The provider-specific driver slot is the only thing missing.

## 1. Evaluation criteria

The evaluation is structured against the criteria the implementer will weigh at the first-client onboarding. Each criterion maps to a real workflow already documented in `docs/CLIENT_ONBOARDING.md`.

| # | Criterion | Source |
| --- | --- | --- |
| 1 | One client = one agency = one isolated CMS project / workspace | `docs/CLIENT_ONBOARDING.md` §2.1 and §4.7 |
| 2 | Client editor / admin access | `docs/CLIENT_ONBOARDING.md` §2.1 |
| 3 | Project ownership and handoff | `docs/CLIENT_ONBOARDING.md` §4.7 |
| 4 | Properties, agents, developments, future site-content models | `docs/DATA_MODELS.md` §2–§4 |
| 5 | Document references / relationships | Property → Agent, Property → Development |
| 6 | Image / media management | 22 placeholder assets + per-record galleries |
| 7 | Draft / publish workflow | `docs/CLIENT_ONBOARDING.md` §2.1 ("production vs preview / draft") |
| 8 | Role / permission support | `docs/CLIENT_ONBOARDING.md` §2.1 (admin / editor / developer split) |
| 9 | API ergonomics for Nuxt / Nitro | `app/core/data-source/cms-driver.ts`, `server/utils/*.ts` |
| 10 | Server-side authentication options | `docs/CLIENT_ONBOARDING.md` §2.1 ("the current generic HTTP/JSON driver does not expose an authentication-token configuration") |
| 11 | Ease of mapping provider documents into the existing Zod models | `propertyListSchema`, `agentListSchema`, `developmentListSchema` |
| 12 | Operational complexity | `docs/DEPLOYMENT.md` §5 (recommended Node / Nitro for first client) |
| 13 | Expected cost model for small agencies | First-client guidance in `docs/CLIENT_ONBOARDING.md` |
| 14 | Vendor lock-in and migration difficulty | Long-term ownership model in `docs/CLIENT_ONBOARDING.md` §4.7 |

The comparison below uses the implementer's first-hand knowledge of all three providers as cloud-hosted headless CMS platforms, with explicit notes on what the implementer must verify with the agency before signing the engagement contract. **Pricing tiers and seat / role limits below are the current plans at the time of writing; the operator must verify the current pricing at engagement time because vendor plans change.**

## 2. Comparison matrix

| Criterion | Sanity | Contentful | Strapi |
| --- | --- | --- | --- |
| 1. Project isolation per client | One Sanity project per agency. Project-level IAM. Multi-project within a single Sanity organisation is supported but the implementer creates one project per engagement. | One Contentful space per agency. Organisation-level IAM. Spaces are isolated by design. | Self-hosted: one Strapi instance per project (the canonical isolation). Strapi Cloud: one project per workspace. |
| 2. Editor / admin access | Two built-in roles on the Free plan: **Administrator** and **Viewer**. Three additional built-in roles (Editor, Developer, Contributor) require the **Growth** plan or above. Custom roles require Enterprise. Studio at `<project>.sanity.studio`. | Granular roles: Administrator, Editor, Author. Custom roles via the Roles API. Studio at `app.contentful.com`. The Free plan is intended for learning / testing and is **not** permitted for commercial use. | Built-in admin panel with default roles (Super Admin, Editor, Author) on the Community Edition. Custom roles and granular conditions are available on the Community Edition via the Users-Permissions plugin; field-level permissions, condition builders, and audit logs are Enterprise-only. |
| 3. Project ownership and handoff | Project can be transferred to another Sanity organisation. The agency owns the project; the implementer holds a member role during the build and transfers it. | Spaces can be transferred between organisations. The agency owns the space. | Self-hosted: the agency owns the server. Strapi Cloud: the project transfers with the workspace. |
| 4. Properties / agents / developments / future site-content models | Custom schemas via Sanity Studio (TypeScript or schema.json). Nested documents, deep references, and reusable objects are first-class. | Custom content types via the Studio. Nested fields and references are supported but the schema definition is heavier than Sanity's. | Custom content types via the Studio or via schema files. Plugins exist for dynamic zones (the Strapi equivalent of reusable blocks). |
| 5. Document references / relationships | `reference` field type. GROQ queries with projections resolve references in a single round trip. Cross-references (e.g. Property → Agent and Property → Development) are natural. | `Link` field type. The Delivery API returns references as links; the client must issue a follow-up query with `include` to dereference. | `relation` field type. The REST API requires `populate` to dereference; the GraphQL plugin returns the resolved shape in one query. |
| 6. Image / media management | First-class image pipeline. Image asset URLs are available directly via the GROQ projection on the asset reference. The `image-url` builder (`@sanity/image-url`) is a **separate package** from `@sanity/client` and provides hotspot / crop-aware URL building with auto-format, auto-quality, and lazy `srcset`. Built-in CDN. | Images API with format / quality params and focal-point controls. Built-in CDN. Asset management UI. | Provider-based uploads (local, S3, Cloudinary, etc.). Image transforms via the provider's plugin or the built-in `strapi-plugin-sharp`. |
| 7. Draft / publish workflow | Built-in drafts. The published dataset is the default; the `previewDrafts` perspective exposes drafts. Scheduled publishing is supported. | Built-in drafts. The Delivery API returns the published dataset; the Preview API returns drafts. Scheduled publishing is supported on the Team plan and up. | Built-in drafts and publish. Drafts are exposed via `?_publicationState=preview` or the GraphQL `@strapi` filter. |
| 8. Role / permission support | Two built-in roles on Free (Administrator, Viewer); five built-in roles on Growth (adds Editor, Developer, Contributor). Custom roles require Enterprise. | Roles + permissions editor. Field-level permissions are available. | Community RBAC covers the default roles (Super Admin, Editor, Author) plus custom roles via the Users-Permissions plugin on the Community Edition. Granular field-level permissions, condition builders, and audit logs are Enterprise-only. |
| 9. API ergonomics for Nuxt / Nitro | `@sanity/client` is the official Node.js client. GROQ projection queries map cleanly to the boundary Zod schema. The client is dependency-light. The image-url builder is a separate package. | `contentful` (CDA) is the official Node.js client. REST + GraphQL endpoints. Field ID conventions (`fields.<name>`) require a small mapping step. | REST + GraphQL endpoints. The REST response shape is verbose; the GraphQL plugin returns the desired shape in one query. |
| 10. Server-side authentication | Read tokens (scoped to dataset + perspective) and project tokens. The read token is suitable for `runtimeConfig` because it is scoped to the published dataset. The driver is constructed server-only; the token never leaves the server bundle. | CDA token (read), CPA token (preview), CMA token (admin). The CDA token is the published-dataset token. | API tokens with configurable permissions per role. The Content API token is the published-dataset token. |
| 11. Mapping provider documents into the boundary Zod schema | GROQ projection → `Property` is a one-pass transformation. The schema's optional fields map cleanly to GROQ's null-coalescing. | The Delivery API returns `sys` + `fields` envelope. The mapping step unwraps `fields` and normalises the four locale variants to a single `PropertyLocale` record. | REST field names are kebab-case by default; the mapping step normalises to camelCase. The `id` → `slug` translation is a single function. |
| 12. Operational complexity | Hosted Studio. No database to manage. Near-zero ops. | Hosted Studio. No database to manage. Near-zero ops. | Self-hosted: PostgreSQL / SQLite / MySQL + the Node service + reverse proxy + backups. Strapi Cloud: hosted, similar to Contentful. |
| 13. Expected cost model for small agencies | **Free plan**: up to 20 seats, 2 built-in roles (Administrator, Viewer), 2 public datasets, 10 000 documents, 100 GB assets, 100 GB bandwidth. **Growth plan**: $15 / seat / month, up to 50 seats, 5 built-in roles (adds Editor, Developer, Contributor). **Custom roles**: Enterprise. | Free plan is for learning / testing and is **not** permitted for commercial use. The current paid tiers (Team and above) are priced per seat and per content model. A small real-estate agency that needs a commercial license must be on a paid plan. | Self-hosted: open-source, no license cost. Pay for the infrastructure (small VPS + DB). Strapi Cloud: per-seat and per-record. The open-source model is the lowest license cost; the operational cost is the deciding factor. |
| 14. Vendor lock-in and migration difficulty | GROQ is Sanity-specific. The data is plain JSON (the Content Lake is queryable). The Studio schema is the source of truth for the document shape. Migration out is a JSON export + import into a different CMS. | Content model is in the Contentful schema (not in the agency's repo). Export is JSON; import to a different CMS is heavier because the model is not in the agency's repo. | Self-hosted: lowest lock-in (the data is in the agency's database). Strapi Cloud: same as Contentful. Migration paths are well-trodden for the self-hosted variant. |

## 3. Recommendation

**Sanity is the recommended v1.2 pilot provider.** The corrected plan information does not materially invalidate the decision; it sharpens the cost conversation with the agency.

The recommendation rests on five concrete advantages that map to the first-client workflow in `docs/CLIENT_ONBOARDING.md`:

1. **Operational simplicity for small agencies.** Sanity is fully hosted. The agency does not provision a database, a Node service, or a reverse proxy. The Studio is at `<project>.sanity.studio`. The first agency that signs an engagement can ship a CMS-backed deployment without the implementer doing any infrastructure work beyond the data-source driver. This aligns with `docs/CLIENT_ONBOARDING.md` §2.1 ("the agency owns the CMS project") — the agency's operational surface is a hosted service, not a self-hosted stack.

2. **A current Free tier that fits a small production agency by usage.** The Sanity Free plan covers up to **20 seats**, **2 built-in roles** (Administrator and Viewer), **2 public datasets**, **10 000 documents**, **100 GB assets**, and **100 GB bandwidth**. The first-client pilot (a property catalog of under 100 listings, an agent directory of under 10 agents, and a development portfolio of under 5 projects) fits well within these limits. **Practical consequence:**
   - **Free can work for a small production agency by usage.** When the agency owns the project as Administrator and one operator holds a Viewer role, both roles are on the Free plan. The document / asset / bandwidth limits are generous for the pilot catalog.
   - **A client who needs non-admin content editors likely requires Growth.** The Editor, Developer, and Contributor roles require the Growth plan ($15 / seat / month, up to 50 seats, 5 built-in roles). A real-estate agency that wants a non-admin content editor (the typical "agency staff edits the listings" workflow) is on Growth, not Free. The implementer confirms the role shape with the agency at onboarding time; the cost conversation is part of `docs/CLIENT_ONBOARDING.md` §2.2.
   - **Custom roles require Enterprise.** A multi-role permission model beyond the five built-in roles is an Enterprise conversation. The v1.2 pilot does not need custom roles.

3. **Plain JSON data.** Sanity's Content Lake is queryable as JSON. The schema is in the Studio, but the data is portable. A migration out of Sanity is a JSON export + import into a different CMS; the migration cost is bounded. This is the lowest vendor-lock-in profile of the three candidates for a hosted CMS.

4. **References as a first-class concept.** GROQ resolves references in a single query with a projection. The pattern works directly with the `Property → Agent` and `Property → Development` references that `app/features/properties/types/property.types.ts` already declares. The mapping step is a small `mapRecord` function that turns the projected shape into `Property`.

5. **Studio at a hosted URL.** The Sanity Studio is hosted at `<project>.sanity.studio`. No admin-app deployment is required from the implementer.

The community + paid tier split also maps cleanly onto the long-term ownership model in `docs/CLIENT_ONBOARDING.md` §4.7: the agency owns the Sanity organisation, the project, and the read token. The implementer / operator does not need a content-editing role in production.

## 4. Why the other providers are not the first choice

### 4.1 Contentful

Contentful is the closest alternative on the hosted-provider axis. The comparison matrix shows it is a credible second choice. The reasons it is not the first choice for the v1.2 pilot:

- **The Free plan is not permitted for commercial use.** Contentful's Free plan is intended for learning and testing. A real-estate agency that runs a commercial website must be on a paid tier from day one. The Sanity equivalent (Free) is permitted for commercial use within the documented limits. The "free tier as a commercial baseline" axis is therefore not symmetric: Sanity's Free plan can be a real production baseline within its limits, Contentful's Free plan cannot.
- **Pricing climbs faster for small agencies.** The current paid tiers (Team and above) are priced per seat and per content model. The first-client pilot (English + Spanish, with Property / Agent / Development / Page / SiteSettings / Category as the initial content types) lands in the next tier based on content model count. Adding the next reusable block or a `Testimonial` type pushes the agency into the next tier. The per-seat and per-model boundary is the wrong shape for a small real-estate agency.
- **Reference resolution is heavier.** Contentful links require a follow-up query with `include` to dereference. The boundary schema needs an `EntryFieldTypes` mapping step that the implementer must maintain.
- **Vendor lock-in is heavier.** The content model lives in the Contentful schema, not in the agency's repo. Migrating out of Contentful is a JSON export + a schema-redesign exercise in the destination CMS. The agency's content model is not portable.

Contentful remains a credible future option for an enterprise-grade multi-tenant deployment that needs Contentful's advanced role / workflow features. The v1.2 pilot is not that deployment.

### 4.2 Strapi

Strapi is the open-source alternative. The comparison matrix shows it is the lowest vendor-lock-in option, but the operational cost is the deciding factor for the v1.2 pilot:

- **Self-hosted requires operational maintenance.** A self-hosted Strapi deployment is a Node service + a PostgreSQL / MySQL / SQLite database + a reverse proxy + backups + monitoring. A small real-estate agency does not have a DevOps function. The implementer / operator would absorb the operational burden, which contradicts the "agency owns the CMS project" principle in `docs/CLIENT_ONBOARDING.md` §4.7.
- **Image management requires a separate provider plugin.** Strapi's default upload provider is local disk; the production setup needs a provider plugin (S3, Cloudinary, etc.) plus the corresponding credentials. The image pipeline is not a first-class deliverable.
- **Granular field-level permissions, the condition builder, and audit logs are Enterprise-only.** The Community Edition covers the default roles (Super Admin, Editor, Author) plus custom roles via the Users-Permissions plugin. A first-client pilot that only needs the default roles and the typical admin / editor / agency split is fine on Community; a multi-tenant deployment that needs field-level permissions (e.g. "the editor can edit `description` but not `price`") is an Enterprise conversation.

Strapi remains a credible future option if the agency requires a self-hosted CMS (data residency, on-premise deployments, vendor-neutral open-source stack). The v1.2 pilot is not that deployment.

## 5. Pilot scope

The v1.2 pilot is the smallest realistic end-to-end integration that exercises the project's data model and the `CmsDriver<T>` abstraction. The scope is intentionally bounded so the implementer can ship a working pilot in one milestone and the agency can preview the result before the full roll-out.

### 5.1 In scope

- **Property.** All fields in `app/features/properties/types/property.types.ts`:
  - `id`, `title`, `slug`, `description`, `operationType`, `propertyType`, `price`, `currency`, `location`, `city`, `state`, `country`, `bedrooms`, `bathrooms`, `parkingSpaces`, `sizeUnit`, `constructionSize`, `landSize`, `images`, `coverImage`, `amenities`, `developmentId`, `agentId`, `coordinates`, `status`, `featured`.
- **Agent.** All fields in `app/features/agents/types/agent.types.ts`:
  - `id`, `name`, `slug`, `role`, `bio`, `image`, `phone`, `email`, `whatsapp`, `specialties`.
- **Development.** All fields in `app/features/developments/types/development.types.ts`:
  - `id`, `name`, `slug`, `status`, `location`, `description`, `image`, `priceFrom`, `priceTo`, `currency`, `sizeUnit`, `units`, `bedrooms`, `areaFrom`, `areaTo`, `deliveryDate`, `featured`.
- **References between them.** The `Property.agentId` and `Property.developmentId` references are resolved by the Sanity driver's GROQ projection. The `agents` and `developments` lists are loaded independently; the per-property reference is resolved at the per-record mapping step.
- **Image galleries.** Property `images: string[]` and `coverImage: string` are mapped from Sanity's image asset references. The pilot uses **direct projected asset URLs** (the `asset->url` field in the GROQ projection). The hotspot / crop-aware URL builder (`@sanity/image-url`) is intentionally **deferred** to keep the pilot's dependency surface to one package. The deferral is documented in §6.6.
- **Published content only.** The driver queries the published dataset (`useCdn: true` in `@sanity/client`). The `drafts` perspective is not consumed in the pilot. A future task can add a preview driver.
- **No pagination.** The pilot is bounded by the document-count limits of the Free plan (10 000 documents, which is far in excess of any realistic pilot catalog). The driver fetches the GROQ projection in a single call. Pagination is added only when the dataset outgrows the single-call response or when the provider's API enforces a response-size cap.

### 5.2 Out of scope (deferred)

- **Preview / draft mode.** The driver reads the published dataset. A preview perspective is a separate driver that consumes the draft dataset; the boundary schema is the same.
- **Webhook-driven revalidation.** A Sanity webhook → Nitro endpoint that invalidates the loader's memoised cache is a future task. The v1.2 pilot relies on the loader's per-request `pending` coalescing.
- **Retry / cache layer.** The v1.2 pilot is a thin transport + boundary validation, mirroring the documented constraints of the existing CMS path.
- **Hotspot / crop-aware URL building.** `@sanity/image-url` is a separate package from `@sanity/client`. The pilot uses direct projected asset URLs (`asset->url`) and does not depend on the image-url builder. A future task can add `@sanity/image-url` as a justified dependency when the agency needs hotspot / crop-aware transforms.
- **Pagination.** The pilot does not paginate. Add pagination only when the dataset outgrows the single-call response or when the provider's API enforces a response-size cap.
- **Other Sanity content types.** Page, SiteSettings, Category, Testimonial, and any other content type are out of scope for the v1.2 pilot. The first deploy can ship with the static sample data for those content types and migrate them in a later milestone.
- **Studio customisation.** The default Sanity Studio is sufficient for the pilot. A custom studio theme or a custom desk structure is a future task.
- **Multi-tenant Sanity.** One client = one project. The multi-tenant registry in `app/config/agencies/registry.ts` is not extended with Sanity-organisation-level metadata in the pilot.

## 6. Expected integration shape with `CmsDriver<T>`

The integration is a single new file under `app/core/data-source/adapters/` that implements the `CmsDriver<T>` contract. The contract requires `id` and `dispatch()`. The driver is constructed for a specific target shape (the loader constructs `CmsDriver<Property>` / `CmsDriver<Agent>` / `CmsDriver<Development>`). The boundary Zod schema is supplied to the adapter separately.

**Implementation status (Task 116).** The Sanity pilot is implemented. The driver file is `server/utils/sanity-driver.ts` (server-only location; Task 115B originally placed it at `app/core/data-source/adapters/sanity-driver.ts` and Task 116 moved it to `server/utils/` so the `@sanity/client` import is bundled exclusively to the Nitro server output). The driver test file is `server/utils/sanity-driver.test.ts`. A new boundary regression test at `server/utils/sanity-boundary.test.ts` asserts no `app/` file imports `@sanity/client`, references `NUXT_SANITY_TOKEN`, or re-exports `createSanityDriver` / `createSanityClientConfig`, plus the file-location and `nuxt.config.ts` image.domains assertions. The Sanity client / config layer is at `server/utils/sanity-config.ts`. The per-feature GROQ queries + mapping functions are at `server/utils/sanity-mappings.ts`. The three feature loaders (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`) wire the Sanity driver through the existing CRUD path with a per-feature `NUXT_<FEATURE>_CMS_PROVIDER` env var. The shared `server-data-source.ts` `cms` branch was extended to make `endpointEnvName` and `timeoutEnvName` optional so the Sanity path does not require a `NUXT_<FEATURE>_CMS_URL`. The Nuxt Image config adds `image.domains: ['cdn.sanity.io']` so the IPX provider accepts the Sanity asset URLs. The HTTP/JSON path is unchanged. The `pnpm-lock.yaml` is updated to pin `@sanity/client@6.29.1` so `pnpm install --frozen-lockfile` succeeds on a clean checkout. See `docs/DATA_MODELS.md` §10.4.1 for the canonical documentation.

### 6.1 Configuration model (one agency-owned project)

The v1.2 pilot is intentionally simple: a single Sanity project owned by the agency, with one dataset for the agency's content. The configuration is shared across the Property / Agent / Development drivers, not duplicated per feature.

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NUXT_SANITY_PROJECT_ID` | yes when `cms` is in use | — | The Sanity project ID. The agency owns the project; this is the value bound to the agency's Sanity organisation. |
| `NUXT_SANITY_DATASET` | yes when `cms` is in use | `production` | The dataset name. The published dataset the driver queries. |
| `NUXT_SANITY_API_VERSION` | yes when `cms` is in use | `2024-01-01` | Sanity API version. Pinned at build time so the GROQ query result shape is stable across Sanity upgrades. The default is the documented current Sanity API version at the time of writing; the implementation task may update this when the pilot ships. |
| `NUXT_SANITY_TOKEN` | no (server-only) | `''` | Optional read token. Required if the dataset is private (e.g. preview / draft). For a published-dataset read on a public dataset, the token is empty. The driver is constructed server-only; the token is read from `process.env` and never leaves the server bundle. |

The configuration is **shared across the three features**. The driver file does not need per-feature credentials. The Property / Agent / Development drivers each construct their own `@sanity/client` with the same configuration; the GROQ query and the per-record `mapRecord` function are the only feature-specific pieces.

The existing `NUXT_*_CMS_URL` env vars (per-feature) are still read by the loader branch because they are the legacy switch the operator sets to `cms`. The Sanity driver ignores the URL (the URL is the api endpoint Sanity exposes under the hood); the loader still reads the URL for the connection-check side effect. The implementation task can either keep the per-feature `NUXT_*_CMS_URL` env vars (for documentation parity with the existing `http-json` driver) or remove them. The recommended shape is to keep them as deprecation-tolerant stubs so the operator's existing `.env.example` continues to work.

### 6.2 File structure

```text
server/utils/sanity-driver.ts
server/utils/sanity-driver.test.ts
server/utils/sanity-boundary.test.ts
```

The driver module:

- Imports `@sanity/client` (the only new runtime dependency for the pilot). `@sanity/image-url` is **not** a dependency of the pilot; the image-url builder is deferred.
- Exports `createSanityDriver<T>({ client, query, mapRecord, source? })`. The driver itself does not own the `client` lifecycle; the loader constructs the client once with the shared configuration and passes it to the driver.
- The driver's `dispatch()` runs the GROQ query against the configured client and returns the mapped list. **No pagination in the pilot** (see §5.1).
- The driver's `id` is `'sanity'`.
- The driver is constructed inside the server-only loader (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`); the Sanity read token is read from `process.env` and never leaves the server bundle.

### 6.3 Loader wiring

The existing branch in `server/utils/properties.ts` already supports the `cms` kind via the shared `createServerDataSourceAdapter` utility. The Sanity driver is wired the same way the `http-json` driver is wired today. The configuration is shared across the three loaders:

```ts
const sanityClient = createSanityClient({
  projectId: readEnv('NUXT_SANITY_PROJECT_ID'),
  dataset: readEnv('NUXT_SANITY_DATASET'),
  apiVersion: readEnv('NUXT_SANITY_API_VERSION'),
  useCdn: true,
  token: readEnv('NUXT_SANITY_TOKEN'),
})

case 'cms': {
  const driver = createSanityDriver<Property>({
    client: sanityClient,
    query: `*[_type == "property" && status != "hidden"]`,
    mapRecord: mapSanityProperty,
    source: 'cms:NUXT_PROPERTIES_CMS_URL',
  })
  return createCmsDataSource<Property>({ driver, schema: propertyListSchema, source: 'cms:NUXT_PROPERTIES_CMS_URL' })
}
```

The GROQ query and the `mapRecord` function are the only feature-specific pieces. The agents and developments loaders follow the same pattern with their own GROQ query and `mapRecord`.

### 6.4 Mapping step

The `mapRecord` step is a small per-record function that turns the GROQ projection into the `Property` / `Agent` / `Development` shape. The function is unit-tested with a representative Sanity document fixture. The boundary schema validates the result; the driver raises `DataSourceInvalidPayloadError` if the mapping drifts.

For the pilot, the GROQ projection returns each field by name (and image assets by `asset->url`); the mapping step is a 1:1 field-by-field transformation. The mapping step does not need to issue follow-up queries because the projection returns the entire shape in one call.

### 6.5 Authentication

The driver reads the Sanity read token from `process.env` directly (the same pattern the existing data-source loaders use for `NUXT_*_CMS_URL` env vars). The token is scoped to the published dataset (not the drafts dataset) and is provisioned by the agency in the Sanity project's API settings. The token is stored in the platform's secret manager; the agency owns the project, so the agency owns the token rotation.

For a public dataset, the token is empty (`NUXT_SANITY_TOKEN` defaults to `''`). The published dataset is publicly readable; a token is only needed when the dataset is private (e.g. when preview is enabled) or when the operator wants to scope the request to a specific project member. The pilot configures the published dataset as public and skips the token.

### 6.6 Image strategy

The pilot uses **direct projected asset URLs**, not the `@sanity/image-url` builder. The GROQ projection returns `asset->url` for each image field, and the `mapRecord` step stores the URL as a string in the boundary shape. The `<ResponsiveImage>` wrapper in `app/components/shared/ResponsiveImage.vue` consumes the URL with the existing `sizes` attribute and the `@nuxt/image` machinery.

**Why not `@sanity/image-url` in the pilot.** `@sanity/image-url` is a separate package from `@sanity/client`. Adding both would make the pilot depend on two Sanity packages. The hotspot / crop-aware URL builder is a justified future addition when the agency needs the full Sanity image pipeline (hotspot coordinates, crop regions, auto-format). The pilot does not need it — the media store exposes the asset URL directly, and the implementer can add the image-url builder as a feature-flagged opt-in in a future task.

**Deferral is documented.** A future task can add `@sanity/image-url` as a justified dependency, swap the `mapRecord` step to use the builder, and add the hotspot / crop pipeline. The pilot's deferred work list is in §5.2.

### 6.7 Test coverage

The driver's tests cover:

- **`id`** is `'sanity'`.
- **Query success.** A 2xx response with a valid GROQ result mapping to the boundary shape passes the schema.
- **Query failure.** A non-2xx response raises `DataSourceHttpError` with the status code and the dataset URL.
- **Timeout.** A request that exceeds the driver's timeout raises `DataSourceTimeoutError`.
- **Mapping failure.** A document that maps to an invalid `Property` raises `DataSourceInvalidPayloadError` from the adapter boundary.
- **Empty result.** A dataset with no matching documents returns `[]` (the boundary schema accepts an empty array).

The adapter tests already cover the dispatcher + memoisation contract. Pagination is not tested in the pilot (the pilot does not paginate).

## 7. Remaining risks / unknowns

The pilot is scoped to minimise surprises. The implementation task still has to address the following:

- **Sanity plan tier.** The Free plan is sufficient for the pilot's two-role model (agency Administrator + Viewer). The Growth plan is required when the agency needs a non-admin content editor (Editor, Developer, or Contributor). The implementer confirms the role shape with the agency at onboarding time. The pricing conversation is part of `docs/CLIENT_ONBOARDING.md` §2.2.
- **Sanity API version pin.** The default `NUXT_SANITY_API_VERSION` is the documented current Sanity API version at the time of writing. The implementation task may update the default when the pilot ships. The version is pinned to keep the GROQ query result shape stable across Sanity upgrades.
- **Read token rotation.** The agency owns the Sanity project. The read token rotation cadence is part of the handoff (`docs/CLIENT_ONBOARDING.md` §4.7). The implementer does not rotate the token in production.
- **Sanity Studio schema.** The schema is defined in the Sanity Studio (a separate repo / sub-repository owned by the agency). The boundary schema in `app/features/properties/schemas/property.schema.ts` is the source of truth for the runtime contract. The two schemas can drift; a CI / contract test that runs the Sanity Studio schema against the boundary schema is a future task.
- **Image strategy.** The pilot uses direct projected asset URLs (`asset->url`). When the agency needs hotspot / crop-aware transforms, the implementation adds `@sanity/image-url` as a justified dependency. The current pilot does not depend on it.
- **Locale handling.** `availableLocales` is a single array on the agency config. The Sanity model carries per-locale fields. The boundary schema receives a single shape; the implementer confirms the pilot's locale strategy before the integration runs against a real dataset.
- **Multi-tenant.** The v1.2 pilot is single-tenant. The `agency.id` is the Sanity project name. A multi-tenant deployment that hosts multiple Sanity projects behind one build is a future task.
- **Custom SDK dependencies.** The pilot introduces `@sanity/client` as the only new runtime dependency. The implementer confirms the dependency is acceptable (`docs/AGENTS.md` "do not add dependencies without a strong reason" — the Sanity SDK is the canonical way to talk to Sanity, so the dependency is justified). `@sanity/image-url` is **not** a pilot dependency.
- **Studio customisation.** The default Sanity Studio is sufficient for the pilot. A custom Studio (e.g. for the agency's brand colors or a custom desk structure) is a future task that demands its own design pass.

## 8. References

- `docs/CLIENT_ONBOARDING.md` — the first-client onboarding workflow (§2.1 CMS project, §4.7 CMS handoff).
- `docs/DATA_MODELS.md` — the per-feature data models and the existing CMS path (`server/utils/properties.ts`, `server/utils/agents.ts`, `server/utils/developments.ts`).
- `app/core/data-source/cms-driver.ts` — the `CmsDriver<T>` contract and the `createCmsDataSource<T>` adapter.
- `app/core/data-source/adapters/http-json-cms-driver.ts` — the existing thin-transport driver the Sanity driver will mirror.
- `docs/DEPLOYMENT.md` — the deploy procedure and the Node / Nitro recommendation for the first client.
- `docs/ROADMAP.md` — the v1.1.0 M20 / M26 / M27 milestones that ship the current CMS path; the new "v1.2 pilot 0 — CMS provider evaluation" decision entry (Task 115).
