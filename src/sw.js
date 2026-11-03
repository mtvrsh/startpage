// @ts-nocheck
// No fallback: local builds without VITE_GIT_COMMIT cache as `startpage-undefined`.
const VERSION = import.meta.env.VITE_GIT_COMMIT
// Cache Storage is per-origin: GitHub Pages project sites share `<user>.github.io`,
// so this SW must never touch caches it did not create.
const CACHE_PREFIX = 'startpage-'
const CACHE = CACHE_PREFIX + VERSION

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          // Keep in sync with the unhashed output names in vite.config.js.
          ['.', '404.html', 'index.html', 'favicon.svg', 'assets/index.js', 'assets/index.css'].map(
            (url) =>
              fetch(new Request(url, { cache: 'no-cache' })).then((resp) => {
                if (!resp.ok) return
                return cache.put(url, resp.clone())
              }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches
        // Sweep only this app's caches; legacy pre-prefix caches (bare commit
        // hashes) are indistinguishable from sibling projects' and stay.
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (e) => {
  const request = e.request

  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((cached) => cached || fetch(request)))
    return
  }

  // Precache-only: only entries written at install time are served; network
  // responses are never cached here. Runtime caching would ignore
  // `Request.cache` and defeat the backend's `reload`, so add an explicit
  // `request.cache` check if caching is ever extended.
  e.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})
