<script setup lang="ts">
import { computed } from 'vue'
import { sampleAgents } from '~/features/agents/data/agents'
import { usePageSeo } from '~/core/composables/usePageSeo'
import { useJsonLd } from '~/core/composables/useJsonLd'

/**
 * Agents listing page (`/agents`).
 *
 * Thin route: it reads the sample agent catalog from the agents feature,
 * composes a responsive grid of `AgentCard`s, and sets page-level SEO
 * metadata. No individual agent detail pages, no filtering, no backend
 * integration — those are future-phase tasks.
 */
const { t } = useI18n()
const site = useSiteConfig()

const agents = computed(() => sampleAgents)

// --- SEO ----------------------------------------------------------------
/**
 * Page-level SEO building blocks come from `usePageSeo`. This page owns
 * the `useSeoMeta` call (for the page-specific title/description) and
 * the canonical `useHead` call.
 */
const { canonicalUrl, toAbsoluteUrl, ogImage, twitterImage, twitterCard, ogLocale, siteName } = usePageSeo()

const seoTitle = computed(() =>
  t('agents.seo.title', { agencyName: siteName }),
)
const seoDescription = computed(() => t('agents.seo.description'))

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

// --- JSON-LD ------------------------------------------------------------
/**
 * `ItemList` of `Person` entries, one per agent. Each `Person` is
 * tied back to the agency via `worksFor: RealEstateAgent` so search
 * engines can connect the agent to the agency node that the home
 * page already emits. Optional contact fields (`telephone`, `email`)
 * are emitted only when the source record has them.
 *
 * The `worksFor.url` points to the agency home page
 * (`toAbsoluteUrl('/')`) rather than the current page
 * (`canonicalUrl.value`) — `worksFor` references the agency itself,
 * and the home page is the agency's canonical URL.
 */
const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: agents.value.map((agent, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Person',
      name: agent.name,
      jobTitle: agent.role,
      description: agent.bio,
      image: toAbsoluteUrl(agent.image),
      ...(agent.phone ? { telephone: agent.phone } : {}),
      ...(agent.email ? { email: agent.email } : {}),
      worksFor: {
        '@type': 'RealEstateAgent',
        name: site.value.agency.name,
        url: toAbsoluteUrl('/'),
      },
    },
  })),
}))

useJsonLd(jsonLd)
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
