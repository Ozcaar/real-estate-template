# Sanity Studio — Real Estate Website Template

The Sanity Studio is the source of truth for the agency-owned Property / Agent / Development content model. The Nuxt app (`/`) reads the **published dataset** via the `@sanity/client` driver (`server/utils/sanity-driver.ts`); the Studio is the editor's tool to create and update the documents.

The Studio is a **separate project** from the Nuxt app. It lives in `studio/` at the repo root, has its own `package.json`, `pnpm-lock.yaml`, and `node_modules`. The Nuxt app does not import anything from the Studio; the Studio does not import anything from the Nuxt app. The two projects communicate via the Sanity project ID + dataset.

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
└── README.md              This file
```

## 1. Create the Sanity project

The agency owns the Sanity project. The implementer creates the project during the build (or the agency creates it before the build handoff). The project ID is the same value the Nuxt app reads via `NUXT_SANITY_PROJECT_ID`.

1. Sign in to <https://www.sanity.io/manage>.
2. Click **Create new project**.
3. Choose the agency's organisation (or create a new one).
4. Pick a project name and the dataset name (`production` is the default; the Studio uses `production` and the Nuxt driver reads `production`).
5. Pick the **Free** plan for the pilot. The Free plan supports 2 public datasets and 10 000 documents — both are sufficient for the pilot's catalog. The Growth plan is required when the agency needs editor / developer / contributor roles (the added roles are documented in `docs/CMS_EVALUATION.md` §2).
6. Take note of the **Project ID** (a short lowercase string). The Nuxt app reads this via `NUXT_SANITY_PROJECT_ID`. The Studio reads it via `SANITY_STUDIO_PROJECT_ID`.

## 2. Install the Studio

```bash
cd studio
pnpm install
```

The Studio's `package.json` declares the dependencies (`sanity`, `react`, `styled-components`, `vitest`, `typescript`, …). The Studio's `pnpm-lock.yaml` is committed alongside `package.json` so a clean checkout reproduces the install.

## 3. Configure the Studio

The Studio reads the project ID + dataset from the environment:

```bash
# studio/.env (committed to the agency's working tree, NOT to git)
SANITY_STUDIO_PROJECT_ID=<the project ID from step 1>
SANITY_STUDIO_DATASET=production
```

**`SANITY_STUDIO_PROJECT_ID` is required.** The var has no real default. The Studio refuses to boot if the var is empty or unset (`studio/sanity.config.ts` throws a clear error at startup). The agency must supply the project ID it created at <https://www.sanity.io/manage> — the same value the Nuxt app reads via `NUXT_SANITY_PROJECT_ID`.

**`SANITY_STUDIO_DATASET` has a default of `production`.** Override only when the project uses a non-default dataset (`staging`, `development`, etc.).

**`SANITY_STUDIO_*` exposure rule.** Every `SANITY_STUDIO_*` env var read by the Studio is inlined into the Studio's JavaScript bundle at build time (Sanity is a Vite-built SPA). The bundle is publicly served at `<projectId>.sanity.studio`. The operator MUST NOT place a token, a key, or any other secret in a `SANITY_STUDIO_*` env var. The Studio's only configuration is the project ID + dataset name; secrets live in the Nuxt app's runtime config (`NUXT_SANITY_TOKEN`, read server-only from `process.env` inside `server/utils/sanity-config.ts`). The Studio never sees the read token.

The Studio's `sanity.config.ts` reads the env vars via `process.env`. The Studio's `sanity.cli.ts` reads the same env vars for the `sanity` CLI helpers (`sanity dataset create`, `sanity deploy`, etc.).

## 4. Run the Studio locally

```bash
cd studio
pnpm dev
```

The Studio starts on `http://localhost:3333`. The editor sees the three document types (Property, Agent, Development) in the sidebar. The **Vision** plugin (topbar) is the GROQ playground the developer uses to iterate on queries — Vision is **bundled into local dev builds only** (the Studio's `sanity.config.ts` excludes it when `NODE_ENV === 'production'`, so the deployed Studio at `<projectId>.sanity.studio` does not include Vision). The agency's editors do not need Vision; the topbar is intentionally clean for the production Studio.

## 5. Verify the dataset exists

Sanity does **not** auto-create datasets on first publish. The Studio's "Publish" button publishes documents into a dataset that already exists; it does not create the dataset. The operator must verify the configured dataset exists before publishing.

**Verify.**

1. Sign in to <https://www.sanity.io/manage>.
2. Pick the project.
3. Open the **Datasets** tab. The configured dataset (the value of `SANITY_STUDIO_DATASET`, default `production`) must appear in the list.

