import { get } from 'svelte/store'
import { config } from '../../share/config'
import humanizeDuration from 'humanize-duration'
import type { ApiAdapter } from './adapter'
import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'

function getText(obj: any): string {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  return obj.text || (obj.runs?.map((r: any) => r.text).join('')) || ''
}

function bestThumbnail(thumbnails: any[]): string {
  if (!thumbnails?.length) return ''
  return thumbnails.at(-1).url
}

export class StartpageAdapter implements ApiAdapter {
  async search(query: string): Promise<SearchChannelsResult[]> {
    const { backendUrl, timeoutInSeconds } = get(config)
    const response = await fetch(`${backendUrl}/search/channels?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(timeoutInSeconds * 1000)
    })
    if (!response.ok) return []

    const items: any[] = await response.json()
    if (!Array.isArray(items)) return []

    return items.map(item => ({
      url: `https://youtube.com/channel/${item.id}`,
      name: item.author?.name || '',
      thumbnail: bestThumbnail(item.author?.thumbnails) || '',
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

    const body: any = await response.json()
    const items: any[] = feedFetchAll ? body.items : body
    if (!items?.length) throw new Error(`No videos found for ${id}`)

    const author = feedFetchAll ? body.author : items[0].author

    const videos = items.map(v => {
      const duration = this.formatDuration(v.duration, v.is_live)
      const uploaded = this.getUploaded(v)
      const uploadedDate = getText(v.published)
      const thumb = bestThumbnail(v.thumbnails) || ''

      return {
        url: `https://youtube.com/watch?v=${v.video_id || v.id}`,
        title: getText(v.title),
        thumbnail: thumb,
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

    const body: any = await response.json()
    const items: any[] = body.items || []
    if (!items?.length) throw new Error(`No videos found for playlist ${id}`)

    const author = body.author || items[0].author

    const videos = items.map(v => {
      const duration = this.formatDuration(v.duration, v.is_live)
      const uploaded = this.getUploaded(v)
      const uploadedDate = getText(v.published)
      const thumb = bestThumbnail(v.thumbnails) || ''

      return {
        url: `https://youtube.com/watch?v=${v.id}`,
        title: getText(v.title),
        thumbnail: thumb,
        duration,
        uploaded,
        uploadedDate
      }
    })

    return {
      url: `https://youtube.com/playlist?list=${id}`,
      name: body.name || author?.name || '',
      displayName: body.name || author?.name || '',
      videos
    }
  }

  private formatDuration(d: any, isLive: boolean): string {
    if (isLive) return 'live'
    if (!d?.seconds || d.seconds === '0') return ''
    return humanizeDuration(d.seconds * 1000, {
      round: true,
      units: d.seconds >= 60 ? ['h', 'm'] : ['s']
    })
  }

  private getUploaded(v: any): number {
    if (v.is_live) return -1
    if (v.is_upcoming && v.upcoming) {
      const date = new Date(v.upcoming).getTime()
      if (date) return date
    }
    return v.uploaded ?? 0
  }
}
