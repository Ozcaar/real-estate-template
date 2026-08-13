import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Boundary regression tests for the property service.
 *
 * The HTTP property data source and its private configuration
 * (`NUXT_PROPERTIES_DATA_SOURCE`, `NUXT_PROPERTIES_API_URL`,
 * `NUXT_PROPERTIES_API_TIMEOUT_MS`) must remain server-only.
 * The property service is imported by page files in
 * `app/pages/`, which Nuxt bundles to BOTH the server and the
 * client. If the service ever:
 *
 *  - imported the api-adapter module
 *    (`app/core/data-source/adapters/api-adapter.ts`),
 *  - imported the static-adapter module
 *    (`app/core/data-source/adapters/static-adapter.ts`),
 *  - imported the data-source contract's runtime exports
 *    (the `selectDataSource` selector, the `DataSourceKind`
 *    type, the `isDataSourceKind` type guard, the four error
 *    classes),
 *  - declared or read any `NUXT_PROPERTIES_API_*` env var
 *    in its runtime code, or
 *  - relied solely on `typeof window === 'undefined'` as the
 *    server / client boundary,
 *
 * the api-adapter module and the env-var name strings would
 * reach the client bundle via tree-shaking reachability. The
 * structural boundary is the `server/utils/` directory: the
 * server-only property loader at
 * `server/utils/properties.ts` and the same-origin Nitro
 * endpoint at `server/api/properties.get.ts` are bundled to
 * the Nitro server output only. The service consumes the
 * resolved public list through `$fetch('/api/properties')` —
 * the client bundle references only the same-origin path.
 *
 * These tests pin that contract at the source-file level. A
 * textual scan of `properties.service.ts` fails the suite if
 * any of the protected identifiers ever reappears in the
 * runtime code. The textual scan tolerates the documented
 * appearances in JSDoc comments because comments are stripped
 * by the bundler before the file reaches the client.
 */

const SERVICE_PATH = join(__dirname, 'properties.service.ts')

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const RUNTIME_SOURCE = stripComments(readFileSync(SERVICE_PATH, 'utf8'))

describe('propertiesService — server-only / client-safe boundary', () => {
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

    it('does not declare any NUXT_PROPERTIES_API_* env-var name', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_PROPERTIES_DATA_SOURCE/)
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_PROPERTIES_API_URL/)
      expect(RUNTIME_SOURCE).not.toMatch(/NUXT_PROPERTIES_API_TIMEOUT_MS/)
    })

    it('does not read any process.env key', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/process\.env/)
    })

    it('does not gate the api adapter selection with typeof window', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/typeof\s+window/)
    })

    it('does not reference useState or properties-state-key', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/useState/)
      expect(RUNTIME_SOURCE).not.toMatch(/PROPERTIES_DATA_STATE_KEY/)
      expect(RUNTIME_SOURCE).not.toMatch(/properties-state-key/)
    })

    it('does not reference the server-only plugin path or loader path', () => {
      expect(RUNTIME_SOURCE).not.toMatch(/properties-source/)
      expect(RUNTIME_SOURCE).not.toMatch(/server\/utils\/properties/)
    })
  })

  describe('module-level (runtime exports)', () => {
    it('exports only the documented public surface', async () => {
      const mod = await import('./properties.service')
      const exportedNames = Object.keys(mod).sort()
      expect(exportedNames).toEqual([
        'isPropertySort',
        'propertiesService',
      ])
    })

    it('does not expose any api-adapter symbol on the module exports', async () => {
      const mod = await import('./properties.service')
      expect(mod).not.toHaveProperty('createApiDataSource')
      expect(mod).not.toHaveProperty('ApiDataSourceOptions')
      expect(mod).not.toHaveProperty('ApiDataSourceFetch')
    })

    it('does not expose a resolveKind or selectPropertiesAdapter helper', async () => {
      const mod = await import('./properties.service')
      expect(mod).not.toHaveProperty('resolveKind')
      expect(mod).not.toHaveProperty('selectPropertiesAdapter')
      expect(mod).not.toHaveProperty('getApiAdapter')
    })
  })
})