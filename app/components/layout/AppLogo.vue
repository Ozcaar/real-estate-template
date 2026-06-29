<script setup lang="ts">
import { computed } from 'vue'

/**
 * Agency logo, sourced entirely from agency configuration (never hardcoded).
 * Renders the configured logo image with the agency name as accessible `alt`
 * text; if no logo is configured it falls back to the agency name as a wordmark
 * so the header/footer always have a usable brand element.
 */
const site = useSiteConfig()
const agency = computed(() => site.value.agency)
</script>

<template>
  <NuxtLink
    to="/"
    class="inline-flex items-center gap-2 text-lg font-semibold text-[var(--color-primary)]"
    :aria-label="agency.name"
  >
    <NuxtImg
      v-if="agency.logo"
      :src="agency.logo"
      :alt="agency.name"
      class="h-8 w-auto"
    />
    <span v-else>{{ agency.name }}</span>
  </NuxtLink>
</template>
