import { get, writable } from 'svelte/store'
import { LocalStorage } from '../util/storage'
import { readPairs } from '../util/validate'
import { config } from './config'
import { fetchFeed } from '../util/feed'

export interface Feed {
  url: string
  name: string
}

export interface FeedEntry {
  url: string
  title: string
  summary: string
  published: number
  feedUrl: string
  feedName: string
}

export interface FeedState {
  loading: boolean
  error: string
  fetchedAt: number
}

export class Feeds extends LocalStorage {
  static LS_NAME = 'feeds'

  static saveOnUpdate() {
    feeds.subscribe(feedMap => super.set([...feedMap]))
  }

  static add(url: string, name = ''): Promise<void> {
    const normalized = this.#normalizeUrl(url)
    if (!normalized)
      return Promise.reject(new Error('Invalid feed URL'))

    feeds.update(feedMap => new Map(feedMap).set(normalized, { url: normalized, name: name.trim() }))
    return this.refresh(normalized, { reload: true })
  }

  static remove(url: string) {
    feeds.update(feedMap => {
      const next = new Map(feedMap)
      next.delete(url)
      return next
    })
    entries.update(list => list.filter(entry => entry.feedUrl !== url))
    feedStates.update(states => {
      const next = new Map(states)
      next.delete(url)
      return next
    })
  }

  static update(url: string, partial: Partial<Feed>) {
    feeds.update(feedMap => {
      const feed = feedMap.get(url)
      if (!feed) return feedMap

      return new Map(feedMap).set(url, { ...feed, ...partial })
    })
  }

  static rename(url: string, name: string) {
    if (!get(feeds).has(url)) return

    const nextName = name.trim()
    this.update(url, { name: nextName })

    const feedName = nextName || this.#hostname(url)
    entries.update(list => list.map(entry =>
      entry.feedUrl === url ? { ...entry, feedName } : entry
    ))
  }

  static refetch({ reload = false } = {}): Promise<void> {
    return Promise.all(
      [...get(feeds).keys()].map(url => this.refresh(url, { reload }))
    ).then(() => {})
  }

  static refresh(url: string, { reload = false } = {}): Promise<void> {
    const current = get(feedStates).get(url)
    const lifetime = get(config).cacheLifetimeInMinutes * 60_000

    if (!reload && current && !current.error && Date.now() - current.fetchedAt < lifetime)
      return Promise.resolve()

    this.#setState(url, {
      loading: true,
      error: '',
      fetchedAt: current?.fetchedAt ?? 0
    })

    return fetchFeed(url, {
      reload,
      timeoutInMs: get(config).timeoutInSeconds * 1000
    })
      .then(parsed => {
        // The feed may have been removed while its request was in flight.
        if (!get(feeds).has(url)) return

        const feed = get(feeds).get(url)
        const name = feed?.name || parsed.title || this.#hostname(url)

        if (feed && !feed.name)
          this.update(url, { name })

        entries.update(list => [
          ...list.filter(entry => entry.feedUrl !== url),
          ...parsed.entries.map(entry => ({
            ...entry,
            feedUrl: url,
            feedName: name
          }))
        ])

        this.#setState(url, { loading: false, error: '', fetchedAt: Date.now() })
      })
      .catch(error => {
        if (!get(feeds).has(url)) return

        this.#setState(url, {
          loading: false,
          error: error instanceof Error ? error.message : String(error),
          fetchedAt: 0
        })
      })
  }

  static #setState(url: string, state: FeedState) {
    feedStates.update(states => new Map(states).set(url, state))
  }

  static #normalizeUrl(value: string): string {
    try {
      const url = new URL(value.trim())
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
    } catch {
      return ''
    }
  }

  static #hostname(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  static serialize() {
    return [...get(feeds)]
  }

  static restore(data: unknown) {
    feeds.set(data instanceof Map ? new Map(data) : this.parseStored(data))
    entries.set([])
    feedStates.set(new Map())
  }

  /**
   * Validates a serialized/imported feed list. Never throws: malformed pairs
   * are skipped, URLs must be http(s) (the proxy/fetch target), and entries are
   * re-keyed by the normalized URL so key === url holds. Shared by hydration
   * and restore.
   */
  static parseStored(raw: unknown, issues?: string[]): Map<string, Feed> {
    const entries = readPairs(raw, 'feeds', issues, (key, value, path) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        issues?.push(`${path}: expected a feed object`)
        return undefined
      }

      const candidate = value as Record<string, unknown>
      if (candidate.url !== undefined && typeof candidate.url !== 'string') {
        issues?.push(`${path}.url: expected a string`)
      }

      // A missing/blank url falls back to the serialized key, which is where it
      // came from; strictly malformed values are reported above.
      const candidateUrl = typeof candidate.url === 'string' && candidate.url.trim()
        ? candidate.url
        : key
      const url = this.#normalizeUrl(candidateUrl)
      if (!url) {
        issues?.push(`${path}: missing or invalid http(s) url`)
        return undefined
      }

      if (candidate.name !== undefined && typeof candidate.name !== 'string') {
        issues?.push(`${path}.name: expected a string`)
      }

      return [url, {
        url,
        name: typeof candidate.name === 'string' ? candidate.name : ''
      }] as [string, Feed]
    })

    return new Map(entries)
  }
}

const initial = Feeds.parseStored(Feeds.get())

export const feeds = writable<Map<string, Feed>>(initial)
export const entries = writable<FeedEntry[]>([])
export const feedStates = writable<Map<string, FeedState>>(new Map())
