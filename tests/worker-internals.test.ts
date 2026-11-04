import { afterEach, describe, expect, test, vi } from 'vitest'
import { parseSubscriberCount } from '../startpage-api/src/router'
import { playlistContinuationToken } from '../startpage-api/src/playlist-continuation'
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

// The continuation fallback logs whenever it degrades; tests that exercise a
// shorts page with an intentionally empty continuation should stay quiet.
function muteErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

// Each route test needs a working client, so reset the module registry (the
// router caches a `getYt()` singleton) and re-mock before importing it.
async function withInnertube(client: Record<string, unknown>) {
  vi.resetModules()
  vi.doMock(CF_WORKER, () => ({ Innertube: { create: async () => client } }))
  return (await import('../startpage-api/src/router')).handleRequest
}

afterEach(() => {
  vi.restoreAllMocks()
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

describe('playlistContinuationToken', () => {
  // Golden token for the live shorts-only uploads playlist used during the
  // fix's validation. It must stay byte-identical to what NewPipeExtractor's
  // protobuf produces (fields 2/3/35 under 80226972), because field 35 is
  // what makes YouTube answer with `lockupViewModel` items (duration + date).
  test('encodes the NewPipe-compatible first-page parameters', () => {
    expect(playlistContinuationToken('UUkQ774ot9mhH3wWMsjzGq2g')).toBe(
      '4qmFsgJJEhpWTFVVa1E3NzRvdDltaEgzd1dNc2p6R3EyZxoQQ0FEQ0JnSUlBQSUzRCUzRJoCGFVVa1E3NzRvdDltaEgzd1dNc2p6R3EyZw',
    )
  })

  test('accepts an already VL-prefixed id without doubling it', () => {
    expect(playlistContinuationToken('VLUUkQ774ot9mhH3wWMsjzGq2g')).toBe(
      playlistContinuationToken('UUkQ774ot9mhH3wWMsjzGq2g'),
    )
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

// `LockupView` items from the playlist continuation: unlike ShortsLockupView
// they expose the duration badge in `content_image.overlays` and the publish
// date in the content metadata rows.
function lockupFixture(videoId: string) {
  return {
    type: 'LockupView',
    content_id: videoId,
    content_type: 'VIDEO',
    content_image: {
      image: [{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 360, height: 202 }],
      overlays: [
        {
          type: 'ThumbnailBottomOverlayView',
          badges: [{ type: 'ThumbnailBadgeView', text: '0:13' }],
        },
      ],
    },
    metadata: {
      title: { toString: () => 'A short with metadata' },
      metadata: {
        metadata_rows: [{ metadata_parts: [{ text: { toString: () => '6h ago' } }] }],
      },
    },
  }
}

describe('shorts lockup items in listings', () => {
  test('GET /playlists/:id maps ShortsLockupView items via the tap endpoint, not entity_id', async () => {
    muteErrors()
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
      // Empty continuation: the mapping under test is the fallback page.
      actions: { execute: async () => ({}) },
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
    muteErrors()
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
      // Mixed page, so the fallback runs; an empty continuation must leave the
      // initial page intact.
      actions: { execute: async () => ({}) },
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

  test('GET /playlists/:id serves a mixed page from the continuation', async () => {
    const execute = vi.fn(async () => ({
      on_response_received_actions: [
        {
          type: 'AppendContinuationItemsAction',
          contents: [lockupFixture('abc12345678'), lockupFixture('8U19uSzmPUU')],
        },
      ],
    }))
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [lockupFixture('abc12345678'), shortsLockupFixture('8U19uSzmPUU')],
        memo: new Map(),
        info: { title: 'Uploads', author: undefined },
      }),
      actions: { execute },
    })

    const res = await working(request('/playlists/UUkQ774ot9mhH3wWMsjzGq2g'), env())

    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
    const { items } = await res.json()
    // The continuation is the authoritative first page, so it replaces the
    // mixed initial list; the shorts entry gains the duration it lacked.
    expect(items.map((item: any) => item.id)).toEqual(['abc12345678', '8U19uSzmPUU'])
    expect(items.every((item: any) => item.duration.seconds !== '0')).toBe(true)
  })

  test('GET /playlists/:id refetches shorts-only uploads through the continuation', async () => {
    const execute = vi.fn(async (_endpoint: string, _args: { continuation: string }) => ({
      on_response_received_actions: [
        {
          type: 'AppendContinuationItemsAction',
          contents: [
            lockupFixture('xf9Je_S1mAs'),
            // The continuation page always ends with a continuation node; it
            // must not turn into a listing item.
            { type: 'ContinuationItemView' },
          ],
        },
      ],
    }))

    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [shortsLockupFixture('xf9Je_S1mAs')],
        memo: new Map(),
        info: { title: 'Uploads', author: { name: 'Channel' } },
      }),
      actions: { execute },
    })

    const res = await working(request('/playlists/UUkQ774ot9mhH3wWMsjzGq2g'), env())

    expect(res.status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('/browse', {
      continuation: playlistContinuationToken('UUkQ774ot9mhH3wWMsjzGq2g'),
      parse: true,
    })

    const { items } = await res.json()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'xf9Je_S1mAs',
      title: { text: 'A short with metadata' },
      published: { text: '6h ago' },
      duration: { seconds: '13', text: '0:13' },
    })
    expect(items[0].uploaded).toBeGreaterThan(0)
  })

  test('GET /playlists/:id reads the reload continuation shape too', async () => {
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [shortsLockupFixture('xf9Je_S1mAs')],
        memo: new Map(),
        info: { title: 'Uploads', author: undefined },
      }),
      actions: {
        execute: async () => ({
          on_response_received_actions: [
            { type: 'ReloadContinuationItemsCommand', contents: [lockupFixture('xf9Je_S1mAs')] },
          ],
        }),
      },
    })

    const res = await working(request('/playlists/UUkQ774ot9mhH3wWMsjzGq2g'), env())

    const { items } = await res.json()
    expect(items[0].duration).toMatchObject({ seconds: '13', text: '0:13' })
  })

  test('GET /playlists/:id keeps the single request for LockupView first pages', async () => {
    const execute = vi.fn()
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [lockupFixture('abc12345678')],
        memo: new Map(),
        info: { title: 'Playlist', author: undefined },
      }),
      actions: { execute },
    })

    const res = await working(request('/playlists/PL1234567890abcdefghijklmno1'), env())

    expect(res.status).toBe(200)
    expect(execute).not.toHaveBeenCalled()
    const { items } = await res.json()
    expect(items[0]).toMatchObject({
      id: 'abc12345678',
      published: { text: '6h ago' },
      duration: { seconds: '13', text: '0:13' },
    })
  })

  test('GET /playlists/:id falls back to the shorts page when the continuation fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [shortsLockupFixture('8U19uSzmPUU')],
        memo: new Map(),
        info: { title: 'Uploads', author: undefined },
      }),
      actions: {
        execute: async () => {
          throw new Error('browse failed')
        },
      },
    })

    const res = await working(request('/playlists/UUkQ774ot9mhH3wWMsjzGq2g'), env())

    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: '8U19uSzmPUU',
      published: { text: '' },
      duration: { seconds: '0', text: '' },
    })
    expect(logged).toHaveBeenCalled()
  })

  test('GET /channels/:id refetches shorts lockups through the uploads playlist', async () => {
    const execute = vi.fn(async () => ({
      on_response_received_actions: [
        { type: 'ReloadContinuationItemsCommand', contents: [lockupFixture('8U19uSzmPUU')] },
      ],
    }))
    const working = await withInnertube({
      getChannel: async () => ({
        has_videos: true,
        getVideos: async () => ({
          videos: [shortsLockupFixture('8U19uSzmPUU')],
          memo: new Map(),
        }),
        metadata: { title: 'Channel', external_id: 'UCkQ774ot9mhH3wWMsjzGq2g' },
        header: { author: { name: 'Channel', thumbnails: [] } },
      }),
      actions: { execute },
    })

    const res = await working(request('/channels/UCkQ774ot9mhH3wWMsjzGq2g'), env())

    expect(res.status).toBe(200)
    // `UC…` is rewritten to the matching uploads playlist.
    expect(execute).toHaveBeenCalledWith('/browse', {
      continuation: playlistContinuationToken('UUkQ774ot9mhH3wWMsjzGq2g'),
      parse: true,
    })
    const items = await res.json()
    expect(items[0]).toMatchObject({
      video_id: '8U19uSzmPUU',
      published: { text: '6h ago' },
      duration: { seconds: '13', text: '0:13' },
    })
  })

  test('GET /channels/:id extracts ShortsLockupView items from the memo via the tap endpoint', async () => {
    muteErrors()
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
      // Empty continuation: this test covers the mapping of the memo page.
      actions: { execute: async () => ({}) },
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
