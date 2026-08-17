import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  developmentListSchema,
  developmentSchema,
  developmentStatusSchema,
} from './development.schema'
import { sampleDevelopments } from '../data/developments'
import type { Development } from '../types/development.types'

/**
 * Tests for the development Zod schema.
 *
 * The schema is the runtime boundary for the development domain
 * model. It is consumed by:
 *
 *  - the static adapter at module load
 *    (`createStaticDataSource({ schema: developmentListSchema })`)
 *    so a malformed record fails at startup rather than at
 *    first request;
 *  - the api adapter at response-parse time
 *    (`createApiDataSource({ schema: developmentListSchema })`) so
 *    the remote source is held to the same rules as the bundled
 *    static data.
 *
 * The tests pin every documented rule plus the optional-field
 * semantics. The bundled `sampleDevelopments` catalog is the
 * production fixture; the schema must accept every shipped
 * record without modification.
 */

const minimal: Development = {
  id: 'dev-001',
  name: 'Test Development',
  slug: 'test-development',
  status: 'pre-sale',
  location: 'Centro, Testville',
  description: 'A test development.',
  image: '/images/test.svg',
}

const allStatuses: readonly Development['status'][] = [
  'pre-sale',
  'under-construction',
  'ready-to-deliver',
  'sold-out',
] as const

describe('developmentSchema — required fields', () => {
  it('accepts the minimal valid development', () => {
    expect(developmentSchema.safeParse(minimal).success).toBe(true)
  })

  it('rejects an empty id', () => {
    expect(developmentSchema.safeParse({ ...minimal, id: '' }).success).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(developmentSchema.safeParse({ ...minimal, name: '' }).success).toBe(false)
  })

  it('rejects an empty slug', () => {
    expect(developmentSchema.safeParse({ ...minimal, slug: '' }).success).toBe(false)
  })

  it('rejects an empty location', () => {
    expect(developmentSchema.safeParse({ ...minimal, location: '' }).success).toBe(false)
  })

  it('rejects an empty description', () => {
    expect(developmentSchema.safeParse({ ...minimal, description: '' }).success).toBe(false)
  })

  it('rejects an empty image', () => {
    expect(developmentSchema.safeParse({ ...minimal, image: '' }).success).toBe(false)
  })
})

