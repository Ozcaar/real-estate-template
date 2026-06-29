<script setup lang="ts">
import type { Property } from '~/features/properties/types/property.types'

/**
 * "Featured properties" homepage section. Presentational: it receives the
 * already-resolved list of properties and composes the reusable
 * {@link PropertyGrid}. Data loading happens in the page.
 */
defineProps<{
  properties: Property[]
}>()

const { t } = useI18n()
</script>

<template>
  <BaseSection spacing="lg">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <SectionHeader
        :eyebrow="t('home.featured.eyebrow')"
        :title="t('home.featured.title')"
        :subtitle="t('home.featured.subtitle')"
      />
      <BaseButton to="/properties" variant="outline" class="hidden shrink-0 sm:inline-flex">
        {{ t('home.featured.viewAll') }}
      </BaseButton>
    </div>

    <div class="mt-10">
      <PropertyGrid :properties="properties" :empty-message="t('home.featured.empty')" />
    </div>

    <div class="mt-8 sm:hidden">
      <BaseButton to="/properties" variant="outline" block>
        {{ t('home.featured.viewAll') }}
      </BaseButton>
    </div>
  </BaseSection>
</template>
