import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataSourceMissingConfigError } from '~/core/data-source/data-source'
import {
  createSanityClientConfig,
  DEFAULT_SANITY_API_VERSION,
  DEFAULT_SANITY_DATASET,
} from './sanity-config'

/**
 * Tests for the Sanity client / config layer.
 *
 * The factory validates the required `NUXT_SANITY_PROJECT_ID`
 * and `NUXT_SANITY_DATASET` (after the default substitution)
 * synchronously. The token is optional — a public dataset can
 * be queried without authentication. The `@sanity/client`
 * SDK is mocked because the test environment does not have
 * network access and the SDK constructor would otherwise
 * attempt to record the project ID; we only need to assert
 * that the factory validates the env vars and the underlying
 * client API is constructed with the right fields.
 */

const ENV_PROJECT_ID = 'NUXT_SANITY_PROJECT_ID'
const ENV_DATASET = 'NUXT_SANITY_DATASET'
const ENV_API_VERSION = 'NUXT_SANITY_API_VERSION'
const ENV_TOKEN = 'NUXT_SANITY_TOKEN'

const originalEnv = { ...process.env }

beforeEach(() => {
  Reflect.deleteProperty(process.env, ENV_PROJECT_ID)
  Reflect.deleteProperty(process.env, ENV_DATASET)
  Reflect.deleteProperty(process.env, ENV_API_VERSION)
  Reflect.deleteProperty(process.env, ENV_TOKEN)
  vi.resetModules()
})

afterEach(() => {
  for (const key of [ENV_PROJECT_ID, ENV_DATASET, ENV_API_VERSION, ENV_TOKEN]) {
    Reflect.deleteProperty(process.env, key)
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key)
    }
    else {
      process.env[key] = value
    }
  }
  vi.resetModules()
})

describe('server/utils/sanity-config', () => {
  describe('createSanityClientConfig — validation', () => {
    it('throws DataSourceMissingConfigError when NUXT_SANITY_PROJECT_ID is unset', () => {
      process.env[ENV_DATASET] = 'production'
      expect(() => createSanityClientConfig()).toThrow(
        DataSourceMissingConfigError,
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_SANITY_PROJECT_ID is empty', () => {
      process.env[ENV_PROJECT_ID] = ''
      process.env[ENV_DATASET] = 'production'
      expect(() => createSanityClientConfig()).toThrow(
        DataSourceMissingConfigError,
      )
    })

    it('throws DataSourceMissingConfigError when NUXT_SANITY_PROJECT_ID is whitespace', () => {
      process.env[ENV_PROJECT_ID] = '   '
      process.env[ENV_DATASET] = 'production'
      expect(() => createSanityClientConfig()).toThrow(
        DataSourceMissingConfigError,
      )
    })

    it('falls back to the default dataset when NUXT_SANITY_DATASET is unset', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      const config = createSanityClientConfig()
      expect(config.dataset).toBe(DEFAULT_SANITY_DATASET)
    })

    it('falls back to the default API version when NUXT_SANITY_API_VERSION is unset', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      const config = createSanityClientConfig()
      expect(config.apiVersion).toBe(DEFAULT_SANITY_API_VERSION)
    })

    it('honors a custom dataset', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      process.env[ENV_DATASET] = 'staging'
      const config = createSanityClientConfig()
      expect(config.dataset).toBe('staging')
    })

    it('honors a custom API version', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      process.env[ENV_API_VERSION] = '2025-01-15'
      const config = createSanityClientConfig()
      expect(config.apiVersion).toBe('2025-01-15')
    })

    it('returns an empty token when NUXT_SANITY_TOKEN is unset', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      const config = createSanityClientConfig()
      expect(config.token).toBe('')
    })

    it('honors a custom token', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      process.env[ENV_TOKEN] = 'read-token-xyz'
      const config = createSanityClientConfig()
      expect(config.token).toBe('read-token-xyz')
    })
  })

  describe('createSanityClientConfig — success', () => {
    it('returns a structured Sanity config with the resolved fields', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      process.env[ENV_DATASET] = 'production'
      process.env[ENV_API_VERSION] = '2024-01-01'
      process.env[ENV_TOKEN] = 'read-token'
      const config = createSanityClientConfig()
      expect(config.projectId).toBe('abc123')
      expect(config.dataset).toBe('production')
      expect(config.apiVersion).toBe('2024-01-01')
      expect(config.token).toBe('read-token')
      expect(config.source).toBe('sanity:abc123/production')
      expect(typeof config.client.fetch).toBe('function')
    })

    it('trims whitespace from the project ID', () => {
      process.env[ENV_PROJECT_ID] = '  abc123  '
      process.env[ENV_DATASET] = 'production'
      const config = createSanityClientConfig()
      expect(config.projectId).toBe('abc123')
    })

    it('trims whitespace from the token', () => {
      process.env[ENV_PROJECT_ID] = 'abc123'
      process.env[ENV_TOKEN] = '  read-token  '
      const config = createSanityClientConfig()
      expect(config.token).toBe('read-token')
    })
  })
})
