import { writable, get } from 'svelte/store';
import { hasSafeScheme } from '../util/scheme'

export type URL = string

export interface Bookmark {
  url: URL;
  tag: string;
  name: string;
}

export const bookmarks = writable<Map<URL, Bookmark>>(parseStoredBookmarks())

// Like LocalStorage.get(): never let a corrupt (or unexpected-shape)
// localStorage entry throw at module scope — that would brick app boot.
// Unparseable or malformed data degrades to an empty map.
export function parseStoredBookmarks(): Map<URL, Bookmark> {
  let parsed: unknown

  try {
    parsed = JSON.parse(localStorage['bookmarks'] || '[]')
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('Failed to parse bookmarks local storage')
      return new Map()
    }
    throw e
  }

  if (!Array.isArray(parsed)) return new Map()

  const pairs: [URL, Bookmark][] = []
  for (const value of parsed) {
    if (!Array.isArray(value) || value.length !== 2) continue

    const [url, bookmark] = value
    if (typeof url !== 'string') continue

    const parsedBookmark = parseStoredBookmark(bookmark)
    if (parsedBookmark) pairs.push([url, parsedBookmark])
  }

  return new Map(pairs)
}

// Validates one stored/exported bookmark value. Malformed defaults are
// dropped, missing tag/name degrade to '' so downstream consumers
// (grouping, localeCompare) never see undefined.
function parseStoredBookmark(bookmark: unknown): Bookmark | undefined {
  if (bookmark === null || typeof bookmark !== 'object') return undefined

  const candidate = bookmark as Record<string, unknown>
  if (typeof candidate.url !== 'string') return undefined

  return {
    url: candidate.url,
    tag: typeof candidate.tag === 'string' ? candidate.tag : '',
    name: typeof candidate.name === 'string' ? candidate.name : ''
  }
}

export default class Bookmarks {
  static LS_CACHE = 'bookmarks'

  static set(bookmark: Bookmark) {
    bookmarks.update(v => v.set(bookmark.url, bookmark))
  }

  static update(url: URL, partial: Partial<Bookmark>) {
    bookmarks.update(v => {
      const bookmark = v.get(url)

      if (!bookmark) return v

      return new Map(v).set(url, { ...bookmark, ...partial, url })
    })
  }

  static replace(url: URL, bookmark: Bookmark): boolean {
    const current = get(bookmarks)

    if (!current.has(url)) return false
    if (bookmark.url !== url && current.has(bookmark.url)) return false

    bookmarks.update(v => {
      const next = new Map(v)

      next.delete(url)
      next.set(bookmark.url, bookmark)

      return next
    })

    return true
  }

  static delete(url: URL) {
    bookmarks.update(v => {
      v.delete(url)
      return v
    })
  }

  static subscribeToLocalStorage() {
    bookmarks.subscribe(v =>
      localStorage[this.LS_CACHE] = JSON.stringify(v, (_, value) => 
        value instanceof Map ? [...value] : value
      )
    )
  }

  static serialize() {
    return [...get(bookmarks)]
  }

  static restore(data: [URL, Bookmark][]) {
    const pairs: [URL, Bookmark][] = []

    for (const value of Array.isArray(data) ? data : []) {
      if (!Array.isArray(value) || value.length !== 2) continue

      const [url, bookmarkValue] = value
      if (typeof url !== 'string') continue

      const bookmark = parseStoredBookmark(bookmarkValue)
      if (bookmark && hasSafeScheme(url)) pairs.push([url, bookmark])
    }

    bookmarks.set(new Map(pairs))
  }
}