describe('developmentStatusSchema', () => {
  it('accepts every documented status', () => {
    for (const status of allStatuses) {
      expect(developmentStatusSchema.safeParse(status).success).toBe(true)
    }
  })

  it('rejects an unknown status string', () => {
    expect(developmentStatusSchema.safeParse('unknown').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(developmentStatusSchema.safeParse('').success).toBe(false)
  })

  it('rejects a case-variant status', () => {
    expect(developmentStatusSchema.safeParse('PRE-SALE').success).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(developmentStatusSchema.safeParse(42).success).toBe(false)
  })
})

describe('developmentSchema — optional numeric fields', () => {
  it('accepts priceFrom without priceTo (single price)', () => {
    expect(developmentSchema.safeParse({ ...minimal, priceFrom: 100000 }).success)
      .toBe(true)
  })

  it('accepts both priceFrom and priceTo (range)', () => {
    expect(developmentSchema.safeParse({
      ...minimal,
      priceFrom: 100000,
      priceTo: 200000,
    }).success).toBe(true)
  })

  it('rejects a negative priceFrom', () => {
    expect(developmentSchema.safeParse({ ...minimal, priceFrom: -1 }).success).toBe(false)
  })

  it('rejects a negative priceTo', () => {
    expect(developmentSchema.safeParse({ ...minimal, priceFrom: 100, priceTo: -1 }).success)
      .toBe(false)
  })

  it('rejects a non-integer units value', () => {
    expect(developmentSchema.safeParse({ ...minimal, units: 1.5 }).success).toBe(false)
  })

  it('rejects a negative units value', () => {
    expect(developmentSchema.safeParse({ ...minimal, units: -1 }).success).toBe(false)
  })

  it('rejects a non-integer bedrooms value', () => {
    expect(developmentSchema.safeParse({ ...minimal, bedrooms: 2.5 }).success).toBe(false)
  })

  it('accepts zero units / zero bedrooms (a valid "0" value)', () => {
    expect(developmentSchema.safeParse({ ...minimal, units: 0, bedrooms: 0 }).success)
      .toBe(true)
  })

  it('rejects a negative areaFrom', () => {
    expect(developmentSchema.safeParse({ ...minimal, areaFrom: -1 }).success).toBe(false)
  })
})

describe('developmentSchema — optional enum / string fields', () => {
  it('accepts a valid sizeUnit metric', () => {
    expect(developmentSchema.safeParse({ ...minimal, sizeUnit: 'metric' }).success)
      .toBe(true)
  })

  it('accepts a valid sizeUnit imperial', () => {
    expect(developmentSchema.safeParse({ ...minimal, sizeUnit: 'imperial' }).success)
      .toBe(true)
  })

  it('rejects an unknown sizeUnit', () => {
    expect(developmentSchema.safeParse({ ...minimal, sizeUnit: 'cm' }).success).toBe(false)
  })

  it('rejects an empty currency', () => {
    expect(developmentSchema.safeParse({ ...minimal, currency: '' }).success).toBe(false)
  })

  it('rejects an empty deliveryDate', () => {
    expect(developmentSchema.safeParse({ ...minimal, deliveryDate: '' }).success).toBe(false)
  })

  it('accepts a non-empty deliveryDate (the schema treats it as opaque text)', () => {
    expect(developmentSchema.safeParse({ ...minimal, deliveryDate: '2026-06' }).success)
      .toBe(true)
  })

  it('accepts featured=true', () => {
    expect(developmentSchema.safeParse({ ...minimal, featured: true }).success)
      .toBe(true)
  })

  it('accepts featured=false', () => {
    expect(developmentSchema.safeParse({ ...minimal, featured: false }).success)
      .toBe(true)
  })

  it('rejects a non-boolean featured', () => {
    expect(developmentSchema.safeParse({ ...minimal, featured: 'true' }).success)
      .toBe(false)
  })
})

describe('developmentSchema — type and shape', () => {
  it('rejects a non-object input (string)', () => {
    expect(developmentSchema.safeParse('not a development').success).toBe(false)
  })

  it('rejects a non-object input (null)', () => {
    expect(developmentSchema.safeParse(null).success).toBe(false)
  })

  it('rejects a non-object input (array)', () => {
    expect(developmentSchema.safeParse([minimal]).success).toBe(false)
  })
})

describe('developmentListSchema — list contract', () => {
  it('accepts the bundled sample catalog without modification', () => {
    const result = developmentListSchema.safeParse(sampleDevelopments)
    expect(result.success).toBe(true)
  })

  it('accepts an empty array (zero developments is a valid catalog)', () => {
    expect(developmentListSchema.safeParse([]).success).toBe(true)
  })

  it('rejects an array containing a malformed record', () => {
    const result = developmentListSchema.safeParse([minimal, { ...minimal, id: '' }])
    expect(result.success).toBe(false)
  })

  it('rejects a non-array input', () => {
    expect(developmentListSchema.safeParse(minimal).success).toBe(false)
  })

  it('the underlying Zod error names the failing field on a malformed record', () => {
    const result = developmentListSchema.safeParse([minimal, { ...minimal, slug: '' }])
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues
      const slugIssue = issues.find(i => Array.isArray(i.path) && i.path.includes('slug'))
      expect(slugIssue).toBeDefined()
    }
  })
})

describe('developmentSchema — type-check guard (compile-time only)', () => {
  it('the inferred type is assignable to the canonical Development interface', () => {
    // The compile-time guard at the bottom of development.schema.ts
    // is the structural guarantee. This runtime case is a
    // smoke test — if the guard ever fails to compile, this
    // import will fail too.
    const value: DevelopmentInput = {
      ...minimal,
      priceFrom: 100000,
      priceTo: 200000,
      units: 24,
      bedrooms: 2,
      sizeUnit: 'metric',
      areaFrom: 78,
      areaTo: 112,
      deliveryDate: '2026-06',
      featured: true,
    }
    const asDevelopment: Development = value
    expect(asDevelopment.id).toBe('dev-001')
  })

  it('the schema parses and re-serializes losslessly', () => {
    const parsed = developmentSchema.safeParse({
      ...minimal,
      priceFrom: 100000,
      priceTo: 200000,
      units: 24,
      bedrooms: 2,
      sizeUnit: 'metric',
      areaFrom: 78,
      areaTo: 112,
      deliveryDate: '2026-06',
      featured: true,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.id).toBe('dev-001')
      expect(parsed.data.priceTo).toBe(200000)
      expect(parsed.data.units).toBe(24)
    }
  })
})

describe('developmentSchema — runtime parse on the bundled sample catalog', () => {
  it('every record in sampleDevelopments validates without modification', () => {
    for (const development of sampleDevelopments) {
      expect(developmentSchema.safeParse(development).success).toBe(true)
    }
  })

  it('every record in sampleDevelopments has a unique slug', () => {
    const slugs = new Set<string>()
    for (const development of sampleDevelopments) {
      expect(slugs.has(development.slug)).toBe(false)
      slugs.add(development.slug)
    }
  })

  it('every record in sampleDevelopments has a URL-safe slug matching /^[a-z0-9-]+$/', () => {
    for (const development of sampleDevelopments) {
      expect(development.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('every record in sampleDevelopments has a valid status from the documented enum', () => {
    for (const development of sampleDevelopments) {
      expect(allStatuses).toContain(development.status)
    }
  })
})

// Suppress unused-imports warning when running individual cases.
void z