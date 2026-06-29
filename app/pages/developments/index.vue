<script setup lang="ts">
import { computed } from 'vue'
import { sampleDevelopments } from '~/features/developments/data/developments'
import { usePageSeo } from '~/core/composables/usePageSeo'

/**
 * Developments listing page (`/developments`).
 *
 * Thin route: it reads the sample development catalog from the
 * developments feature, composes a responsive grid of
 * `DevelopmentCard`s, and sets page-level SEO metadata. No individual
 * development detail pages, no filtering, no map view — those are
 * future-phase tasks.
 */
const { t } = useI18n()

const developments = computed(() => sampleDevelopments)

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page owns
 * the `useSeoMeta` call (for the page-specific title/description) and
 * the canonical `useHead` call.
 */
const { canonicalUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

const seoTitle = computed(() =>
  t('developments.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('developments.seo.description'))

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogSiteName: () => siteName,
  ogLocale: () => ogLocale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  twitterImage: () => twitterImage.value,
})

useHead({
  link: [
    ...(canonicalUrl.value
      ? [{ rel: 'canonical', href: canonicalUrl.value }]
      : []),
  ],
})
</script>

<template>
  <div>
    <BaseSection spacing="lg">
      <SectionHeader
        align="center"
        :eyebrow="t('nav.developments')"
        :title="t('developments.page.title')"
        :subtitle="t('developments.page.subtitle')"
      />

      <div
        v-if="developments.length"
        class="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <DevelopmentCard
          v-for="development in developments"
          :key="development.id"
          :development="development"
        />
      </div>

      <div
        v-else
        class="mx-auto mt-12 max-w-2xl rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-10 text-center"
      >
        <p class="text-base font-semibold text-[var(--color-foreground)]">
          {{ t('developments.empty.title') }}
        </p>
        <p class="mt-2 text-sm text-[var(--color-muted)]">
          {{ t('developments.empty.description') }}
        </p>
      </div>
    </BaseSection>

    <BaseSection spacing="md">
      <CtaBlock
        :title="t('developments.cta.title')"
        :description="t('developments.cta.description')"
        tone="primary"
      >
        <template #actions>
          <BaseButton to="/contact" size="lg" variant="secondary">
            {{ t('developments.cta.primary') }}
          </BaseButton>
          <BaseButton to="/properties" size="lg" variant="ghost">
            {{ t('developments.cta.secondary') }}
          </BaseButton>
        </template>
      </CtaBlock>
    </BaseSection>
  </div>
</template>
