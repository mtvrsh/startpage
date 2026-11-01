import { afterEach, describe, expect, test, vi } from 'vitest'
import { PipedBackend } from '../src/lib/api/piped-backend'

const CHANNEL_ID = 'UC1234567890abcdefghijkl'

function stubFetch(body: unknown) {
  const mock = vi.fn(async (_input: string, _init?: RequestInit) => ({
    ok: true,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Only Piped-specific search quirks live here. The rest of the backend —
// video/playlist mapping, failure semantics and feedFetchAll routing — is
// covered by the shared scenarios in backend-contract.test.ts.
describe('search', () => {
  test('makes site-relative and schemeless channel urls absolute', async () => {
    stubFetch({
      items: [
        { url: `/channel/${CHANNEL_ID}`, name: 'Channel', thumbnail: '', subscribers: 1 },
        { url: 'https://youtube.com/@handle', name: 'Handle', thumbnail: '', subscribers: 0 },
        { url: 'youtube.com/c/Legacy', name: 'Legacy', thumbnail: '', subscribers: 0 },
      ],
    })

    const results = await new PipedBackend().search('query')

    expect(results.map((result) => result.url)).toEqual([
      `https://youtube.com/channel/${CHANNEL_ID}`,
      'https://youtube.com/@handle',
      'https://youtube.com/c/Legacy',
    ])
  })
})
