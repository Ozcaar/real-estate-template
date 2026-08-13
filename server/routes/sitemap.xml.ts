import { defineEventHandler, setResponseHeader, setResponseStatus } from 'h3'
import { useRuntimeConfig } from '#imports'
import { siteConfig } from '~/config/site.config'
import { loadPropertiesServer } from '../utils/properties'
import { developmentsService } from '~/features/developments/services/developments.service'
import { agentsService } from '~/features/agents/services/agents.service'
import type { Property } from '~/features/properties/types/property.types'

/**
 * Dynamic `/sitemap.xml` endpoint.
 *
 * Lists every public route the agency exposes, gated by `agency.modules.*`
 * (a disabled module removes its entries from the sitemap, mirroring how the
 * header, footer and home sections disappear). Property detail URLs are
 * sourced from the server-only property loader
 * (`server/utils/properties.ts`) so `status: 'hidden'` records are excluded
 * automatically — do not duplicate that filter here.
 *
 * **Why the loader, not the service.** This route is a Nitro
 * server route, not a Nuxt app page. It must not import app
 * composables or code that depends on `useState` (the property
 * service uses `$fetch` to call the same-origin Nitro endpoint
 * at `/api/properties`, which is a loopback on the server and
 * would be wasted ceremony here). The server-only loader is
 * the documented public surface for non-page server
 * consumers; it owns the static / api source selection, reads
 * the `NUXT_PROPERTIES_*` env vars, and returns the validated
 * list directly without the HTTP round-trip.
 *
 * **Async data source.** The loader delegates to the
 * configured adapter (static by default; api when
 * `NUXT_PROPERTIES_DATA_SOURCE=api` + `NUXT_PROPERTIES_API_URL`
 * are set). The api adapter fetches and validates the
 * response; the static adapter returns the bundled data. The
 * sitemap iterates over the resolved data via a local
 * `visibleProperties` filter so `status: 'hidden'` records
 * are excluded — the loader returns the full list (hidden
 * records included, for the api path) and the visibility
 * filter is the sitemap's contract with the data.
 *
 * Development detail URLs are sourced from
 * `developmentsService.getAll()`. The development model does not carry
 * a `status: 'hidden'` field, so the service returns the full catalog;
 * if a future task adds a visibility flag, the service is the place to
 * filter it out (the sitemap will pick up the change automatically.
 *
 * Agent detail URLs are sourced from `agentsService.getAll()`. The
 * agent model does not carry a visibility flag either; the service
 * returns the full catalog and the sitemap loop emits one entry per
 * agent's stable slug.
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
export default defineEventHandler(async (event) => {
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
  if (modules.agents) {
    urls.push('/agents')
    for (const agent of agentsService.getAll()) {
      urls.push(`/agents/${agent.slug}`)
    }
  }
  if (modules.properties) {
    urls.push('/properties')
    const properties = await loadPropertiesServer()
    const visibleProperties = properties.filter(
      (property: Property) => property.status !== 'hidden',
    )
    for (const property of visibleProperties) {
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
