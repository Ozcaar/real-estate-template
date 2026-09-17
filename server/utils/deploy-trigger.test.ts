import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TRIGGER_TIMEOUT_MS,
  outcomeForStatus,
  readDeployTriggerConfig,
  triggerDeploy,
} from './deploy-trigger'

/**
 * Tests for the provider-agnostic external rebuild trigger.
 *
 * Coverage:
 *  - `readDeployTriggerConfig` reads the three env vars (URL,
 *    auth header, timeout) with the documented defaults.
 *  - `triggerDeploy` returns `missing_config` when the URL is
 *    empty / whitespace.
 *  - `triggerDeploy` invokes `fetch` exactly once with the
 *    configured URL, method, headers, and JSON body.
 *  - `triggerDeploy` returns `dispatched` on a 2xx response.
 *  - `triggerDeploy` returns `auth_rejected` on a 401 / 403
 *    response.
 *  - `triggerDeploy` returns `not_found` on a 404 response.
 *  - `triggerTrigger` returns `server_error` on a 5xx response.
 *  - `triggerDeploy` returns `client_error` on a 4xx other
 *    than 401 / 403 / 404.
 *  - `triggerDeploy` returns `redirect_blocked` when the fetch
 *    response has `type === 'opaqRedirect'`.
 *  - `triggerDeploy` returns `timeout` when the fetch rejects
 *    with an AbortError (or any error whose message includes
 *    `abort`).
 *  - `triggerDeploy` returns `network_error` on a non-abort
 *    fetch rejection.
 *  - `triggerDeploy` uses `redirect: 'manual'` so a 3xx
 *    response is never followed.
 *  - `triggerDeploy` does NOT include the `Authorization`
 *    header when none is configured.
 *  - `triggerDeploy` includes the `Authorization` header when
 *    configured.
 *  - `triggerDeploy` sends a JSON body with the documented
 *    fields (no Sanity body, no secrets).
 *  - The default timeout is the documented 5 seconds.
 *
 * The tests inject a `fetch` mock via the `fetchImpl` option
 * so the production platform `fetch` is never touched.
 */

const ENV_URL = 'NUXT_DEPLOY_HOOK_URL'
const ENV_AUTH = 'NUXT_DEPLOY_HOOK_AUTH_HEADER'
const ENV_TIMEOUT = 'NUXT_DEPLOY_HOOK_TIMEOUT_MS'

const originalEnv = { ...process.env }

function jsonResponse(status: number, _opts: { type?: ResponseType } = {}): Response {
  return new Response('{}', { status, headers: { 'content-type': 'application/json' } })
}

function opaqRedirectResponse(): Response {
  // Node 18+ Response does not support direct `type: 'opaqRedirect'`
  // construction. Cast through `as unknown as Response` to seed
  // the discriminator the trigger reads.
  const stub = new Response(null, { status: 302, headers: { location: 'https://elsewhere.example.test' } })
  Object.defineProperty(stub, 'type', { value: 'opaqRedirect', configurable: true })
  return stub
}

beforeEach(() => {
  for (const key of [ENV_URL, ENV_AUTH, ENV_TIMEOUT]) {
    Reflect.deleteProperty(process.env, key)
  }
})

afterEach(() => {
  for (const key of [ENV_URL, ENV_AUTH, ENV_TIMEOUT]) {
    Reflect.deleteProperty(process.env, key)
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }
  vi.restoreAllMocks()
})

