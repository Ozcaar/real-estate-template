import { describe, expect, it } from 'vitest'
import { agentsService } from './agents.service'
import { sampleAgents } from '../data/agents'
import type { Agent } from '../types/agent.types'

/**
 * Tests for `agentsService`. The service is pure, synchronous, and
 * reads from a static catalog (`sampleAgents`). The tests focus on:
 *
 *  - `getAll` returns every agent in insertion order and every
 *    agent carries a unique, URL-safe, non-empty `slug`.
 *  - `getBySlug` returns the right record, returns `undefined` for
 *    missing slugs, and is case-sensitive.
 *
 * The static catalog is the production data. The model intentionally
 * has no `status: 'hidden'` field, no `featured` flag, and no
 * `getRelated` helper (see `agents.service.ts` JSDoc); the suite
 * is therefore the minimal contract the detail page relies on.
 */

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

describe('agentsService.getAll', () => {
  it('returns every agent in the static catalog in insertion order', () => {
    const all = agentsService.getAll()
    expect(all).toHaveLength(sampleAgents.length)
    for (let i = 0; i < all.length; i++) {
      expect(all[i].id).toBe(sampleAgents[i].id)
    }
  })

  it('returns at least one agent in the static catalog', () => {
    // Sanity check on the test fixture: the `getBySlug` cases below
    // depend on the catalog being non-empty.
    expect(agentsService.getAll().length).toBeGreaterThan(0)
  })

  it('every agent has a unique, non-empty, URL-safe slug', () => {
    const all = agentsService.getAll()
    const slugs = new Set<string>()
    for (const agent of all) {
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
    const result = agentsService.getBySlug(target.slug)
    expect(result).toBeDefined()
    expect(result?.id).toBe(target.id)
  })

  it('returns undefined for an unknown slug', () => {
    expect(agentsService.getBySlug('does-not-exist')).toBeUndefined()
  })

  it('is case-sensitive', () => {
    const target = sampleAgents[0]
    const upper = target.slug.toUpperCase()
    // Only assert the negative case — if the target's slug is already
    // uppercase the test would degenerate. The static catalog ships
    // already-lowercase slugs, so the upper case is reliably distinct.
    if (upper !== target.slug) {
      expect(agentsService.getBySlug(upper)).toBeUndefined()
    }
  })

  it('returns undefined for an empty slug', () => {
    expect(agentsService.getBySlug('')).toBeUndefined()
  })

  it('every catalog agent is reachable through getBySlug', () => {
    // Cross-check: every agent returned by `getAll` is also reachable
    // by `getBySlug(agent.slug)`. This is the inverse of "all unique
    // slugs" above and guards against a future catalog edit that
    // accidentally produces a duplicate slug.
    for (const agent of agentsService.getAll()) {
      expect(agentsService.getBySlug(agent.slug)?.id).toBe(agent.id)
    }
  })
})

describe('agentsService — fixture type-check', () => {
  it('the makeAgent fixture produces a valid Agent', () => {
    // The fixture is used to exercise the type-checker on the
    // service surface; if the `Agent` interface ever changes (e.g.
    // a new required field is added), this case will fail to
    // compile and surface the change here.
    const fixture = makeAgent({ id: 'fixture-001' })
    expect(fixture.id).toBe('fixture-001')
    expect(fixture.slug).toBe('test-agent')
  })
})