**Create the dataset (only when it does not exist).** Use **exactly one** of the following:

- **Project management UI.** In the project view at <https://www.sanity.io/manage>, open the **Datasets** tab and click **Create new dataset**. Enter the dataset name (matching `SANITY_STUDIO_DATASET`) and pick the visibility (public — the Nuxt driver reads the published dataset via the public CDN, so the dataset must be public; a private dataset requires the read token and is out of scope for the pilot).

- **Sanity CLI.** From the Studio folder, run:
  ```bash
  cd studio
  pnpm exec sanity dataset create <name> --visibility public
  ```
  The CLI uses the same `SANITY_STUDIO_PROJECT_ID` env var. The dataset name must match the value of `SANITY_STUDIO_DATASET` (and the value of `NUXT_SANITY_DATASET` on the Nuxt side — the two must agree).

The dataset name (`production`) is the default value the Nuxt driver reads via `NUXT_SANITY_DATASET`. Both sides must agree on the dataset name.

## 6. Populate the dataset

The editor opens the Studio, picks **Property** in the sidebar, and clicks **Create new**. The Studio groups the fields into **Content**, **Media**, **Location**, and **Status** tabs. The editor fills in the required fields (the Studio blocks publish on missing required fields) and clicks **Publish**.

Documents are stored in the published dataset. The Nuxt driver reads the published dataset (`useCdn: true` in `@sanity/client`) — the draft perspective is **not** consumed in the pilot.

## 7. Deploy the Studio

The Studio is deployed to Sanity's managed hosting with a single command:

```bash
cd studio
pnpm deploy
```

Under the hood, `sanity deploy` builds the Studio and publishes it to `<projectId>.sanity.studio`. The agency accesses the deployed Studio at that URL. The Studio's authentication is Sanity's own — the agency signs in with a Sanity account that has been granted a role on the project.

## 8. Grant agency access

The agency owner signs in to <https://www.sanity.io/manage>, picks the project, and grants the agency's editors / admins a role on the project. The Free plan supports two roles: **Administrator** (full access) and **Viewer** (read-only). The Growth plan adds Editor, Developer, and Contributor.

The implementer signs in with their own Sanity account during the build, then transfers the project ownership to the agency at handoff time (`docs/CLIENT_ONBOARDING.md` §4.7). The agency revokes the implementer's access after the handoff.

## 9. Run the schema tests

```bash
cd studio
pnpm test
```

The tests verify the schema exports match the GROQ projection contract:

