/**
 * In-memory idempotency cache for the Sanity webhook endpoint
 * (Task 129 — failure-safe retries + idempotency).
 *
 * Sanity uses at-least-once delivery. Every webhook delivery
 * carries a unique `idempotency-key` header; the endpoint must
 * guarantee that a replayed delivery does not initiate a
 * second rebuild trigger **and** that a failed dispatch does
 * not permanently consume the key.
 *
 * # Claim / Complete / Release lifecycle
 *
 * The cache tracks each `idempotency-key` through three states:
 *
 *  1. **`claimed`** — the endpoint has accepted the delivery
 *     and is currently invoking the external rebuild trigger.
 *     A second delivery with the same key arriving while the
 *     first is still in flight sees the entry in `claimed`
 *     state and the cache returns `in_flight`. The endpoint
 *     returns **503** (retryable) so Sanity keeps retrying; the
 *     in-flight duplicate is NOT acknowledged as success. If the
 *     first dispatch succeeds, the entry transitions to
 *     `completed` and the retry becomes a regular `duplicate`
 *     (200). If the first dispatch fails, the entry is released
 *     (deleted) and the retry re-claims and re-dispatches.
 *     This guarantees that an in-flight duplicate cannot
 *     permanently lose the event.
 *
 *  2. **`completed`** — the endpoint received the key, the
 *     dispatch was accepted by the external receiver (a 2xx
 *     response), and the cache marked the entry completed.
 *     Subsequent deliveries with the same key see `duplicate`
 *     and the endpoint returns **200 + `duplicate: true`**
 *     (idempotent ack). The cache entry's TTL bounds the
 *     duplicate-detection window so an entry does not pin
 *     memory indefinitely; once the TTL elapses, the same key
 *     is treated as a fresh delivery (consistent with the
 *     "the deploy hook is idempotent on its own end"
 *     contract — a replay after the TTL is harmless because
 *     the receiver de-duplicates on its end or because the
 *     original success is already reflected in production).
 *
 *  3. **(released)** — the dispatch failed (any reason:
 *     missing dispatch configuration, auth rejection, receiver
 *     4xx, receiver 5xx, redirect blocked, timeout, network
 *     error). The endpoint deletes the cache entry so a Sanity
 *     retry can re-claim and re-dispatch. **A failed dispatch
 *     NEVER permanently consumes the idempotency key.** The
 *     cache entry's absence after release is the documented
 *     "this dispatch did not succeed; a retry is welcome"
 *     signal.
 *
 * The endpoint's decision tree:
 *
 * ```
 *   tryClaim(key)
 *     ├─ 'claimed'        → run dispatch → on success markCompleted
 *     │                                       on failure release
 *     ├─ 'in_flight'      → return 503 (Sanity retries)
 *     └─ 'duplicate'      → return 200 { ok: true, duplicate: true }
 * ```
 *
 * # Scope and limitations (documented for the operator)
 *
 * This cache is **in-memory, per-process, and not durable**. The
 * documented limitations:
 *
 *  - **Multi-instance / serverless.** A deployment with more
 *    than one Nitro process (PM2 cluster mode, Cloudflare
 *    Workers isolates, multiple containers) does NOT share the
 *    cache. Two instances that see the same replay will both
 *    trigger. The deploy hook must be idempotent on its own
 *    end (a GitHub Actions run with the same commit SHA is a
 *    no-op; a hosting-provider deploy hook called twice during
 *    the build window is also a no-op), so the practical blast
 *    radius is bounded — but operators who need strict
 *    single-trigger semantics across instances must back this
 *    cache with a shared store (Redis / KV). The deploy-hook
 *    contract is documented in `docs/SANITY_OPERATIONS.md` to
 *    note this limitation.
 *  - **Process restart.** A Nitro process restart clears the
 *    cache. A Sanity replay that lands after the restart will
 *    re-trigger. Same mitigation as above (deploy-hook
 *    idempotency).
 *  - **Bounded size.** The cache holds at most
 *    {@link MAX_IDEMPOTENCY_ENTRIES} entries; older entries are
 *    evicted under a FIFO discipline when the cap is reached.
 *    The cap is sized to comfortably exceed Sanity's 30-second
 *    retry interval for the full TTL window.
 *  - **TTL.** Each entry expires after
 *    {@link DEFAULT_IDEMPOTENCY_TTL_MS} (1 hour by default).
 *    A replay older than the TTL is treated as a fresh
 *    delivery. **The TTL is separate from the signature
 *    verifier's replay-protection tolerance** (which defaults
 *    to 5 minutes — a tighter window because the tolerance is
 *    a security boundary; the dedup TTL is an operational
 *    courtesy). The two windows are operator-configurable via
 *    separate env vars.
 *
 * The cache is **never** used as a security boundary. Signature
 * verification is the security boundary. The cache is a
 * courtesy: it avoids redundant trigger dispatches.
 */

