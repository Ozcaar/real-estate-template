import { useRuntimeConfig } from '#imports'

/**
 * Dynamic `/robots.txt` endpoint.
 *
 * Mirrors the canonical-URL configuration in `usePageSeo()`: the production
 * site URL is read from `runtimeConfig.public.siteUrl` (sourced from
 * `NUXT_PUBLIC_SITE_URL`) with any trailing slash stripped. The output is
 * a minimal `robots.txt` that either allows crawling and advertises the
 * sitemap (when `siteUrl` is set) or blocks all crawling with a hint
 * pointing the operator at the missing env var (when it is empty).
 *
 * The empty-`siteUrl` branch deliberately does not 503 the request —
 * `robots.txt` is a small text file and most crawlers probe it early.
 * Returning 200 with a blocking rule means search engines back off until
 * the deployment is fully configured, without the operator needing to
 * investigate a non-2xx response.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || '').replace(/\/+$/, '')

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

  if (!siteUrl) {
    return [
      'User-Agent: *',
      'Disallow: /',
      '',
      '# Configure NUXT_PUBLIC_SITE_URL to enable crawling.',
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
