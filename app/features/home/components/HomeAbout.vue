<script setup lang="ts">
import type { HomeStat } from '../types/home.types'

/**
 * "About / trust" section: a short agency story paired with headline trust
 * stats. Story copy comes from i18n; the stat values are passed in (agency
 * content). The image is configurable via a prop with a placeholder fallback.
 */
withDefaults(
  defineProps<{
    stats: HomeStat[]
    image?: string
  }>(),
  {
    image: '/images/home/about.svg',
  },
)

const { t } = useI18n()
</script>

<template>
  <BaseSection spacing="lg">
    <div class="grid items-center gap-10 lg:grid-cols-2">
      <div class="order-last lg:order-first">
        <ResponsiveImage
          :src="image"
          :alt="t('home.about.imageAlt')"
          ratio="4/3"
          rounded="xl"
          sizes="100vw lg:50vw"
        />
      </div>

      <div>
        <SectionHeader
          :eyebrow="t('home.about.eyebrow')"
          :title="t('home.about.title')"
          :subtitle="t('home.about.body')"
        />

        <BaseButton to="/about" variant="outline" class="mt-6">
          {{ t('home.about.cta') }}
        </BaseButton>

        <dl class="mt-10 grid grid-cols-2 gap-6">
          <div v-for="stat in stats" :key="stat.id" class="flex items-start gap-3">
            <span
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
            >
              <BaseIcon :name="stat.icon" size="lg" />
            </span>
            <div>
              <dt class="text-2xl font-bold text-[var(--color-foreground)]">{{ stat.value }}</dt>
              <dd class="text-sm text-[var(--color-muted)]">{{ t(stat.labelKey) }}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  </BaseSection>
</template>
