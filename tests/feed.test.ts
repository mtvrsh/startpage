import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchFeed, parseFeed } from '../src/util/feed'
import { config, defaults } from '../src/share/config'

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <title>Hello &amp; welcome</title>
    <link rel="alternate" href="posts/hello.html"/>
    <published>2026-01-02T03:04:05Z</published>
    <summary type="html">&lt;p&gt;A &lt;strong&gt;short&lt;/strong&gt; summary.&lt;/p&gt;</summary>
  </entry>
  <entry>
    <title>Second post</title>
    <link href="https://example.com/second"/>
    <updated>2026-01-03T00:00:00Z</updated>
    <content type="html">&lt;p&gt;Second body&lt;/p&gt;</content>
  </entry>
</feed>`

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Example RSS</title>
    <item>
      <title>RSS post</title>
      <link>https://example.com/rss-post</link>
      <pubDate>2026-02-04T05:06:07Z</pubDate>
      <description><![CDATA[<p>Body <b>here</b></p>]]></description>
    </item>
  </channel>
</rss>`

afterEach(() => {
  vi.unstubAllGlobals()
  config.update(current => ({ ...current, feedProxyUrl: defaults.feedProxyUrl }))
})

const RDF = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.com/">
    <title>Example RDF</title>
  </channel>
  <item rdf:about="https://example.com/rdf-post">
    <title>RDF post</title>
    <link>https://example.com/rdf-post</link>
    <dc:date>2026-03-05T00:00:00Z</dc:date>
    <description>RDF body</description>
  </item>
</rdf:RDF>`

describe('parseFeed', () => {
  test('parses Atom entries and resolves relative links', () => {
    const feed = parseFeed(ATOM, 'https://example.com/blog/atom.xml')

    expect(feed.title).toBe('Example Atom')
    expect(feed.entries).toHaveLength(2)
    expect(feed.entries[0]).toEqual({
      url: 'https://example.com/blog/posts/hello.html',
      title: 'Hello & welcome',
      summary: 'A short summary.',
      published: Date.parse('2026-01-02T03:04:05Z')
    })
    expect(feed.entries[1].url).toBe('https://example.com/second')
    expect(feed.entries[1].summary).toBe('Second body')
    expect(feed.entries[1].published).toBe(Date.parse('2026-01-03T00:00:00Z'))
  })

  test('parses RSS 2.0 entries and strips HTML from descriptions', () => {
    const feed = parseFeed(RSS, 'https://example.com/rss.xml')

    expect(feed.title).toBe('Example RSS')
    expect(feed.entries).toHaveLength(1)
    expect(feed.entries[0]).toEqual({
      url: 'https://example.com/rss-post',
      title: 'RSS post',
      summary: 'Body here',
      published: Date.parse('2026-02-04T05:06:07Z')
    })
  })

  test('parses RSS 1.0/RDF feeds', () => {
    const feed = parseFeed(RDF, 'https://example.com/rdf.xml')

    expect(feed.title).toBe('Example RDF')
    expect(feed.entries).toHaveLength(1)
    expect(feed.entries[0].title).toBe('RDF post')
    expect(feed.entries[0].published).toBe(Date.parse('2026-03-05T00:00:00Z'))
  })

  test('rejects links with non-http protocols', () => {
    const feed = parseFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom">
        <title>Unsafe</title>
        <entry>
          <title>Click me</title>
          <link href="javascript:alert(1)"/>
        </entry>
      </feed>`,
      'https://example.com/atom.xml'
    )

    expect(feed.entries[0].url).toBe('')
  })

  test('uses the hostname when the feed has no title', () => {
    const feed = parseFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>One</title></entry></feed>`,
      'https://example.com/atom.xml'
    )

    expect(feed.title).toBe('example.com')
  })

  test('throws on malformed XML', () => {
    expect(() => parseFeed('<feed><title>Broken</title>', 'https://example.com')).toThrow()
  })

  test('throws on unsupported documents', () => {
    expect(() => parseFeed('<html><body>Hello</body></html>', 'https://example.com')).toThrow('Unsupported feed format')
  })
})

describe('fetchFeed', () => {
  test('defaults to the startpage worker proxy', () => {
    expect(defaults.feedProxyUrl).toBe('https://startpage-api.mtvrs.workers.dev')
  })

  test('routes requests through the configured proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ATOM
    })
    vi.stubGlobal('fetch', fetchMock)
    config.update(current => ({ ...current, feedProxyUrl: 'https://proxy.example/' }))

    const feed = await fetchFeed('https://example.com/atom.xml')

    expect(feed.title).toBe('Example Atom')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example/feed?url=https%3A%2F%2Fexample.com%2Fatom.xml',
      expect.objectContaining({ cache: 'default' })
    )
  })

  test('fetches directly when the proxy URL is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ATOM
    })
    vi.stubGlobal('fetch', fetchMock)
    config.update(current => ({ ...current, feedProxyUrl: '' }))

    await fetchFeed('https://example.com/atom.xml')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/atom.xml',
      expect.objectContaining({ cache: 'default' })
    )
  })

  test('uses the worker error message from a JSON error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Private network feed URLs are not allowed' })
    }))

    await expect(fetchFeed('https://example.com/atom.xml'))
      .rejects.toThrow('Private network feed URLs are not allowed')
  })
})