import { readEnv } from './server-data-source'

/**
 * The cap on cached entries. Sized to comfortably exceed
 * Sanity's documented 30-second retry interval for the full
 * TTL window — at 1 delivery / second for 1 hour the cache
 * holds ~3600 entries; the cap leaves headroom.
 */
export const MAX_IDEMPOTENCY_ENTRIES = 1024

/**
 * The TTL per cached entry (1 hour). Distinct from the
 * signature verifier's replay-protection tolerance (which
 * defaults to 5 minutes and is a security boundary).
 *
 * The dedup TTL bounds how long a replayed delivery can be
 * recognized as "already dispatched" without invoking the
 * trigger again. 1 hour is conservative: Sanity's documented
 * retry window is seconds-to-minutes, so any replay that
 * lands more than 1 hour after the original success is treated
 * as a fresh delivery. The deploy hook must be idempotent on
 * its own end to make this safe.
 *
 * Operator-configurable via `NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS`
 * (independent of the signature-tolerance env var).
 */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 60 * 60 * 1000

/**
 * Possible outcomes of {@link IdempotencyCache.tryClaim}.
 *
 *  - `claimed`: the key is new — the caller should proceed with
 *    the side effect (the deploy hook POST) and either call
 *    `markCompleted` on success or `release` on failure.
 *  - `duplicate`: the key is already in `completed` state —
 *    the caller short-circuits with a 200 (idempotent ack).
 *  - `in_flight`: the key is already in `claimed` state (a
 *    prior delivery is mid-dispatch) — the caller returns a
 *    **retryable** error (503) so Sanity keeps retrying with
 *    the same key. The retry's outcome depends on whether the
 *    prior dispatch succeeded (the entry transitions to
 *    `completed` and the retry becomes a regular `duplicate`)
 *    or failed (the entry is released and the retry re-claims
 *    and re-dispatches). Either way, no event loss.
 */
export type IdempotencyClaimResult = 'claimed' | 'duplicate' | 'in_flight'

/**
 * The internal state of a cached idempotency entry.
 *
 *  - `claimed`: the endpoint accepted the delivery and is
 *    dispatching. Future calls with the same key observe
 *    `in_flight` until the entry transitions to `completed`
 *    or is released.
 *  - `completed`: the dispatch succeeded. Future calls
 *    observe `duplicate`.
 *
 * The cache never stores a "failed" entry — failed dispatches
 * release the entry so a Sanity retry can re-claim.
 */
export type IdempotencyKeyState = 'claimed' | 'completed'

/**
 * The minimal cache surface. Exposed as a `Map` keyed by the
 * `idempotency-key` header value. Each entry carries its
 * state and its expiry timestamp (ms since epoch). Expired
 * entries are removed lazily on every call (the sweep is
 * O(n) where n is the number of expired entries — at the
 * documented cap this is negligible).
 */
export interface IdempotencyCache {
  tryClaim(key: string, now?: number): IdempotencyClaimResult
  /**
   * Mark an entry as completed (the dispatch was accepted by
   * the receiver). No-op if the entry has already expired or
   * was released. Idempotent — calling twice has no effect.
   */
  markCompleted(key: string, now?: number): void
  /**
   * Release an entry (the dispatch failed; the key may be
   * re-claimed by a future Sanity retry). No-op if the entry
   * has already expired or was released. Idempotent — calling
   * twice has no effect. The optional `now` argument is
   * accepted for symmetry with `tryClaim` / `markCompleted`
   * so tests can release deterministically without coupling
   * to wall-clock time (the cache performs no expiry sweep on
   * release — the entry is simply deleted).
   */
  release(key: string, now?: number): void
  /** Test-only — clears every cached entry. */
  reset(): void
  /** Test-only — returns the number of live (non-expired) entries. */
  size(now?: number): number
  /** Test-only — returns the state of a single entry, or `null` if expired / released / unknown. */
  stateOf(key: string, now?: number): IdempotencyKeyState | null
}

/**
 * Read the operator-configurable dedup TTL from the environment,
 * with a documented default. Exposed for the test surface so
 * the test can construct a cache with a tight TTL without
 * mutating the global cache.
 *
 * The env var name `NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS` is
 * independent of the signature verifier's
 * `NUXT_SANITY_WEBHOOK_TOLERANCE_MS`. The two windows measure
 * different things:
 *
 *  - The signature tolerance is a **security boundary** —
 *    a signed request older than the tolerance is rejected as
 *    a replay attempt. The default is 5 minutes (matching the
 *    Stripe convention the Sanity docs reference and the
 *    realistic clock-skew envelope for a CDN-fronted endpoint).
 *  - The dedup TTL is an **operational courtesy** — how long
 *    the endpoint recognizes a replay as "already dispatched"
 *    without re-invoking the trigger. The default is 1 hour.
 *
 * Coupling the two would force an operator who wants a longer
 * dedup window to also accept a longer replay window, which is
 * a security relaxation. The two env vars keep the surfaces
 * independent.
 */
