import { afterEach, describe, expect, test, vi } from 'vitest'
import { parseSubscriberCount } from '../startpage-api/src/router'
import type { WorkerEnv } from '../startpage-api/src/access'

// The YouTube.js client is never exercised here; route tests swap in their own
// `create()` factory per case. The mock must use the resolved file path: the
// bare specifier resolves from startpage-api/node_modules, which vitest cannot
// mock by name from tests/.
vi.mock('../startpage-api/node_modules/youtubei.js/dist/src/platform/cf-worker.js', () => ({
  Innertube: {
    create: () => Promise.reject(new TypeError('innertube unavailable')),
  },
}))

const CF_WORKER = '../startpage-api/node_modules/youtubei.js/dist/src/platform/cf-worker.js'

const ALLOWED_ORIGINS = 'https://app.example'
const okLimit = { limit: async () => ({ success: true }) }

function env(): WorkerEnv {
  return { ALLOWED_ORIGINS, FEED_LIMIT: okLimit } as WorkerEnv
}

function request(path: string) {
  return new Request(`https://worker.test${path}`, {
    headers: { Origin: 'https://app.example' },
  })
}

// Each route test needs a working client, so reset the module registry (the
// router caches a `getYt()` singleton) and re-mock before importing it.
async function withInnertube(client: Record<string, unknown>) {
  vi.resetModules()
  vi.doMock(CF_WORKER, () => ({ Innertube: { create: async () => client } }))
  return (await import('../startpage-api/src/router')).handleRequest
}

afterEach(() => {
  vi.resetModules()
})

describe('parseSubscriberCount', () => {
  test.each([
    ['525K subscribers', 525_000],
    ['1.2M subscribers', 1_200_000],
    ['12,345 subscribers', 12_345],
    ['12.3K', 12_300],
    ['525K', 525_000],
    ['12', 12],
    ['1,234,567', 1_234_567],
    ['0 subscribers', 0],
    ['No subscribers', 0],
    ['', 0],
    // Digits present but a different unit must not count as subscribers:
    // only a pure number (plus optional compact suffix / "subscribers" word)
    // is accepted.
    ['1,234 videos', 0],
    ['1.2K videos', 0],
    ['@handle', 0], // handle text in a non-inverted `subscriber_count`
  ])('%s -> %i', (text, expected) => {
    expect(parseSubscriberCount(text)).toBe(expected)
  })
})

describe('GET /search/channels', () => {
  test('normalizes raw YouTube.js channel nodes to the frontend shape', async () => {
    const working = await withInnertube({
      search: async () => ({
        channels: [
          {
            id: 'UC1234567890abcdefghijkl',
            author: {
              id: 'UC1234567890abcdefghijkl',
              name: 'Channel',
              thumbnails: [{ url: 'https://example.test/avatar.jpg' }],
            },
            // YouTube.js puts the count in `video_count`, not `subscribers`.
            video_count: { text: '525K subscribers' },
          },
        ],
      }),
    })

    const res = await working(request('/search/channels?q=channel'), env())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'UC1234567890abcdefghijkl',
        author: {
          id: 'UC1234567890abcdefghijkl',
          name: 'Channel',
          thumbnails: [{ url: 'https://example.test/avatar.jpg' }],
        },
        subscribers: 525_000,
      },
    ])
  })
})

describe('GET /channels/:id', () => {
  test('resolves a handle to its browse id before fetching the channel', async () => {
    const fetched: string[] = []
    const working = await withInnertube({
      resolveURL: async () => ({ payload: { browseId: 'UC1234567890abcdefghijkl' } }),
      getChannel: async (id: string) => {
        fetched.push(id)
        return { has_videos: false }
      },
    })

    const res = await working(request('/channels/@handle'), env())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(fetched).toEqual(['UC1234567890abcdefghijkl'])
  })

  test('does not resolve UC ids', async () => {
    let resolutions = 0
    const working = await withInnertube({
      resolveURL: async () => {
        resolutions++
        return { payload: { browseId: 'should-not-be-used' } }
      },
      getChannel: async () => ({ has_videos: false }),
    })

    await working(request('/channels/UC1234567890abcdefghijkl'), env())

    expect(resolutions).toBe(0)
  })

  test('falls back to the raw handle when resolution fails', async () => {
    const fetched: string[] = []
    const working = await withInnertube({
      resolveURL: async () => {
        throw new Error('resolve failed')
      },
      getChannel: async (id: string) => {
        fetched.push(id)
        return { has_videos: false }
      },
    })

    const res = await working(request('/channels/@handle'), env())

    expect(res.status).toBe(200)
    expect(fetched).toEqual(['@handle'])
  })
})
