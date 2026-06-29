<script setup lang="ts">
/**
 * Default public layout: header, page content and footer.
 *
 * The root wrapper is marked `inert` while the mobile navigation drawer is
 * open, so keyboard and screen-reader users cannot tab into the header, the
 * page content, the footer, or any other background element. The drawer is
 * rendered via `<Teleport to="body">` inside `AppMobileMenu`, so it lives
 * outside this inert tree and remains fully interactive. The open/close flag
 * is published by `AppMobileMenu` via the shared `mobile-menu-open`
 * `useState`, so this layout does not need to import the drawer component.
 */
const mobileMenuOpen = useState<boolean>('mobile-menu-open')
</script>

<template>
  <div
    class="flex min-h-screen flex-col bg-[var(--color-background)] text-[var(--color-foreground)]"
    :inert="mobileMenuOpen"
  >
    <a
      href="#main-content"
      class="sr-only rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2 text-[var(--color-primary-foreground)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
    >
      {{ $t('common.skipToContent') }}
    </a>

    <AppHeader />

    <main
      id="main-content"
      class="flex-1"
    >
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
