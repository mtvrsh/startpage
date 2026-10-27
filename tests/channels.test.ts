import { test, expect, describe, vi, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { Channels, channels } from '../src/share/channels'
import type { Channel } from '../src/share/channels'
import { status } from '../src/share/status'

const t = test.extend({
  id: 'myId',
  channel: {
    url: 'https://my.url/myId',
    name: 'myChannelName',
    displayName: 'myChannelDisplayName',
    videos: [
      {
        url: 'myVideoUrl',
        title: 'myVideoUrl',
        uploaded: 2137,
        uploadedDate: 'myUploadedDate',
        duration: '',
        thumbnail: ''
      },
      {
        url: 'mySecondVideoUrl',
        title: 'mySecondVideoUrl',
        uploaded: 2138,
        uploadedDate: 'mySecondUploadedDate',
        duration: '',
        thumbnail: ''
      }
    ]
  }
})

describe('update', () => {
  t('merges values into existing channel', ({id, channel}) => {
    Channels.addExisting(id, channel)
    Channels.update(id, { displayName: 'newName' })

    const result = get(channels).get(id)
    expect(result?.displayName).toBe('newName')
    expect(result?.name).toBe(channel.name)
  })

  t('is a no-op when channel was removed (partial fetch race)', ({id, channel}) => {
    Channels.addExisting(id, channel)
    Channels.remove(id)
    Channels.update(id, { videos: channel.videos })

    expect(get(channels).has(id)).toBe(false)
  })
})

describe('remove', () => {
  t('removes channel from store', ({id, channel}) => {
    Channels.addExisting(id, channel)
    expect(get(channels).has(id)).toBe(true)

    Channels.remove(id)
    expect(get(channels).has(id)).toBe(false)
  })
})

describe('addExisting', () => {
  t('adds channel to store', ({id, channel}) => {
    Channels.addExisting(id, channel)

    const result = get(channels).get(id)
    expect(result).toEqual(channel)
  })
})

const expectedVideos = (channel: Channel) =>
  channel.videos.map(video => ({
    ...video,
    channelUrl: channel.url,
    channelName: channel.name,
    channelDisplayName: channel.displayName
  }))

t('toArray(Map<string, Channel>) returns ChannelVideo[]', ({id, channel}) => {
  expect(Channels.toArray(new Map([[id, channel]]))).toEqual(expectedVideos(channel))
})

t('toArray([string, Channel]) returns ChannelVideo[]', ({id, channel}) => {
  expect(Channels.toArray([id, channel])).toEqual(expectedVideos(channel))
})

t('BY_UPLOADED sorts ChannelVideo[] by <uploaded> descending', ({id, channel}) => {
  const actual = Channels.toArray([id, channel]).sort(Channels.BY_UPLOADED)

  expect(actual).toEqual(
    [
      { ...channel.videos[1], channelUrl: channel.url, channelName: channel.name, channelDisplayName: channel.displayName },
      { ...channel.videos[0], channelUrl: channel.url, channelName: channel.name, channelDisplayName: channel.displayName }
    ]
  )
})

describe('BY_CHANNEL_DISPLAY_NAME', () => {
  t('sorts ChannelVideo[] by channelDisplayName ascending', ({channel}) => {
    const videoA = {
      ...channel.videos[0],
      channelUrl: channel.url,
      channelDisplayName: 'Alpha',
      channelName: 'alpha'
    }
    const videoB = {
      ...channel.videos[0],
      channelUrl: channel.url,
      channelDisplayName: 'Beta',
      channelName: 'beta'
    }

    const items = [videoB, videoA]
    items.sort(Channels.BY_CHANNEL_DISPLAY_NAME)

    expect(items[0].channelDisplayName).toBe('Alpha')
    expect(items[1].channelDisplayName).toBe('Beta')
  })

  t('falls back to channelName when channelDisplayName is empty', ({channel}) => {
    const videoA = {
      ...channel.videos[0],
      channelUrl: channel.url,
      channelDisplayName: '',
      channelName: 'Charlie'
    }
    const videoB = {
      ...channel.videos[0],
      channelUrl: channel.url,
      channelDisplayName: '',
      channelName: 'Delta'
    }

    const items = [videoB, videoA]
    items.sort(Channels.BY_CHANNEL_DISPLAY_NAME)

    expect(items[0].channelName).toBe('Charlie')
    expect(items[1].channelName).toBe('Delta')
  })
})

describe('BY_NAME', () => {
  t('sorts [string, Channel][] by displayName ascending', ({channel}) => {
    const channelA: Channel = { ...channel, displayName: 'Alpha', name: 'alpha' }
    const channelB: Channel = { ...channel, displayName: 'Beta', name: 'beta' }

    const items: [string, Channel][] = [
      ['idB', channelB],
      ['idA', channelA]
    ]

    items.sort(Channels.BY_NAME)

    expect(items[0][1].displayName).toBe('Alpha')
    expect(items[1][1].displayName).toBe('Beta')
  })

  t('falls back to name when displayName is empty', ({channel}) => {
    const channelA: Channel = { ...channel, displayName: '', name: 'Echo' }
    const channelB: Channel = { ...channel, displayName: '', name: 'Foxtrot' }

    const items: [string, Channel][] = [
      ['idB', channelB],
      ['idA', channelA]
    ]

    items.sort(Channels.BY_NAME)

    expect(items[0][1].name).toBe('Echo')
    expect(items[1][1].name).toBe('Foxtrot')
  })
})

describe('serialize', () => {
  t('returns array without videos', ({id, channel}) => {
    Channels.addExisting(id, channel)

    const serialized = Channels.serialize()

    expect(serialized).toEqual([
      [id, {
        url: channel.url,
        name: channel.name,
        displayName: channel.displayName
      }]
    ])
    expect(serialized[0][1]).not.toHaveProperty('videos')
  })
})

describe('restore', () => {
  t('restores channels from serialized data', () => {
    const data: [string, { url: string; name: string; displayName: string }][] = [
      ['restoredId', {
        url: 'https://restored.url',
        name: 'restoredName',
        displayName: 'restoredDisplayName'
      }]
    ]

    Channels.restore(data)

    const result = get(channels)
    expect(result.size).toBe(1)
    expect(result.get('restoredId')).toEqual({
      url: 'https://restored.url',
      name: 'restoredName',
      displayName: 'restoredDisplayName',
      videos: []
    })
  })

  t('clears existing channels on restore', ({id, channel}) => {
    Channels.addExisting(id, channel)

    Channels.restore([['newId', { url: 'https://new.url', name: 'new', displayName: 'new' }]])

    const result = get(channels)
    expect(result.has(id)).toBe(false)
    expect(result.size).toBe(1)
  })
})

describe('restore re-keys channels by parsed url', () => {
  const restoreUrl = (url: string) => {
    Channels.restore([[url, { url, name: 'name', displayName: '' }]])
    return [...get(channels).keys()][0]
  }

  t('parses playlist urls with extra query params', () => {
    expect(restoreUrl('https://youtube.com/playlist?list=PL123&si=abc')).toBe('PL123')
  })

  t('parses channel urls with extra query params', () => {
    expect(restoreUrl('https://youtube.com/channel/UC123/?si=abc')).toBe('UC123')
  })

  t('strips trailing tab segments', () => {
    expect(restoreUrl('https://youtube.com/channel/UC123/videos')).toBe('UC123')
    expect(restoreUrl('https://youtube.com/@foo/shorts')).toBe('@foo')
    expect(restoreUrl('https://youtube.com/c/foo/featured')).toBe('foo')
    expect(restoreUrl('https://youtube.com/user/foo/community')).toBe('foo')
  })

  t('recognizes bare handle urls', () => {
    expect(restoreUrl('https://youtube.com/@foo/')).toBe('@foo')
  })

  t('parses schemeless youtube urls', () => {
    expect(restoreUrl('youtube.com/@foo')).toBe('@foo')
    expect(restoreUrl('www.youtube.com/channel/UC123')).toBe('UC123')
    expect(restoreUrl('youtube.com/playlist?list=PL123')).toBe('PL123')
  })

  t('recognizes bare handles as channels', () => {
    expect(restoreUrl('@foo')).toBe('@foo')
  })

  t('ignores list= on other hosts', () => {
    expect(restoreUrl('https://evil.example/?list=PL999')).toBe('https://evil.example/?list=PL999')
  })

  t('rejects video urls and keeps the original url', () => {
    const url = 'https://youtube.com/watch?v=abc123'
    expect(restoreUrl(url)).toBe(url)
  })

  t('keeps the original url for unparseable urls', () => {
    expect(restoreUrl('https://example.com/foo')).toBe('https://example.com/foo')
  })
})

describe('restore validation', () => {
  t('skips entries of unexpected shape without throwing', () => {
    const url = 'https://ok.example/one'
    expect(() => Channels.restore(
      [1, [url], [url, null], [42, { url }], [url, { url: 1 }]] as any
    )).not.toThrow()
    expect(get(channels).size).toBe(0)
  })

  t('degrades missing name/displayName to empty strings', () => {
    Channels.restore([['key', { url: 'https://ok.example/bare' }]] as any)

    expect(get(channels).get('key')).toEqual({
      url: 'https://ok.example/bare', name: '', displayName: '', videos: []
    })
  })

  t('drops entries with unsafe urls', () => {
    Channels.restore([['javascript:alert(1)', { url: 'javascript:alert(1)', name: 'x', displayName: 'x' }]] as any)

    expect(get(channels).size).toBe(0)
  })
})

describe('hydration validation', () => {
  t('parseStored skips malformed entries instead of throwing', () => {
    const url = 'https://youtube.com/@ok'
    const map = Channels.parseStored([
      1,
      [url],
      [url, null],
      ['javascript:alert(1)', { url: 'javascript:alert(1)' }],
      [url, { url, name: 42, displayName: null }]
    ] as any)

    expect([...map]).toEqual([['@ok', { url, name: '', displayName: '', videos: [] }]])
  })

  t('parseStored tolerates non-array storage', () => {
    expect(Channels.parseStored(undefined).size).toBe(0)
    expect(Channels.parseStored(null).size).toBe(0)
    expect(Channels.parseStored({ a: 1 }).size).toBe(0)
  })

  t('parseStored keeps valid cached videos and drops malformed ones', () => {
    const url = 'https://youtube.com/@ok'
    const video = {
      url: '/watch?v=1', title: 't', thumbnail: 'i', duration: '1m',
      uploaded: 1, uploadedDate: 'now'
    }
    const map = Channels.parseStored([[
      url,
      { url, name: 'ok', displayName: 'Ok', videos: [video, { ...video, uploaded: 'nope' }, null] }
    ]])

    expect(map.get('@ok')?.videos).toEqual([video])
  })

  t('toArray ignores null channel values', () => {
    expect(() => Channels.toArray(new Map([['bad', null as any]]))).not.toThrow()
    expect(Channels.toArray(new Map([['bad', null as any]]))).toEqual([])
  })

  t('parseStored reports malformed entries in strict mode', () => {
    const issues: string[] = []

    Channels.parseStored([
      null,
      ['@ok', { url: 'https://youtube.com/@ok', name: 42, videos: {} }]
    ], issues)

    expect(issues).toEqual([
      'channels[0]: expected a [key, value] pair',
      'channels[1].videos: expected an array',
      'channels[1].name: expected a string'
    ])
  })

  t('parseStored keeps channels stored before the url field existed', () => {
    const map = Channels.parseStored([['@legacy', { name: 'n', displayName: 'N' }]])

    expect(map.get('@legacy')).toEqual({
      url: '', name: 'n', displayName: 'N', videos: []
    })
  })

  t('parseStored round-trips a channel with an empty url in strict mode', () => {
    const issues: string[] = []
    const map = Channels.parseStored([['@legacy', { url: '', name: 'n' }]], issues)

    expect(issues).toEqual([])
    expect(map.get('@legacy')?.url).toBe('')
  })

  t('parseStored reports unsafe urls in strict mode', () => {
    const issues: string[] = []

    Channels.parseStored([
      ['javascript:alert(1)', { url: 'https://youtube.com/@ok' }],
      ['@ok', { url: 'javascript:alert(1)' }],
      ['@bad', { url: 42 }]
    ], issues)

    expect(issues).toEqual([
      'channels[0]: unsafe id',
      'channels[1].url: expected a safe url',
      'channels[2].url: expected a safe url'
    ])
  })
})

describe('refetch', () => {
  const video = { url: '/watch?v=1', title: 't', thumbnail: '', duration: 60, uploaded: Date.now() - 1000, uploadedDate: '1 day ago' }
  const handleChannel: Channel = { url: 'https://youtube.com/@foo', name: 'n', displayName: 'n', videos: [] }
  let fetchMock: ReturnType<typeof vi.fn>

  afterEach(() => vi.unstubAllGlobals())

  function stubFetch() {
    fetchMock = vi.fn(async (input: any) => {
      const url = String(input)
      const body = url.includes('/playlists/')
        ? { name: 'Playlist name', relatedStreams: [{ ...video, uploaderUrl: '/channel/UCup', uploaderName: 'up' }] }
        : { content: [{ ...video, uploaderUrl: '/channel/UCup', uploaderName: 'up' }] }
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  async function refetchChannel(key: string, stored: Channel) {
    Channels.restore([])
    Channels.addExisting(key, stored)
    stubFetch()

    Channels.refetch()
    await vi.waitFor(() => {
      if (get(status).feed.fetching.now.length) throw new Error('still fetching')
    })
    return fetchMock.mock.calls.map(call => String(call[0]))
  }

  t('refetches channels stored behind @handle keys as channels', async () => {
    const calls = await refetchChannel('@foo', handleChannel)

    expect(calls.some(u => u.includes('/channels/tabs'))).toBe(true)
    expect(calls.some(u => u.includes('/playlists/'))).toBe(false)
  })

  t('refetches channels stored behind legacy keys as channels', async () => {
    const calls = await refetchChannel('legacyFoo', {
      url: 'https://youtube.com/channel/UCreal', name: 'n', displayName: 'n', videos: []
    })

    expect(calls.some(u => u.includes('/channels/tabs'))).toBe(true)
  })

  t('refetches playlists as playlists', async () => {
    const calls = await refetchChannel('PL1', {
      url: 'https://youtube.com/playlist?list=PL1', name: 'p', displayName: 'p', videos: []
    })

    expect(calls.some(u => u.includes('/playlists/PL1'))).toBe(true)
  })

  t('classifies a channel key when the stored url is missing', async () => {
    const calls = await refetchChannel('@foo', { ...handleChannel, url: '' })

    expect(calls.some(u => u.includes('/channels/tabs'))).toBe(true)
    expect(calls.some(u => u.includes('/playlists/'))).toBe(false)
  })

  t('keeps per-channel progress when one channel fails', async () => {
    Channels.restore([])
    Channels.addExisting('UCa', { url: 'https://youtube.com/channel/UCa', name: 'a', displayName: 'a', videos: [] })
    Channels.addExisting('UCb', { url: 'https://youtube.com/channel/UCb', name: 'b', displayName: 'b', videos: [] })
    stubFetch()
    const goodFetch = globalThis.fetch as any
    globalThis.fetch = vi.fn(async (input: any) => {
      if (String(input).includes('UCa')) throw new Error('boom')
      return goodFetch(input)
    }) as any

    Channels.refetch()
    await vi.waitFor(() => {
      // Once UCb (the healthy one) completes, UCa's failed entry is already gone
      const now = get(status).feed.fetching.now.filter((id: string) => id !== 'UCa')
      if (now.includes('UCb')) throw new Error('still fetching')
    })

    expect(get(status).feed.fetching.now).toEqual([])
    expect(get(status).feed.fetching.max).toBe(0)
    expect(get(channels).get('UCb')!.videos.length).toBe(1)
  })

  t('skips a null channel value instead of throwing', async () => {
    Channels.restore([])
    Channels.addExisting('UCbad', null as any)
    Channels.addExisting('UCok', { url: 'https://youtube.com/channel/UCok', name: 'ok', displayName: 'ok', videos: [] })
    stubFetch()

    expect(() => Channels.refetch()).not.toThrow()

    await vi.waitFor(() => {
      if (get(status).feed.fetching.now.length) throw new Error('still fetching')
    })
  })
})

describe('add validation', () => {
  afterEach(() => vi.unstubAllGlobals())

  t('rejects empty input without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(Channels.add('')).rejects.toThrow()
    await expect(Channels.add('   ')).rejects.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  t('fetches bare handles as channels', async () => {
    const fetchSpy = vi.fn(async (_input: unknown) => ({ ok: true, json: async () => ({ content: [] }) }))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(Channels.add('@foo')).rejects.toThrow()

    expect(fetchSpy.mock.calls.map(call => String(call[0]))[0]).toContain('/channels/tabs')
  })

  t('fetches schemeless urls', async () => {
    const fetchSpy = vi.fn(async (_input: unknown) => ({ ok: true, json: async () => ({ content: [] }) }))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(Channels.add('youtube.com/@foo')).rejects.toThrow()

    expect(fetchSpy.mock.calls.map(call => String(call[0]))[0]).toContain('/channels/tabs')
  })
})
