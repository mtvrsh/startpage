import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import ChannelsColumn from '../src/lib/Channels.svelte'
import { Channels } from '../src/share/channels'
import { config, defaults } from '../src/share/config'

const VIDEO_URL = 'https://youtube.com/watch?v=vid12345678'

let target: HTMLDivElement
let component: ReturnType<typeof mount>

beforeEach(() => {
  // The column refetches on mount; keep that offline and out of the way.
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  target = document.createElement('div')
  document.body.append(target)
})

afterEach(() => {
  unmount(component)
  target.remove()
  Channels.restore([])
  config.set(structuredClone(defaults))
  vi.unstubAllGlobals()
})

function titleHref(settings: { videos: boolean, titles: boolean }) {
  config.set({
    ...structuredClone(defaults),
    feedProtocolEnabledForVideos: settings.videos,
    feedProtocolEnabledForVideosInTitles: settings.titles,
    feedProtocolName: 'mpv'
  })
  Channels.restore([['UC1234567890abcdefghijkl', {
    url: 'https://youtube.com/channel/UC1234567890abcdefghijkl',
    name: 'Channel',
    displayName: 'Channel',
    videos: [{
      url: VIDEO_URL,
      title: 'Video',
      thumbnail: '',
      duration: '',
      uploaded: 1,
      uploadedDate: 'now'
    }]
  }]])

  component = mount(ChannelsColumn, { target })

  return target.querySelector<HTMLAnchorElement>('.feed__item-name-url')
}

describe('video link protocol', () => {
  test('uses the custom protocol for titles when both toggles are on', () => {
    expect(titleHref({ videos: true, titles: true })?.getAttribute('href'))
      .toBe(`mpv:${VIDEO_URL}`)
  })

  test('keeps the plain video url for titles when the title toggle is off', () => {
    expect(titleHref({ videos: true, titles: false })?.getAttribute('href'))
      .toBe(VIDEO_URL)
  })

  test('still checks the url scheme when the title toggle is off', () => {
    const unsafe = 'javascript:alert(1)'
    config.set({
      ...structuredClone(defaults),
      feedProtocolEnabledForVideos: true,
      feedProtocolEnabledForVideosInTitles: false,
      feedProtocolName: 'mpv'
    })
    Channels.restore([['UC1234567890abcdefghijkl', {
      url: 'https://youtube.com/channel/UC1234567890abcdefghijkl',
      name: 'Channel',
      displayName: 'Channel',
      videos: [{
        url: unsafe,
        title: 'Video',
        thumbnail: '',
        duration: '',
        uploaded: 1,
        uploadedDate: 'now'
      }]
    }]])

    component = mount(ChannelsColumn, { target })

    expect(target.querySelector<HTMLAnchorElement>('.feed__item-name-url')?.getAttribute('href'))
      .toBeNull()
  })
})
