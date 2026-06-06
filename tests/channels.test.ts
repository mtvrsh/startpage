import { test, expect, describe } from 'vitest'
import { get } from 'svelte/store'
import { Channels, channels } from '../src/share/channels'
import type { Channel } from '../src/share/channels'

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

t('toArray(Map<string, Channel>) returns ChannelVideo[]', ({id, channel}) => {
  const actual = Channels.toArray(new Map([[id, channel]]))

  expect(actual).toEqual(
    [
      {
        ...channel.videos[0],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      },
      {
        ...channel.videos[1],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      }
    ]
  )
})

t('toArray([string, Channel]) returns ChannelVideo[]', ({id, channel}) => {
  const actual = Channels.toArray([id, channel])

  expect(actual).toEqual(
    [
      {
        ...channel.videos[0],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      },
      {
        ...channel.videos[1],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      }
    ]
  )
})

t('BY_UPLOADED sorts ChannelVideo[] by <uploaded> descending', ({id, channel}) => {
  const actual = Channels.toArray([id, channel]).sort(Channels.BY_UPLOADED)

  expect(actual).toEqual(
    [
      {
        ...channel.videos[1],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      },
      {
        ...channel.videos[0],
        channelUrl: channel.url,
        channelName: channel.name,
        channelDisplayName: channel.displayName
      }
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
