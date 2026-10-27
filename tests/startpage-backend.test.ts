import { afterEach, describe, expect, test, vi } from 'vitest'
import { StartpageBackend } from '../src/lib/api/startpage-backend'
import { config, defaults } from '../src/share/config'

const CHANNEL_ID = 'UC1234567890abcdefghijkl'

const VIDEO = {
  video_id: 'vid12345678',
  title: { text: 'Video' },
  thumbnails: [{ url: 'https://i.ytimg.com/vi/vid12345678/hqdefault.jpg' }],
  author: { id: CHANNEL_ID, name: 'Channel', thumbnails: [] },
  published: { text: '1 day ago' },
  uploaded: 1,
  duration: { seconds: '90' },
  is_live: false
}

function stubFetch(body: unknown) {
  const mock = vi.fn(async (_input: string, _init?: RequestInit) => ({
    ok: true,
    json: async () => body
  }))
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
  config.set(structuredClone(defaults))
})

describe('browser cache mode', () => {
  test('lets the browser cache channel listings on a normal refetch', async () => {
    const mock = stubFetch([VIDEO])
    await new StartpageBackend().fetchChannel(CHANNEL_ID)

    expect(mock.mock.calls[0][1]?.cache).toBe('default')
  })

  test('forces a network reload for channels when asked', async () => {
    const mock = stubFetch([VIDEO])
    await new StartpageBackend().fetchChannel(CHANNEL_ID, true)

    expect(mock.mock.calls[0][1]?.cache).toBe('reload')
  })

  test('applies the same cache mode to playlists', async () => {
    const backend = new StartpageBackend()
    const mock = stubFetch({ items: [VIDEO], name: 'Playlist', author: VIDEO.author })

    await backend.fetchPlaylist('PL1234567890abcdefghijklmno1')
    await backend.fetchPlaylist('PL1234567890abcdefghijklmno1', true)

    expect(mock.mock.calls[0][1]?.cache).toBe('default')
    expect(mock.mock.calls[1][1]?.cache).toBe('reload')
  })
})

describe('fetchChannel with feedFetchAll', () => {
  test('uses the uploads playlist for real channel ids', async () => {
    config.set({ ...structuredClone(defaults), feedFetchAll: true })
    const mock = stubFetch({ items: [VIDEO], author: VIDEO.author })

    await new StartpageBackend().fetchChannel(CHANNEL_ID)

    expect(String(mock.mock.calls[0][0])).toContain(`/playlists/UU${CHANNEL_ID.slice(2)}`)
  })

  test('falls back to the channel endpoint for handles', async () => {
    config.set({ ...structuredClone(defaults), feedFetchAll: true })
    const mock = stubFetch([VIDEO])

    await new StartpageBackend().fetchChannel('@handle')

    expect(String(mock.mock.calls[0][0])).toContain('/channels/@handle')
  })
})
