<script setup lang="ts">
import { computed } from 'vue'
import { sampleDevelopments } from '~/features/developments/data/developments'

/**
 * Developments listing page (`/developments`).
 *
 * Thin route: it reads the sample development catalog from the
 * developments feature, composes a responsive grid of
 * `DevelopmentCard`s, and sets page-level SEO metadata. No individual
 * development detail pages, no filtering, no map view — those are
 * future-phase tasks.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
const route = useRoute()

const developments = computed(() => sampleDevelopments)

// --- SEO ----------------------------------------------------------------
const siteUrl = computed(() => config.public.siteUrl.replace(/\/+$/, ''))

function toAbsoluteUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = siteUrl.value
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

const seoTitle = computed(() =>
  t('developments.seo.title', { agencyName: site.value.agency.name }),
)
const seoDescription = computed(() => t('developments.seo.description'))

const canonicalUrl = computed(() => {
  const base = siteUrl.value
  if (!base) return null
  return `${base}${route.path}`
})

const ogImage = computed(() => toAbsoluteUrl(site.value.agency.logo))
const twitterImage = computed(() => toAbsoluteUrl(site.value.agency.logo))

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'website',
  ogImage: () => ogImage.value,
  ogSiteName: () => site.value.agency.name,
  ogLocale: () => locale.value,
  ogUrl: () => canonicalUrl.value ?? undefined,
  twitterCard: 'summary_large_image',
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
