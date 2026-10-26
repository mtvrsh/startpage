/**
 * Origin allowlist and per-IP rate limiting for the public API.
 *
 * The frontend is a fully static GitHub Pages app with no server-side
 * component, so the API cannot use real authentication. These are
 * abuse-countermeasures, not a security boundary: non-browser clients can
 * trivially spoof an Origin header. They exist to stop casual browser-based
 * use of the API as an open cross-origin relay and to blunt quota-exhaustion
 * scrapers.
 */

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Structural subset of the generated worker `Env` used by the router so the
 * module also typechecks outside the Workers runtime (frontend test suite).
 */
export interface WorkerEnv {
  ALLOWED_ORIGINS?: string
  FEED_LIMIT?: RateLimiter
}

function allowedOrigins(env: { ALLOWED_ORIGINS?: string }): Set<string> {
  const raw = env.ALLOWED_ORIGINS ?? ''
  return new Set(
    raw
      .split(/\s+/)
      .map(origin => origin.replace(/\/+$/, ''))
      .filter(Boolean),
  )
}

/**
 * The browser origin of the request, if any. `fetch()` always sends `Origin`
 * on cross-origin requests; `Referer` is a fallback for odd clients.
 */
function requestOrigin(request: Request): string | null {
  const origin = request.headers.get('Origin')
  if (origin) {
    try {
      return new URL(origin).origin
    } catch {
      return null
    }
  }
  const referer = request.headers.get('Referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function isAllowedOrigin(request: Request, env: { ALLOWED_ORIGINS?: string }): boolean {
  const origin = requestOrigin(request)
  return origin !== null && allowedOrigins(env).has(origin)
}

/**
 * CORS headers for an allowed-origin request: echo the origin (plus
 * `Vary: Origin` so shared caches never serve one origin's grant to another).
 * Must not be combined with `Access-Control-Allow-Credentials`.
 */
export function corsHeaders(request: Request, env: { ALLOWED_ORIGINS?: string }): Record<string, string> {
  if (!isAllowedOrigin(request, env)) return {}
  const origin = requestOrigin(request)!
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  }
}

/**
 * Approximate per-IP throttle backed by the Rate Limiting binding (per
 * Cloudflare location, so not a strict cap). Returns true when the counter is
 * exhausted and the request should be rejected with 429.
 */
export async function isRateLimited(request: Request, env: WorkerEnv): Promise<boolean> {
  if (!env.FEED_LIMIT) return false
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  try {
    const { success } = await env.FEED_LIMIT.limit({ key: ip })
    return !success
  } catch {
    // Fail open: an unavailable limiter must not take down the API.
    return false
  }
}
