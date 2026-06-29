<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '../types/agent.types'
import { buildWhatsAppLink } from '~/core/utils/whatsapp-link'

/**
 * Agent card. Presentational only: it receives a typed `Agent` and never
 * fetches data. The contact links (phone, email, WhatsApp) are only
 * rendered when the corresponding field is present on the agent, so a
 * partial record renders gracefully.
 */
const props = defineProps<{
  agent: Agent
}>()

const { t } = useI18n()

const whatsappLink = computed(() => buildWhatsAppLink(props.agent.whatsapp))
</script>

<template>
  <BaseCard padding="none" radius="lg" shadow="sm" class="flex h-full flex-col overflow-hidden">
    <template #media>
      <ResponsiveImage
        :src="agent.image"
        :alt="agent.name"
        ratio="1/1"
        rounded="none"
        sizes="100vw sm:50vw lg:33vw"
      />
    </template>

    <div class="flex flex-1 flex-col p-5">
      <BaseHeading :level="3" size="md">
        {{ agent.name }}
      </BaseHeading>
      <p class="mt-1 text-sm font-medium text-[var(--color-primary)]">
        {{ agent.role }}
      </p>
      <p class="mt-3 text-sm text-[var(--color-muted)]">
        {{ agent.bio }}
      </p>

      <div
        v-if="agent.specialties && agent.specialties.length"
        class="mt-4"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {{ t('agents.card.specialtiesLabel') }}
        </p>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li v-for="specialty in agent.specialties" :key="specialty">
            <BaseBadge variant="neutral" size="sm">
              {{ specialty }}
            </BaseBadge>
          </li>
        </ul>
      </div>

      <ul
        v-if="agent.phone || agent.email || whatsappLink"
        class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-4 text-sm"
      >
        <li v-if="agent.phone">
          <a
            :href="`tel:${agent.phone}`"
            :aria-label="`${t('agents.card.call')}: ${agent.name}`"
            class="inline-flex items-center gap-1.5 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:phone-outline" size="sm" />
            <span>{{ agent.phone }}</span>
          </a>
        </li>
        <li v-if="agent.email">
          <a
            :href="`mailto:${agent.email}`"
            :aria-label="`${t('agents.card.email')}: ${agent.name}`"
            class="inline-flex items-center gap-1.5 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:email-outline" size="sm" />
            <span>{{ agent.email }}</span>
          </a>
        </li>
        <li v-if="whatsappLink">
          <a
            :href="whatsappLink"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${t('agents.card.whatsapp')}: ${agent.name}`"
            class="inline-flex items-center gap-1.5 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:whatsapp" size="sm" />
            <span>{{ agent.whatsapp }}</span>
          </a>
        </li>
      </ul>
    </div>
  </BaseCard>
</template>
