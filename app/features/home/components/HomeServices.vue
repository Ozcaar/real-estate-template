<script setup lang="ts">
import { computed } from 'vue'

/**
 * "Why choose us" / value-proposition section. The items are static marketing
 * copy resolved from i18n keys; icons are presentational. Built on the shared
 * {@link FeatureItem} so the styling stays consistent across the site.
 */
const { t } = useI18n()

const services = computed(() => [
  {
    icon: 'mdi:home-search-outline',
    title: t('home.services.items.discover.title'),
    description: t('home.services.items.discover.description'),
  },
  {
    icon: 'mdi:tag-outline',
    title: t('home.services.items.sell.title'),
    description: t('home.services.items.sell.description'),
  },
  {
    icon: 'mdi:handshake-outline',
    title: t('home.services.items.guidance.title'),
    description: t('home.services.items.guidance.description'),
  },
  {
    icon: 'mdi:map-marker-radius-outline',
    title: t('home.services.items.explore.title'),
    description: t('home.services.items.explore.description'),
  },
])
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('home.services.eyebrow')"
      :title="t('home.services.title')"
      :subtitle="t('home.services.subtitle')"
    />

    <div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <BaseCard v-for="service in services" :key="service.title" padding="lg">
        <FeatureItem
          :icon="service.icon"
          :title="service.title"
          :description="service.description"
        />
      </BaseCard>
    </div>
  </BaseSection>
</template>
