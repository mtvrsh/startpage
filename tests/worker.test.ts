import { afterEach, describe, expect, test, vi } from 'vitest'
import { handleRequest as worker } from '../startpage-api/src/router'
import { corsHeaders, isAllowedOrigin } from '../startpage-api/src/access'
import type { WorkerEnv } from '../startpage-api/src/access'

// The YouTube.js client is never exercised here; rejecting create() gives the
// generic-500 path a deterministic trigger. The mock must use the resolved
// file path: the bare specifier resolves from startpage-api/node_modules,
// which vitest cannot mock by name from tests/.
vi.mock('../startpage-api/node_modules/youtubei.js/dist/src/platform/cf-worker.js', () => ({
  Innertube: {
    create: () => Promise.reject(new TypeError('secret innertube detail')),
  },
}))

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
  test('rejects unlisted origins and missing Origin with 403 and no CORS headers', async () => {
    for (const res of [
      await worker(request('/feed', { origin: 'https://evil.example' }), env(okLimit)),
      await worker(request('/feed', { origin: null }), env(okLimit)),
    ]) {
      expect(res.status).toBe(403)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
      expect(await res.json()).toMatchObject({ error: 'origin not allowed' })
    }
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
    // The proxy response already carries CORS; it must not be duplicated.
    expect([...res.headers.keys()].filter(k => k === 'access-control-allow-origin')).toHaveLength(1)
  })

  test('200 responses from Innertube-backed routes carry CORS headers', async () => {
    // A channel with no videos short-circuits to a bare `[]` json() response
    // that never saw the cors headers before the central application.
    for (const path of ['/channels/UC1234567890abcdefghijklm', '/raw/channels/UC1234567890abcdefghijklm']) {
      const res = await worker(request(path), env(okLimit))
      expect(res.status).toBe(500) // Innertube create() is mocked to fail
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    }
  })

  describe('input validation', () => {
    test('rejects a query over 100 characters with 400 and CORS headers', async () => {
      const res = await worker(request(`/search/channels?q=${'a'.repeat(101)}`), env(okLimit))
      expect(res.status).toBe(400)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
      expect(await res.json()).toMatchObject({ error: 'query is too long' })
    })

    test('rejects malformed channel and playlist ids with 400 and CORS headers', async () => {
      for (const path of [
        `/channels/${'a'.repeat(65)}`,
        `/channels/a%20b`,
        `/raw/channels/%20x`,
        `/playlists/a%20b`,
        `/raw/playlists/${'x'.repeat(65)}`,
        `/channels/foo@bar`,
        `/channels/@`,
      ]) {
        const res = await worker(request(path), env(okLimit))
        expect(res.status).toBe(400)
        expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
      }
    })

    test('all dispatched endpoints append CORS headers to their responses', async () => {
      // Every path through dispatch() must come back usable from the browser:
      // without Access-Control-Allow-Origin the fetch fails there regardless
      // of the status code. Covers 400-validation, 404 and the Streamed 500s.
      for (const path of [
        '/search/channels',
        '/search/channels?q=x',
        '/suggestions',
        '/suggestions?q=x',
        '/channels/doesNotExistButValid-Id123',
        '/raw/channels/UC1234567890abcdefghijklm',
        '/playlists/PL1234567890abcdefghijklmno1',
        '/raw/playlists/PL1234567890abcdefghijklmno1',
        '/no-such-route',
      ]) {
        const res = await worker(request(path), env(okLimit))
        expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
        expect(res.headers.get('vary')).toBe('Origin')
      }
    })

    test('accepts channel handles', async () => {
      // InnerTube is mocked to fail (500), so what matters here is that the
      // id passes validation instead of being rejected with 400.
      for (const path of ['/channels/@foo', '/raw/channels/@foo', '/channels/@foo.bar']) {
        const res = await worker(request(path), env(okLimit))
        expect([400, 404]).not.toContain(res.status)
        if (res.status === 500)
          expect(await res.json()).toMatchObject({ error: 'internal error' })
        else
          expect(await res.json()).not.toMatchObject({ error: 'invalid channel id' })
      }
    })

    test('returns a generic 500 without leaking internals', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await worker(request('/search/channels?q=ok'), env(okLimit))
      expect(res.status).toBe(500)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
      expect(await res.json()).toMatchObject({ error: 'internal error' })
      expect(consoleError.mock.calls.flat().some(line =>
        typeof line === 'string' && line.includes('secret innertube detail')
      )).toBe(true)

      consoleError.mockRestore()
    })
  })
})
