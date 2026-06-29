<script setup lang="ts">
import { computed } from 'vue'
import { sampleAgents } from '~/features/agents/data/agents'

/**
 * Agents listing page (`/agents`).
 *
 * Thin route: it reads the sample agent catalog from the agents feature,
 * composes a responsive grid of `AgentCard`s, and sets page-level SEO
 * metadata. No individual agent detail pages, no filtering, no backend
 * integration — those are future-phase tasks.
 */
const { t, locale } = useI18n()
const site = useSiteConfig()
const config = useRuntimeConfig()
const route = useRoute()

const agents = computed(() => sampleAgents)

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
  t('agents.seo.title', { agencyName: site.value.agency.name }),
)
const seoDescription = computed(() => t('agents.seo.description'))

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
        :eyebrow="t('nav.agents')"
        :title="t('agents.page.title')"
        :subtitle="t('agents.page.subtitle')"
      />

      <div
        v-if="agents.length"
        class="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AgentCard
          v-for="agent in agents"
          :key="agent.id"
          :agent="agent"
        />
      </div>

      <div
        v-else
        class="mx-auto mt-12 max-w-2xl rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-10 text-center"
      >
        <p class="text-base font-semibold text-[var(--color-foreground)]">
          {{ t('agents.empty.title') }}
        </p>
        <p class="mt-2 text-sm text-[var(--color-muted)]">
          {{ t('agents.empty.description') }}
        </p>
      </div>
    </BaseSection>

    <BaseSection spacing="md">
      <CtaBlock
        :title="t('agents.cta.title')"
        :description="t('agents.cta.description')"
        tone="primary"
      >
        <template #actions>
          <BaseButton to="/contact" size="lg" variant="secondary">
            {{ t('agents.cta.primary') }}
          </BaseButton>
        </template>
      </CtaBlock>
    </BaseSection>
  </div>
</template>
