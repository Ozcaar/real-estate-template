// `$fetch` is a Nuxt-built-in universal fetch auto-injected as
// a global on both server and client; the service uses the
// global (no explicit import from `#imports`). In Vitest the
// auto-injection does not run, so we stub `$fetch` to return
// the bundled static catalog — exactly what the server-only
// loader at `server/utils/agents.ts` returns in the default
// (static) configuration.
//
// The stub is set after the static imports so ESLint's
// `import/first` rule stays satisfied.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { agentsService } from './agents.service'
import { sampleAgents } from '../data/agents'
import type { Agent } from '../types/agent.types'

vi.stubGlobal('$fetch', <T = unknown>(_url: string, _options?: unknown): Promise<T> => {
  return Promise.resolve(sampleAgents as unknown as T)
})

/**
 * Tests for `agentsService` after the v1.1.0 M21 async
 * contract evolution (mirrors `propertiesService`).
 *
 * The service consumes the async data-source contract through
 * `loadAll()` and exposes a pure helper (`getBySlug(data,
 * slug)`) that takes the loaded data as its first argument.
 * The tests focus on:
 *
 *  - `loadAll()` returns the resolved public agent list from
 *    the same-origin Nitro endpoint (verified via `$fetch`
 *    stub).
 *  - `getBySlug(data, slug)` returns the right record,
 *    returns `undefined` for missing slugs, is case-sensitive,
 *    and is empty-string safe.
 *  - Every agent returned by `loadAll()` is reachable through
 *    `getBySlug(data, agent.slug)` (cross-check on slug
 *    uniqueness).
 *  - The service is source-agnostic — the helper is pure and
 *    works on any data array passed in.
 *
 * The static catalog is the production data; the data is
 * loaded once via `agentsService.loadAll()` in `beforeAll` and
 * the resolved array is shared across every test.
 */

let agents: readonly Agent[]

beforeAll(async () => {
  agents = await agentsService.loadAll()
})

function makeAgent(overrides: Partial<Agent>): Agent {
  return {
    id: 'test-agent-001',
    name: 'Test Agent',
    slug: 'test-agent',
    role: 'Test role',
    bio: 'A test agent.',
    image: '/images/test.svg',
    ...overrides,
  }
}

describe('agentsService.loadAll', () => {
  it('returns every agent in the static catalog in insertion order', async () => {
    const loaded = await agentsService.loadAll()
    expect(loaded).toHaveLength(sampleAgents.length)
    for (let i = 0; i < loaded.length; i++) {
      expect(loaded[i].id).toBe(sampleAgents[i].id)
    }
  })

  it('returns at least one agent in the static catalog', async () => {
    const loaded = await agentsService.loadAll()
    expect(loaded.length).toBeGreaterThan(0)
  })

  it('every agent has a unique, non-empty, URL-safe slug', async () => {
    const loaded = await agentsService.loadAll()
    const slugs = new Set<string>()
    for (const agent of loaded) {
      expect(typeof agent.slug).toBe('string')
      expect(agent.slug.length, 'agent.slug should be non-empty').toBeGreaterThan(0)
      // URL-safe: lowercase letters, digits, and hyphens only.
      expect(agent.slug, 'agent.slug should match /^[a-z0-9-]+$/').toMatch(/^[a-z0-9-]+$/)
      expect(slugs.has(agent.slug), `agent.slug must be unique; duplicate: ${agent.slug}`).toBe(false)
      slugs.add(agent.slug)
    }
  })
})

describe('agentsService.getBySlug', () => {
  it('returns the matching agent', () => {
    const target = sampleAgents[0]
    const result = agentsService.getBySlug(agents, target.slug)
    expect(result).toBeDefined()
    expect(result?.id).toBe(target.id)
  })

  it('returns undefined for an unknown slug', () => {
    expect(agentsService.getBySlug(agents, 'does-not-exist')).toBeUndefined()
  })

  it('is case-sensitive', () => {
    const target = sampleAgents[0]
    const upper = target.slug.toUpperCase()
    // Only assert the negative case — if the target's slug is
    // already uppercase the test would degenerate. The
    // static catalog ships already-lowercase slugs, so the
    // upper case is reliably distinct.
    if (upper !== target.slug) {
      expect(agentsService.getBySlug(agents, upper)).toBeUndefined()
    }
  })

  it('returns undefined for an empty slug', () => {
    expect(agentsService.getBySlug(agents, '')).toBeUndefined()
  })

  it('every catalog agent is reachable through getBySlug', () => {
    // Cross-check: every agent returned by `loadAll` is also
    // reachable by `getBySlug(data, agent.slug)`. This is
    // the inverse of "all unique slugs" above and guards
    // against a future catalog edit that accidentally
    // produces a duplicate slug.
    for (const agent of agents) {
      expect(agentsService.getBySlug(agents, agent.slug)?.id).toBe(agent.id)
    }
  })

  it('the helper is source-agnostic — works on any data array passed in', () => {
    // The helper takes the loaded data as its first
    // argument; it does not call `loadAll()` itself. A
    // caller-supplied array (a unit-test fixture, an
    // alternate source) is the documented input shape.
    const fixture = [
      makeAgent({ id: 'fixture-001', slug: 'fixture-001' }),
      makeAgent({ id: 'fixture-002', slug: 'fixture-002' }),
    ]
    expect(agentsService.getBySlug(fixture, 'fixture-001')?.id).toBe('fixture-001')
    expect(agentsService.getBySlug(fixture, 'missing')).toBeUndefined()
  })

  it('the helper returns undefined for an empty data array', () => {
    expect(agentsService.getBySlug([], 'any-slug')).toBeUndefined()
  })
})

describe('agentsService — fixture type-check', () => {
  it('the makeAgent fixture produces a valid Agent', () => {
    // The fixture is used to exercise the type-checker on
    // the service surface; if the `Agent` interface ever
    // changes (e.g. a new required field is added), this
    // case will fail to compile and surface the change here.
    const fixture = makeAgent({ id: 'fixture-001' })
    expect(fixture.id).toBe('fixture-001')
    expect(fixture.slug).toBe('test-agent')
  })
})