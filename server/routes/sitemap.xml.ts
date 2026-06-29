import { useRuntimeConfig } from '#imports'
import { siteConfig } from '~/config/site.config'
import { propertiesService } from '~/features/properties/services/properties.service'

/**
 * Dynamic `/sitemap.xml` endpoint.
 *
 * Lists every public route the agency exposes, gated by `agency.modules.*`
 * (a disabled module removes its entries from the sitemap, mirroring how the
 * header, footer and home sections disappear). Property detail URLs are
 * sourced from `propertiesService.getAll()` so `status: 'hidden'` records
 * are excluded automatically — do not duplicate that filter here.
 *
 * Per-development URLs are intentionally omitted: the `Development.slug`
 * field is reserved for a future `/developments/[slug]` detail page, and
 * emitting those URLs today would point crawlers to 404s. When that route
 * ships, add the per-slug loop here.
 *
 * The output is a minimal `urlset` (no `<lastmod>`, `<changefreq>` or
 * `<priority>`) because the data models do not carry a last-modified
 * timestamp. The sitemaps.org spec treats all three as optional.
 *
 * `siteUrl` is read from `runtimeConfig.public.siteUrl` (sourced from
 * `NUXT_PUBLIC_SITE_URL`) and normalized the same way as `usePageSeo()`:
 * any trailing slash is stripped so concatenation with a path that starts
 * with `/` never produces `//`. When the value is empty (no env var set),
 * the route returns HTTP 503 with a plain-text hint so a misconfigured
 * deployment is obvious in crawlers' logs.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || '').replace(/\/+$/, '')

  if (!siteUrl) {
    setResponseStatus(event, 503)
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return 'Configure NUXT_PUBLIC_SITE_URL to enable the sitemap.'
  }

  const { modules } = siteConfig.agency

  const urls: string[] = ['/', '/about']

  if (modules.contact) urls.push('/contact')
  if (modules.agents) urls.push('/agents')
  if (modules.properties) {
    urls.push('/properties')
    for (const property of propertiesService.getAll()) {
      urls.push(`/properties/${property.slug}`)
    }
  }
  if (modules.developments) urls.push('/developments')

  const escape = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const body
    = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(url => `  <url>\n    <loc>${escape(siteUrl + url)}</loc>\n  </url>`).join('\n')
    + '\n</urlset>\n'

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return body
})
