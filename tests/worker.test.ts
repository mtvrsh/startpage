import { afterEach, describe, expect, test, vi } from 'vitest'
import { handleRequest as worker } from '../startpage-api/src/router'
import { corsHeaders, isAllowedOrigin } from '../startpage-api/src/access'
import type { WorkerEnv } from '../startpage-api/src/access'

const ALLOWED_ORIGINS = 'https://app.example http://localhost:5173'

function env(limit: { limit: (options: { key: string }) => Promise<{ success: boolean }> } | undefined) {
  return { ALLOWED_ORIGINS, FEED_LIMIT: limit } as WorkerEnv
}

function request(
  url: string,
  init?: { origin?: string | null; referer?: string; method?: string },
) {
  const headers: Record<string, string> = {}
  if (init?.origin !== null) headers.Origin = init?.origin ?? 'https://app.example'
  if (init?.referer) headers.Referer = init.referer
  return new Request(`https://worker.test${url}`, { headers, method: init?.method ?? 'GET' })
}

const okLimit = { limit: async () => ({ success: true }) }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isAllowedOrigin / corsHeaders', () => {
  test('accepts allowlisted origins and echoes them', () => {
    const req = request('/feed', { origin: 'https://app.example' })
    expect(isAllowedOrigin(req, env(okLimit))).toBe(true)
    expect(corsHeaders(req, env(okLimit))).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    })
  })

  test('accepts allowlisted origins ignoring trailing slashes', () => {
    const req = request('/feed', { origin: 'http://localhost:5173' })
    expect(isAllowedOrigin(req, { ALLOWED_ORIGINS: 'http://localhost:5173/' })).toBe(true)
  })

  test('rejects unlisted origins', () => {
    const req = request('/feed', { origin: 'https://evil.example' })
    expect(isAllowedOrigin(req, env(okLimit))).toBe(false)
    expect(corsHeaders(req, env(okLimit))).toEqual({})
  })

  test('rejects requests without an Origin header', () => {
    const req = request('/feed', { origin: null })
    expect(isAllowedOrigin(req, env(okLimit))).toBe(false)
  })

  test('falls back to the Referer origin', () => {
    const req = request('/feed', {
      origin: null,
      referer: 'https://app.example/startpage/index.html',
    })
    expect(isAllowedOrigin(req, env(okLimit))).toBe(true)
  })
})

describe('exported fetch handler', () => {
  test('rejects unlisted origins with 403 and no CORS headers', async () => {
    const res = await worker(request('/feed', { origin: 'https://evil.example' }), env(okLimit))
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(await res.json()).toMatchObject({ error: 'origin not allowed' })
  })

  test('rejects requests lacking an Origin header with 403', async () => {
    const res = await worker(request('/feed', { origin: null }), env(okLimit))
    expect(res.status).toBe(403)
  })

  test('preflight from an allowed origin gets echoed CORS headers', async () => {
    const res = await worker(request('/', { method: 'OPTIONS' }), env(okLimit))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(res.headers.get('access-control-allow-headers')).toBeNull()
  })

  test('non-GET methods are rejected with CORS headers for allowed origins', async () => {
    const res = await worker(request('/', { method: 'POST' }), env(okLimit))
    expect(res.status).toBe(405)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
  })

  test('rate-limited requests get 429', async () => {
    const res = await worker(request('/feed'), env({ limit: async () => ({ success: false }) }))

    expect(res.status).toBe(429)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(await res.json()).toMatchObject({ error: 'rate limit exceeded' })
  })

  test('rate limiter failures fail open', async () => {
    const failing = { limit: async () => { throw new Error('boom') } }
    const res = await worker(request('/failing-route-404'), env(failing))
    expect(res.status).toBe(404)
  })

  test('feeds through to the feed proxy with echo-origin CORS', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<feed/>', {
      headers: { 'Content-Type': 'application/atom+xml' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await worker(request('/feed?url=https%3A%2F%2Fdustri.org%2Fb%2Fatom.xml'), env(okLimit))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(res.headers.get('vary')).toBe('Origin')
    expect(await res.text()).toBe('<feed/>')
  })
})
