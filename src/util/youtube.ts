// The Piped API rewrites YouTube thumbnails to `https://<pipedproxy>/…?host=i.ytimg.com`,
// where `host` names the original image host. Only YouTube image hosts are
// ever legitimate here; without an allowlist the `host` param would let a
// malicious or compromised Piped instance redirect image loads to an
// arbitrary server (tracking pixel, IP referrer leak).
const TRUSTED_HOST_SUFFIXES = ['ytimg.com', 'ggpht.com', 'googleusercontent.com']

function isTrustedHost(host: string): boolean {
  const normal = host.toLowerCase().replace(/\.$/, '')
  return TRUSTED_HOST_SUFFIXES.some(suffix =>
    normal === suffix || normal.endsWith('.' + suffix)
  )
}

export function getDirectThumbnail(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.searchParams.get('host')
    if (host && isTrustedHost(host)) {
      parsed.searchParams.delete('host')
      const params = parsed.searchParams.toString()
      return `https://${host}${parsed.pathname}${params ? '?' + params : ''}`
    }
  } catch {}
  return url
}
