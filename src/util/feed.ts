import { get } from 'svelte/store'
import { config } from '../share/config'

export interface ParsedEntry {
  url: string
  title: string
  summary: string
  published: number
}

export interface ParsedFeed {
  title: string
  entries: ParsedEntry[]
}

const EMPTY_PUBLISHED = 0
const SUMMARY_LIMIT = 400

function childrenNamed(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter(child => child.localName === name)
}

function firstChildNamed(parent: Element, ...names: string[]): Element | undefined {
  for (const name of names) {
    const child = childrenNamed(parent, name)[0]
    if (child) return child
  }
}

function text(element: Element | undefined): string {
  return element?.textContent?.trim() ?? ''
}

function resolveUrl(href: string, baseUrl: string): string {
  if (!href) return ''

  try {
    const url = new URL(href, baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function parseDate(value: string): number {
  if (!value) return EMPTY_PUBLISHED

  const time = Date.parse(value)
  return Number.isNaN(time) ? EMPTY_PUBLISHED : time
}

function summaryText(element: Element | undefined): string {
  if (!element) return ''

  const decoded = element.textContent ?? ''
  // Atom/RSS payloads are XML-escaped, so HTML arrives as text content.
  // Parse it as HTML to drop tags before anything reaches the template.
  const plain = /<[a-z!/][^>]*>/i.test(decoded)
    ? new DOMParser().parseFromString(decoded, 'text/html').body.textContent ?? ''
    : decoded

  return plain.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_LIMIT)
}

function fallbackTitle(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname
  } catch {
    return baseUrl
  }
}

function atomLink(entry: Element, baseUrl: string): string {
  const links = childrenNamed(entry, 'link')
  const preferred = links.find(link => {
    const rel = link.getAttribute('rel')
    return (!rel || rel === 'alternate') && link.getAttribute('href')
  }) ?? links.find(link => link.getAttribute('href'))

  return resolveUrl(preferred?.getAttribute('href') ?? '', baseUrl)
}

function rssLink(item: Element, baseUrl: string): string {
  const link = text(firstChildNamed(item, 'link'))
  if (link) return resolveUrl(link, baseUrl)

  const guid = firstChildNamed(item, 'guid')
  if (guid && guid.getAttribute('isPermaLink') !== 'false')
    return resolveUrl(text(guid), baseUrl)

  return ''
}

function parseAtom(root: Element, baseUrl: string): ParsedFeed {
  const title = text(firstChildNamed(root, 'title')) || fallbackTitle(baseUrl)

  const entryElements = childrenNamed(root, 'entry').length
    ? childrenNamed(root, 'entry')
    : Array.from(root.getElementsByTagNameNS('*', 'entry'))

  const entries = entryElements.flatMap(entry => {
    const url = atomLink(entry, baseUrl)
    const entryTitle = text(firstChildNamed(entry, 'title')) || url
    if (!url && !entryTitle) return []

    return [{
      url,
      title: entryTitle,
      summary: summaryText(firstChildNamed(entry, 'summary', 'content')),
      published: parseDate(text(firstChildNamed(entry, 'published', 'updated')))
    }]
  })

  return { title, entries }
}

function parseRss(root: Element, baseUrl: string): ParsedFeed {
  const channel = firstChildNamed(root, 'channel') ?? root
  const title = text(firstChildNamed(channel, 'title')) || fallbackTitle(baseUrl)

  // RSS 1.0/RDF keeps <item> next to <channel>, RSS 2.0 nests it inside.
  const itemParent = root.localName === 'RDF' ? root : channel
  const itemElements = childrenNamed(itemParent, 'item').length
    ? childrenNamed(itemParent, 'item')
    : Array.from(root.getElementsByTagNameNS('*', 'item'))

  const entries = itemElements.flatMap(item => {
    const url = rssLink(item, baseUrl)
    const entryTitle = text(firstChildNamed(item, 'title')) || url
    if (!url && !entryTitle) return []

    return [{
      url,
      title: entryTitle,
      summary: summaryText(firstChildNamed(item, 'description', 'encoded', 'summary')),
      published: parseDate(text(firstChildNamed(item, 'pubDate', 'date', 'published', 'updated')))
    }]
  })

  return { title, entries }
}

function isParserError(document: Document): boolean {
  return document.documentElement.localName === 'parsererror'
    || document.getElementsByTagName('parsererror').length > 0
    || document.querySelector('parsererror') !== null
}

export function parseFeed(xml: string, baseUrl: string): ParsedFeed {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (isParserError(document))
    throw new Error('Feed is not valid XML')

  const root = document.documentElement
  const rootName = root.localName

  if (rootName === 'feed')
    return parseAtom(root, baseUrl)

  if (rootName === 'rss' || rootName === 'RDF' || rootName === 'rdf')
    return parseRss(root, baseUrl)

  // Tolerate feeds wrapped in an unexpected root element.
  if (root.getElementsByTagNameNS('*', 'entry').length)
    return parseAtom(root, baseUrl)

  if (root.getElementsByTagNameNS('*', 'item').length)
    return parseRss(root, baseUrl)

  throw new Error('Unsupported feed format')
}

export async function fetchFeedXml(
  url: string,
  { reload = false, timeoutInMs = 5000 } = {}
): Promise<string> {
  const proxy = get(config).feedProxyUrl.trim().replace(/\/+$/, '')
  const target = proxy
    ? `${proxy}/feed?url=${encodeURIComponent(url)}`
    : url

  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutInMs)
    : undefined

  const response = await fetch(target, {
    cache: reload ? 'reload' : 'default',
    signal
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = await response.json() as { error?: unknown }
      if (typeof body.error === 'string' && body.error)
        message = body.error
    } catch {
      // Error responses are not always JSON (for example when proxying is off).
    }
    throw new Error(message)
  }

  return response.text()
}

export async function fetchFeed(
  url: string,
  options: { reload?: boolean; timeoutInMs?: number } = {}
): Promise<ParsedFeed> {
  const xml = await fetchFeedXml(url, options)
  return parseFeed(xml, url)
}
