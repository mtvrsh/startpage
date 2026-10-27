import { writable, get } from 'svelte/store';
import { hasSafeScheme } from '../util/scheme'
import { readPairs } from '../util/validate'

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

  return parseBookmarks(parsed)
}

/**
 * Validates a serialized/imported bookmark list. Never throws: malformed
 * entries are skipped and entries are re-keyed by bookmark.url so the
 * key === bookmark.url invariant holds. Shared by hydration and restore.
 */
export function parseBookmarks(raw: unknown, issues?: string[]): Map<URL, Bookmark> {
  const pairs = readPairs(raw, 'bookmarks', issues, (_key, value, path) => {
    const bookmark = parseStoredBookmark(value, path, issues)
    if (!bookmark) return undefined

    // In strict mode (import) an unsafe URL rejects the payload; otherwise
    // hydration keeps it and restore() filters it out.
    if (issues && !hasSafeScheme(bookmark.url)) {
      issues.push(`${path}: unsafe url`)
      return undefined
    }

    // A mismatched serialized key cannot be edited or deleted through the UI,
    // so it is re-keyed by bookmark.url.
    return [bookmark.url, bookmark] as [URL, Bookmark]
  })

  return new Map(pairs)
}

// Validates one stored/exported bookmark value. Malformed values are dropped,
// missing tag/name degrade to '' so downstream consumers (grouping,
// localeCompare) never see undefined, and malformed fields are reported in
// strict mode (import) instead of being silently coerced.
function parseStoredBookmark(
  bookmark: unknown,
  path: string,
  issues?: string[]
): Bookmark | undefined {
  if (bookmark === null || typeof bookmark !== 'object' || Array.isArray(bookmark)) {
    issues?.push(`${path}: expected a bookmark object`)
    return undefined
  }

  const candidate = bookmark as Record<string, unknown>
  if (typeof candidate.url !== 'string') {
    issues?.push(`${path}.url: expected a string`)
    return undefined
  }

  if (candidate.tag !== undefined && typeof candidate.tag !== 'string')
    issues?.push(`${path}.tag: expected a string`)

  if (candidate.name !== undefined && typeof candidate.name !== 'string')
    issues?.push(`${path}.name: expected a string`)

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

  static restore(data: unknown) {
    const parsed = data instanceof Map ? new Map(data) : parseBookmarks(data)

    // Imported data is untrusted: only keep entries whose URL is safe to store.
    bookmarks.set(new Map(
      [...parsed].filter(([, bookmark]) => hasSafeScheme(bookmark.url))
    ))
  }
}
