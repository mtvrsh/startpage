import { writable, get } from 'svelte/store';
import { LocalStorage } from '../util/storage'
import { hasSafeScheme } from '../util/scheme'
import { config } from './config'
import { status } from './status'
import { backend } from '../lib/api/backend'

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

type ChannelRef = {
  kind: 'channel' | 'playlist',
  id: string
}

export class Channels extends LocalStorage {
  static LS_NAME = 'channels'

  static saveOnUpdate() {
    channels.subscribe(channelMap => super.set([...channelMap]))
  }

  static add(url: string, partial = false, reload = false): Promise<void> {
    const ref = this.#parse(url)

    if (!ref)
      return Promise.reject(`No URL found in ${url}`)

    return this.#fetch(ref, partial, reload)
  }

  static #fetch(ref: ChannelRef, partial = false, reload = false): Promise<void> {
    return (
        ref.kind === 'playlist'
      ? get(backend).fetchPlaylist(ref.id, reload)
      : get(backend).fetchChannel(ref.id, reload)
    ).then(channel => {
        if (partial)
          this.update(ref.id, {videos: channel.videos})
        else
          channels.update(channelMap => channelMap.set(ref.id, channel))

        status.update(state => {
          state.feed.fetching.now = state.feed.fetching.now.filter(
            (channelId: string) => channelId != ref.id
          )

          if (state.feed.fetching.now.length == 0)
            state.feed.fetching.max = 0

          return state
        })
      }
    )
  }

  static update(id: string, channelProps: any) {
    channels.update(channelMap => channelMap.set(id, {...channelMap.get(id), ...channelProps}))
  }

  static remove(id: string) {
    channels.update(channelMap => {
      channelMap.delete(id)
      return channelMap
    })
  }

  static addExisting(id: string, channel: Channel) {
    channels.update(channelMap => channelMap.set(id, channel))
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

  static BY_UPLOADED = (videoA: Video, videoB: Video) =>
    videoB.uploaded - videoA.uploaded

  static BY_CHANNEL_DISPLAY_NAME = (channelA: ChannelVideo, channelB: ChannelVideo) =>
    (channelA.channelDisplayName || channelA.channelName).localeCompare(channelB.channelDisplayName || channelB.channelName)

  static BY_NAME = ([, channelA]: [string, Channel], [, channelB]: [string, Channel]) =>
    (channelA.displayName || channelA.name).localeCompare(channelB.displayName || channelB.name)

  static refetch({reload = false} = {}) {
    const forceReload = reload || !this.#isFeedFresh()

    channels.update(channelMap => {
      status.update(state => {
        state.feed.fetching.now = [...channelMap].map(entry => entry[0])
        state.feed.fetching.max = channelMap.size
        return state
      })

      channelMap.forEach((channel, id) => {
        this.#fetch(this.#refFor(channel, id), true, forceReload)
        .catch(_ => status.update(state => {
          state.feed.fetching.now = []
          state.feed.fetching.max = 0
          return state
        }))
      })

      return channelMap
    })

    this.#resetFeedFetchedAt()
  }

  static #isFeedFresh() {
    return Date.now() < (get(status).feed.fetchedAt + get(config).cacheLifetimeInMinutes * 60000)
  }

  static #resetFeedFetchedAt() {
    status.update(state => { state.feed.fetchedAt = Date.now(); return state })
  }

  static #refFor(channel: Channel, fallbackId: string): ChannelRef {
    // The map key alone is ambiguous (@handle / legacy /c/ /user/ keys look like
    // playlist ids), so derive the kind from the stored channel.url instead.
    if (channel.url)
      return {
        kind: this.#isPlaylist(channel.url) ? 'playlist' : 'channel',
        id: fallbackId
      }

    return { kind: this.#isPlaylist(fallbackId) ? 'playlist' : 'channel', id: fallbackId }
  }

  static #isPlaylist(url: string): boolean {
    if (url.includes('playlist') || url.includes('list=')) return true
    if (!url.includes('/') && !url.includes('='))
      return !url.startsWith('UC')
    return false
  }

  static #parse(url: string): ChannelRef | undefined {
    if (this.#isPlaylist(url)) {
      const id = url.split('=').pop()
      return id ? { kind: 'playlist', id } : undefined
    }

    const id = url.split('/').pop()
    return id ? { kind: 'channel', id } : undefined
  }

  static serialize() {
    return [...get(channels)].map(([url, channel]) => [url, {
      url: channel.url,
      name: channel.name,
      displayName: channel.displayName
    }])
  }

  static restore(data: [string, { url: string; name: string; displayName: string }][]) {
    const entries = data
      .filter(([url, channel]) => hasSafeScheme(url) && hasSafeScheme(channel.url))
      .map(([url, channel]) => [this.#parse(url)?.id || url, { ...channel, videos: [] }] as [string, Channel])
    channels.set(new Map(entries))
  }
}

const stored = Channels.get()
export const channels = writable<Map<string, Channel>>(new Map(Array.isArray(stored) ? stored : []))
