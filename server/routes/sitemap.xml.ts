import { useRuntimeConfig } from '#imports'
import { siteConfig } from '~/config/site.config'
import { propertiesService } from '~/features/properties/services/properties.service'
import { developmentsService } from '~/features/developments/services/developments.service'

/**
 * Dynamic `/sitemap.xml` endpoint.
 *
 * Lists every public route the agency exposes, gated by `agency.modules.*`
 * (a disabled module removes its entries from the sitemap, mirroring how the
 * header, footer and home sections disappear). Property detail URLs are
 * sourced from `propertiesService.getAll()` so `status: 'hidden'` records
 * are excluded automatically — do not duplicate that filter here.
 *
 * Development detail URLs are sourced from
 * `developmentsService.getAll()`. The development model does not carry
 * a `status: 'hidden'` field, so the service returns the full catalog;
 * if a future task adds a visibility flag, the service is the place to
 * filter it out (the sitemap will pick up the change automatically).
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
  if (modules.developments) {
    urls.push('/developments')
    for (const development of developmentsService.getAll()) {
      urls.push(`/developments/${development.slug}`)
    }
  }

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
