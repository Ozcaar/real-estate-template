<script setup lang="ts">
import { computed } from 'vue'
import type { AgencySocialConfig } from '~/types/agency.types'

/**
 * Renders the agency's social links. Only entries with a value are shown, so
 * an agency can enable/disable networks purely from configuration.
 */
const props = defineProps<{
  links: AgencySocialConfig
}>()

const iconByPlatform: Record<string, string> = {
  facebook: 'mdi:facebook',
  instagram: 'mdi:instagram',
  linkedin: 'mdi:linkedin',
  tiktok: 'simple-icons:tiktok',
  youtube: 'mdi:youtube',
}

const items = computed(() =>
  (Object.entries(props.links) as [string, string | undefined][])
    .filter(([, url]) => Boolean(url))
    .map(([platform, url]) => ({
      platform,
      url: url as string,
      icon: iconByPlatform[platform] ?? 'mdi:link-variant',
    })),
)
</script>

<template>
  <ul v-if="items.length" class="flex items-center gap-3">
    <li v-for="item in items" :key="item.platform">
      <a
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-full)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
        :aria-label="item.platform"
      >
        <Icon :name="item.icon" class="h-5 w-5" />
      </a>
    </li>
  </ul>
</template>
