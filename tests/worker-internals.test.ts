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

// Shorts-only upload playlists come back as ShortsLockupView items (captured
// live from the shorts-only channel UCkQ774ot9mhH3wWMsjzGq2g): `entity_id` is
// an opaque hash and the video id / thumbnails sit on the tap endpoint, while
// no duration or publish date exists anywhere in the renderer (a YouTube API
// limitation, also documented in NewPipeExtractor's
// YoutubeShortsLockupInfoItemExtractor).
function shortsLockupFixture(videoId: string) {
  return {
    type: 'ShortsLockupView',
    entity_id: 'C1A2D28FC54EBFE2',
    accessibility_text: 'man, 8.8 thousand views - play Short',
    thumbnail: [],
    thumbnail_view_model: {
      image: [{ url: `https://i.ytimg.com/vi/${videoId}/oardefault.jpg`, width: 360, height: 202 }],
    },
    on_tap_endpoint: {
      payload: { videoId },
      metadata: { url: `https://www.youtube.com/shorts/${videoId}` },
    },
    overlay_metadata: {
      primary_text: { toString: () => 'A short' },
      secondary_text: { toString: () => '42K views' },
    },
  }
}

describe('shorts lockup items in listings', () => {
  test('GET /playlists/:id maps ShortsLockupView items via the tap endpoint, not entity_id', async () => {
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [
          shortsLockupFixture('8U19uSzmPUU'),
          // An opaque `entity_id` with no id on the tap endpoint must be
          // dropped rather than emitted with a fabricated video id.
          {
            type: 'ShortsLockupView',
            entity_id: '0B2C3D4E5FF6GH7II',
            thumbnail: [],
            on_tap_endpoint: { payload: {} },
          },
        ],
        memo: new Map(),
        info: { title: 'Uploads', author: { name: 'Channel' } },
      }),
    })

    const res = await working(request('/playlists/PL1234567890abcdefghijklmno1'), env())

    expect(res.status).toBe(200)
    // The playlist-level author (from info) is what the frontend consumes:
    // ShortsLockupView items carry no per-item author, so theirs serializes
    // away and the backend falls back to `data.author`.
    expect(await res.json()).toEqual({
      name: 'Uploads',
      author: { name: 'Channel' },
      items: [
        {
          id: '8U19uSzmPUU',
          title: { text: 'A short' },
          thumbnails: [
            { url: 'https://i.ytimg.com/vi/8U19uSzmPUU/oardefault.jpg', width: 360, height: 202 },
          ],
          author: undefined,
          published: { text: '' },
          uploaded: 0,
          duration: { seconds: '0', text: '' },
          is_live: false,
          is_upcoming: false,
        },
      ],
    })
  })

  test('GET /playlists/:id still maps content_id LockupView items', async () => {
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [
          {
            type: 'LockupView',
            content_id: 'abc12345678',
            content_type: 'VIDEO',
            content_image: {
              image: [
                {
                  url: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg',
                  width: 360,
                  height: 202,
                },
              ],
            },
            metadata: { title: { toString: () => 'Long video' } },
          },
          shortsLockupFixture('8U19uSzmPUU'),
        ],
        memo: new Map(),
        info: { title: 'Uploads', author: undefined },
      }),
    })

    const res = await working(request('/playlists/PL1234567890abcdefghijklmno1'), env())

    const { items } = await res.json()
    expect(items).toEqual([
      {
        id: 'abc12345678',
        title: { text: 'Long video' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg', width: 360, height: 202 },
        ],
        author: undefined,
        published: { text: '' },
        uploaded: 0,
        duration: { seconds: '0', text: '' },
        is_live: false,
        is_upcoming: false,
      },
      {
        id: '8U19uSzmPUU',
        title: { text: 'A short' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/8U19uSzmPUU/oardefault.jpg', width: 360, height: 202 },
        ],
        author: undefined,
        published: { text: '' },
        uploaded: 0,
        duration: { seconds: '0', text: '' },
        is_live: false,
        is_upcoming: false,
      },
    ])
  })

  test('GET /channels/:id extracts ShortsLockupView items from the memo via the tap endpoint', async () => {
    const working = await withInnertube({
      getChannel: async () => ({
        has_videos: true,
        getVideos: async () => ({
          videos: [],
          memo: new Map([
            [
              'ShortsLockupView',
              [
                // Relative /shorts/<id> URL form, as captured live: the id
                // fallback regex matches relative and absolute alike.
                {
                  ...shortsLockupFixture('8U19uSzmPUU'),
                  on_tap_endpoint: {
                    payload: { videoId: '8U19uSzmPUU' },
                    metadata: { url: '/shorts/8U19uSzmPUU' },
                  },
                },
              ],
            ],
          ]),
        }),
        metadata: { title: 'Channel', external_id: 'UCkQ774ot9mhH3wWMsjzGq2g' },
        header: { author: { name: 'Channel', thumbnails: [] } },
      }),
    })

    const res = await working(request('/channels/UCkQ774ot9mhH3wWMsjzGq2g'), env())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        video_id: '8U19uSzmPUU',
        title: { text: 'A short' },
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/8U19uSzmPUU/oardefault.jpg', width: 360, height: 202 },
        ],
        author: {
          id: 'UCkQ774ot9mhH3wWMsjzGq2g',
          name: 'Channel',
          thumbnails: [],
        },
        published: { text: '' },
        uploaded: 0,
        duration: { seconds: '0', text: '' },
        is_live: false,
        is_upcoming: false,
        is_premiere: false,
        best_thumbnail: {
          url: 'https://i.ytimg.com/vi/8U19uSzmPUU/oardefault.jpg',
          width: 360,
          height: 202,
        },
      },
    ])
  })
})
