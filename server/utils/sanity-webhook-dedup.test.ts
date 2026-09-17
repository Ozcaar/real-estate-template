import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetSharedIdempotencyCacheForTests,
  _setSharedIdempotencyCacheForTests,
  createIdempotencyCache,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  getSharedIdempotencyCache,
  MAX_IDEMPOTENCY_ENTRIES,
} from './sanity-webhook-dedup'

/**
 * Tests for the in-memory idempotency cache (Task 129 — failure-
 * safe retries).
 *
 * Coverage:
 *
 *  - First claim for a key returns `'claimed'`.
 *  - A second claim for a key still in `claimed` state returns
 *    `'in_flight'` (NOT `'duplicate'`).
 *  - A claim for a key marked `'completed'` returns `'duplicate'`.
 *  - `markCompleted` transitions `claimed` → `completed`.
 *  - `release` removes the entry; a subsequent claim is
 *    `'claimed'` (the key is available again for retry).
 *  - Expired entries are reclaimed on a fresh delivery.
 *  - The cache respects the `maxEntries` cap (FIFO eviction).
 *  - The default TTL is 1 hour (separate from the signature
 *    verifier's 5-minute tolerance window).
 *  - The shared cache is process-scoped (reset for tests).
 */

const NOW = 1_700_000_000_000
const KEY_A = 'sanity-idem-001'
const KEY_B = 'sanity-idem-002'
const KEY_C = 'sanity-idem-003'
const KEY_D = 'sanity-idem-004'