- The schema index exports exactly three document types (Property, Agent, Development).
- Every field name the GROQ projection selects is present on the schema.
- The required fields are marked required.
- The enum values match the runtime Zod schema (`propertyStatusSchema`, `developmentStatusSchema`, `propertyOperationTypeSchema`, `propertyTypeSchema`, `propertySizeUnitSchema`).
- The price / area / unit fields are non-negative numbers.
- The `agent` and `development` reference fields point to the matching document types.
- The image fields are typed `image` (the GROQ projection's `asset->url` flat projection).
- The `coordinates` field is typed `geopoint` — the default Studio editing surface is two numeric inputs (latitude / longitude); the pilot does NOT include a visual map picker. The GROQ projection's `.lat` / `.lng` access.

The tests are static — they inspect the schema objects directly without booting the Sanity Studio runtime.

## 10. Typecheck the schemas

```bash
cd studio
pnpm typecheck
```

The `tsc --noEmit` step verifies the schemas + config type-check against the `sanity` package's types. The Studio's `tsconfig.json` extends the root's `tsconfig.json` for the shared `compilerOptions`.

## 11. Wire the Nuxt app to the project

The Nuxt app reads the published dataset via the same env vars the Studio uses:

```bash
# the agency's working tree
NUXT_SANITY_PROJECT_ID=<the project ID from step 1>
NUXT_SANITY_DATASET=production
NUXT_SANITY_API_VERSION=2024-01-01
NUXT_SANITY_TOKEN=<read token; leave empty for a public dataset>

NUXT_PROPERTIES_DATA_SOURCE=cms
NUXT_PROPERTIES_CMS_PROVIDER=sanity
NUXT_AGENTS_DATA_SOURCE=cms
NUXT_AGENTS_CMS_PROVIDER=sanity
NUXT_DEVELOPMENTS_DATA_SOURCE=cms
NUXT_DEVELOPMENTS_CMS_PROVIDER=sanity
```

The Nuxt app's `server/utils/sanity-mappings.ts` queries the published dataset and maps the documents into the runtime boundary shapes. The Nuxt app does not import anything from this Studio folder.

## 12. Schema contract

The Studio schema is the **editor contract**. The Nuxt Zod schema is the **runtime contract**. The two are matched by hand:

| Runtime field | Studio field | Type |
| --- | --- | --- |
| `Property.id` | `_id` (Sanity system field) | string |
| `Property.title` | `title` | string |
| `Property.slug` | `slug.current` (the Studio's slug type) | string |
| `Property.description` | `description` | text |
| `Property.operationType` | `operationType` | `'sale' \| 'rent'` |
| `Property.propertyType` | `propertyType` | `'house' \| 'apartment' \| 'land' \| 'commercial' \| 'office'` |
| `Property.price` | `price` | number |
| `Property.currency` | `currency` | string |
| `Property.amenities` | `amenities` | string[] |
| `Property.coverImage` | `coverImage.asset->url` | string |
| `Property.images` | `images[].asset->url` | string[] |
| `Property.location` / `city` / `state` / `country` | `location` / `city` / `state` / `country` | string |
| `Property.coordinates` | `coordinates.lat` / `coordinates.lng` | `{ lat: number, lng: number }` |
| `Property.bedrooms` / `bathrooms` / `parkingSpaces` | `bedrooms` / `bathrooms` / `parkingSpaces` | number (optional) |
| `Property.sizeUnit` / `constructionSize` / `landSize` | `sizeUnit` / `constructionSize` / `landSize` | union |
| `Property.agentId` | `agent._ref` | string (optional) |
| `Property.developmentId` | `development._ref` | string (optional) |
| `Property.status` | `status` | `'available' \| 'sold' \| 'rented' \| 'reserved' \| 'hidden'` |
| `Property.featured` | `featured` | boolean |
| `Agent.id` | `_id` | string |
| `Agent.name` / `slug` / `role` / `bio` / `image` | `name` / `slug` / `role` / `bio` / `image.asset->url` | string |
| `Agent.phone` / `email` / `whatsapp` / `specialties` | `phone` / `email` / `whatsapp` / `specialties` | optional |
| `Development.id` / `name` / `slug` / `status` / `location` / `description` / `image` | matching fields | string |
| `Development.priceFrom` / `priceTo` / `currency` / `sizeUnit` / `units` / `bedrooms` / `areaFrom` / `areaTo` / `deliveryDate` / `featured` | matching fields | optional |

The `slug` field is the only place the Studio's runtime shape differs from the boundary shape. The Studio's `slug` is an object with `current`, `_type`, and `source`; the GROQ projection flattens it to `slug.current` (a string). The boundary Zod schema expects a string.

## 13. What this Studio does NOT do

- **No preview integration.** The Nuxt app reads the published dataset only. The `presentationTool` plugin is intentionally not added. A future task can add a preview driver without touching the Studio.
- **No `@sanity/image-url` integration.** The GROQ projection returns the raw asset URL. The hotspot / crop-aware URL builder is deferred.
- **No webhooks / revalidation.** The Nuxt app fetches the dataset on every loader call (no permanent cache). The Studio's webhook → Nitro endpoint is a future task.
- **No custom theming.** The Studio uses the default Sanity light / dark theme.
- **No Vision plugin in production.** Vision is a developer tool; the deployed Studio at `<projectId>.sanity.studio` does NOT include it. The Studio's `sanity.config.ts` bundles Vision only when `NODE_ENV !== 'production'`, so the local dev Studio (`pnpm dev`) carries Vision and the deployed Studio carries only the editor essentials. The agency editors do not need the GROQ playground.
- **No map picker for the `coordinates` field.** The default Studio editing surface for the Property's `coordinates` field is two numeric inputs (latitude / longitude). Adding a visual map input would require a custom input component (with a map provider such as Mapbox) and is a deferred future task.
- **No Studio schemas for SiteSettings / Page / Testimonial / Category.** The pilot is Property / Agent / Development only. A future task can add the additional content types.

## 14. References

- `docs/CMS_EVALUATION.md` — the provider evaluation that selected Sanity.
- `docs/DATA_MODELS.md` §10.4.1 — the runtime Sanity integration documentation.
- `docs/CLIENT_ONBOARDING.md` §2.1 / §4.7 — the CMS project creation and handoff workflow.
- `server/utils/sanity-mappings.ts` — the GROQ queries + mapping functions the Nuxt app reads.
- `server/utils/sanity-driver.ts` — the `CmsDriver<T>` implementation.
- `server/utils/sanity-config.ts` — the Sanity client / config layer.
- `app/features/properties/schemas/property.schema.ts` — the runtime boundary schema.
- `app/features/agents/schemas/agent.schema.ts` — the runtime boundary schema.
- `app/features/developments/schemas/development.schema.ts` — the runtime boundary schema.
