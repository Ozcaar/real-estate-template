<script setup lang="ts">
import type { HomeTestimonial } from '../types/home.types'

/**
 * Social-proof section. Receives testimonials and renders them as quote cards
 * with an accessible star rating (the rating is announced as text, not by
 * color/icon alone). Copy is agency content.
 */
defineProps<{
  testimonials: HomeTestimonial[]
}>()

const { t } = useI18n()
const stars = [1, 2, 3, 4, 5]
</script>

<template>
  <BaseSection spacing="lg">
    <SectionHeader
      align="center"
      :eyebrow="t('home.testimonials.eyebrow')"
      :title="t('home.testimonials.title')"
      :subtitle="t('home.testimonials.subtitle')"
    />

    <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
      <BaseCard v-for="testimonial in testimonials" :key="testimonial.id" padding="lg" class="flex flex-col">
        <div
          class="flex items-center gap-0.5 text-[var(--color-accent)]"
          role="img"
          :aria-label="t('home.testimonials.rating', { rating: testimonial.rating })"
        >
          <BaseIcon
            v-for="star in stars"
            :key="star"
            :name="star <= testimonial.rating ? 'mdi:star' : 'mdi:star-outline'"
            size="sm"
          />
        </div>

        <blockquote class="mt-4 flex-1 text-[var(--color-foreground)]">
          “{{ testimonial.quote }}”
        </blockquote>

        <footer class="mt-6 flex items-center gap-3">
          <span
            class="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface-muted)] text-[var(--color-primary)]"
            aria-hidden="true"
          >
            <BaseIcon name="mdi:account" size="lg" />
          </span>
          <span>
            <span class="block text-sm font-semibold text-[var(--color-foreground)]">{{ testimonial.name }}</span>
            <span class="block text-sm text-[var(--color-muted)]">{{ testimonial.role }}</span>
          </span>
        </footer>
      </BaseCard>
    </div>
  </BaseSection>
</template>