describe('createIdempotencyCache', () => {
  let cache: ReturnType<typeof createIdempotencyCache>

  afterEach(() => {
    cache?.reset()
  })

  it('first claim for a key returns "claimed"', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    expect(cache.tryClaim(KEY_A, NOW)).toBe('claimed')
  })

  it('a second claim for a still-claimed key returns "in_flight" (the prior dispatch is mid-flight)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    // The prior delivery has not yet called markCompleted or
    // release. The endpoint returns 503 so Sanity retries; the
    // eventual outcome (success → markCompleted → duplicate 200,
    // failure → release → claimed + re-dispatch) determines the
    // eventual delivery status. **No event loss.**
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('in_flight')
  })

  it('a claim for a key marked completed returns "duplicate"', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.markCompleted(KEY_A, NOW)
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('duplicate')
  })

  it('a claim for a key released (after a failed dispatch) returns "claimed" (the retry can re-dispatch)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    // Simulate a failed dispatch: the endpoint calls release
    // so a Sanity retry can re-claim and re-dispatch. **A
    // failed dispatch NEVER permanently consumes the key.**
    cache.release(KEY_A)
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('claimed')
  })

  it('markCompleted is idempotent (calling twice has the same effect)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.markCompleted(KEY_A, NOW)
    cache.markCompleted(KEY_A, NOW) // second call is a no-op
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('duplicate')
  })

  it('release is idempotent (calling twice has the same effect)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.release(KEY_A)
    cache.release(KEY_A) // second call is a no-op
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('claimed')
  })

  it('markCompleted after release is a no-op (the key was already freed)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.release(KEY_A)
    cache.markCompleted(KEY_A, NOW) // no-op
    // A fresh delivery can claim the key.
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('claimed')
  })

  it('release after markCompleted frees the key (defensive — the endpoint never does this; documents the cache semantics)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.markCompleted(KEY_A, NOW)
    // After release the cache treats the key as if it had
    // never been seen. The endpoint never does this in
    // production (markCompleted and release are mutually
    // exclusive paths), but the test pins the cache semantics.
    cache.release(KEY_A)
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('claimed')
  })

  it('duplicate claim at the exact TTL boundary returns "claimed" (entry just expired)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.markCompleted(KEY_A, NOW)
    expect(cache.tryClaim(KEY_A, NOW + 1000)).toBe('claimed')
  })

  it('expired entries are reclaimed on a fresh delivery', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    // Move the clock past the TTL.
    expect(cache.tryClaim(KEY_A, NOW + 5000)).toBe('claimed')
  })

  it('different keys are tracked independently', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    expect(cache.tryClaim(KEY_A, NOW)).toBe('claimed')
    expect(cache.tryClaim(KEY_B, NOW)).toBe('claimed')
    expect(cache.tryClaim(KEY_C, NOW)).toBe('claimed')
    expect(cache.size(NOW)).toBe(3)
    // None of them have been markedCompleted — they are all
    // "in_flight" from the cache's perspective.
    expect(cache.tryClaim(KEY_A, NOW + 100)).toBe('in_flight')
    expect(cache.tryClaim(KEY_B, NOW + 100)).toBe('in_flight')
  })

  it('evicts the oldest entry when the cap is reached (FIFO)', () => {
    cache = createIdempotencyCache({ ttlMs: 60_000, maxEntries: 2 })
    // Fill the cache to capacity.
    expect(cache.tryClaim(KEY_A, NOW)).toBe('claimed')
    expect(cache.tryClaim(KEY_B, NOW)).toBe('claimed')
    expect(cache.size(NOW)).toBe(2)
    // The third claim evicts KEY_A (oldest) and inserts KEY_C.
    expect(cache.tryClaim(KEY_C, NOW)).toBe('claimed')
    expect(cache.size(NOW)).toBe(2)
    // KEY_A is gone, so a re-claim is "claimed" (a new delivery).
    expect(cache.tryClaim(KEY_A, NOW + 1)).toBe('claimed')
    // The cache is now [B, A]; KEY_B is the oldest. Inserting KEY_D
    // evicts KEY_B.
    expect(cache.tryClaim(KEY_D, NOW + 2)).toBe('claimed')
    // KEY_C is also gone (evicted by the previous step's FIFO
    // rotation). KEY_B is gone. Only [A, D] remain.
    expect(cache.tryClaim(KEY_C, NOW + 3)).toBe('claimed')
    expect(cache.tryClaim(KEY_B, NOW + 4)).toBe('claimed')
  })

  it('lazy sweep removes expired entries on the next tryClaim', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim('k1', NOW)
    cache.tryClaim('k2', NOW + 200)
    cache.tryClaim('k3', NOW + 400)
    expect(cache.size(NOW)).toBe(3)
    // After the TTL, the size call lazily sweeps.
    expect(cache.size(NOW + 5000)).toBe(0)
  })

  it('size() does not include expired entries', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    expect(cache.size(NOW)).toBe(1)
    expect(cache.size(NOW + 5000)).toBe(0)
  })

  it('reset() clears every entry', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    cache.tryClaim(KEY_B, NOW)
    expect(cache.size(NOW)).toBe(2)
    cache.reset()
    expect(cache.size(NOW)).toBe(0)
    // A re-claim is "claimed" again.
    expect(cache.tryClaim(KEY_A, NOW)).toBe('claimed')
  })

  it('default TTL is 1 hour (separate from the 5-minute signature tolerance)', () => {
    cache = createIdempotencyCache()
    expect(DEFAULT_IDEMPOTENCY_TTL_MS).toBe(60 * 60 * 1000)
    cache.tryClaim(KEY_A, NOW)
    // At the boundary the entry has just expired → "claimed".
    expect(cache.tryClaim(KEY_A, NOW + DEFAULT_IDEMPOTENCY_TTL_MS)).toBe('claimed')
    // One ms before the boundary → "in_flight" (still live).
    expect(cache.tryClaim(KEY_A, NOW + DEFAULT_IDEMPOTENCY_TTL_MS - 1)).toBe('in_flight')
  })

  it('MAX_IDEMPOTENCY_ENTRIES default is reasonable (>= 256)', () => {
    // Regression guard against a future change that
    // accidentally drops the cap to a useless value.
    expect(MAX_IDEMPOTENCY_ENTRIES).toBeGreaterThanOrEqual(256)
  })

  it('stateOf returns the current state for a live entry', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    expect(cache.stateOf(KEY_A, NOW)).toBe('claimed')
    cache.markCompleted(KEY_A, NOW)
    expect(cache.stateOf(KEY_A, NOW)).toBe('completed')
    cache.release(KEY_A)
    expect(cache.stateOf(KEY_A, NOW)).toBeNull()
  })

  it('stateOf returns null for an expired entry (the cache has swept it)', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    cache.tryClaim(KEY_A, NOW)
    expect(cache.stateOf(KEY_A, NOW + 100)).toBe('claimed')
    // Past the TTL — the cache has swept the entry.
    expect(cache.stateOf(KEY_A, NOW + 5000)).toBeNull()
  })

  it('stateOf returns null for an unknown key', () => {
    cache = createIdempotencyCache({ ttlMs: 1000 })
    expect(cache.stateOf('never-seen-key', NOW)).toBeNull()
  })
})

describe('shared idempotency cache', () => {
  afterEach(() => {
    _resetSharedIdempotencyCacheForTests()
  })

  it('returns the same instance on repeated calls (singleton pattern)', () => {
    const a = getSharedIdempotencyCache()
    const b = getSharedIdempotencyCache()
    expect(a).toBe(b)
  })

  it('shared cache state survives across getSharedIdempotencyCache calls', () => {
    const cache = getSharedIdempotencyCache()
    cache.tryClaim(KEY_A, NOW)
    const other = getSharedIdempotencyCache()
    // The shared singleton has KEY_A in `claimed` state.
    expect(other.tryClaim(KEY_A, NOW + 100)).toBe('in_flight')
  })

  it('_setSharedIdempotencyCacheForTests allows injecting a custom cache', () => {
    const custom = createIdempotencyCache({ ttlMs: 100 })
    _setSharedIdempotencyCacheForTests(custom)
    expect(getSharedIdempotencyCache()).toBe(custom)
    custom.tryClaim(KEY_A, NOW)
    expect(getSharedIdempotencyCache().tryClaim(KEY_A, NOW + 50)).toBe('in_flight')
  })
})