describe('readDeployTriggerConfig', () => {
  it('returns null when NUXT_DEPLOY_HOOK_URL is empty', () => {
    expect(readDeployTriggerConfig({ ...process.env })).toBeNull()
  })

  it('returns null when NUXT_DEPLOY_HOOK_URL is whitespace-only', () => {
    process.env[ENV_URL] = '   '
    expect(readDeployTriggerConfig({ ...process.env })).toBeNull()
  })

  it('returns the URL with no auth header when NUXT_DEPLOY_HOOK_AUTH_HEADER is unset', () => {
    process.env[ENV_URL] = 'https://hooks.example.test/deploy'
    const config = readDeployTriggerConfig({ ...process.env })
    expect(config).toEqual({
      url: 'https://hooks.example.test/deploy',
      authHeader: null,
      timeoutMs: DEFAULT_TRIGGER_TIMEOUT_MS,
    })
  })

  it('returns the URL with the auth header when configured', () => {
    process.env[ENV_URL] = 'https://hooks.example.test/deploy'
    process.env[ENV_AUTH] = 'Bearer secret-token'
    const config = readDeployTriggerConfig({ ...process.env })
    expect(config?.authHeader).toBe('Bearer secret-token')
  })

  it('trims whitespace from the URL but preserves whitespace in the auth header (credential field)', () => {
    process.env[ENV_URL] = '  https://hooks.example.test/deploy  '
    process.env[ENV_AUTH] = '  Bearer secret-token  '
    const config = readDeployTriggerConfig({ ...process.env })
    // URLs are non-credentials — trim to remove operator
    // formatting artifacts.
    expect(config?.url).toBe('https://hooks.example.test/deploy')
    // The auth header is a credential — leading / trailing
    // whitespace is part of the secret. The verifier trims
    // ONLY for the missing / present decision; the returned
    // value preserves the exact configured bytes.
    expect(config?.authHeader).toBe('  Bearer secret-token  ')
  })

  it('uses the default timeout when NUXT_DEPLOY_HOOK_TIMEOUT_MS is unset', () => {
    process.env[ENV_URL] = 'https://hooks.example.test/deploy'
    expect(readDeployTriggerConfig({ ...process.env })?.timeoutMs).toBe(DEFAULT_TRIGGER_TIMEOUT_MS)
  })

  it('honors a custom NUXT_DEPLOY_HOOK_TIMEOUT_MS', () => {
    process.env[ENV_URL] = 'https://hooks.example.test/deploy'
    process.env[ENV_TIMEOUT] = '1234'
    expect(readDeployTriggerConfig({ ...process.env })?.timeoutMs).toBe(1234)
  })

  it('falls back to the default when NUXT_DEPLOY_HOOK_TIMEOUT_MS is malformed', () => {
    process.env[ENV_URL] = 'https://hooks.example.test/deploy'
    process.env[ENV_TIMEOUT] = 'not-a-number'
    expect(readDeployTriggerConfig({ ...process.env })?.timeoutMs).toBe(DEFAULT_TRIGGER_TIMEOUT_MS)
  })
})

describe('outcomeForStatus', () => {
  it('200 → dispatched', () => {
    expect(outcomeForStatus(200)).toBe('dispatched')
  })
  it('201 → dispatched', () => {
    expect(outcomeForStatus(201)).toBe('dispatched')
  })
  it('204 → dispatched', () => {
    expect(outcomeForStatus(204)).toBe('dispatched')
  })
  it('299 → dispatched', () => {
    expect(outcomeForStatus(299)).toBe('dispatched')
  })
  it('301 → client_error (redirects are routed through redirect_blocked, not via outcomeForStatus)', () => {
    // The redirect-blocked branch fires before outcomeForStatus
    // is reached; this test pins that outcomeForStatus would
    // not falsely accept a redirect.
    expect(outcomeForStatus(301)).toBe('client_error')
  })
  it('400 → client_error', () => {
    expect(outcomeForStatus(400)).toBe('client_error')
  })
  it('401 → auth_rejected', () => {
    expect(outcomeForStatus(401)).toBe('auth_rejected')
  })
  it('403 → auth_rejected', () => {
    expect(outcomeForStatus(403)).toBe('auth_rejected')
  })
  it('404 → not_found', () => {
    expect(outcomeForStatus(404)).toBe('not_found')
  })
  it('409 → client_error', () => {
    expect(outcomeForStatus(409)).toBe('client_error')
  })
  it('429 → client_error', () => {
    expect(outcomeForStatus(429)).toBe('client_error')
  })
  it('500 → server_error', () => {
    expect(outcomeForStatus(500)).toBe('server_error')
  })
  it('503 → server_error', () => {
    expect(outcomeForStatus(503)).toBe('server_error')
  })
  it('599 → server_error', () => {
    expect(outcomeForStatus(599)).toBe('server_error')
  })
})

