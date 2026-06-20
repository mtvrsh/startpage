import { writable, get } from 'svelte/store';
import { LocalStorage } from '../util/storage'
import { config } from './config'
import { status } from './status'
import { getAdapter } from '../lib/api/adapter'

export interface Channel {
  url: string;
  name: string;
  displayName: string;
  videos: Video[];
}

export interface Video {
  url: string;
  title: string;
  thumbnail: string;
  duration: string;
  uploaded: number;
  uploadedDate: string;
}

export interface ChannelVideo extends Video {
  channelUrl: string;
  channelName: string;
  channelDisplayName: string;
}

export class Channels extends LocalStorage {
  static LS_NAME = 'channels'

  static saveOnUpdate() {
    channels.subscribe(s => super.set([...s]))
  }

  static add(url: string, partial = false, reload = false): Promise<void> {
    let id = this.#parseId(url)

    if (!id)
      return new Promise((_, reject) => reject(`No URL found in ${url}`))

    const adapter = getAdapter()

    return (
        this.#isPlaylist(url)
      ? adapter.fetchPlaylist(id, reload)
      : adapter.fetchChannel(id, reload)
    ).then(channel => {
        if (partial)
          this.update(id, {videos: channel.videos})
        else
          channels.update(s => s.set(id, channel))

        status.update(s => {
          s.feed.fetching.now = s.feed.fetching.now.filter(
            (u: string) => u != id
          )

          if (s.feed.fetching.now.length == 0)
            s.feed.fetching.max = 0

          return s
        })
      }
    )
  }

  static update(id: string, values: any) {
    channels.update(s => s.set(id, {...s.get(id), ...values}))
  }

  static remove(id: string) {
    channels.update(s => {
      s.delete(id)
      return s
    })
  }

  static addExisting(id: string, channel: Channel) {
    channels.update(s => s.set(id, channel))
  }

  static toArray(selected: [string, Channel] | Map<string, Channel>): ChannelVideo[] {
    return this.#toArray(
      selected instanceof Map ? [...selected.entries()] : [selected]
    )
  }

  static #toArray(selected: Array<[string, Channel]>): ChannelVideo[] {
    return selected.flatMap(([_url, channel]) => channel.videos.map(video => ({
      ...video,
      channelUrl: channel.url,
      channelName : channel.name,
      channelDisplayName : channel.displayName
    })))
  }

  static BY_UPLOADED = (a: Video, b: Video) =>
    b.uploaded - a.uploaded

  static BY_CHANNEL_DISPLAY_NAME = (a: ChannelVideo, b: ChannelVideo) =>
    (a.channelDisplayName || a.channelName).localeCompare(b.channelDisplayName || b.channelName)

  static BY_NAME = ([, a]: [string, Channel], [, b]: [string, Channel]) =>
    (a.displayName || a.name).localeCompare(b.displayName || b.name)

  static refetch({reload = false} = {}) {
    const r = reload || !this.#isFeedFresh()

    channels.update(v => {
      status.update(s => {
        s.feed.fetching.now = [...v].map(c => c[0])
        s.feed.fetching.max = v.size
        return s
      })

      v.forEach((_, id) => 
        this.add(id, true, r)
        .catch(_ => status.update(s => {
          s.feed.fetching.now = []
          s.feed.fetching.max = 0
          return s
        })))

      return v
    })

    this.#resetFeedFetchedAt()
  }

  static #isFeedFresh() {
    return Date.now() < (get(status).feed.fetchedAt + get(config).cacheLifetimeInMinutes * 60000)
  }

  static #resetFeedFetchedAt() {
    status.update(s => { s.feed.fetchedAt = Date.now(); return s })
  }

  static #isPlaylist(url: string): boolean {
    if (url.includes('playlist') || url.includes('list=')) return true
    if (!url.includes('/') && !url.includes('='))
      return !url.startsWith('UC')
    return false
  }

  static #parseId(url: string): string | undefined {
    let delimeter = this.#isPlaylist(url) ? '=' : '/'

    return url.split(delimeter).pop()
  }

  static serialize() {
    return [...get(channels)].map(([url, ch]) => [url, {
      url: ch.url,
      name: ch.name,
      displayName: ch.displayName
    }])
  }

  static restore(data: [string, { url: string; name: string; displayName: string }][]) {
    const entries = data
      .map(([url, ch]) => [this.#parseId(url) || url, { ...ch, videos: [] }] as [string, Channel])
    channels.set(new Map(entries))
  }
}

const stored = Channels.get()
export const channels = writable<Map<string, Channel>>(new Map(Array.isArray(stored) ? stored : []))
