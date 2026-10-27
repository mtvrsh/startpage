import { describe, expect, test } from 'vitest'
import { getDirectThumbnail, isChannelId } from '../src/util/youtube'

describe('isChannelId', () => {
  test('accepts UC ids with 22 characters after the prefix', () => {
    expect(isChannelId('UC1234567890abcdefghijkl')).toBe(true)
    expect(isChannelId('UC_x5XG1OV2P6uZZ5FSM9Ttw')).toBe(true)
  })

  test('rejects handles, playlists, and near-miss ids', () => {
    expect(isChannelId('@foo')).toBe(false)
    expect(isChannelId('PL1234567890abcdefghijkl')).toBe(false)
    expect(isChannelId('UC1234567890abcdefghijk')).toBe(false)
    expect(isChannelId('UC1234567890abcdefghijklm')).toBe(false)
    expect(isChannelId('legacyFoo')).toBe(false)
    expect(isChannelId('')).toBe(false)
  })
})

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
