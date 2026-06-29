<script setup lang="ts">
import { computed } from 'vue'
import { mainNavigation } from '~/config/navigation'

const site = useSiteConfig()
const agency = computed(() => site.value.agency)
const currentYear = new Date().getFullYear()

const navItems = computed(() =>
  mainNavigation.filter(item => !item.module || agency.value.modules[item.module]),
)

/** Build a `wa.me` link from a phone string (digits only, no formatting). */
const whatsappLink = computed(() => {
  const raw = agency.value.contact.whatsapp
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
})
</script>

<template>
  <footer
    class="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-foreground)]"
  >
    <BaseContainer as="div" class="grid gap-10 py-12 md:grid-cols-3">
      <div>
        <AppLogo />
        <p class="mt-2 max-w-xs text-sm text-[var(--color-muted)]">
          {{ agency.slogan || $t('footer.tagline') }}
        </p>
        <SocialLinks :links="agency.social" class="mt-4" />
      </div>

      <nav :aria-label="$t('footer.quickLinks')">
        <p class="text-sm font-semibold">{{ $t('footer.quickLinks') }}</p>
        <ul class="mt-3 flex flex-col gap-2">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
            >
              {{ $t(item.labelKey) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <p class="text-sm font-semibold">{{ $t('footer.contact') }}</p>
        <ul class="mt-3 flex flex-col gap-2 text-sm text-[var(--color-muted)]">
          <li v-if="agency.contact.phone">
            <a
              :href="`tel:${agency.contact.phone}`"
              class="inline-flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]"
            >
              <BaseIcon name="mdi:phone-outline" size="sm" />
              <span>{{ agency.contact.phone }}</span>
            </a>
          </li>
          <li v-if="agency.contact.email">
            <a
              :href="`mailto:${agency.contact.email}`"
              class="inline-flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]"
            >
              <BaseIcon name="mdi:email-outline" size="sm" />
              <span>{{ agency.contact.email }}</span>
            </a>
          </li>
          <li v-if="whatsappLink">
            <a
              :href="whatsappLink"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="$t('footer.whatsappLabel')"
              class="inline-flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]"
            >
              <BaseIcon name="mdi:whatsapp" size="sm" />
              <span>{{ agency.contact.whatsapp }}</span>
            </a>
          </li>
          <li v-if="agency.contact.address">
            <span class="inline-flex items-center gap-2">
              <BaseIcon name="mdi:map-marker-outline" size="sm" />
              <span>{{ agency.contact.address }}</span>
            </span>
          </li>
          <li v-if="agency.contact.businessHours">
            <span class="inline-flex items-center gap-2">
              <BaseIcon name="mdi:clock-outline" size="sm" />
              <span>{{ agency.contact.businessHours }}</span>
            </span>
          </li>
        </ul>
      </div>
    </BaseContainer>

    <div class="border-t border-[var(--color-border)]">
      <BaseContainer as="div" class="py-4 text-center text-xs text-[var(--color-muted)]">
        © {{ currentYear }} {{ agency.name }}. {{ $t('footer.rights') }}
      </BaseContainer>
    </div>
  </footer>
</template>
