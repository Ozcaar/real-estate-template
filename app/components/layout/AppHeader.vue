<script setup lang="ts">
import { computed, ref } from 'vue'
import { mainNavigation } from '~/config/navigation'

const site = useSiteConfig()
const agency = computed(() => site.value.agency)

// Hide navigation entries whose module is disabled for this agency.
const navItems = computed(() =>
  mainNavigation.filter(item => !item.module || agency.value.modules[item.module]),
)

const mobileOpen = ref(false)
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur"
  >
    <BaseContainer as="div" class="flex h-16 items-center justify-between gap-4">
      <AppLogo />

      <AppNavbar :items="navItems" class="hidden lg:block" />

      <div class="flex items-center gap-2">
        <AppLanguageSwitcher />
        <BaseButton to="/contact" size="sm" class="hidden sm:inline-flex">
          {{ $t('nav.contact') }}
        </BaseButton>
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] lg:hidden"
          :aria-label="$t('common.openMenu')"
          @click="mobileOpen = true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </BaseContainer>

    <AppMobileMenu
      :items="navItems"
      :open="mobileOpen"
      @close="mobileOpen = false"
    />
  </header>
</template>
