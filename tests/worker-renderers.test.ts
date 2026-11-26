import { afterEach, describe, expect, test, vi } from 'vitest'

// youtubei.js parses classic renderers (PlaylistVideo, Video, …) into objects
// whose id/duration/published metadata differ from the newer lockup views.
// Both shapes must survive the worker's mapping instead of becoming empty feeds.
const CF_WORKER = '../startpage-api/node_modules/youtubei.js/dist/src/platform/cf-worker.js'
const ALLOWED_ORIGINS = 'https://app.example'
const okLimit = { limit: async () => ({ success: true }) }

function request(path: string) {
  return new Request(`https://worker.test${path}`, { headers: { Origin: ALLOWED_ORIGINS } })
}

function env() {
  return { ALLOWED_ORIGINS, FEED_LIMIT: okLimit } as any
}

async function withInnertube(client: Record<string, unknown>) {
  vi.resetModules()
  vi.doMock(CF_WORKER, () => ({ Innertube: { create: async () => client } }))
  return (await import('../startpage-api/src/router')).handleRequest
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

const THUMB = { url: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg' }

describe('classic youtubei.js renderers', () => {
  test('maps a PlaylistVideo item instead of dropping it', async () => {
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [
          {
            type: 'PlaylistVideo',
            id: 'abc12345678',
            title: { toString: () => 'Classic video', text: 'Classic video' },
            thumbnails: [THUMB],
            author: { name: 'Channel' },
            duration: { text: '1:37', seconds: 97 },
            published: { text: '1 day ago' },
            is_upcoming: true,
            upcoming: new Date('2026-12-01T00:00:00Z'),
          },
        ],
        memo: new Map(),
        info: { title: 'Playlist', author: { name: 'Channel' } },
      }),
      actions: { execute: async () => ({}) },
    })

    const res = await working(request('/playlists/PL1234567890abcdefghijklmno1'), env())
    const body = await res.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      id: 'abc12345678',
      title: { text: 'Classic video' },
      thumbnails: [THUMB],
      published: { text: '1 day ago' },
      duration: { seconds: '97', text: '1:37' },
      is_upcoming: true,
      upcoming: '2026-12-01T00:00:00.000Z',
    })
    expect(body.items[0].uploaded).toBeGreaterThan(0)
  })

  test('maps a Video item from a channel listing', async () => {
    const working = await withInnertube({
      getChannel: async () => ({
        has_videos: true,
        getVideos: async () => ({
          videos: [
            {
              type: 'Video',
              video_id: 'def12345678',
              title: { text: 'Rendered video', toString: () => 'Rendered video' },
              thumbnails: [THUMB],
              published: { text: '3 hours ago' },
            },
          ],
          memo: new Map(),
        }),
        metadata: { title: 'Channel', external_id: 'UCkQ774ot9mhH3wWMsjzGq2g' },
        header: { author: { name: 'Channel', thumbnails: [] } },
      }),
    })

    const res = await working(request('/channels/UCkQ774ot9mhH3wWMsjzGq2g'), env())
    const items = await res.json()

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      video_id: 'def12345678',
      title: { text: 'Rendered video' },
      published: { text: '3 hours ago' },
    })
    expect(items[0].uploaded).toBeGreaterThan(0)
  })

  test('reads a ThumbnailOverlayBadgeView duration and a collection thumbnail', async () => {
    const working = await withInnertube({
      getPlaylist: async () => ({
        videos: [
          {
            type: 'LockupView',
            content_id: 'abc12345678',
            content_type: 'VIDEO',
            content_image: {
              primary_thumbnail: {
                image: [THUMB],
                overlays: [
                  {
                    type: 'ThumbnailOverlayBadgeView',
                    badges: [{ text: '1,234:56' }],
                  },
                ],
              },
            },
            metadata: {
              title: { toString: () => 'Long video' },
              metadata: {
                metadata_rows: [{ metadata_parts: [{ text: { toString: () => '2 days ago' } }] }],
              },
            },
          },
        ],
        memo: new Map(),
        info: { title: 'Playlist', author: { name: 'Channel' } },
      }),
    })

    const res = await working(request('/playlists/PL1234567890abcdefghijklmno1'), env())
    const { items } = await res.json()

    expect(items).toHaveLength(1)
    expect(items[0].thumbnails).toEqual([THUMB])
    expect(items[0].duration).toMatchObject({ seconds: '74096', text: '1,234:56' })
    expect(items[0].published).toEqual({ text: '2 days ago' })
  })
})
