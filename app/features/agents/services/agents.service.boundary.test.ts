import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Boundary regression tests for the agent service (Task 104).
 *
 * The HTTP agent data source and its private configuration
 * (`NUXT_AGENTS_DATA_SOURCE`, `NUXT_AGENTS_API_URL`,
 * `NUXT_AGENTS_API_TIMEOUT_MS`) must remain server-only. The
 * agent service is imported by page files in `app/pages/`,
 * which Nuxt bundles to BOTH the server and the client. If
 * the service ever:
 *
 *  - imported the api-adapter module
 *    (`app/core/data-source/adapters/api-adapter.ts`),
 *  - imported the static-adapter module
 *    (`app/core/data-source/adapters/static-adapter.ts`),
 *  - imported the data-source contract's runtime exports
 *    (the `selectDataSource` selector, the `DataSourceKind`
 *    type, the `isDataSourceKind` type guard, the five error
 *    classes),
 *  - declared or read any `NUXT_AGENTS_*` env var in its
 *    runtime code, or
 *  - relied solely on `typeof window === 'undefined'` as the
 *    server / client boundary,
 *
 * the api-adapter module and the env-var name strings would
 * reach the client bundle via tree-shaking reachability. The
 * structural boundary is the `server/utils/` directory: the
 * server-only agent loader at `server/utils/agents.ts` and
 * the same-origin Nitro endpoint at `server/api/agents.get.ts`
 * are bundled to the Nitro server output only. The service
 * consumes the resolved public list through
 * `$fetch('/api/agents')` — the client bundle references
 * only the same-origin path.
 *
 * These tests pin that contract at the source-file level. A
 * textual scan of `agents.service.ts` fails the suite if any
 * of the protected identifiers ever reappears in the runtime
 * code. The textual scan tolerates the documented appearances
 * in JSDoc comments because comments are stripped by the
 * bundler before the file reaches the client.
 *
 * Mirrors `app/features/properties/services/properties.service.boundary.test.ts`.
 */

const SERVICE_PATH = join(__dirname, 'agents.service.ts')

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const RUNTIME_SOURCE = stripComments(readFileSync(SERVICE_PATH, 'utf8'))

describe('agentsService — server-only / client-safe boundary', () => {
  describe('source-file level (textual, comments stripped)', () => {
    it('does not import the api-adapter module', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/api-adapter/)
      expect(RUNTIME_SOURCE).not.toMatch(/createApiDataSource/)
    })

    it('does not import the static-adapter module', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/static-adapter/)
      expect(RUNTIME_SOURCE).not.toMatch(/createStaticDataSource/)
    })

    it('does not import the data-source contract runtime exports', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/selectDataSource/)
      expect(RUNTIME_SOURCE).not.toMatch(/isDataSourceKind/)
      expect(RUNTIME_SOURCE).not.toMatch(/DEFAULT_DATA_SOURCE/)
      expect(RUNTIME_SOURCE).not.toMatch(/DataSourceMissingConfigError/)
      expect(RUNTIME_SOURCE).not.toMatch(/DataSourceHttpError/)
      expect(RUNTIME_SOURCE).not.toMatch(/DataSourceTimeoutError/)
      expect(RUNTIME_SOURCE).not.toMatch(/DataSourceInvalidPayloadError/)
      expect(RUNTIME_SOURCE).not.toMatch(/DataSourceNotImplementedError/)
    })

    it('does not declare any NUXT_AGENTS_* env-var name', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_AGENTS_DATA_SOURCE/)
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_AGENTS_API_URL/)
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_AGENTS_API_TIMEOUT_MS/)
    })

    it('does not read any process.env key', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/process\.env/)
    })

    it('does not gate the api adapter selection with typeof window', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/typeof\s+window/)
    })

    it('does not reference the server-only loader path or endpoint path', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/server\/utils\/agents/)
      expect(RUNTIME_SOURCE).not.toMatch(/server\/api\/agents/)
    })
  })

  describe('module-level (runtime exports)', () => {
    it('exports only the documented public surface', async () => {
      const mod = await import('./agents.service')
      const exportedNames = Object.keys(mod).sort()
      expect(exportedNames).toEqual([
        'agentsService',
      ])
    })

    it('does not expose any api-adapter symbol on the module exports', async () => {
      const mod = await import('./agents.service')
      expect(mod).not.toHaveProperty('createApiDataSource')
      expect(mod).not.toHaveProperty('ApiDataSourceOptions')
      expect(mod).not.toHaveProperty('ApiDataSourceFetch')
    })

    it('does not expose a resolveKind or selectAgentsAdapter helper', async () => {
      const mod = await import('./agents.service')
      expect(mod).not.toHaveProperty('resolveKind')
      expect(mod).not.toHaveProperty('selectAgentsAdapter')
      expect(mod).not.toHaveProperty('getApiAdapter')
    })

    it('the exported agentsService has only the documented public surface', async () => {
      const mod = await import('./agents.service')
      const service = mod.agentsService
      const surface = Object.keys(service).sort()
      // `loadAll` (async) + `getBySlug` (pure helper). A
      // regression that adds a synchronous `getAll` would
      // be caught here — the sync accessor was removed in
      // the v1.1.0 M17 async contract evolution and the
      // agent service follows the same pattern in M21.
      expect(surface).toEqual([
        'getBySlug',
        'loadAll',
      ])
    })
  })
})