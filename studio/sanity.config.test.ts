import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sanity Studio config tests (Task 118).
 *
 * The Studio config (`sanity.config.ts`) refuses to boot
 * without a `SANITY_STUDIO_PROJECT_ID`. The `process.env`
 * read and the throw happen at module load time.
 *
 * The tests below use `vi.resetModules()` and `vi.stubEnv`
 * to control the env vars between cases. The dynamic
 * `import('./sanity.config')` call re-evaluates the module
 * with the new env vars.
 *
 * The fail-fast test imports the config without an env
 * var and asserts the documented error. The other tests
 * verify the success path (default dataset, override
 * dataset, dev-only Vision plugin).
 */
describe('studio/sanity.config.ts', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws when SANITY_STUDIO_PROJECT_ID is empty', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', '')
    let error: Error | undefined
    try {
      await import('./sanity.config')
    }
    catch (cause) {
      error = cause as Error
    }
    expect(error).toBeDefined()
    expect(error?.message).toMatch(/SANITY_STUDIO_PROJECT_ID is required/)
  }, 30_000)

  it('loads when SANITY_STUDIO_PROJECT_ID is set', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'test-project-id')
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./sanity.config')
    const config = (mod.default as unknown as {
      projectId: string
      dataset: string
      plugins: Array<{ name?: string } & { [Symbol.toStringTag]?: string }>
    })
    expect(config.projectId).toBe('test-project-id')
    expect(config.dataset).toBe('production')
  }, 30_000)

  it('defaults dataset to production when SANITY_STUDIO_DATASET is unset', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'test-project-id')
    vi.stubEnv('SANITY_STUDIO_DATASET', undefined as unknown as string)
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./sanity.config')
    const config = (mod.default as unknown as { dataset: string })
    expect(config.dataset).toBe('production')
  }, 30_000)

  it('uses the override SANITY_STUDIO_DATASET when supplied', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'test-project-id')
    vi.stubEnv('SANITY_STUDIO_DATASET', 'staging')
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./sanity.config')
    const config = (mod.default as unknown as { dataset: string })
    expect(config.dataset).toBe('staging')
  }, 30_000)

  it('does not include visionTool in a production build', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'test-project-id')
    vi.stubEnv('NODE_ENV', 'production')
    const mod = await import('./sanity.config')
    const config = (mod.default as unknown as {
      plugins: Array<{ name?: string } & { [Symbol.toStringTag]?: string }>
    })
    const pluginNames = config.plugins.map(p => p.name ?? p[Symbol.toStringTag] ?? '')
    expect(pluginNames.some(name => name.includes('vision'))).toBe(false)
  }, 30_000)

  it('includes visionTool in a development build', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'test-project-id')
    vi.stubEnv('NODE_ENV', 'development')
    const mod = await import('./sanity.config')
    const config = (mod.default as unknown as {
      plugins: Array<{ name?: string } & { [Symbol.toStringTag]?: string }>
    })
    const pluginNames = config.plugins.map(p => p.name ?? p[Symbol.toStringTag] ?? '')
    expect(pluginNames.some(name => name.includes('vision'))).toBe(true)
  }, 30_000)
})
