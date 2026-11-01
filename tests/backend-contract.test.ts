import { afterEach, describe, expect, test, vi } from 'vitest'
import humanizeDuration from 'humanize-duration'
import { PipedBackend } from '../src/lib/api/piped-backend'
import { StartpageBackend } from '../src/lib/api/startpage-backend'
import { config, defaults } from '../src/share/config'
import type { Backend } from '../src/lib/api/backend'

type FetchMock = ReturnType<typeof vi.fn>

// One common scenario suite run against every backend: the startpage worker
// (YouTube.js) responses are fixture-translated into the same logical data the
// Piped instances send, so both backends must end up with identical app-level
// results wherever the providers really do agree. Where the providers diverge
// today (live upload timestamps) the difference is asserted inline in that
// scenario instead of being hidden.

const CHANNEL_ID = 'UC1234567890abcdefghijkl'
const HANDLE = '@handle'
// What the startpage worker resolves `@handle` to: each video's author id is
// the channel's canonical UC id (metadata external_id), even when fetched by
// handle.
const RESOLVED_HANDLE_ID = 'UC9876543210fedcba12345678'
const VIDEO_ID = 'vid12345678'
const TITLE = 'Video'
const THUMB = 'https://i.ytimg.com/vi/vid12345678/hqdefault.jpg'
const DURATION_SECONDS = 97
const PUBLISHED_TEXT = '1 day ago'
const UPLOADED_MS = 1604225078462
const PLAYLIST_ID = 'PL1234567890abcdefghijklmno1'
const PLAYLIST_NAME = 'Playlist'

interface Shape {
  status?: number
  body?: unknown
}

// A logical scenario expressed in per-route shapes; each backend maps it onto
// its own endpoint conventions (see pipedRoutes/startpageRoutes).
interface Scenario {
  search?: Shape
  channel?: Shape
  uploads?: Shape
  playlist?: Shape
}

