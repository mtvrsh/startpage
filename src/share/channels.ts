import { writable, get } from 'svelte/store';
import { LocalStorage } from '../util/storage'
import { hasSafeScheme } from '../util/scheme'
import { readPairs } from '../util/validate'
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

  // The run currently in flight, so a second trigger (double-clicking sync,
  // or mounting while a manual sync runs) joins it instead of firing another
  // request for every channel.
  static #refetching: Promise<void> | null = null

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

        // A success clears the previous failure; a channel removed while its
        // request was in flight gets no new state.
        if (get(channels).has(ref.id))
          this.#setState(ref.id, '')
      }
    ).catch(error => {
      if (get(channels).has(ref.id))
        this.#setState(
          ref.id,
          error instanceof Error ? error.message : String(error)
        )

      // Rethrow so add()'s form rejection and refetch()'s swallow keep their
      // current behavior; only the recording is added.
      throw error
    }).finally(() => this.#clearFetching(ref.id))
  }

  static #setState(id: string, error: string) {
    channelStates.update(states => new Map(states).set(id, { error }))
  }

  static #clearFetching(id: string) {
    status.update(state => {
      state.feed.fetching.now = state.feed.fetching.now.filter(
        (channelId: string) => channelId != id
      )

      if (state.feed.fetching.now.length == 0)
        state.feed.fetching.max = 0

      return state
    })
  }

  static update(id: string, channelProps: any) {
    channels.update(channelMap => {
      const channel = channelMap.get(id)
      if (!channel) return channelMap
      return new Map(channelMap).set(id, {...channel, ...channelProps})
    })
  }

  static remove(id: string) {
    channels.update(channelMap => {
      channelMap.delete(id)
      return channelMap
    })
    channelStates.update(states => {
      const next = new Map(states)
      next.delete(id)
      return next
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
    return selected.flatMap(([_url, channel]) => {
      if (!channel || !Array.isArray(channel.videos)) return []

      return channel.videos.map(video => ({
        ...video,
        channelUrl: channel.url,
        channelName : channel.name,
        channelDisplayName : channel.displayName
      }))
    })
  }

  static BY_UPLOADED = (videoA: Video, videoB: Video) =>
    videoB.uploaded - videoA.uploaded

  static BY_CHANNEL_DISPLAY_NAME = (channelA: ChannelVideo, channelB: ChannelVideo) =>
    (channelA.channelDisplayName || channelA.channelName).localeCompare(channelB.channelDisplayName || channelB.channelName)

  static BY_NAME = ([, channelA]: [string, Channel], [, channelB]: [string, Channel]) =>
    (channelA.displayName || channelA.name).localeCompare(channelB.displayName || channelB.name)

  static refetch({reload = false} = {}): Promise<void> {
    // Overlapping calls join the run in flight; a request that asked for a
    // forced reload is chained after it instead, so the intent is not
    // silently dropped (the sync button is disabled meanwhile, so this only
    // matters for programmatic triggers).
    if (Channels.#refetching)
      return reload
        ? Channels.#refetching.then(() => this.refetch({ reload }))
        : Channels.#refetching

    const forceReload = reload || !this.#isFeedFresh()
    const tasks: Promise<void>[] = []

    channels.update(channelMap => {
      status.update(state => {
        state.feed.fetching.now = [...channelMap].map(entry => entry[0])
        state.feed.fetching.max = channelMap.size
        return state
      })

      channelMap.forEach((channel, id) => {
        tasks.push(this.#fetch(this.#refFor(channel, id), true, forceReload)
          .catch(() => {
            // Failed channel was already removed from fetching.now in #fetch;
            // remaining ids keep their in-flight progress
          })
        )
      })

      return channelMap
    })

    this.#resetFeedFetchedAt()

    // Settle all channels, then let the next refetch start a new run.
    const run = Promise.all(tasks)
      .then(() => {})
      .finally(() => { Channels.#refetching = null })

    Channels.#refetching = run
    return run
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
    if (channel?.url)
      return {
        kind: this.#isPlaylist(channel.url) ? 'playlist' : 'channel',
        id: fallbackId
      }

    // Missing stored url: parse the map key itself, falling back to the legacy
    // heuristics for keys #parse cannot understand. Only the kind is trusted
    // from the parse — the id stays the map key.
    const parsed = this.#tryParse(fallbackId)
    if (parsed)
      return { kind: parsed.kind, id: fallbackId }

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
    if (!raw)
      return undefined

    // Bare ids: 'UC…' channel ids or playlist ids (also legacy 'x=list=…' keys)
    if (!raw.includes('/')) {
      if (raw.includes('=')) {
        const id = raw.split('=').pop()
        return id ? { kind: 'playlist', id } : undefined
      }

      // 'UC…' channel ids and '@handle' handles are channels; anything else
      // is assumed to be an opaque playlist id.
      return raw.startsWith('UC') || raw.startsWith('@')
        ? { kind: 'channel', id: raw }
        : { kind: 'playlist', id: raw }
    }

    // Schemeless youtube urls ('youtube.com/@foo') were accepted by the earlier
    // split-based parser, so normalize them instead of rejecting.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))
      raw = `https://${raw.replace(/^\/\//, '')}`

    let parsedUrl: URL
    try {
      parsedUrl = new URL(raw)
    } catch {
      return undefined
    }

    // Validate the host before honoring any query parameters: a `list=` on a
    // non-YouTube host must not smuggle a playlist id in.
    const hostname = parsedUrl.hostname.replace(/^(?:www|m)\./i, '')
    if (!/(^|\.)youtube\.com$/.test(hostname))
      return undefined

    const list = parsedUrl.searchParams.get('list')
    if (list)
      return { kind: 'playlist', id: list }

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

  static restore(data: unknown) {
    channels.set(data instanceof Map ? new Map(data) : this.parseStored(data))
    channelStates.set(new Map())
  }

  /**
   * Validates a serialized/imported channel list. Never throws: malformed
   * pairs are skipped, names degrade to '', and only safe schemes are kept.
   * Shared by hydration and restore.
   *
   * A missing or empty `url` is a supported state, not malformed: channels
   * stored before the field existed are resolved from the map key by #refFor,
   * and exports of them carry `url: ''`.
   */
  static parseStored(raw: unknown, issues?: string[]): Map<string, Channel> {
    const entries = readPairs(raw, 'channels', issues, (key, value, path) => {
      if (typeof value !== 'object' || value === null) {
        issues?.push(`${path}: expected a channel object`)
        return undefined
      }

      const candidate = value as Record<string, unknown>
      if (!hasSafeScheme(key)) {
        issues?.push(`${path}: unsafe id`)
        return undefined
      }

      const url = candidate.url === undefined ? '' : candidate.url
      if (typeof url !== 'string' || (url && !hasSafeScheme(url))) {
        issues?.push(`${path}.url: expected a safe url`)
        return undefined
      }

      if (candidate.videos !== undefined && !Array.isArray(candidate.videos)) {
        issues?.push(`${path}.videos: expected an array`)
      }

      if (candidate.name !== undefined && typeof candidate.name !== 'string') {
        issues?.push(`${path}.name: expected a string`)
      }

      if (candidate.displayName !== undefined && typeof candidate.displayName !== 'string') {
        issues?.push(`${path}.displayName: expected a string`)
      }

      const videos = parseStoredVideos(candidate.videos)
      if (Array.isArray(candidate.videos) && videos.length !== candidate.videos.length) {
        issues?.push(`${path}.videos: contains invalid entries`)
      }

      const channel: Channel = {
        url,
        name: typeof candidate.name === 'string' ? candidate.name : '',
        displayName: typeof candidate.displayName === 'string' ? candidate.displayName : '',
        // Persisted feeds keep their cached videos across reloads; exported
        // files have none, so this is usually empty.
        videos
      }

      return [this.#tryParse(key)?.id || key, channel] as [string, Channel]
    })

    return new Map(entries)
  }
}

// Cached videos are persisted alongside channels (see saveOnUpdate), so keep
// well-formed ones to avoid an empty feed flash on boot. Anything malformed is
// dropped rather than breaking rendering/sorting.
function parseStoredVideos(value: unknown): Video[] {
  if (!Array.isArray(value)) return []

  return value.flatMap(video => {
    if (typeof video !== 'object' || video === null) return []

    const candidate = video as Record<string, unknown>
    if (
      typeof candidate.url !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.thumbnail !== 'string' ||
      typeof candidate.duration !== 'string' ||
      typeof candidate.uploadedDate !== 'string' ||
      typeof candidate.uploaded !== 'number' ||
      !Number.isFinite(candidate.uploaded)
    ) return []

    return [{
      url: candidate.url,
      title: candidate.title,
      thumbnail: candidate.thumbnail,
      duration: candidate.duration,
      uploaded: candidate.uploaded,
      uploadedDate: candidate.uploadedDate
    }]
  })
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
export const channels = writable<Map<string, Channel>>(Channels.parseStored(stored))
// Memory-only, like feeds' parsed entries: the latest fetch attempt's error
// per channel id. Loading lives in status.feed.fetching.now, so this map only
// tracks failures.
export const channelStates = writable<Map<string, { error: string }>>(new Map())
