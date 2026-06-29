import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useHead } from '#imports'

/**
 * Emit a JSON-LD `<script type="application/ld+json">` block for the
 * current page.
 *
 * JSON-LD is intentionally **page-specific** (a `RealEstateAgent` on
 * the home page, an `ItemList` of `RealEstateListing` on the catalog
 * page, etc.) and is therefore kept out of `usePageSeo` — see that
 * composable's JSDoc. This helper exists so every page does not
 * inline the same `useHead({ script: [{ type: 'application/ld+json',
 * innerHTML: () => JSON.stringify(...) }] })` boilerplate.
 *
 * The `innerHTML` callback is the function form so the JSON is
 * serialized at SSR time (matching the home page's existing
 * pattern), not at script-tag-stringification time.
 *
 * **Import policy.** This helper lives in `~/core/composables/`, which
 * is listed in `nuxt.config.ts → imports.dirs`, so Nuxt currently
 * auto-imports it. Pages still write `import { useJsonLd } from
 * '~/core/composables/useJsonLd'` explicitly to match the same
 * convention as `usePageSeo`: page-level SEO helpers are easier to
 * audit and to refactor when every call site states its import. A
 * future cleanup could either keep the explicit imports (preferred)
 * or remove `~/core/composables` from `imports.dirs` to enforce
 * explicit imports at the linter level.
 *
 * @param data The JSON-LD payload. Accepts a plain object, a ref or a
 * getter so callers can compose the payload from reactive sources
 * (`site`, `route`, page-specific data) without ceremony.
 */
export function useJsonLd(data: MaybeRefOrGetter<Record<string, unknown>>): void {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: () => JSON.stringify(toValue(data)),
      },
    ],
  })
}
