<script setup lang="ts">
import type { HomeLocation } from '../types/home.types'

/**
 * "Areas we serve" section. Receives the locations and renders image cards
 * that deep-link into the properties listing filtered by location. Names and
 * counts are agency content; the count label is localized.
 */
defineProps<{
  locations: HomeLocation[]
}>()

const { t } = useI18n()
</script>

<template>
  <BaseSection tone="muted" spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('home.locations.eyebrow')"
      :title="t('home.locations.title')"
      :subtitle="t('home.locations.subtitle')"
    />

    <ul class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <li v-for="location in locations" :key="location.id">
        <NuxtLink
          :to="{ path: '/properties', query: { location: location.slug } }"
          class="group relative block overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]"
        >
          <ResponsiveImage
            :src="location.image"
            :alt="location.name"
            ratio="3/2"
            rounded="none"
            sizes="100vw sm:50vw lg:25vw"
          />
          <span class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <span class="absolute inset-x-0 bottom-0 p-4 text-white">
            <span class="block text-lg font-semibold">{{ location.name }}</span>
            <span class="text-sm opacity-90">
              {{ t('home.locations.propertyCount', { count: location.propertyCount }) }}
            </span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </BaseSection>
</template>