describe('triggerDeploy', () => {
  const URL = 'https://hooks.example.test/deploy'
  const INPUT = {
    idempotencyKey: 'sanity-idem-abc',
    sanityWebhookId: 'webhook-1',
    sanityDocumentId: 'doc-1',
    sanityOperation: 'create',
    reason: 'sanity_content_change' as const,
  }

  function buildConfig(authHeader: string | null = null, timeoutMs = DEFAULT_TRIGGER_TIMEOUT_MS) {
    return { url: URL, authHeader, timeoutMs }
  }

  it('returns missing_config when the configured URL is empty', async () => {
    const fetchImpl = vi.fn()
    const result = await triggerDeploy(INPUT, { config: null, fetchImpl })
    expect(result).toEqual({ outcome: 'missing_config', status: null })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('invokes fetch exactly once with the configured URL, method, headers, and JSON body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200))
    await triggerDeploy(INPUT, {
      config: buildConfig('Bearer token-abc'),
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(URL)
    expect(calledInit.method).toBe('POST')
    const headers = calledInit.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['user-agent']).toContain('real-estate-template/sanity-webhook-trigger')
    expect(headers['authorization']).toBe('Bearer token-abc')
    expect(calledInit.redirect).toBe('manual')
    expect(typeof calledInit.signal).toBe('object')
    const body = JSON.parse(calledInit.body as string)
    expect(body).toEqual({
      reason: 'sanity_content_change',
      idempotencyKey: 'sanity-idem-abc',
      sanityWebhookId: 'webhook-1',
      sanityDocumentId: 'doc-1',
      sanityOperation: 'create',
    })
  })

  it('does NOT include the Authorization header when none is configured', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200))
    await triggerDeploy(INPUT, { config: buildConfig(null), fetchImpl })
    const [, calledInit] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const headers = calledInit.headers as Record<string, string>
    expect(headers['authorization']).toBeUndefined()
  })

  it('returns dispatched on a 2xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(202))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'dispatched', status: 202 })
  })

  it('returns auth_rejected on a 401 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'auth_rejected', status: 401 })
  })

  it('returns auth_rejected on a 403 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'auth_rejected', status: 403 })
  })

  it('returns not_found on a 404 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'not_found', status: 404 })
  })

  it('returns client_error on a 400 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'client_error', status: 400 })
  })

  it('returns client_error on a 409 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'client_error', status: 409 })
  })

  it('returns server_error on a 500 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'server_error', status: 500 })
  })

  it('returns server_error on a 503 response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503))
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'server_error', status: 503 })
  })

  it('returns redirect_blocked when the response is opaqRedirect (does NOT follow redirects)', async () => {
    const fetchImpl = vi.fn(async () => opaqRedirectResponse())
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result.outcome).toBe('redirect_blocked')
    expect(result.status).toBe(0)
  })

  it('redirect: "manual" is passed to fetch so 3xx is never followed', async () => {
    const fetchImpl = vi.fn(async () => opaqRedirectResponse())
    await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    const [, calledInit] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(calledInit.redirect).toBe('manual')
  })

  it('returns timeout when the fetch rejects with an AbortError', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => {
      throw abortError
    })
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'timeout', status: null })
  })

  it('returns timeout when the fetch rejects with a DOMException-style AbortError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError')
    })
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'timeout', status: null })
  })

  it('returns network_error when the fetch rejects with a non-abort error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'network_error', status: null })
  })

  it('does not throw on any input shape — every error path is a structured result', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('boom')
    })
    const result = await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    expect(result).toEqual({ outcome: 'network_error', status: null })
  })

  it('does not log the request body or the response body', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => new Response('provider-secret-token-in-body', { status: 200 }))
    await triggerDeploy(INPUT, { config: buildConfig(), fetchImpl })
    const allCalls = [...consoleSpy.mock.calls, ...consoleErrorSpy.mock.calls]
    for (const call of allCalls) {
      expect(JSON.stringify(call)).not.toContain('provider-secret-token-in-body')
    }
  })

  it('does not follow an arbitrary redirect — the 3xx is reported, not chained', async () => {
    // A receiver that 302-redirects to a different host must
    // not be followed with the Authorization header.
    const fetchImpl = vi.fn(async () => opaqRedirectResponse())
    const result = await triggerDeploy(INPUT, {
      config: buildConfig('Bearer sensitive-token'),
      fetchImpl,
    })
    expect(result.outcome).toBe('redirect_blocked')
    // The trigger is invoked exactly once — the redirect was
    // NOT followed.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('DEFAULT_TRIGGER_TIMEOUT_MS', () => {
  it('is 5 seconds (under Sanity\'s 30-second delivery timeout)', () => {
    expect(DEFAULT_TRIGGER_TIMEOUT_MS).toBe(5_000)
  })
})
