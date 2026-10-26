import { beforeEach, describe, expect, test } from 'vitest'
import { get } from 'svelte/store'
import { hasSafeScheme, safeHref } from '../src/util/scheme'
import Bookmarks, { bookmarks } from '../src/share/bookmarks'
import { Channels, channels } from '../src/share/channels'

describe('hasSafeScheme', () => {
  test.each([
    'https://example.com',
    'http://example.com',
    'HTTPS://example.com',
    'magnet:?xt=urn:btih:abc',
    'example.com/foo',
    '/relative/path',
    'foo/bar?x=y:z'
  ])('accepts %s', url => {
    expect(hasSafeScheme(url)).toBe(true)
    expect(safeHref(url)).toBe(url)
  })

  test.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    '',
    '   '
  ])('rejects %s', url => {
    expect(hasSafeScheme(url)).toBe(false)
    expect(safeHref(url)).toBeUndefined()
  })

  test('rejects data: URLs', () => {
    expect(hasSafeScheme('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(safeHref('data:text/html,<p>hi</p>')).toBeUndefined()
  })

  test('rejects mailto: and ftp:', () => {
    expect(hasSafeScheme('mailto:user@example.com')).toBe(false)
    expect(hasSafeScheme('ftp://example.com/file')).toBe(false)
  })

  test('rejects an unsafe custom protocol composed over a safe URL', () => {
    expect(hasSafeScheme('javascript:https://youtube.com/watch?v=x')).toBe(false)
    expect(hasSafeScheme('ja:va:https://youtube.com/watch?v=x')).toBe(false)
  })
})

describe('Bookmarks.restore', () => {
  beforeEach(() => Bookmarks.restore([]))

  test('drops bookmarks with unsafe schemes', () => {
    Bookmarks.restore([
      ['https://example.com/ok', { url: 'https://example.com/ok', tag: 'one', name: 'Ok' }],
      ['javascript:alert(1)', { url: 'javascript:alert(1)', tag: 'one', name: 'Bad' }],
      ['data:text/html,x', { url: 'data:text/html,x', tag: 'one', name: 'Bad' }]
    ])

    const restored = get(bookmarks)

    expect(restored.size).toBe(1)
    expect(restored.has('https://example.com/ok')).toBe(true)
  })
})

describe('Channels.restore', () => {
  beforeEach(() => Channels.restore([]))

  test('drops channels with unsafe schemes', () => {
    Channels.restore([
      ['https://youtube.com/@ok', { url: 'https://youtube.com/@ok', name: 'ok', displayName: 'Ok' }],
      ['https://youtube.com/@bad', { url: 'javascript:alert(1)', name: 'bad', displayName: 'Bad' }],
      ['javascript:alert(1)', { url: 'javascript:alert(1)', name: 'bad', displayName: 'Bad' }]
    ])

    const restored = get(channels)

    expect(restored.size).toBe(1)
    expect(restored.get('@ok')?.url).toBe('https://youtube.com/@ok')
  })
})
