import { createClient, type SanityClient } from '@sanity/client'
import { DataSourceMissingConfigError } from '~/core/data-source/data-source'
import { readEnv } from './server-data-source'

/**
 * Sanity client / config layer (Task 115 — v1.2 pilot).
 *
 * The single source of truth for the Sanity client on the
 * server. Reads the four env vars the pilot documents in
 * `docs/CMS_EVALUATION.md` §6.1 and validates the required
 * ones (the token is optional — a public dataset can be
 * queried without authentication).
 *
 *  - `NUXT_SANITY_PROJECT_ID` — required. The agency's Sanity
 *    project ID. The agency owns the project; this is the
 *    value bound to the agency's Sanity organisation.
 *  - `NUXT_SANITY_DATASET` — required. The dataset name. The
 *    pilot reads the published dataset (`'production'` is
 *    the conventional Sanity name; the operator can
 *    override).
 *  - `NUXT_SANITY_API_VERSION` — required. Sanity API version
 *    pinned at build time so the GROQ query result shape is
 *    stable across Sanity upgrades. Defaults to `'2024-01-01'`.
 *  - `NUXT_SANITY_TOKEN` — optional (server-only). The read
 *    token. Required for a private dataset; for a public
 *    dataset the token is empty.
 *
 * **Why a `server/utils/` module.** Same reasoning as the
 * other data-source loaders: `server/utils/` is the canonical
 * Nuxt 4 location for server-only utilities. The file is
 * auto-imported by Nitro and bundled exclusively to the
 * server output, never to the client. The `NUXT_SANITY_*`
 * env vars and the Sanity read token therefore cannot reach
 * the client bundle by code organization, not by
 * tree-shaking.
 *
 * **Why `process.env` directly (not `useRuntimeConfig`).**
 * Consistent with the existing per-feature loaders
 * (`properties.ts`, `agents.ts`, `developments.ts`). The env
 * vars are read by the loader module on every adapter
 * construction; the shared `readEnv` helper is the canonical
 * reader.
 *
 * **One client per adapter construction.** The factory
 * creates a fresh `SanityClient` on every call. The loader
 * invokes the factory on every `loadPropertiesServer()` (or
 * agents / developments) call; the per-feature
 * `createServerLoader` coalesces concurrent in-flight calls
 * so two simultaneous requests share the same adapter
 * instance until settle. The Sanity client itself is
 * internally pooled by `@sanity/client`; constructing a
 * fresh one per request is cheap and keeps the test surface
 * deterministic.
 */

/**
 * The resolved Sanity config returned by
 * {@link createSanityClientConfig}. The structured fields
 * are exposed for diagnostics (the boundary schema contract
 * does not depend on them; the boundary schema is the
 * `Property` / `Agent` / `Development` shape, not the
 * Sanity config).
 */
export interface SanityConfig {
  readonly client: SanityClient
  readonly projectId: string
  readonly dataset: string
  readonly apiVersion: string
  readonly token: string
  readonly source: string
}

/**
 * Default Sanity API version. Matches the documented
 * default in `docs/CMS_EVALUATION.md` §6.1. The pilot pins
 * the API version so the GROQ projection result shape is
 * stable across Sanity upgrades; the implementation task may
 * update this when the pilot ships.
 */
export const DEFAULT_SANITY_API_VERSION = '2024-01-01'

/**
 * Default Sanity dataset. The conventional Sanity name for
 * the published dataset is `'production'`. The operator can
 * override via `NUXT_SANITY_DATASET`.
 */
export const DEFAULT_SANITY_DATASET = 'production'

/**
 * Construct a Sanity client from the four env vars.
 *
 * The factory validates the required `NUXT_SANITY_PROJECT_ID`
 * and `NUXT_SANITY_DATASET` (after the default substitution)
 * synchronously. A missing project ID raises
 * {@link DataSourceMissingConfigError} so the
 * misconfiguration is fixed at startup rather than at first
 * request.
 *
 * The token is optional — a public dataset can be queried
 * without an authentication header. When the token is empty,
 * the client is constructed without the `token` option
 * (the Sanity client treats an empty string as falsy and
 * falls back to the public CDN endpoint).
 *
 * The `useCdn: true` option is set unconditionally. The pilot
 * reads the published dataset and tolerates the CDN's
 * eventual consistency within the small TTL that the
 * loader's per-request `pending` coalescing already
 * provides. A future task can add a `useCdn: false` flag
 * (e.g. `NUXT_SANITY_USE_CDN`) for deployments that need
 * real-time freshness.
 */
export function createSanityClientConfig(): SanityConfig {
  const projectId = readEnv('NUXT_SANITY_PROJECT_ID').trim()
  if (projectId === '') {
    throw new DataSourceMissingConfigError('cms', 'NUXT_SANITY_PROJECT_ID')
  }
  const dataset = readEnv('NUXT_SANITY_DATASET').trim()
    || DEFAULT_SANITY_DATASET
  if (dataset === '') {
    throw new DataSourceMissingConfigError('cms', 'NUXT_SANITY_DATASET')
  }
  const apiVersion = readEnv('NUXT_SANITY_API_VERSION').trim()
    || DEFAULT_SANITY_API_VERSION
  const token = readEnv('NUXT_SANITY_TOKEN').trim()

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true,
    ...(token !== '' ? { token } : {}),
  })

  return {
    client,
    projectId,
    dataset,
    apiVersion,
    token,
    source: `sanity:${projectId}/${dataset}`,
  }
}
