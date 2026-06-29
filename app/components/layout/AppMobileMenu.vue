<script setup lang="ts">
import { toRef } from 'vue'
import type { NavItem } from '~/types/site.types'

/** Slide-over navigation drawer for small screens. */
const props = defineProps<{
  items: NavItem[]
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Close on Escape for keyboard accessibility.
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) emit('close')
})

// Lock background scroll while the drawer is open.
const isOpen = toRef(props, 'open')
useHead({
  htmlAttrs: {
    style: () => (isOpen.value ? 'overflow:hidden' : ''),
  },
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-200"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('common.mainNavigation')"
    >
      <div
        class="absolute inset-0 bg-black/40"
        @click="emit('close')"
      />
      <div
        class="absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col gap-6 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
      >
        <button
          type="button"
          class="self-end rounded-[var(--radius-sm)] p-2 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          :aria-label="$t('common.closeMenu')"
          @click="emit('close')"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <nav :aria-label="$t('common.mainNavigation')">
          <ul class="flex flex-col gap-1">
            <li v-for="item in items" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="block rounded-[var(--radius-md)] px-3 py-2 text-base font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                active-class="text-[var(--color-primary)]"
                @click="emit('close')"
              >
                {{ $t(item.labelKey) }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </Transition>
</template>
