<script setup lang="ts">
import { computed } from 'vue'
import { buildWhatsAppLink } from '~/core/utils/whatsapp-link'

/**
 * Homepage "Contact CTA" band: the final conversion section.
 *
 * Composes the shared {@link CtaBlock} with a secondary action and a
 * configurable contact-info strip (phone, email, WhatsApp, address) sourced
 * from the active agency's configuration. Each contact hint only renders when
 * its corresponding field is set, so an agency can enable/disable channels
 * purely from `app/config/agencies/*.agency.ts` without touching this
 * component. No contact data is hardcoded here.
 */
const { t } = useI18n()
const site = useSiteConfig()

const contact = computed(() => site.value.agency.contact)

/** WhatsApp deep link derived from the agency's configured number. */
const whatsappLink = computed(() => buildWhatsAppLink(contact.value.whatsapp))

/** True when at least one contact hint has a value to render. */
const hasAnyContact = computed(() =>
  Boolean(contact.value.phone)
  || Boolean(contact.value.email)
  || Boolean(whatsappLink.value)
  || Boolean(contact.value.address),
)
</script>

<template>
  <BaseSection spacing="lg">
    <CtaBlock
      :title="t('home.cta.title')"
      :description="t('home.cta.description')"
      tone="primary"
    >
      <template #actions>
        <BaseButton to="/contact" size="lg" variant="secondary">
          {{ t('home.cta.action') }}
        </BaseButton>
        <BaseButton to="/properties" size="lg" variant="ghost">
          {{ t('home.contactCta.secondaryAction') }}
        </BaseButton>
      </template>
    </CtaBlock>

    <div
      v-if="hasAnyContact"
      class="mt-8"
    >
      <p class="text-center text-sm font-medium text-[var(--color-muted)]">
        {{ t('home.contactCta.contactLabel') }}
      </p>
      <ul
        class="mt-4 flex flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2"
      >
        <li v-if="contact.phone">
          <a
            :href="`tel:${contact.phone}`"
            :aria-label="t('home.contactCta.phoneLabel')"
            class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:phone-outline" size="sm" />
            <span>{{ contact.phone }}</span>
          </a>
        </li>
        <li v-if="contact.email">
          <a
            :href="`mailto:${contact.email}`"
            :aria-label="t('home.contactCta.emailLabel')"
            class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:email-outline" size="sm" />
            <span>{{ contact.email }}</span>
          </a>
        </li>
        <li v-if="whatsappLink">
          <a
            :href="whatsappLink"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('home.contactCta.whatsappLabel')"
            class="inline-flex items-center gap-2 text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <BaseIcon name="mdi:whatsapp" size="sm" />
            <span>{{ contact.whatsapp }}</span>
          </a>
        </li>
        <li v-if="contact.address">
          <span
            :aria-label="t('home.contactCta.addressLabel')"
            class="inline-flex items-center gap-2 text-[var(--color-foreground)]"
          >
            <BaseIcon name="mdi:map-marker-outline" size="sm" />
            <span>{{ contact.address }}</span>
          </span>
        </li>
      </ul>
    </div>
  </BaseSection>
</template>