function wireFetch(resolver: (url: URL) => Shape) {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const { status = 200, body } = resolver(url)
    return { ok: status < 400, status, json: async () => body }
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function shape({ status, body }: Shape) {
  return { status, body }
}

function pipedRoutes({ search, channel, uploads, playlist }: Scenario) {
  return (url: URL): Shape => {
    if (url.pathname === '/search') return shape(search ?? { body: { items: [] } })
    if (url.pathname === '/channels/tabs') return shape(channel ?? { body: { relatedStreams: [] } })
    if (url.pathname.startsWith('/playlists/UU'))
      return shape(uploads ?? playlist ?? { body: { relatedStreams: [] } })
    if (url.pathname.startsWith('/playlists/'))
      return shape(playlist ?? { body: { relatedStreams: [] } })
    return shape({})
  }
}

function startpageRoutes({ search, channel, uploads, playlist }: Scenario) {
  return (url: URL): Shape => {
    if (url.pathname === '/search/channels') return shape(search ?? { body: [] })
    if (url.pathname.startsWith('/channels/')) return shape(channel ?? { body: [] })
    if (url.pathname.startsWith('/playlists/UU'))
      return shape(uploads ?? playlist ?? { body: { items: [] } })
    if (url.pathname.startsWith('/playlists/')) return shape(playlist ?? { body: { items: [] } })
    return shape({})
  }
}

// ---- Logical payload -> backend wire shapes --------------------------------

function pipedStream(overrides: Record<string, unknown> = {}) {
  return {
    url: `/watch?v=${VIDEO_ID}`,
    title: TITLE,
    thumbnail: THUMB,
    duration: DURATION_SECONDS,
    uploaded: UPLOADED_MS,
    uploadedDate: PUBLISHED_TEXT,
    uploaderUrl: `/channel/${CHANNEL_ID}`,
    uploaderName: 'Channel',
    ...overrides,
  }
}

function startpageVideo(overrides: Record<string, unknown> = {}) {
  return {
    video_id: VIDEO_ID,
    title: { text: TITLE },
    thumbnails: [{ url: THUMB, width: 100, height: 56 }],
    author: { name: 'Channel', thumbnails: [{ url: THUMB, width: 100, height: 56 }] },
    published: { text: PUBLISHED_TEXT },
    uploaded: UPLOADED_MS,
    duration: { seconds: String(DURATION_SECONDS), text: '1:37', is_live: false },
    is_live: false,
    is_upcoming: false,
    is_premiere: false,
    ...overrides,
  }
}

// What both providers (fixed up in the backends) must reduce to. `duration` is
// humanized by the same helper passed the same 97s in both backends, so it can
// be computed here rather than second-guessed.
const DURATION_TEXT = humanizeDuration(DURATION_SECONDS * 1000, { round: true, units: ['h', 'm'] })

const EXPECTED_VIDEO = {
  url: `https://youtube.com/watch?v=${VIDEO_ID}`,
  title: TITLE,
  thumbnail: THUMB,
  duration: DURATION_TEXT,
  uploaded: UPLOADED_MS,
  uploadedDate: PUBLISHED_TEXT,
}

const EXPECTED_CHANNEL = {
  url: `https://youtube.com/channel/${CHANNEL_ID}`,
  name: 'Channel',
  displayName: 'Channel',
}

const EXPECTED_WEBSITE = (channelUrl: string) => ({
  url: channelUrl,
  name: 'Channel',
  displayName: 'Channel',
})

// ---- Cases ------------------------------------------------------------------

interface Case {
  name: string
  backend: Backend
  // Wire the shape onto the global fetch stub and return the mock.
  routes: (scenario: Scenario) => FetchMock
  // Where `feedFetchAll` must NOT rewrite a UC id to the uploads playlist —
  // the handle fallback endpoint differs per provider but the behavior (go to
  // the channel endpoint because only `UC…` has a `UU…` uploads playlist)
  // matches.
  handleEndpointPart: string
  playlistsPrefix: string
}

const CASES: Array<Case> = [
  {
    name: 'piped',
    backend: new PipedBackend(),
    routes: (scenario) => wireFetch(pipedRoutes(scenario)),
    handleEndpointPart: '/channels/tabs',
    playlistsPrefix: '/playlists/',
  },
  {
    name: 'startpage',
    backend: new StartpageBackend(),
    routes: (scenario) => wireFetch(startpageRoutes(scenario)),
    handleEndpointPart: '/channels/@handle',
    playlistsPrefix: '/playlists/',
  },
]

afterEach(() => {
  vi.unstubAllGlobals()
  config.set(structuredClone(defaults))
})

describe('shared backend contract', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      describe('search', () => {
        test('returns channels with absolute youtube urls', async () => {
          c.routes({
            search:
              c.name === 'piped'
                ? {
                    body: {
                      items: [
                        {
                          url: `/channel/${CHANNEL_ID}`,
                          name: 'Channel',
                          thumbnail: THUMB,
                          subscribers: 42,
                        },
                        {
                          url: 'https://youtube.com/@handle',
                          name: 'Handle',
                          thumbnail: '',
                          subscribers: 0,
                        },
                      ],
                    },
                  }
                : // The deployed worker returns channel objects (id + author);
                  // thumbnails arrive as an array and the backend takes the
                  // best (last) entry.
                  {
                    body: [
                      {
                        id: CHANNEL_ID,
                        author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [{ url: THUMB }] },
                        subscribers: 42,
                      },
                      {
                        id: 'UC0987654321fedcba98765432',
                        author: {
                          id: 'UC0987654321fedcba98765432',
                          name: 'Handle',
                          thumbnails: [],
                        },
                        subscribers: 0,
                      },
                    ],
                  },
          })

          const results = await c.backend.search('query')

          expect(results[0]).toEqual({
            url: `https://youtube.com/channel/${CHANNEL_ID}`,
            name: 'Channel',
            thumbnail: THUMB,
            // Both providers must surface the count: SearchPalette sorts on it.
            subscribers: 42,
          })
          expect(results[1]?.url).toMatch(/^https:\/\/youtube\.com/)
          expect(new URL(results[1]?.url ?? '').pathname.length).toBeGreaterThan(0)
        })

        test('returns no results when the endpoint fails', async () => {
          c.routes({ search: { status: 500 } })

          expect(await c.backend.search('query')).toEqual([])
        })
      })

      describe('fetchChannel', () => {
        test('maps channel id listings to the shared video contract', async () => {
          c.routes({
            channel:
              c.name === 'piped'
                ? { body: { relatedStreams: [pipedStream()] } }
                : { body: [startpageVideo()] },
          })

          const channel = await c.backend.fetchChannel(CHANNEL_ID)

          expect(channel).toEqual({
            ...EXPECTED_WEBSITE(EXPECTED_CHANNEL.url),
            videos: [EXPECTED_VIDEO],
          })
        })

        test('maps handle channels to the shared video contract', async () => {
          // The two providers send the author identity differently: Piped
          // reports the handle url as-is (it canonicalizes upstream, and that
          // is its job, not ours), while the startpage worker emits each
          // video's author id as the canonical UC id — so the frontend url
          // carries the resolved UC id instead of the requested handle.
          c.routes({
            channel:
              c.name === 'piped'
                ? { body: { relatedStreams: [pipedStream({ uploaderUrl: `/channel/${HANDLE}` })] } }
                : {
                    body: [
                      startpageVideo({
                        author: {
                          id: RESOLVED_HANDLE_ID,
                          name: 'Channel',
                          thumbnails: [{ url: THUMB, width: 100, height: 56 }],
                        },
                      }),
                    ],
                  },
          })

          const expectedUrl =
            c.name === 'piped'
              ? `https://youtube.com/channel/${HANDLE}`
              : `https://youtube.com/channel/${RESOLVED_HANDLE_ID}`

          const channel = await c.backend.fetchChannel(HANDLE)

          expect(channel).toEqual({
            ...EXPECTED_WEBSITE(expectedUrl),
            videos: [EXPECTED_VIDEO],
          })
        })

        test('reports a failure as a throw', async () => {
          c.routes({ channel: { status: 500 } })

          await expect(c.backend.fetchChannel(CHANNEL_ID)).rejects.toThrow()
        })

        test('throws when the listing has no videos', async () => {
          c.routes({
            channel: c.name === 'piped' ? { body: { relatedStreams: [] } } : { body: [] },
          })

          await expect(c.backend.fetchChannel(CHANNEL_ID)).rejects.toThrow(/No videos/)
        })

        test('treats timed-out/live streams as live', async () => {
          c.routes({
            channel:
              c.name === 'piped'
                ? // Piped denotes live with uploaded === -1 and duration 0.
                  {
                    body: {
                      relatedStreams: [
                        pipedStream({ uploaded: -1, duration: 0, uploadedDate: 'now' }),
                      ],
                    },
                  }
                : // The worker surfaces explicit live flags instead.
                  {
                    body: [
                      startpageVideo({
                        is_live: true,
                        duration: { seconds: '0', text: 'LIVE', is_live: true },
                      }),
                    ],
                  },
          })

          const video = (await c.backend.fetchChannel(CHANNEL_ID)).videos[0]

          expect(video.duration).toBe('live')
          // The exact uploaded/uploadedDate representation differs (Piped
          // synthesizes `now`; startpage passes the published text and
          // sentinel -1), but both remain well-formed for the stores' parser.
          expect(Number.isFinite(video.uploaded)).toBe(true)
          expect(typeof video.uploadedDate).toBe('string')
        })

        test('formats zero durations as empty', async () => {
          c.routes({
            channel:
              c.name === 'piped'
                ? { body: { relatedStreams: [pipedStream({ duration: 0 })] } }
                : { body: [startpageVideo({ duration: { seconds: '0', text: '' } })] },
          })

          const video = (await c.backend.fetchChannel(CHANNEL_ID)).videos[0]

          // 0s is not live here (only the live scenario flips it), so both
          // empty-string it instead of showing "0 seconds".
          expect(video.duration).toBe('')
        })

        test('rewrites UC ids to uploads playlists with feedFetchAll', async () => {
          config.set({ ...structuredClone(defaults), feedFetchAll: true })
          const mock = c.routes({
            uploads:
              c.name === 'piped'
                ? { body: { relatedStreams: [pipedStream()] } }
                : // The uploads playlist arrives in the same shape as any
                  // playlist listing (items + author).
                  {
                    body: {
                      items: [startpageVideo()],
                      author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [] },
                    },
                  },
          })

          await c.backend.fetchChannel(CHANNEL_ID)

          expect(String(mock.mock.calls[0][0])).toContain(`/playlists/UU${CHANNEL_ID.slice(2)}`)
        })

        test('hits the channel endpoint for handles with feedFetchAll', async () => {
          config.set({ ...structuredClone(defaults), feedFetchAll: true })
          const mock = c.routes({
            channel:
              c.name === 'piped'
                ? { body: { relatedStreams: [pipedStream()] } }
                : { body: [startpageVideo()] },
          })

          await c.backend.fetchChannel(HANDLE)

          expect(String(mock.mock.calls[0][0])).toContain(c.handleEndpointPart)
        })
      })

      describe('fetchPlaylist', () => {
        test('maps playlist listings to the shared video contract', async () => {
          c.routes({
            playlist:
              c.name === 'piped'
                ? { body: { name: PLAYLIST_NAME, relatedStreams: [pipedStream()] } }
                : {
                    body: {
                      name: PLAYLIST_NAME,
                      author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [] },
                      items: [startpageVideo({ id: VIDEO_ID })],
                    },
                  },
          })

          const channel = await c.backend.fetchPlaylist(PLAYLIST_ID)

          expect(channel).toEqual({
            url: `https://youtube.com/playlist?list=${PLAYLIST_ID}`,
            name: PLAYLIST_NAME,
            displayName: PLAYLIST_NAME,
            videos: [EXPECTED_VIDEO],
          })
        })

        test('reports a failure as a throw', async () => {
          c.routes({ playlist: { status: 500 } })

          await expect(c.backend.fetchPlaylist(PLAYLIST_ID)).rejects.toThrow()
        })

        test('throws when the playlist has no videos', async () => {
          c.routes({
            playlist:
              c.name === 'piped'
                ? { body: { name: PLAYLIST_NAME, relatedStreams: [] } }
                : { body: { name: PLAYLIST_NAME, items: [] } },
          })

          await expect(c.backend.fetchPlaylist(PLAYLIST_ID)).rejects.toThrow(/No videos/)
        })
      })
    })
  }

  describe('startpage-specific response handling', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      config.set(structuredClone(defaults))
    })

    test('maps the normalized worker subscriber count', async () => {
      wireFetch(
        startpageRoutes({
          search: {
            body: [
              {
                id: CHANNEL_ID,
                author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [] },
                subscribers: 525_000,
              },
            ],
          },
        }),
      )

      expect((await new StartpageBackend().search('q'))[0].subscribers).toBe(525_000)
    })

    // The worker always emits `subscribers`, but the field is optional at the
    // frontend boundary: older workers and hand-built responses must not make
    // the palette's sort throw or read `undefined`.
    test('degrades to 0 when the worker omits subscribers', async () => {
      wireFetch(
        startpageRoutes({
          search: {
            body: [
              {
                id: CHANNEL_ID,
                author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [] },
                video_count: { text: '525K subscribers' },
              },
            ],
          },
        }),
      )

      expect((await new StartpageBackend().search('q'))[0].subscribers).toBe(0)
    })

    // Same boundary robustness as the subscribers case: legacy workers and
    // hand-built responses may omit the author id (15f987d introduced it), and
    // the frontend must fall back to the requested id rather than producing a
    // truncated `youtube.com/channel/` url.
    test('falls back to the requested id when the response omits the author id', async () => {
      wireFetch(startpageRoutes({ channel: { body: [startpageVideo()] } }))

      const channel = await new StartpageBackend().fetchChannel(HANDLE)

      expect(channel.url).toBe(`https://youtube.com/channel/${HANDLE}`)
    })
  })
})
