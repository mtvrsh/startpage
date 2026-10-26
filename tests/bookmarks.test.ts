import { beforeEach, describe, expect, test, vi } from 'vitest'
import { get } from 'svelte/store'
import Bookmarks, { bookmarks, parseStoredBookmarks, type Bookmark } from '../src/share/bookmarks'

const first: Bookmark = {
  url: 'https://example.com/first',
  name: 'First',
  tag: 'one'
}

const second: Bookmark = {
  url: 'https://example.com/second',
  name: 'Second',
  tag: 'two'
}

beforeEach(() => Bookmarks.restore([]))

describe('update', () => {
  test('merges name and tag into an existing bookmark', () => {
    Bookmarks.set(first)

    Bookmarks.update(first.url, { name: 'Renamed', tag: 'new-tag' })

    expect(get(bookmarks).get(first.url)).toEqual({
      ...first,
      name: 'Renamed',
      tag: 'new-tag'
    })
  })

  test('keeps the original URL when a partial contains one', () => {
    Bookmarks.set(first)

    Bookmarks.update(first.url, { url: 'https://example.com/elsewhere' })

    expect(get(bookmarks).has(first.url)).toBe(true)
    expect(get(bookmarks).has('https://example.com/elsewhere')).toBe(false)
  })

  test('ignores unknown bookmarks', () => {
    Bookmarks.update(first.url, { name: 'Renamed' })

    expect(get(bookmarks).size).toBe(0)
  })
})

describe('replace', () => {
  test('rekeys a bookmark to a new URL', () => {
    Bookmarks.set(first)

    const next = { ...first, url: 'https://example.com/renamed' }

    expect(Bookmarks.replace(first.url, next)).toBe(true)
    expect(get(bookmarks).has(first.url)).toBe(false)
    expect(get(bookmarks).get(next.url)).toEqual(next)
  })

  test('refuses to overwrite another bookmark', () => {
    Bookmarks.set(first)
    Bookmarks.set(second)

    expect(Bookmarks.replace(first.url, { ...first, url: second.url })).toBe(false)
    expect(get(bookmarks).get(first.url)).toEqual(first)
    expect(get(bookmarks).get(second.url)).toEqual(second)
  })

  test('refuses to replace an unknown bookmark', () => {
    expect(Bookmarks.replace(first.url, first)).toBe(false)
    expect(get(bookmarks).size).toBe(0)
  })
})

describe('parseStoredBookmarks', () => {
  test('keeps well-formed [url, bookmark] pairs', () => {
    localStorage.setItem('bookmarks', JSON.stringify([[first.url, first]]))

    expect([...parseStoredBookmarks()]).toEqual([[first.url, first]])
  })

  test('drops entries of unexpected shape instead of throwing', () => {
    for (const junk of [
      '"garbage"',
      '{"a":1}',
      '[[1, 2]]',
      '[[null, null]]',
      '[[" url", "not an object"]]',
      '[["url", {"url": 42, "name": "x", "tag": "y"}]]',
      '["not a pair"]',
    ]) {
      localStorage.setItem('bookmarks', junk)
      expect(parseStoredBookmarks().size).toBe(0)
    }
  })

  test('returns an empty map for corrupt JSON without throwing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('bookmarks', '{corrupt')

    expect(parseStoredBookmarks().size).toBe(0)
    expect(error).toHaveBeenCalled()

    error.mockRestore()
  })
})
