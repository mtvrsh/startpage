import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { get } from 'svelte/store'
import { Feeds, entries, feedStates, feeds } from '../src/share/feeds'

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Parsed title</title>
  <entry>
    <title>First</title>
    <link href="https://example.com/first"/>
    <published>2026-01-01T00:00:00Z</published>
  </entry>
  <entry>
    <title>Second</title>
    <link href="https://example.com/second"/>
    <updated>2026-01-02T00:00:00Z</updated>
  </entry>
</feed>`

let fetchMock: ReturnType<typeof vi.fn>

function respond(xml: string, { ok = true, status = 200 } = {}) {
  fetchMock.mockResolvedValueOnce({
    ok,
    status,
    text: async () => xml
  })
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  Feeds.restore([])
})

afterEach(() => {
  vi.unstubAllGlobals()
  Feeds.restore([])
})

describe('add', () => {
  test('stores the feed and its entries', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')

    expect(get(feeds).get('https://example.com/atom.xml')).toEqual({
      url: 'https://example.com/atom.xml',
      name: 'Example'
    })
    expect(get(entries)).toHaveLength(2)
    expect(get(entries)[0]).toMatchObject({
      url: 'https://example.com/first',
      title: 'First',
      feedUrl: 'https://example.com/atom.xml',
      feedName: 'Example'
    })
    expect(get(feedStates).get('https://example.com/atom.xml')?.error).toBe('')
  })

  test('falls back to the parsed feed title', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml')

    expect(get(feeds).get('https://example.com/atom.xml')?.name).toBe('Parsed title')
  })

  test('normalizes the feed URL', async () => {
    respond(ATOM)
    await Feeds.add('  https://example.com/atom.xml  ')

    expect(get(feeds).has('https://example.com/atom.xml')).toBe(true)
  })

  test('rejects invalid URLs without storing anything', async () => {
    await expect(Feeds.add('not a url')).rejects.toThrow('Invalid feed URL')
    await expect(Feeds.add('ftp://example.com/atom.xml')).rejects.toThrow('Invalid feed URL')

    expect(get(feeds).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('keeps the feed and records an error when fetching fails', async () => {
    respond('', { ok: false, status: 404 })
    await Feeds.add('https://example.com/atom.xml', 'Example')

    expect(get(feeds).has('https://example.com/atom.xml')).toBe(true)
    expect(get(entries)).toHaveLength(0)
    expect(get(feedStates).get('https://example.com/atom.xml')).toMatchObject({
      loading: false,
      error: 'HTTP 404'
    })
  })
})

describe('rename', () => {
  test('updates the feed name and cached entry metadata', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')

    Feeds.rename('https://example.com/atom.xml', '  Renamed  ')

    expect(get(feeds).get('https://example.com/atom.xml')?.name).toBe('Renamed')
    expect(get(entries).every(entry => entry.feedName === 'Renamed')).toBe(true)
  })

  test('falls back to the hostname when the name is cleared', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')

    Feeds.rename('https://example.com/atom.xml', '   ')

    expect(get(feeds).get('https://example.com/atom.xml')?.name).toBe('')
    expect(get(entries).every(entry => entry.feedName === 'example.com')).toBe(true)
  })
})

describe('remove', () => {
  test('removes the feed, its entries and its state', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')

    Feeds.remove('https://example.com/atom.xml')

    expect(get(feeds).size).toBe(0)
    expect(get(entries)).toHaveLength(0)
    expect(get(feedStates).size).toBe(0)
  })
})

describe('refetch', () => {
  test('skips feeds fetched within the cache lifetime', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await Feeds.refetch()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    respond(ATOM)
    await Feeds.refetch({ reload: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('retries feeds that previously failed', async () => {
    respond('', { ok: false, status: 500 })
    await Feeds.add('https://example.com/atom.xml', 'Example')
    expect(get(feedStates).get('https://example.com/atom.xml')?.error).toBe('HTTP 500')

    respond(ATOM)
    await Feeds.refetch()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(get(entries)).toHaveLength(2)
    expect(get(feedStates).get('https://example.com/atom.xml')?.error).toBe('')
  })
})

describe('restore', () => {
  test('replaces feeds and clears cached entries', async () => {
    respond(ATOM)
    await Feeds.add('https://example.com/atom.xml', 'Example')
    expect(get(entries)).toHaveLength(2)

    Feeds.restore([['https://other.example/feed', { url: 'https://other.example/feed', name: 'Other' }]])

    expect(get(feeds).size).toBe(1)
    expect(get(feeds).get('https://other.example/feed')?.name).toBe('Other')
    expect(get(entries)).toHaveLength(0)
    expect(get(feedStates).size).toBe(0)
  })

  test('ignores invalid input', () => {
    Feeds.restore(null as unknown as [string, { url: string; name: string }][])

    expect(get(feeds).size).toBe(0)
  })
})
