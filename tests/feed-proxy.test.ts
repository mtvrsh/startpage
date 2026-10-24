import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  feedProxy,
  isFeedContentType,
  isPrivateHost,
  readLimited,
  validateFeedUrl,
} from '../startpage-api/src/feed-proxy'

const CORS = { 'Access-Control-Allow-Origin': '*' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateFeedUrl', () => {
  test('accepts public http and https URLs', () => {
    expect(validateFeedUrl('https://dustri.org/b/atom.xml').href)
      .toBe('https://dustri.org/b/atom.xml')
    expect(validateFeedUrl('http://example.com:8080/feed').href)
      .toBe('http://example.com:8080/feed')
  })

  test('rejects unsupported protocols, credentials and malformed URLs', () => {
    for (const url of [
      'ftp://example.com/feed',
      'file:///tmp/feed.xml',
      'javascript:alert(1)',
      'https://user:pass@example.com/feed',
      'not a url',
      '',
    ]) {
      expect(() => validateFeedUrl(url)).toThrow()
    }
  })

  test('rejects private and local hosts', () => {
    for (const url of [
      'http://localhost/feed',
      'http://feed.localhost/feed',
      'http://router.local/feed',
      'http://metadata.internal/feed',
      'http://127.0.0.1/feed',
      'http://10.0.0.1/feed',
      'http://172.16.0.1/feed',
      'http://192.168.1.1/feed',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/feed',
      'http://[fe80::1]/feed',
      'http://[::127.0.0.1]/feed',
    ]) {
      expect(() => validateFeedUrl(url)).toThrow('Private network feed URLs are not allowed')
    }
  })
})

describe('isPrivateHost', () => {
  test('allows ordinary public hostnames', () => {
    expect(isPrivateHost('example.com')).toBe(false)
    expect(isPrivateHost('notlocalhost')).toBe(false)
    expect(isPrivateHost('8.8.8.8')).toBe(false)
  })

  test('blocks reserved and local ranges', () => {
    expect(isPrivateHost('0.0.0.0')).toBe(true)
    expect(isPrivateHost('100.64.0.1')).toBe(true)
    expect(isPrivateHost('198.18.0.1')).toBe(true)
    expect(isPrivateHost('224.0.0.1')).toBe(true)
    expect(isPrivateHost('[fd00::1]')).toBe(true)
    expect(isPrivateHost('[::ffff:127.0.0.1]')).toBe(true)
    expect(isPrivateHost('[::7f00:1]')).toBe(true)
  })
})

describe('isFeedContentType', () => {
  test('accepts XML feed media types with parameters', () => {
    expect(isFeedContentType('application/atom+xml; charset=utf-8')).toBe(true)
    expect(isFeedContentType('application/rss+xml')).toBe(true)
    expect(isFeedContentType('application/rdf+xml')).toBe(true)
    expect(isFeedContentType('text/xml; charset=UTF-8')).toBe(true)
  })

  test('rejects HTML, JSON and missing content types', () => {
    expect(isFeedContentType('text/html')).toBe(false)
    expect(isFeedContentType('application/json')).toBe(false)
    expect(isFeedContentType(null)).toBe(false)
  })
})

describe('readLimited', () => {
  function stream(chunks: Uint8Array[]): Response {
    let index = 0
    return {
      body: {
        getReader: () => ({
          read: async () => index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined },
          cancel: async () => {},
        }),
      },
    } as unknown as Response
  }

  test('joins chunks within the limit', async () => {
    const body = await readLimited(stream([
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4]),
    ]), 4)

    expect(Array.from(body)).toEqual([1, 2, 3, 4])
  })

  test('rejects bodies over the limit', async () => {
    await expect(readLimited(stream([
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
    ]), 4)).rejects.toMatchObject({ status: 413 })
  })
})

describe('feedProxy', () => {
  test('returns the upstream XML with CORS and cache headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<feed/>', {
      headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await feedProxy(
      new URLSearchParams({ url: 'https://dustri.org/b/atom.xml' }),
      CORS,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://dustri.org/b/atom.xml',
      expect.objectContaining({ redirect: 'manual' }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect(await response.text()).toBe('<feed/>')
  })

  test('requires the url parameter', async () => {
    await expect(feedProxy(new URLSearchParams(), CORS))
      .rejects.toMatchObject({ status: 400 })
  })

  test('rejects non-XML upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html/>', {
      headers: { 'Content-Type': 'text/html' },
    })))

    await expect(feedProxy(
      new URLSearchParams({ url: 'https://example.com/' }),
      CORS,
    )).rejects.toMatchObject({ status: 415 })
  })

  test('revalidates redirect targets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/feed' },
    })))

    await expect(feedProxy(
      new URLSearchParams({ url: 'https://example.com/feed' }),
      CORS,
    )).rejects.toMatchObject({ status: 403 })
  })
})
