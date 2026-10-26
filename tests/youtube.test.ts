import { describe, expect, test } from 'vitest'
import { getDirectThumbnail } from '../src/util/youtube'

describe('getDirectThumbnail', () => {
  test('rewrites a Piped proxied thumbnail to its direct YouTube host', () => {
    expect(getDirectThumbnail('https://pipedproxy.kavin.rocks/vi/abc/hqdefault.jpg?host=i.ytimg.com&foo=bar'))
      .toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg?foo=bar')
  })

  test('accepts YouTube image hosts (case-insensitively, with trailing dot)', () => {
    expect(getDirectThumbnail('https://proxy.example/vi/abc.jpg?host=I9.YTIMG.com.'))
      .toBe('https://I9.YTIMG.com./vi/abc.jpg')
    expect(getDirectThumbnail('https://proxy.example/av.jpg?host=yt3.ggpht.com'))
      .toBe('https://yt3.ggpht.com/av.jpg')
  })

  test('keeps the proxied URL when the host is not a YouTube image host', () => {
    const url = 'https://pipedproxy.kavin.rocks/vi/abc/hqdefault.jpg?host=evil.example&foo=bar'
    expect(getDirectThumbnail(url)).toBe(url)
  })

  test('passes through URLs without a host parameter', () => {
    expect(getDirectThumbnail('https://i.ytimg.com/vi/abc/hqdefault.jpg'))
      .toBe('https://i.ytimg.com/vi/abc/hqdefault.jpg')
  })

  test('passes through malformed URLs', () => {
    expect(getDirectThumbnail('not a url')).toBe('not a url')
  })
})
