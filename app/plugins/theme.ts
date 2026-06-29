import { themeToCssVars } from '~/core/utils/theme-to-css-vars'

/**
 * Injects the active agency's theme tokens as CSS variables and sets the
 * `data-theme` attribute. Runs on both server and client so branding is
 * applied during SSR with no flash of unstyled content.
 */
export default defineNuxtPlugin(() => {
  const site = useSiteConfig()

  useHead({
    htmlAttrs: {
      'data-theme': site.value.theme.id,
    },
    // Favicon comes from agency configuration (never hardcoded), falling back
    // to the bundled default when an agency does not provide one.
    link: [
      { rel: 'icon', href: site.value.agency.favicon || '/favicon.ico' },
    ],
    style: [
      {
        id: 'agency-theme',
        innerHTML: themeToCssVars(site.value.theme),
      },
    ],
  })
})
