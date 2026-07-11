<script setup lang="ts">
import { computed } from 'vue'
import type { BreadcrumbItem } from '~/types/breadcrumb.types'

/**
 * Accessible visible breadcrumb trail.
 *
 * Renders a `<nav>` with a translated landmark label (`common.breadcrumb`),
 * an ordered list of the trail, and a decorative `›` separator between
 * items. The final item is always rendered as non-linked text with
 * `aria-current="page"`. Items that have a `to` and are not the final
 * item are rendered as `<NuxtLink>`, inheriting the existing router
 * behaviour. Items without a `to` that are not the final item fall
 * through to plain text so the trail still renders when a caller forgets
 * to populate a link target.
 *
 * The component renders nothing when fewer than two items are provided.
 * A single-item trail is not a meaningful breadcrumb (the only item
 * would be the current page with no ancestor context). This matches
 * the same "render nothing when trivial" pattern used by `BasePagination`
 * (M14 / Task 071).
 *
 * **Long labels** wrap naturally on mobile: the `<ol>` uses
 * `flex-wrap` and no `truncate` / `text-ellipsis` is applied. The
 * current page title is never truncated.
 *
 * **Keyboard focus.** Linked items inherit the standard focus ring via
 * `focus-visible:outline-2 focus-visible:outline-offset-2`. The
 * current page item is a non-focusable `<span>`, which is correct.
 *
 * **Decorative separators.** Each separator is a `<span aria-hidden="true">`
 * so screen readers do not announce it. A leading visual gap from
 * `<ol>`'s `gap-1` keeps the separator from touching the previous label.
 */
const { t } = useI18n()

const props = defineProps<{
  items: BreadcrumbItem[]
}>()

const hasTrail = computed(() => props.items.length >= 2)
const lastIndex = computed(() => props.items.length - 1)
const isLast = (index: number): boolean => index === lastIndex.value
</script>

<template>
  <nav v-if="hasTrail" :aria-label="t('common.breadcrumb')">
    <ol class="flex flex-wrap items-center gap-1 text-sm text-[var(--color-muted)]">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-1"
      >
        <NuxtLink
          v-if="item.to && !isLast(index)"
          :to="item.to"
          :aria-label="item.ariaLabel"
          class="rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {{ item.label }}
        </NuxtLink>
        <span
          v-else
          :aria-label="item.ariaLabel"
          :aria-current="isLast(index) ? 'page' : undefined"
          class="px-1 py-0.5 font-semibold text-[var(--color-foreground)]"
        >
          {{ item.label }}
        </span>
        <span
          v-if="!isLast(index)"
          aria-hidden="true"
          class="select-none"
        >
          ›
        </span>
      </li>
    </ol>
  </nav>
</template>
