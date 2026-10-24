const FEED_TIMEOUT_MS = 10_000
const FEED_MAX_BYTES = 2 * 1024 * 1024
const FEED_MAX_URL_LENGTH = 2048
const FEED_MAX_REDIRECTS = 4

const FEED_ACCEPT = [
  'application/atom+xml',
  'application/rss+xml',
  'application/rdf+xml',
  'application/xml',
  'text/xml',
  'application/xhtml+xml',
].join(', ')

const FEED_CONTENT_TYPES = new Set([
  'application/atom+xml',
  'application/rss+xml',
  'application/rdf+xml',
  'application/xml',
  'text/xml',
  'application/xhtml+xml',
])

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const PRIVATE_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.intranet',
  '.home.arpa',
  '.lan',
]

export class ProxyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ProxyError'
  }
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4 || !parts.every(part => /^\d{1,3}$/.test(part)))
    return null

  const numbers = parts.map(Number)
  return numbers.every(number => number <= 255) ? numbers : null
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b, c] = octets

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
}

function isPrivateIpv6(hostname: string): boolean {
  if (hostname === '::' || hostname === '::1')
    return true

  const firstGroup = hostname.split(':')[0]
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup))
    return true
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup))
    return true
  if (/^ff[0-9a-f]{2}$/.test(firstGroup))
    return true

  // IPv4-mapped addresses.
  if (hostname.startsWith('::ffff:') || hostname.startsWith('::ffff:0:')
    || hostname.startsWith('0:0:0:0:0:ffff:'))
    return true

  // IPv4-compatible addresses such as ::127.0.0.1, which URL normalises
  // to a hex tail like ::7f00:1.
  const compatible = hostname.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (compatible) {
    const high = parseInt(compatible[1], 16)
    const low = parseInt(compatible[2], 16)
    return isPrivateIpv4([high >> 8, high & 255, low >> 8, low & 255])
  }

  return false
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host)
    return true

  if (host === 'localhost' || PRIVATE_HOST_SUFFIXES.some(suffix => host.endsWith(suffix)))
    return true

  if (host.includes(':'))
    return isPrivateIpv6(host)

  const octets = parseIpv4(host)
  return octets ? isPrivateIpv4(octets) : false
}

export function validateFeedUrl(raw: string): URL {
  if (!raw || raw.length > FEED_MAX_URL_LENGTH)
    throw new ProxyError('Invalid feed URL', 400)

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ProxyError('Invalid feed URL', 400)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new ProxyError('Only http and https feed URLs are allowed', 400)
  if (url.username || url.password)
    throw new ProxyError('Feed URL must not include credentials', 400)
  if (url.port === '0')
    throw new ProxyError('Invalid feed URL', 400)
  if (isPrivateHost(url.hostname))
    throw new ProxyError('Private network feed URLs are not allowed', 403)

  return url
}

export function isFeedContentType(value: string | null): boolean {
  if (!value)
    return false

  const mime = value.split(';', 1)[0].trim().toLowerCase()
  return FEED_CONTENT_TYPES.has(mime)
}

export async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body)
    return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      total += value.byteLength
      if (total > limit) {
        await reader.cancel().catch(() => {})
        throw new ProxyError('Feed is larger than 2 MB', 413)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof ProxyError) throw error
    throw new ProxyError('Failed to read feed', 502)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === 'TimeoutError' || name === 'AbortError'
}

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => {})
}

export async function feedProxy(
  searchParams: URLSearchParams,
  cors: Record<string, string>
): Promise<Response> {
  const rawUrl = searchParams.get('url')
  if (!rawUrl)
    throw new ProxyError('url parameter is required', 400)

  let target = validateFeedUrl(rawUrl)
  const signal = AbortSignal.timeout(FEED_TIMEOUT_MS)
  let response: Response | null = null

  for (let redirects = 0; ; redirects++) {
    try {
      response = await fetch(target.href, {
        redirect: 'manual',
        signal,
        headers: {
          Accept: FEED_ACCEPT,
          'User-Agent': 'startpage-feed-proxy/1.0',
        },
      })
    } catch (error) {
      if (isTimeoutError(error))
        throw new ProxyError('Feed request timed out', 504)
      throw new ProxyError('Failed to fetch feed', 502)
    }

    if (!REDIRECT_STATUSES.has(response.status))
      break

    const location = response.headers.get('location')
    await cancelBody(response)
    if (!location)
      throw new ProxyError('Feed redirected without a location', 502)
    if (redirects >= FEED_MAX_REDIRECTS)
      throw new ProxyError('Too many redirects', 502)

    try {
      target = validateFeedUrl(new URL(location, target).href)
    } catch (error) {
      if (error instanceof ProxyError) throw error
      throw new ProxyError('Invalid redirect location', 502)
    }
  }

  if (!response.ok) {
    const status = response.status
    await cancelBody(response)
    throw new ProxyError(`Feed request failed with HTTP ${status}`, 502)
  }

  const contentType = response.headers.get('content-type')
  if (!isFeedContentType(contentType)) {
    await cancelBody(response)
    throw new ProxyError('Feed URL did not return an XML feed', 415)
  }

  const body = await readLimited(response, FEED_MAX_BYTES)

  return new Response(body.buffer as ArrayBuffer, {
    headers: {
      ...cors,
      'Content-Type': contentType ?? 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
