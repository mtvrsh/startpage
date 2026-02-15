import { writable } from 'svelte/store';

export type URL = string

export interface Bookmark {
  url: URL;
  tag: string;
  name: string;
  use: boolean;
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

  static update(url: URL, partial: Bookmark) {
    bookmarks.update(v => v.set(url, {...v.get(url), ...partial}))
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
}
