<script setup lang="ts">
import type { PropertyTypeOption } from '~/features/properties/constants/property-types'

/**
 * "Browse by category" section. Receives the property-type options and renders
 * them as links into the properties listing, pre-filtered by type. Generic and
 * theme-aware; labels resolve from i18n keys on each option.
 */
defineProps<{
  categories: PropertyTypeOption[]
}>()

const { t } = useI18n()
</script>

<template>
  <BaseSection tone="muted" spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('home.categories.eyebrow')"
      :title="t('home.categories.title')"
      :subtitle="t('home.categories.subtitle')"
    />

    <ul class="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <li v-for="category in categories" :key="category.value">
        <NuxtLink
          :to="{ path: '/properties', query: { type: category.value } }"
          class="flex h-full flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-[var(--color-card-foreground)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]"
        >
          <span
            class="inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
          >
            <BaseIcon :name="category.icon" size="lg" />
          </span>
          <span class="text-sm font-semibold">{{ t(category.labelKey) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </BaseSection>
</template>
