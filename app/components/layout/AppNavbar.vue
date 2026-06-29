<script setup lang="ts">
import type { NavItem } from '~/types/site.types'

/** Horizontal primary navigation (desktop). Items are provided by the parent. */
defineProps<{
  items: NavItem[]
}>()
</script>

<template>
  <nav :aria-label="$t('common.mainNavigation')">
    <ul class="flex items-center gap-6">
      <li v-for="item in items" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          active-class="text-[var(--color-primary)]"
        >
          {{ $t(item.labelKey) }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
