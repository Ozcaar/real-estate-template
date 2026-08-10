import { useColorMode } from '~/composables/useColorMode'

/**
 * Color-mode plugin.
 *
 * Runs on the client (and the server, see the SSR branch below) to
 * keep the `<html data-color-mode>` attribute in sync with the
 * composable's resolved mode. The attribute is the single source of
 * truth the CSS serializer reacts to — `core/utils/theme-to-css-vars.ts`
 * emits the dark-mode block on `[data-color-mode='dark']`, so a single
 * attribute flip is enough to swap the entire palette.
 *
 * **Why a plugin (and not just the composable).** The composable
 * already mutates the attribute on the client, but the plugin also
 * runs on the server during SSR so the initial HTML is consistent
 * with the persisted cookie. The anti-FOUC inline script in
 * `nuxt.config.ts` does the same read on the very first paint; the
 * three sources (inline script → SSR plugin → composable) all agree
 * on the resolved mode so there is no flash of incorrect theme.
 *
 * The plugin does not call any `useHead` reactivity for the
 * attribute. `useHead` would re-emit the attribute on every reactive
 * update and race the composable's own DOM write; a single
 * `setAttribute` keeps the contract explicit.
 */
export default defineNuxtPlugin(() => {
  const { resolved, preference } = useColorMode()

  // SSR branch: the composable seeds `'system'` on the server
  // (the cookie is not visible to SSR), so the resolved value
  // here defaults to the SSR fallback. The anti-FOUC inline
  // script in `nuxt.config.ts` will overwrite the attribute on
  // the client if the cookie / system preference differs.
  if (import.meta.server) {
    const mode = resolved.value
    if (typeof document !== 'undefined') {
      // `useHead` would also work but would emit a meta-style
      // tag; the cookie is the source of truth on the client
      // and the resolved mode is what the inline script will
      // re-apply, so we just mirror it here.
      document.documentElement.setAttribute('data-color-mode', mode)
    }
    return
  }

  // Client branch: react to changes in the resolved mode. The
  // composable already sets the attribute once on mount; the
  // watch here covers subsequent updates (toggle click, system
  // preference change while in `'system'` mode).
  if (import.meta.client) {
    watch(
      resolved,
      (mode) => {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-color-mode', mode)
        }
      },
      { immediate: true },
    )

    // Guard against the rare case where the user has not yet
    // visited any page (the `seeded` flag in the composable has
    // not run). The inline script already set the attribute, but
    // we re-assert the composable's resolved value once on mount
    // to keep the two sources of truth in sync.
    if (typeof document !== 'undefined') {
      const current = document.documentElement.getAttribute('data-color-mode')
      if (current !== resolved.value) {
        document.documentElement.setAttribute('data-color-mode', resolved.value)
      }
    }
  }

  // Suppress the unused-`preference` warning without exposing the
  // ref to the template.
  void preference
})
