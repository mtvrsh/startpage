import { get } from 'svelte/store'
import { config } from '../../share/config'
import { Piped } from '../../util/piped'
import { getDirectThumbnail } from '../../util/youtube'
import humanizeDuration from 'humanize-duration'
import type { Backend } from './backend'
import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'

export class PipedBackend implements Backend {
  async search(query: string): Promise<SearchChannelsResult[]> {
    const response = await Piped.search(query, { filter: Piped.FILTER_CHANNELS })
    if (!response.ok) return []
    const data = await response.json()
    return data.items || []
  }

  async fetchChannel(id: string, reload?: boolean): Promise<Channel> {
    const endpoint = get(config).feedFetchAll
      ? `/playlists/UU${id.toString().slice(2)}`
      : `/channels/tabs?data=${encodeURIComponent(JSON.stringify({ id: `${id}`, contentFilters: ['videos'] }))}`

    const response = await fetch(`${get(config).instance.value}${endpoint}`, {
      cache: reload ? 'reload' : 'default'
    })
    const data = await response.json()
    const streams = data.relatedStreams ?? data.content

    if (!streams?.length)
      throw new Error(`No videos found for ${id}`)

    return {
      url: 'https://youtube.com' + streams[0].uploaderUrl,
      name: streams[0].uploaderName,
      displayName: streams[0].uploaderName,
      videos: this.mapVideos(streams)
    }
  }

  async fetchPlaylist(id: string, _reload?: boolean): Promise<Channel> {
    const response = await fetch(`${get(config).instance.value}/playlists/${id}`, { cache: 'default' })
    const data = await response.json()

    return {
      url: `https://youtube.com/playlist?list=${id.toString()}`,
      name: data.name,
      displayName: data.name,
      videos: this.mapVideos(data.relatedStreams)
    }
  }

  private mapVideos(streams: any[]) {
    const useDirectThumbnails = get(config).useDirectThumbnails

    return streams.map((video) => {
      let duration = humanizeDuration(video.duration * 1000, { round: true, units: video.duration >= 60 ? ['h', 'm'] : ['s'] })
      if (video.duration == 0) {
        duration = ''
      }

      let uploaded = video.uploaded
      let uploadedDate = video.uploadedDate

      if (video.uploaded === -1) {
        uploaded = Date.now()
        uploadedDate = 'now'
        duration = 'live'
      }

      if (video.uploaded > Date.now()) {
        uploadedDate = `in ${humanizeDuration(video.uploaded - Date.now(), { round: true, units: ['h', 'm'] })}`
      }

      let thumbnail = video.thumbnail
      if (useDirectThumbnails) {
        thumbnail = getDirectThumbnail(thumbnail)
      }

      return {
        url: `https://youtube.com${video.url}`,
        title: video.title,
        thumbnail: thumbnail,
        duration: duration,
        uploaded: uploaded,
        uploadedDate: uploadedDate
      }
    })
  }
}
