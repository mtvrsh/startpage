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
    try {
      return this.#fetch(this.#parse(url), partial, reload)
    } catch (reason) {
      return Promise.reject(reason)
    }
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
    try {
      return this.#parse(url).kind === 'playlist'
    } catch {
      // Unrecognised stored URL: fall back to legacy heuristics
      return url.includes('playlist') || url.includes('list=')
    }
  }

  static #parse(url: string): ChannelRef {
    const ref = this.#parseRef(url.trim())
    return ref ?? this.#fail(url)
  }

  static #tryParse(url: string): ChannelRef | undefined {
    try {
      return this.#parse(url)
    } catch {
      return undefined
    }
  }

  static #fail(url: string): never {
    throw new Error(`No channel or playlist URL found in ${url}`)
  }

  static #parseRef(raw: string): ChannelRef | undefined {
    // Bare ids: 'UC…' channel ids or playlist ids (also legacy 'x=list=…' keys)
    if (!raw.includes('/')) {
      if (raw.includes('=')) {
        const id = raw.split('=').pop()
        return id ? { kind: 'playlist', id } : undefined
      }

      return raw.startsWith('UC')
        ? { kind: 'channel', id: raw }
        : { kind: 'playlist', id: raw }
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(raw)
    } catch {
      return undefined
    }

    const list = parsedUrl.searchParams.get('list')
    if (list)
      return { kind: 'playlist', id: list }

    const hostname = parsedUrl.hostname.replace(/^www\./i, '')
    if (!/(^|\.)youtube\.com$/.test(hostname))
      return undefined

    // A single video is never a channel or playlist
    if (/\/(watch|shorts\/[^/]+)\/?$/.test(parsedUrl.pathname))
      throw new Error(`Video URLs cannot be added — use a channel or playlist URL (${raw})`)

    let segments = parsedUrl.pathname.split('/').filter(Boolean)

    // Strip trailing tab segments (/videos, /shorts, /featured, …)
    let end = segments.length
    while (end > 1 && TAB_SEGMENTS.has(segments[end - 1])) end--
    segments = segments.slice(0, end)

    const [first, second] = segments

    if (first?.startsWith('@'))
      return { kind: 'channel', id: first }

    if ((first === 'channel' || first === 'c' || first === 'user')) {
      if (!second)
        this.#fail(raw)
      return { kind: 'channel', id: second }
    }

    return undefined
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
      .map(([url, channel]) => [this.#tryParse(url)?.id || url, { ...channel, videos: [] }] as [string, Channel])
    channels.set(new Map(entries))
  }
}

const TAB_SEGMENTS = new Set([
  'videos',
  'shorts',
  'streams',
  'live',
  'featured',
  'playlists',
  'community',
  'about',
  'podcasts',
  'releases'
])

const stored = Channels.get()
export const channels = writable<Map<string, Channel>>(new Map(Array.isArray(stored) ? stored : []))
