// @ts-nocheck
const VERSION = import.meta.env.VITE_GIT_COMMIT;
// Cache Storage is per-origin: GitHub Pages project sites share `<user>.github.io`,
// so this SW must never touch caches it did not create.
const CACHE_PREFIX = 'startpage-';
const CACHE = CACHE_PREFIX + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all([
        '.',
        '404.html',
        'index.html',
        'favicon.svg',
        'assets/index.js',
        'assets/index.css'
      ].map(url => fetch(new Request(url, { cache: 'no-cache' }))
        .then(resp => {
          if (!resp.ok) return;
          return cache.put(url, resp.clone());
        })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', e => {
  const request = e.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    e.respondWith(
      caches.match('index.html')
        .then(cached => cached || fetch(request))
    );
    return;
  }

  // Pass-through (cross-origin GETs are never cached here); add an origin filter if caching is ever extended.
  e.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request))
  );
});
