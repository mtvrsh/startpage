import { get } from 'svelte/store'
import { config } from '../../share/config'
import humanizeDuration from 'humanize-duration'
import type { Backend } from './backend'
import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'

function getText(obj: any): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.text || (obj.runs?.map((run: any) => run.text).join('')) || ''
}

function bestThumbnail(thumbnails: any[]): string {
  if (!thumbnails?.length) return ''
  return thumbnails.at(-1).url
}

export class StartpageBackend implements Backend {
  async search(query: string): Promise<SearchChannelsResult[]> {
    const { backendUrl, timeoutInSeconds } = get(config)
    const response = await fetch(`${backendUrl}/search/channels?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(timeoutInSeconds * 1000)
    })
    if (!response.ok) return []

    const channels: any[] = await response.json()
    if (!Array.isArray(channels)) return []

    return channels.map(channel => ({
      url: `https://youtube.com/channel/${channel.id}`,
      name: channel.author?.name || '',
      thumbnail: bestThumbnail(channel.author?.thumbnails) || '',
      subscribers: 0
    }))
  }

  async fetchChannel(id: string, _reload?: boolean): Promise<Channel> {
    const { backendUrl, timeoutInSeconds, feedFetchAll } = get(config)
    const response = await fetch(
      feedFetchAll
        ? `${backendUrl}/playlists/UU${id.slice(2)}`
        : `${backendUrl}/channels/${id}`, {
      signal: AbortSignal.timeout(timeoutInSeconds * 1000)
    })
    if (!response.ok) throw new Error(`Failed to fetch channel ${id}`)

    const data: any = await response.json()
    const feedItems: any[] = feedFetchAll ? data.items : data
    if (!feedItems?.length) throw new Error(`No videos found for ${id}`)

    const author = feedFetchAll ? data.author : feedItems[0].author

    const videos = feedItems.map(video => {
      const duration = this.formatDuration(video.duration, video.is_live)
      const uploaded = this.getUploaded(video)
      const uploadedDate = getText(video.published)
      const thumbnailUrl = bestThumbnail(video.thumbnails) || ''

      return {
        url: `https://youtube.com/watch?v=${video.video_id || video.id}`,
        title: getText(video.title),
        thumbnail: thumbnailUrl,
        duration,
        uploaded,
        uploadedDate
      }
    })

    return {
      url: `https://youtube.com/channel/${author?.id || id}`,
      name: author?.name || '',
      displayName: author?.name || '',
      videos
    }
  }

  async fetchPlaylist(id: string, _reload?: boolean): Promise<Channel> {
    const { backendUrl, timeoutInSeconds } = get(config)
    const response = await fetch(`${backendUrl}/playlists/${id}`, {
      signal: AbortSignal.timeout(timeoutInSeconds * 1000)
    })
    if (!response.ok) throw new Error(`Failed to fetch playlist ${id}`)

    const data: any = await response.json()
    const feedItems: any[] = data.items || []
    if (!feedItems?.length) throw new Error(`No videos found for playlist ${id}`)

    const author = data.author || feedItems[0].author

    const videos = feedItems.map(video => {
      const duration = this.formatDuration(video.duration, video.is_live)
      const uploaded = this.getUploaded(video)
      const uploadedDate = getText(video.published)
      const thumbnailUrl = bestThumbnail(video.thumbnails) || ''

      return {
        url: `https://youtube.com/watch?v=${video.id}`,
        title: getText(video.title),
        thumbnail: thumbnailUrl,
        duration,
        uploaded,
        uploadedDate
      }
    })

    return {
      url: `https://youtube.com/playlist?list=${id}`,
      name: data.name || author?.name || '',
      displayName: data.name || author?.name || '',
      videos
    }
  }

  private formatDuration(duration: any, isLive: boolean): string {
    if (isLive) return 'live'
    if (!duration?.seconds || duration.seconds === '0') return ''
    return humanizeDuration(duration.seconds * 1000, {
      round: true,
      units: duration.seconds >= 60 ? ['h', 'm'] : ['s']
    })
  }

  private getUploaded(video: any): number {
    if (video.is_live) return -1
    if (video.is_upcoming && video.upcoming) {
      const date = new Date(video.upcoming).getTime()
      if (date) return date
    }
    return video.uploaded ?? 0
  }
}
