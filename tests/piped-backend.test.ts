import { afterEach, describe, expect, test, vi } from 'vitest'
import { PipedBackend } from '../src/lib/api/piped-backend'
import { config, defaults } from '../src/share/config'

const CHANNEL_ID = 'UC1234567890abcdefghijkl'

const STREAM = {
  url: '/watch?v=vid12345678',
  title: 'Video',
  thumbnail: 'https://i.ytimg.com/vi/vid12345678/hqdefault.jpg',
  duration: 90,
  uploaded: 1,
  uploadedDate: '1 day ago',
  uploaderUrl: `/channel/${CHANNEL_ID}`,
  uploaderName: 'Channel'
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

describe('fetchChannel with feedFetchAll', () => {
  test('uses the uploads playlist for real channel ids', async () => {
    config.set({ ...structuredClone(defaults), feedFetchAll: true })
    const mock = stubFetch({ relatedStreams: [STREAM] })

    await new PipedBackend().fetchChannel(CHANNEL_ID)

    expect(String(mock.mock.calls[0][0])).toContain(`/playlists/UU${CHANNEL_ID.slice(2)}`)
  })

  test('falls back to the channel tabs endpoint for handles', async () => {
    config.set({ ...structuredClone(defaults), feedFetchAll: true })
    const mock = stubFetch({ content: [STREAM] })

    await new PipedBackend().fetchChannel('@handle')

    expect(String(mock.mock.calls[0][0])).toContain('/channels/tabs')
  })
})