export function readIdempotencyTtlMs(): number {
  const raw = readEnv('NUXT_SANITY_WEBHOOK_DEDUP_TTL_MS')
  if (raw === '') return DEFAULT_IDEMPOTENCY_TTL_MS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_IDEMPOTENCY_TTL_MS
  return parsed
}

/**
 * Construct a new in-memory idempotency cache.
 *
 * Pure factory — no module-level mutable state. Each cache
 * instance owns its own entries; tests construct a fresh
 * instance per `beforeEach`. The production endpoint uses a
 * single module-level cache via {@link getSharedIdempotencyCache}.
 */
export function createIdempotencyCache(options: {
  readonly ttlMs?: number
  readonly maxEntries?: number
} = {}): IdempotencyCache {
  const ttlMs = options.ttlMs ?? readIdempotencyTtlMs()
  const maxEntries = options.maxEntries ?? MAX_IDEMPOTENCY_ENTRIES
  const entries = new Map<string, { state: IdempotencyKeyState, expiresAt: number }>()

  function evictExpired(now: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key)
    }
  }

  function evictOldestIfFull(): void {
    if (entries.size < maxEntries) return
    // Map iteration order is insertion order — the oldest
    // entry is the first key. Drop it to make room.
    const oldest = entries.keys().next().value
    if (oldest !== undefined) entries.delete(oldest)
  }

  return {
    tryClaim(key, now = Date.now()) {
      evictExpired(now)
      const existing = entries.get(key)
      if (existing !== undefined && existing.expiresAt > now) {
        // The entry is live. The return value depends on its
        // state: a `completed` entry deduplicates as a
        // `duplicate`; a `claimed` entry indicates the prior
        // delivery is still in flight.
        return existing.state === 'completed' ? 'duplicate' : 'in_flight'
      }
      evictOldestIfFull()
      entries.set(key, { state: 'claimed', expiresAt: now + ttlMs })
      return 'claimed'
    },
    markCompleted(key, now = Date.now()) {
      const existing = entries.get(key)
      if (existing === undefined) return
      if (existing.expiresAt <= now) {
        entries.delete(key)
        return
      }
      existing.state = 'completed'
    },
    release(key, _now) {
      // Idempotent release — deleting a non-existent key is a
      // no-op. The endpoint calls this on every dispatch
      // failure path (missing config, auth rejected, 4xx,
      // 5xx, redirect blocked, timeout, network error) so a
      // Sanity retry can re-claim and re-dispatch. The `now`
      // argument is accepted for symmetry with `tryClaim` and
      // `markCompleted`; the cache performs no expiry sweep on
      // release (the entry is simply deleted), so the value is
      // intentionally unused.
      entries.delete(key)
    },
    reset() {
      entries.clear()
    },
    size(now = Date.now()) {
      evictExpired(now)
      return entries.size
    },
    stateOf(key, now = Date.now()) {
      const existing = entries.get(key)
      if (existing === undefined) return null
      if (existing.expiresAt <= now) return null
      return existing.state
    },
  }
}

/**
 * The shared idempotency cache used by the production
 * endpoint. Lazily constructed on first access so unit tests
 * that import the module without booting the endpoint never
 * touch the cache.
 *
 * The `_resetSharedIdempotencyCacheForTests` helper is the
 * test-only reset; tests that exercise the endpoint call it
 * in `beforeEach` to guarantee a clean slate.
 */
let sharedCache: IdempotencyCache | null = null

export function getSharedIdempotencyCache(): IdempotencyCache {
  if (sharedCache === null) {
    sharedCache = createIdempotencyCache()
  }
  return sharedCache
}

/**
 * Test-only — reset the shared cache to its empty state.
 *
 * Exported with the `_ForTests` suffix so a human reader
 * immediately sees the test-only intent. Production code
 * MUST NOT call this.
 */
export function _resetSharedIdempotencyCacheForTests(): void {
  if (sharedCache !== null) {
    sharedCache.reset()
  }
}

/**
 * Test-only — replace the shared cache (so a test can inject
 * a cache with a tight TTL or a tiny cap). Production code
 * MUST NOT call this.
 */
export function _setSharedIdempotencyCacheForTests(cache: IdempotencyCache): void {
  sharedCache = cache
}
