import { describe, expect, it } from 'vitest'
import { paginate, parsePageParam } from './paginate'

/**
 * Tests for the generic pagination utilities.
 *
 * `parsePageParam` normalizes a raw `useRoute().query` value into a
 * safe 1-based page number. `paginate` slices a list into a single
 * page and clamps the requested page against the actual page count.
 *
 * Together they implement the URL contract documented in
 * `docs/DATA_MODELS.md` Section 9 ("Listing Query & Sort Shape"):
 * `?page=1` is omitted, invalid values normalize to 1, and a request
 * for page 99 on a 3-page set silently clamps to page 3.
 */

describe('parsePageParam', () => {
  it('returns 1 for null', () => {
    expect(parsePageParam(null)).toBe(1)
  })

  it('returns 1 for undefined', () => {
    expect(parsePageParam(undefined)).toBe(1)
  })

  it('returns 1 for an empty string', () => {
    expect(parsePageParam('')).toBe(1)
  })

  it('returns 1 for a whitespace-only string', () => {
    expect(parsePageParam('   ')).toBe(1)
  })

  it('returns 1 for "0"', () => {
    expect(parsePageParam('0')).toBe(1)
  })

  it('returns 1 for a negative number', () => {
    expect(parsePageParam('-3')).toBe(1)
  })

  it('returns 1 for a non-numeric string', () => {
    expect(parsePageParam('abc')).toBe(1)
  })

  it('parses a positive integer string', () => {
    expect(parsePageParam('5')).toBe(5)
  })

  it('parses a single-digit positive integer', () => {
    expect(parsePageParam('1')).toBe(1)
  })

  it('truncates a decimal value (1.9 → 1)', () => {
    expect(parsePageParam('1.9')).toBe(1)
  })

  it('truncates a decimal value (2.7 → 2)', () => {
    expect(parsePageParam('2.7')).toBe(2)
  })

  it('handles exponential notation as a finite number (1e2 → 100)', () => {
    // Number('1e2') === 100, which is finite, so it is accepted and
    // truncated to 100. The paginate() helper will clamp further.
    expect(parsePageParam('1e2')).toBe(100)
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parsePageParam('  3  ')).toBe(3)
  })

  it('returns 1 for a numeric string that evaluates to 0 (just whitespace + 0)', () => {
    expect(parsePageParam('  0  ')).toBe(1)
  })

  it('returns 1 for a non-string scalar (number)', () => {
    expect(parsePageParam(42 as unknown)).toBe(1)
  })

  it('returns 1 for a non-string scalar (boolean)', () => {
    expect(parsePageParam(true as unknown)).toBe(1)
  })

  it('returns 1 for an empty array', () => {
    expect(parsePageParam([])).toBe(1)
  })

  it('returns 1 for an array whose first element is undefined', () => {
    expect(parsePageParam([undefined as unknown])).toBe(1)
  })

  it('returns 1 for an array whose first element is null', () => {
    expect(parsePageParam([null as unknown])).toBe(1)
  })

  it('parses the first scalar value of a multi-value array', () => {
    expect(parsePageParam(['2', '3'])).toBe(2)
  })

  it('parses a non-integer numeric string in an array (3.5 → 3)', () => {
    expect(parsePageParam(['3.5'])).toBe(3)
  })

  it('returns 1 for an array whose first element is non-numeric', () => {
    expect(parsePageParam(['xyz'])).toBe(1)
  })
})

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

  it('returns the first page when requested page is 1 and there are items', () => {
    const result = paginate(items, 1, 3)
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(3)
    expect(result.totalItems).toBe(7)
    expect(result.totalPages).toBe(3)
  })

  it('returns the middle page when requested page is 2', () => {
    const result = paginate(items, 2, 3)
    expect(result.items).toEqual(['d', 'e', 'f'])
    expect(result.page).toBe(2)
  })

  it('returns the last partial page when requested page is 3 (7 items / 3 per page)', () => {
    const result = paginate(items, 3, 3)
    expect(result.items).toEqual(['g'])
    expect(result.page).toBe(3)
  })

  it('clamps an out-of-range page down to the last page', () => {
    const result = paginate(items, 99, 3)
    expect(result.items).toEqual(['g'])
    expect(result.page).toBe(3)
  })

  it('clamps a negative page up to 1', () => {
    const result = paginate(items, -5, 3)
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(result.page).toBe(1)
  })

  it('clamps a zero page up to 1', () => {
    const result = paginate(items, 0, 3)
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(result.page).toBe(1)
  })

  it('coerces a non-finite requested page to 1', () => {
    const result = paginate(items, Number.NaN, 3)
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(result.page).toBe(1)
  })

  it('floors a fractional requested page', () => {
    const result = paginate(items, 2.7, 3)
    expect(result.items).toEqual(['d', 'e', 'f'])
    expect(result.page).toBe(2)
  })

  it('coerces a pageSize of 0 to 1', () => {
    const result = paginate(items, 1, 0)
    expect(result.pageSize).toBe(1)
    expect(result.items).toEqual(['a'])
    expect(result.totalPages).toBe(7)
  })

  it('coerces a negative pageSize to 1', () => {
    const result = paginate(items, 1, -3)
    expect(result.pageSize).toBe(1)
    expect(result.items).toEqual(['a'])
  })

  it('floors a fractional pageSize', () => {
    const result = paginate(items, 1, 2.9)
    expect(result.pageSize).toBe(2)
    expect(result.items).toEqual(['a', 'b'])
    expect(result.totalPages).toBe(4)
  })

  it('returns an empty result for an empty list', () => {
    const result = paginate([], 1, 5)
    expect(result.items).toEqual([])
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(5)
    expect(result.totalItems).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('returns the only page for a single-item list with pageSize 5', () => {
    const result = paginate(['only'], 1, 5)
    expect(result.items).toEqual(['only'])
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('handles a pageSize larger than the list', () => {
    const result = paginate(['x', 'y'], 1, 99)
    expect(result.items).toEqual(['x', 'y'])
    expect(result.totalPages).toBe(1)
  })

  it('returns a single page for a list that exactly fits the page size', () => {
    const result = paginate(['a', 'b', 'c'], 1, 3)
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(result.totalPages).toBe(1)
  })

  it('returns an empty page for a request beyond totalPages on an empty list', () => {
    const result = paginate([], 99, 5)
    expect(result.items).toEqual([])
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(0)
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const snapshot = input.slice()
    paginate(input, 1, 2)
    expect(input).toEqual(snapshot)
  })

  it('accepts a readonly array without a type error', () => {
    const readonly: readonly number[] = [10, 20, 30, 40]
    const result = paginate(readonly, 2, 2)
    expect(result.items).toEqual([30, 40])
  })

  it('handles a single item with pageSize 1 on the first page', () => {
    const result = paginate(['only'], 1, 1)
    expect(result.items).toEqual(['only'])
    expect(result.totalPages).toBe(1)
  })

  it('handles a single item with pageSize 1 on page 2 (clamped to 1)', () => {
    const result = paginate(['only'], 2, 1)
    expect(result.items).toEqual(['only'])
    expect(result.page).toBe(1)
  })

  it('uses a fresh array for `items` (caller cannot mutate the source)', () => {
    const input = [1, 2, 3]
    const result = paginate(input, 1, 2)
    result.items.push(99)
    expect(input).toEqual([1, 2, 3])
  })
})
