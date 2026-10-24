import { writable, get } from 'svelte/store';

export type URL = string

export interface Bookmark {
  url: URL;
  tag: string;
  name: string;
}

export const bookmarks = writable<Map<URL, Bookmark>>(
  new Map(
    JSON.parse(localStorage['bookmarks'] || '[]')
  )
)

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
    bookmarks.set(new Map(data))
  }
}
