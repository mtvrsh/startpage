// Whitelist of link protocols that are safe to render as clickable hrefs.
// Everything else (javascript:, data:, mailto:, custom OS handlers, ...) is
// treated as unsafe and rendered inert, both when saving and at render time.

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'magnet:'])

// Schemes that would execute code when used as a href prefix
const UNSAFE_PROTOCOLS = new Set(['javascript:', 'data:'])

// WHATWG URL scheme name: [a-z][a-z0-9+.-]*
const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:$/

export function hasSafeScheme(url: string): boolean {
  if (!url.trim()) return false

  try {
    return SAFE_PROTOCOLS.has(new URL(url, location.href).protocol)
  } catch {
    return false
  }
}

/**
 * Custom protocol names (feedProtocolName) are user-configured handlers
 * (vlc, mpv, ...), so instead of the SAFE_PROTOCOLS whitelist only the
 * scheme must be a well-formed name and not code-executing.
 */
export function isSafeProtocolName(name: string): boolean {
  if (!name.trim()) return false

  try {
    const protocol = new URL(`${name}:https://example.com/`).protocol

    return PROTOCOL_RE.test(protocol) && !UNSAFE_PROTOCOLS.has(protocol)
  } catch {
    return false
  }
}

/** Returns the URL when safe to link to, otherwise `undefined` (renders a non-link). */
export function safeHref(url: string): string | undefined {
  return hasSafeScheme(url) ? url : undefined
}
