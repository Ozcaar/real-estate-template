<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import type { NavItem } from '~/types/site.types'

/** Slide-over navigation drawer for small screens. */
const props = defineProps<{
  items: NavItem[]
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const closeBtnRef = ref<HTMLButtonElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)

/**
 * Shared state consumed by the root layout to mark the entire background as
 * `inert` while the drawer is open. Using `useState` (Nuxt's SSR-safe shared
 * ref) keeps the coupling minimal — the layout does not import this component,
 * and this component does not need to know about the layout's DOM. The drawer
 * itself is teleported to `<body>` (see template) so it stays outside the
 * inert tree and remains fully interactive.
 */
const mobileMenuOpen = useState<boolean>('mobile-menu-open', () => false)

/** Element that had focus before the drawer opened (usually the hamburger). */
const previouslyFocused = ref<HTMLElement | null>(null)

/** Selector for focusable elements inside the dialog. Used by the focus trap. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableInDialog(): HTMLElement[] {
  const root = dialogRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)
}

// Close on Escape for keyboard accessibility, and trap Tab focus
// inside the dialog while it is open.
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  // The background layout is `inert`, so the only focusable
  // elements in the document are inside the dialog (which is
  // teleported to `<body>`). Trap Tab so the user can never
  // tab past the last focusable element and out of the page
  // (the inert layout gives the browser no other element to
  // land on, so focus would otherwise leave the document).
  const focusables = getFocusableInDialog()
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (event.shiftKey) {
    if (active === first || !dialogRef.value?.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }
})

// Lock background scroll while the drawer is open.
const isOpen = toRef(props, 'open')
useHead({
  htmlAttrs: {
    style: () => (isOpen.value ? 'overflow:hidden' : ''),
  },
})

/**
 * Focus management + inert coordination.
 *  - On open: remember the previously focused element, then move focus to the
 *    drawer's close button once the element is in the DOM.
 *  - On close: restore focus to the previously focused element if it is still
 *    in the document (e.g. after a same-page link click). If the element was
 *    removed (e.g. after route navigation), let the browser set focus to its
 *    default target.
 *  - On unmount: clear the shared `inert` flag so the page does not stay
 *    inert if the component is torn down while open.
 */
watch(
  () => props.open,
  async (isOpen) => {
    mobileMenuOpen.value = isOpen
    if (isOpen) {
      previouslyFocused.value
        = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      closeBtnRef.value?.focus()
    } else {
      const target = previouslyFocused.value
      previouslyFocused.value = null
      await nextTick()
      if (target && document.contains(target)) target.focus()
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  mobileMenuOpen.value = false
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        ref="dialogRef"
        class="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('common.mobileNavigation')"
      >
        <div
          class="absolute inset-0 bg-black/40"
          @click="emit('close')"
        />
        <div
          class="absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col gap-6 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
        >
          <button
            ref="closeBtnRef"
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
          <nav>
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
  </Teleport>
</template>
