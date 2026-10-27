import { beforeEach, describe, expect, test, vi } from 'vitest'
import { get } from 'svelte/store'

// Module-scope hydration must tolerate corrupt localStorage: a bad array used
// to throw inside `new Map(...)` and brick the whole app before it rendered.
describe('store hydration from localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  test('boots with corrupt channels, feeds, config and status data', async () => {
    localStorage.setItem('channels', JSON.stringify([
      ['https://youtube.com/@ok', { url: 'https://youtube.com/@ok', name: 'ok', displayName: 'Ok' }],
      ['@legacy', { name: 'legacy', displayName: 'Legacy', videos: [] }],
      ['https://youtube.com/@bad', null],
      [1, 2, 3],
      'junk'
    ]))
    localStorage.setItem('feeds', JSON.stringify([
      ['https://example.com/feed', null],
      42
    ]))
    localStorage.setItem('config', JSON.stringify({ instance: null, instances: 5 }))
    localStorage.setItem('status', JSON.stringify({ feed: { fetching: null } }))

    const { channels } = await import('../src/share/channels')
    const { feeds } = await import('../src/share/feeds')
    const { config, defaults } = await import('../src/share/config')
    const { status } = await import('../src/share/status')

    expect([...get(channels)].map(([key]) => key)).toEqual(['@ok', '@legacy'])
    // Channels stored before the url field existed survive hydration so they
    // are not silently deleted on the next save.
    expect(get(channels).get('@legacy')).toEqual({
      url: '', name: 'legacy', displayName: 'Legacy', videos: []
    })
    expect(get(feeds).size).toBe(0)
    expect(get(config).instance).toEqual(defaults.instance)
    expect(get(config).instances).toEqual(defaults.instances)
    expect(get(status).feed.fetching).toEqual({ now: [], max: 0 })
  })

  test('boots with unparseable localStorage entries', async () => {
    for (const name of ['channels', 'feeds', 'config', 'status', 'bookmarks']) {
      localStorage.setItem(name, '{corrupt')
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { channels } = await import('../src/share/channels')
    const { feeds } = await import('../src/share/feeds')
    const { config } = await import('../src/share/config')
    const { status } = await import('../src/share/status')
    const { bookmarks } = await import('../src/share/bookmarks')

    expect(get(channels).size).toBe(0)
    expect(get(feeds).size).toBe(0)
    expect(get(bookmarks).size).toBe(0)
    expect(get(config)).toBeTruthy()
    expect(get(status).feed.fetching).toEqual({ now: [], max: 0 })

    error.mockRestore()
  })
})
