import { writable, get } from 'svelte/store';
import { LocalStorage } from '../util/storage.ts'
import { config } from './config.ts'
import { status } from './status.ts'
import humanizeDuration from 'humanize-duration'

export type URL = string

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

  static add(url: string | URL, partial = false, reload = false): Promise<void> {
    let id = this.#parseId(url)

    if (id === undefined)
      return new Promise((_, reject) => reject(`No URL found in ${url}`))

    return (
        this.#isPlaylist(url)
      ? this.#fetchPlaylist(id, reload)
      : this.#fetchChannel(id, reload)
    ).then(channel => {
        if (partial)
          this.update(url, {videos: channel.videos})
        else
          channels.update(s => s.set(url, channel))

        status.update(s => {
          s.feed.fetching.now = s.feed.fetching.now.filter(
            (u: URL) => u != url
          )

          if (s.feed.fetching.now.length == 0)
            s.feed.fetching.max = 0

          return s
        })
      }
    )
  }

  static update(id: URL, values: any) {
    channels.update(s => s.set(id, {...s.get(id), ...values}))
  }

  static remove(id: URL) {
    channels.update(s => {
      s.delete(id)
      return s
    })
  }

  static addExisting(id: URL, channel: Channel) {
    channels.update(s => s.set(id, channel))
  }

  static toArray(selected: [URL, Channel] | Map<URL, Channel>): ChannelVideo[] {
    return this.#toArray(
      selected instanceof Map ? [...selected.entries()] : [selected]
    )
  }

  static #toArray(selected: Array<[URL, Channel]>): ChannelVideo[] {
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

  static BY_NAME = ([, a]: [URL, Channel], [, b]: [URL, Channel]) =>
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

  static #mapVideos(streams: any[]) {
    return streams.map((video) => {
      let duration = humanizeDuration(video.duration * 1000, { round: true, units: video.duration >= 60 ? ['h', 'm'] : ['s'] })
      let uploaded = video.uploaded
      let uploadedDate = video.uploadedDate

      // live
      if (video.uploaded === -1) {
        uploaded = Date.now()
        uploadedDate = 'Live'
        duration = ''
      }

      // premiere
      if (video.uploaded > Date.now()) {
        uploadedDate = `in ${humanizeDuration(video.uploaded - Date.now(), { round: true, units: ['h', 'm'] })}`
      }

      return {
        url: `https://youtube.com${video.url}`,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: duration,
        uploaded: uploaded,
        uploadedDate: uploadedDate
      }
    })
  }

  static #fetchChannel(id: URL, reload: boolean): Promise<Channel> {
    const endpoint = get(config).feedFetchAll
      ? `/playlists/UU${id.toString().slice(2)}`
      : `/channels/tabs?data=${encodeURIComponent(JSON.stringify({ id: `${id}`, contentFilters: ["videos"] }))}`

    return fetch(`${get(config).instance.value}${endpoint}`, {cache: reload ? 'reload' : 'default'})
      .then(response => response.json())
      .then(response => {
        const streams = response.relatedStreams ?? response.content
        return {
          'url': 'https://youtube.com' + streams?.[0]?.uploaderUrl,
          'name': streams?.[0]?.uploaderName,
          'displayName': streams?.[0]?.uploaderName,
          'videos': this.#mapVideos(streams)
        }
      })
  }

  static #fetchPlaylist(id: URL, reload: boolean): Promise<Channel> {
    return fetch(`${get(config).instance.value}/playlists/${id}`, {cache: reload ? 'reload' : 'default'})
      .then(response => response.json())
      .then(response => ({
        'url': `https://youtube.com/playlist?list=${id.toString()}`,
        'name': response.name,
        'displayName': response.name,
        'videos': this.#mapVideos(response.relatedStreams)
      }))
  }

  static #parseId(url: string): URL | undefined {
    let delimeter = this.#isPlaylist(url) ? '=' : '/'

    return url.split(delimeter).pop()
  }

  static #isPlaylist(url: string): boolean {
    return url.includes('playlist')
  }
}

export let channels = writable<Map<URL, Channel>>(new Map(Channels.get()))
