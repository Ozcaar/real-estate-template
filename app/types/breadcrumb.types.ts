/**
 * Single item in a breadcrumb trail.
 *
 * - `label` is the visible text. The caller resolves i18n keys via `$t(...)`
 *   and dynamic values (e.g. `property.title`) before passing them in, so
 *   this type stays free of `useI18n` and easy to test.
 * - `to` is the route path. Omit it on the current page (the final item).
 *   When the current page is the final item, the consumer does not pass a
 *   `to` and the renderer treats it as non-linked text with
 *   `aria-current="page"`.
 * - `ariaLabel` is an optional screen-reader-only override for the link
 *   text. Useful when a visible label is short (e.g. "Home") but the
 *   screen-reader announcement should include more context (e.g.
 *   "Home, return to the homepage"). Falls back to `label` when omitted.
 */
export interface BreadcrumbItem {
  label: string
  to?: string
  ariaLabel?: string
}
