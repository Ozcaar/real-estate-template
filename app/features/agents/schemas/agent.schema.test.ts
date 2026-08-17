import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  agentListSchema,
  agentSchema,
} from './agent.schema'
import { sampleAgents } from '../data/agents'
import type { Agent } from '../types/agent.types'

/**
 * Tests for the agent Zod schema.
 *
 * The schema is the runtime boundary for the agent domain
 * model. It is consumed by:
 *
 *  - the static adapter at module load
 *    (`createStaticDataSource({ schema: agentListSchema })`)
 *    so a malformed record fails at startup rather than at
 *    first request;
 *  - the api adapter at response-parse time
 *    (`createApiDataSource({ schema: agentListSchema })`) so the
 *    remote source is held to the same rules as the bundled
 *    static data.
 *
 * The tests pin every documented rule plus the optional-field
 * semantics. The bundled `sampleAgents` catalog is the
 * production fixture; the schema must accept every shipped
 * record without modification.
 */

const minimal: Agent = {
  id: 'agent-001',
  name: 'Test Agent',
  slug: 'test-agent',
  role: 'Test role',
  bio: 'A test agent.',
  image: '/images/test.svg',
}

describe('agentSchema — required fields', () => {
  it('accepts the minimal valid agent', () => {
    expect(agentSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejects an empty id', () => {
    expect(agentSchema.safeParse({ ...minimal, id: '' }).success).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(agentSchema.safeParse({ ...minimal, name: '' }).success).toBe(false)
  })

  it('rejects an empty slug', () => {
    expect(agentSchema.safeParse({ ...minimal, slug: '' }).success).toBe(false)
  })

  it('rejects an empty role', () => {
    expect(agentSchema.safeParse({ ...minimal, role: '' }).success).toBe(false)
  })

  it('rejects an empty bio', () => {
    expect(agentSchema.safeParse({ ...minimal, bio: '' }).success).toBe(false)
  })

  it('rejects an empty image', () => {
    expect(agentSchema.safeParse({ ...minimal, image: '' }).success).toBe(false)
  })
})

describe('agentSchema — optional fields', () => {
  it('accepts an agent with phone', () => {
    expect(agentSchema.safeParse({ ...minimal, phone: '+1-555-0100' }).success).toBe(true)
  })

  it('accepts an agent with email', () => {
    expect(agentSchema.safeParse({ ...minimal, email: 'agent@example.com' }).success).toBe(true)
  })

  it('accepts an agent with whatsapp', () => {
    expect(agentSchema.safeParse({ ...minimal, whatsapp: '+1-555-0100' }).success).toBe(true)
  })

  it('accepts an agent with non-empty specialties', () => {
    expect(agentSchema.safeParse({ ...minimal, specialties: ['Residential'] }).success).toBe(true)
  })

  it('accepts an empty specialties array (the .min(1) constraint is per item)', () => {
    // `specialties` itself is optional; when supplied as an
    // empty array the per-item `.min(1)` constraint is
    // vacuously satisfied. The detail page treats an empty
    // array as "no specialties" via `hasSpecialties` and
    // hides the badges block.
    expect(agentSchema.safeParse({ ...minimal, specialties: [] }).success).toBe(true)
  })

  it('rejects a non-empty specialties array containing an empty string', () => {
    expect(agentSchema.safeParse({ ...minimal, specialties: ['Residential', ''] }).success).toBe(false)
  })

  it('accepts the omission of every optional field', () => {
    const result = agentSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })
})

describe('agentSchema — type and shape', () => {
  it('rejects a non-object input (string)', () => {
    expect(agentSchema.safeParse('not an agent').success).toBe(false)
  })

  it('rejects a non-object input (null)', () => {
    expect(agentSchema.safeParse(null).success).toBe(false)
  })

  it('rejects a non-object input (array)', () => {
    expect(agentSchema.safeParse([minimal]).success).toBe(false)
  })
})

describe('agentListSchema — list contract', () => {
  it('accepts the bundled sample catalog without modification', () => {
    const result = agentListSchema.safeParse(sampleAgents)
    expect(result.success).toBe(true)
  })

  it('accepts an empty array (zero agents is a valid catalog)', () => {
    expect(agentListSchema.safeParse([]).success).toBe(true)
  })

  it('rejects an array containing a malformed record', () => {
    const result = agentListSchema.safeParse([minimal, { ...minimal, id: '' }])
    expect(result.success).toBe(false)
  })

  it('rejects a non-array input', () => {
    expect(agentListSchema.safeParse(minimal).success).toBe(false)
  })

  it('the underlying Zod error names the failing field on a malformed record', () => {
    const result = agentListSchema.safeParse([minimal, { ...minimal, slug: '' }])
    expect(result.success).toBe(false)
    if (!result.success) {
      // The error must include the path so a misconfigured
      // upstream is easy to diagnose.
      const issues = result.error.issues
      const slugIssue = issues.find(i => Array.isArray(i.path) && i.path.includes('slug'))
      expect(slugIssue).toBeDefined()
    }
  })
})

describe('agentSchema — type-check guard (compile-time only)', () => {
  it('the inferred type is assignable to the canonical Agent interface', () => {
    // The compile-time guard at the bottom of agent.schema.ts
    // is the structural guarantee. This runtime case is a
    // smoke test — if the guard ever fails to compile, this
    // import will fail too.
    const value: AgentInput = {
      ...minimal,
      phone: '+1-555-0100',
      specialties: ['Residential'],
    }
    const asAgent: Agent = value
    expect(asAgent.id).toBe('agent-001')
  })

  it('the schema parses and re-serializes losslessly', () => {
    const parsed = agentSchema.safeParse({
      ...minimal,
      phone: '+1-555-0100',
      specialties: ['Residential', 'First-time buyers'],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.id).toBe('agent-001')
      expect(parsed.data.specialties).toEqual(['Residential', 'First-time buyers'])
    }
  })
})

describe('agentSchema — runtime parse on the bundled sample catalog', () => {
  it('every record in sampleAgents validates without modification', () => {
    for (const agent of sampleAgents) {
      expect(agentSchema.safeParse(agent).success).toBe(true)
    }
  })

  it('every record in sampleAgents has a unique slug', () => {
    // Cross-check: the detail page relies on slug uniqueness
    // to resolve `/agents/[slug]`. A future catalog edit that
    // accidentally produces a duplicate slug is caught here
    // (and on the listing page's "every catalog agent is
    // reachable through getBySlug" case in the service
    // tests).
    const slugs = new Set<string>()
    for (const agent of sampleAgents) {
      expect(slugs.has(agent.slug)).toBe(false)
      slugs.add(agent.slug)
    }
  })

  it('every record in sampleAgents has a URL-safe slug matching /^[a-z0-9-]+$/', () => {
    for (const agent of sampleAgents) {
      expect(agent.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

// Suppress unused-imports warning when running individual cases.
void z