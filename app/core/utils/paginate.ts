/**
 * Generic paginated result shape.
 *
 * Returned by {@link paginate}. Pages are 1-based. `totalPages` is `0`
 * when the source list is empty, and `1` when there is at least one
 * item but it fits on a single page.
 */
export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

/**
 * Normalize a raw `useRoute().query`-style value into a 1-based page
 * number. Used by the listing page to read `?page=` safely without
 * trusting the URL.
 *
 * Rules:
 * - `null` / `undefined` → `1` (page omitted entirely).
 * - `[]` (array) or `['2', '3']` → use the first scalar value, then apply
 *   the scalar rules. An array whose first entry is `null` / `undefined`
 *   also resolves to `1`.
 * - Empty string `''` or whitespace-only string → `1`.
 * - Non-numeric string (`'abc'`, `'1e9'` would parse as a number, so
 *   `Number.isFinite` accepts it; the brief asks for `parseInt`-like
 *   integer coercion, so `1.5` → `1`, `-1` → `1`, `0` → `1`, `NaN` → `1`).
 * - Decimal values are truncated to an integer via `Math.trunc` before
 *   the `< 1` guard.
 * - Out-of-range values (e.g. `?page=99` when only 3 pages exist) are NOT
 *   clamped here; the page layer clamps the effective page against
 *   {@link paginate}'s returned `totalPages` so the helper stays generic
 *   and has no knowledge of the dataset.
 *
 * @param raw The raw query value (`string | string[] | null | undefined`).
 * @returns A 1-based page number that is always a safe positive integer.
 */
export function parsePageParam(raw: unknown): number {
  if (raw == null) return 1
  let value: unknown = raw
  if (Array.isArray(value)) {
    value = value[0]
    if (value == null) return 1
  }
  if (typeof value !== 'string') return 1
  const trimmed = value.trim()
  if (trimmed === '') return 1
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return 1
  const int = Math.trunc(parsed)
  if (int < 1) return 1
  return int
}

/**
 * Slice a list into a single page of results. Pages are 1-based.
 *
 * The input array is never mutated; the returned `items` is a fresh
 * array built via `Array.prototype.slice`. The helper is pure and
 * business-agnostic — the same code powers the properties listing today
 * and any future listing page (agents, developments) that wants the
 * same `?page=N` URL contract.
 *
 * Clamping:
 * - An empty input list returns `{ items: [], page: 1, totalItems: 0,
 *   totalPages: 0 }`. The page layer treats `totalPages === 0` as
 *   "render the empty state and no pagination control".
 * - `pageSize < 1` is coerced to `1` (a single page is still a page).
 * - The effective page is clamped to `[1, max(1, totalPages)]`. A
 *   request for page `99` on a 3-page list returns the last page
 *   (page 3) and the caller can rely on the returned `page` to know
 *   which slice was actually selected.
 *
 * @param items The full result list, already filtered and sorted.
 * @param requestedPage The 1-based page the caller wants. Values below
 *   `1` clamp up; values above `totalPages` clamp down.
 * @param pageSize The desired number of items per page. Floored to an
 *   integer; values below `1` coerce to `1`.
 */
export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
): PaginatedResult<T> {
  const safeSize = Math.max(1, Math.floor(pageSize))
  const totalItems = items.length
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / safeSize)
  if (totalItems === 0) {
    return {
      items: [],
      page: 1,
      pageSize: safeSize,
      totalItems: 0,
      totalPages: 0,
    }
  }
  const requested = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1
  const safePage = Math.max(1, Math.min(requested, totalPages))
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    totalItems,
    totalPages,
  }
}
