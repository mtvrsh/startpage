import { get } from 'svelte/store'
import { config } from '../share/config.ts'

export class Piped {
  static RELOAD           = false
  static FILTER_ALL       = 'all'
  static FILTER_VIDEOS    = 'videos'
  static FILTER_CHANNELS  = 'channels'
  static FILTER_PLAYLISTS = 'playlists'

  static get(endpoint: string, reload: boolean) {
    const {instance: {value: baseUrl}, timeoutInSeconds} = get(config)

    return fetch(baseUrl + endpoint, {
      cache: reload ? 'reload' : 'default',
      signal: AbortSignal.timeout(timeoutInSeconds * 1000)
    })
  }

  static getChannel(id: string, {
    reload = this.RELOAD
  } = {}) {
    return this.get(`/channel/${id}`, reload)
  }

  static getPlaylist(id: string, {
    reload = this.RELOAD
  } = {}) {
    return this.get(`/playlists/${id}`, reload)
  }

  static search(query: string, {
    filter = this.FILTER_ALL,
    reload = this.RELOAD
  } = {}) {
    return this.get(`/search?q=${query}&filter=${filter}`, reload)
  }

  static parseId(url: string) {
    return url.split('/').pop() || ''
  }
}

export interface SearchChannelsResult {
  url: string,
  name: string,
  thumbnail: string,
  subscribers: number
}
