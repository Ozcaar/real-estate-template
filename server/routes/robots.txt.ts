import { defineEventHandler, getRequestHeader, setResponseHeader } from 'h3'
import { resolveTenantContext } from '../utils/tenant-context'

/**
 * Dynamic `/robots.txt` endpoint.
 *
 * Resolves the active tenant's canonical site URL via
 * `resolveTenantContext` (Task 102) and emits a minimal
 * `robots.txt` that either allows crawling and advertises the
 * tenant's `sitemap.xml` (when `siteUrl` is set) or blocks all
 * crawling with a hint pointing the operator at the missing env
 * var (when it is empty).
 *
 * **Per-tenant canonical URL.** The site URL is the
 * `NUXT_PUBLIC_SITE_URL__<TENANT_ID>` override with fallback to
 * the global `NUXT_PUBLIC_SITE_URL`. The default tenant uses the
 * global env var, preserving the existing single-agency behavior
 * byte-identically. The sitemap reference uses the SAME resolved
 * URL, so a multi-tenant deployment that lists each tenant's
 * hostname in the registry emits the matching `Sitemap:` line.
 *
 * **Read host from headers.** The route honors
 * `x-forwarded-host` first (a CDN / load balancer rewrites the
 * host header at the edge), then falls back to `host`. Both are
 * lowercased and trimmed for stable matching.
 *
 * **The empty-`siteUrl` branch deliberately does not 503 the
 * request.** `robots.txt` is a small text file and most crawlers
 * probe it early. Returning 200 with a blocking rule means search
 * engines back off until the deployment is fully configured,
 * without the operator needing to investigate a non-2xx response.
 */
function readHost(event: Parameters<typeof defineEventHandler>[0]): string {
  const fwd = getRequestHeader(event, 'x-forwarded-host')
  const host = getRequestHeader(event, 'host')
  const raw = (fwd ?? host ?? '').split(',')[0]?.trim() ?? ''
  return raw
}

export default defineEventHandler((event) => {
  const ctx = resolveTenantContext(readHost(event))
  const siteUrl = ctx.siteUrl

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

  if (!siteUrl) {
    return [
      'User-Agent: *',
      'Disallow: /',
      '',
      '# Configure NUXT_PUBLIC_SITE_URL (or a per-tenant NUXT_PUBLIC_SITE_URL__<TENANT_ID> override) to enable crawling.',
      '',
    ].join('\n')
  }

  return [
    'User-Agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})