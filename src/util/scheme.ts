// Whitelist of link protocols that are safe to render as clickable hrefs.
// Everything else (javascript:, data:, mailto:, custom OS handlers, ...) is
// treated as unsafe and rendered inert, both when saving and at render time.

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'magnet:'])

export function hasSafeScheme(url: string): boolean {
  if (!url.trim()) return false

  try {
    return SAFE_PROTOCOLS.has(new URL(url, location.href).protocol)
  } catch {
    return false
  }
}

/** Returns the URL when safe to link to, otherwise `undefined` (renders a non-link). */
export function safeHref(url: string): string | undefined {
  return hasSafeScheme(url) ? url : undefined
}
