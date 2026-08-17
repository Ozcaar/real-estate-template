import { defineEventHandler, getRequestHeader, setResponseHeader, setResponseStatus } from 'h3'
import { loadAgentsServer } from '../utils/agents'
import { loadDevelopmentsServer } from '../utils/developments'
import { loadPropertiesServer } from '../utils/properties'
import { resolveTenantContext } from '../utils/tenant-context'
import type { Property } from '~/features/properties/types/property.types'

/**
 * Dynamic `/sitemap.xml` endpoint.
 *
 * Lists every public route the active **tenant** exposes, gated
 * by the resolved tenant's `agency.modules.*` (a disabled module
 * removes its entries from the sitemap, mirroring how the
 * header, footer and home sections disappear). Property detail
 * URLs are sourced from the server-only property loader
 * (`server/utils/properties.ts`) so `status: 'hidden'` records
 * are excluded automatically — do not duplicate that filter here.
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
 * Development detail URLs are sourced from `loadDevelopmentsServer()`
 * (the server-only development loader). The development model does not
 * carry a `status: 'hidden'` field; the loader returns the full catalog
 * (validated against `developmentListSchema`) and the sitemap loop
 * emits one entry per development's stable slug. The sitemap uses
 * the loader directly rather than the app-side `developmentsService`
 * so the api-adapter module, the `NUXT_DEVELOPMENTS_*` env vars, and
 * the boundary regression tests on the app-side service do not
 * influence the server-only Nitro bundle.
 *
 * Agent detail URLs are sourced from `loadAgentsServer()` (the
 * server-only agent loader). The agent model does not carry a
 * visibility flag; the loader returns the full catalog (validated
 * against `agentListSchema`) and the sitemap loop emits one entry
 * per agent's stable slug. The sitemap uses the loader directly
 * rather than the app-side `agentsService` so the api-adapter
 * module, the `NUXT_AGENTS_*` env vars, and the boundary
 * regression tests on the app-side service do not influence the
 * server-only Nitro bundle.
 *
 * The output is a minimal `urlset` (no `<lastmod>`, `<changefreq>` or
 * `<priority>`) because the data models do not carry a last-modified
 * timestamp. The sitemaps.org spec treats all three as optional.
 *
 * **Tenant-aware resolution (Task 102).** The route calls
 * `resolveTenantContext` per request to pick the active tenant
 * from the request hostname (the registry's `normalizeHostname`
 * handles port stripping, case folding, etc.) and to read the
 * **per-tenant canonical site URL**. The per-tenant URL is
 * resolved with the documented
 * `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` override + global
 * `NUXT_PUBLIC_SITE_URL` fallback; the default tenant uses the
 * global env var, preserving the existing single-agency behavior
 * byte-identically. The route imports NO app composables and
 * NO global `siteConfig` — the tenant context is the source of
 * truth. When the resolved `siteUrl` is empty, the route returns
 * HTTP 503 with a plain-text hint so a misconfigured
 * deployment is obvious in crawlers' logs.
 */

/**
 * Read the request hostname for tenant resolution.
 *
 * Honors `x-forwarded-host` first (a CDN / load balancer
 * rewrites the host header at the edge), then falls back to
 * `host`. Both headers are lowercased and trimmed for stable
 * matching against the registry's `hosts` lists.
 */
function readHost(event: Parameters<typeof defineEventHandler>[0]): string {
  const fwd = getRequestHeader(event, 'x-forwarded-host')
  const host = getRequestHeader(event, 'host')
  const raw = (fwd ?? host ?? '').split(',')[0]?.trim() ?? ''
  return raw
}

export default defineEventHandler(async (event) => {
  const ctx = resolveTenantContext(readHost(event))
  const siteUrl = ctx.siteUrl

  if (!siteUrl) {
    setResponseStatus(event, 503)
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return 'Configure NUXT_PUBLIC_SITE_URL (or a per-tenant NUXT_PUBLIC_SITE_URL__<TENANT_ID> override) to enable the sitemap.'
  }

  const { modules } = ctx.agency

  const urls: string[] = ['/', '/about']

  if (modules.contact) urls.push('/contact')
  if (modules.agents) {
    urls.push('/agents')
    const agents = await loadAgentsServer()
    for (const agent of agents) {
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
    const developments = await loadDevelopmentsServer()
    for (const development of developments) {
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