<script setup lang="ts">
import { computed } from 'vue'

type PageToken = number | 'ellipsis'

/**
 * Accessible, URL-based pagination primitive.
 *
 * Renders a `<nav>` with a translated landmark label, an ordered list of
 * page links (current / previous / next / numbered pages / decorative
 * ellipses), and a `sr-only` live region that announces the current
 * page whenever it changes. The component is business-agnostic: it does
 * not know about properties, agents, or any specific dataset. It only
 * knows how to render a numbered pagination control from the values
 * passed in.
 *
 * **Renders nothing when `totalPages <= 1`.** This is the contract used
 * by the listing page: when the filtered catalog fits on a single
 * page, no control is shown, no `?page=` parameter leaks into the URL,
 * and the layout reflows to use the freed vertical space.
 *
 * **Query contract.** The caller passes a `query` object of values to
 * preserve (`operation`, `type`, `location`, non-default `sort`, etc.).
 * The component strips empty entries, omits `?page=1`, and adds
 * `?page=N` for pages beyond the first. The caller is responsible for
 * pre-filtering the query (for example, omitting the default sort);
 * the component does not know about domain-specific defaults.
 *
 * **Accessibility.**
 * - `<nav>` carries `aria-label="$t('properties.pagination.nav')"`.
 * - The page links are an `<ol>` so a screen reader announces the
 *   list and the number of items.
 * - The current page is a non-link `<span>` with `aria-current="page"`
 *   and an `aria-label` of the form "Current page, page N of T".
 * - Previous and next are `<NuxtLink>` when at a non-boundary page and
 *   non-focusable `<span aria-disabled="true">` at the boundaries. The
 *   disabled control is rendered (not removed) so the layout does not
 *   jump and a screen reader announces "Previous page, dimmed" /
 *   "Next page, dimmed" instead of skipping it entirely.
 * - Decorative ellipses are `<span aria-hidden="true">…</span>`; they
 *   carry no text and no interactive role.
 * - A `sr-only` `<p aria-live="polite">` announces "Page X of T"
 *   whenever the `currentPage` prop changes, so a screen reader user
 *   navigating via Previous / Next hears the new position.
 */
const props = withDefaults(
  defineProps<{
    /** The 1-based page the caller is currently rendering. */
    currentPage: number
    /** The total number of pages available after filtering and sorting. */
    totalPages: number
    /** The route path the page links should target (e.g. `/properties`). */
    basePath: string
    /**
     * Query values to preserve on every generated link. Entries with
     * `undefined` or `''` are dropped. `?page=1` is omitted; later
     * pages get `?page=N` added automatically. The component does not
     * know about domain-specific defaults — the caller pre-filters.
     */
    query?: Record<string, string | undefined>
    /** Number of page links to show on each side of the current page. */
    siblings?: number
    /** Number of page links to always show at the start and end. */
    boundaries?: number
  }>(),
  {
    query: () => ({}),
    siblings: 1,
    boundaries: 1,
  },
)

const { t } = useI18n()

const hasMultiplePages = computed(() => props.totalPages > 1)

const tokens = computed<PageToken[]>(() => {
  if (props.totalPages <= 1) return []
  return buildPageTokens(
    props.currentPage,
    props.totalPages,
    props.siblings,
    props.boundaries,
  )
})

const isPrevDisabled = computed(() => props.currentPage <= 1)
const isNextDisabled = computed(() => props.currentPage >= props.totalPages)

const prevTo = computed(() => buildTo(props.currentPage - 1))
const nextTo = computed(() => buildTo(props.currentPage + 1))

/**
 * Build the smart-pagination token sequence: first N pages, ellipsis
 * (or the single missing page when the gap is exactly 2), current ±
 * siblings, ellipsis (or the single missing page), last N pages. The
 * "fill single gaps" rule means a total of 7 pages is rendered as
 * 1, 2, 3, 4, 5, 6, 7 with no ellipses, even though the boundaries
 * and siblings sets alone do not cover every page.
 */
function buildPageTokens(
  current: number,
  total: number,
  siblings: number,
  boundaries: number,
): PageToken[] {
  if (total <= 1) return []
  const include = new Set<number>()
  for (let i = 1; i <= Math.min(boundaries, total); i++) include.add(i)
  for (let i = total - boundaries + 1; i <= total; i++) include.add(i)
  for (let i = current - siblings; i <= current + siblings; i++) {
    if (i >= 1 && i <= total) include.add(i)
  }
  const sorted = [...include].sort((a, b) => a - b)
  const out: PageToken[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1]
      if (gap === 2) {
        out.push(sorted[i - 1] + 1)
      } else if (gap > 2) {
        out.push('ellipsis')
      }
    }
    out.push(sorted[i])
  }
  return out
}

function buildTo(page: number): { path: string; query: Record<string, string> } {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(props.query)) {
    if (value !== undefined && value !== '') {
      query[key] = value
    }
  }
  if (page > 1) {
    query.page = String(page)
  }
  return { path: props.basePath, query }
}
</script>

<template>
  <nav
    v-if="hasMultiplePages"
    :aria-label="t('properties.pagination.nav')"
    class="mt-10"
  >
    <ol class="flex flex-wrap items-center justify-center gap-1 text-sm">
      <li>
        <NuxtLink
          v-if="!isPrevDisabled"
          :to="prevTo"
          :aria-label="t('properties.pagination.previous')"
          class="inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <BaseIcon name="mdi:chevron-left" size="sm" />
          <span>{{ t('properties.pagination.previous') }}</span>
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-muted)] opacity-50"
        >
          <BaseIcon name="mdi:chevron-left" size="sm" />
          <span>{{ t('properties.pagination.previous') }}</span>
        </span>
      </li>

      <li
        v-for="(token, index) in tokens"
        :key="`${String(token)}-${index}`"
      >
        <span
          v-if="token === 'ellipsis'"
          aria-hidden="true"
          class="inline-flex h-9 w-9 items-center justify-center text-[var(--color-muted)]"
        >…</span>
        <NuxtLink
          v-else-if="token !== currentPage"
          :to="buildTo(token)"
          :aria-label="t('properties.pagination.page', { n: token })"
          class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {{ token }}
        </NuxtLink>
        <span
          v-else
          :aria-label="t('properties.pagination.currentPage', { n: token, total: totalPages })"
          aria-current="page"
          class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]"
        >
          {{ token }}
        </span>
      </li>

      <li>
        <NuxtLink
          v-if="!isNextDisabled"
          :to="nextTo"
          :aria-label="t('properties.pagination.next')"
          class="inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span>{{ t('properties.pagination.next') }}</span>
          <BaseIcon name="mdi:chevron-right" size="sm" />
        </NuxtLink>
        <span
          v-else
          aria-disabled="true"
          class="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-muted)] opacity-50"
        >
          <span>{{ t('properties.pagination.next') }}</span>
          <BaseIcon name="mdi:chevron-right" size="sm" />
        </span>
      </li>
    </ol>

    <p class="sr-only" aria-live="polite">
      {{ t('properties.pagination.pageStatus', { page: currentPage, total: totalPages }) }}
    </p>
  </nav>
</template>
