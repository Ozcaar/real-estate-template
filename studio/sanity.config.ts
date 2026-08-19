import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

const STUDIO_PROJECT_ID = process.env.SANITY_STUDIO_PROJECT_ID

if (!STUDIO_PROJECT_ID) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID is required. The Studio refuses to boot '
    + 'without a project ID. Set it in studio/.env or in the environment '
    + 'before running `pnpm dev` or `pnpm deploy`. See studio/README.md §3.',
  )
}

const STUDIO_DATASET = process.env.SANITY_STUDIO_DATASET ?? 'production'

const isProductionBuild = process.env.NODE_ENV === 'production'

/**
 * Sanity Studio config (Task 118 — v1.2 pilot Studio hardening).
 *
 * The Studio is the source of truth for the agency-owned
 * content model. The three document schemas (Property,
 * Agent, Development) are defined in `schemas/` and
 * exported as `schemaTypes`. The Nuxt integration
 * (`server/utils/sanity-mappings.ts`) reads the published
 * dataset via GROQ and maps the documents into the
 * runtime boundary shapes (`propertyListSchema`,
 * `agentListSchema`, `developmentListSchema`).
 *
 * **Project ID and dataset.** The `projectId` and
 * `dataset` are read from the environment at startup:
 *
 *   - `SANITY_STUDIO_PROJECT_ID` — REQUIRED. The Studio
 *     refuses to boot without it. The var has no real
 *     default; the agency must supply the project ID it
 *     created at https://www.sanity.io/manage (the same
 *     value the Nuxt app reads via `NUXT_SANITY_PROJECT_ID`).
 *   - `SANITY_STUDIO_DATASET` — optional, default
 *     `'production'`. The operator can override the
 *     dataset name when the project uses a non-default
 *     dataset (`staging`, `development`, …).
 *
 * **`SANITY_STUDIO_*` exposure rule.** Every
 * `SANITY_STUDIO_*` env var read by this file is
 * inlined into the Studio's JavaScript bundle at build
 * time (Sanity is a Vite-built SPA). The bundle is
 * publicly served at `<projectId>.sanity.studio`. The
 * operator MUST NOT place a token, a key, or any other
 * secret in a `SANITY_STUDIO_*` env var. The Studio's
 * only configuration is the project ID + dataset name;
 * secrets live in the Nuxt app's runtime config
 * (`NUXT_SANITY_TOKEN`, read server-only from
 * `process.env` inside `server/utils/sanity-config.ts`).
 * The Studio never sees the read token.
 *
 * **Vision plugin (developer tool, dev-only).** The
 * Vision plugin is the GROQ playground the developer
 * uses to iterate on queries without running the Nuxt
 * app. The Vision plugin is **excluded from production
 * builds**: it is bundled only when
 * `process.env.NODE_ENV !== 'production'`. The agency's
 * editors do not need Vision; the topbar is intentionally
 * clean for the production Studio. A developer who needs
 * Vision can run `pnpm dev` locally (the local Studio
 * includes Vision because `sanity dev` sets
 * `NODE_ENV=development`). The plugin's
 * `defaultApiVersion` matches the `NUXT_SANITY_API_VERSION`
 * default so the Vision playground and the runtime
 * driver agree on the API version.
 *
 * **Structure.** The desk structure uses the default
 * `structureTool` so the editor sees the three document
 * types in the sidebar. The Desk is intentionally minimal
 * — no custom structure is needed for the pilot.
 *
 * **No preview / draft integration.** The pilot does NOT
 * add the `presentationTool` (the preview plugin). The
 * Nuxt integration reads the published dataset only. A
 * future task can add the preview driver without
 * touching the Studio config.
 *
 * **No custom theming.** The Studio uses the default Sanity
 * light / dark theme. A custom theme is a future task
 * (see `docs/CMS_EVALUATION.md` §5.2).
 */
export default defineConfig({
  name: 'inmoviliaria-studio',
  title: 'Real Estate Studio',

  projectId: STUDIO_PROJECT_ID,
  dataset: STUDIO_DATASET,

  plugins: [
    structureTool(),
    ...(isProductionBuild ? [] : [visionTool({ defaultApiVersion: '2024-01-01' })]),
  ],

  schema: {
    types: schemaTypes,
  },
})
