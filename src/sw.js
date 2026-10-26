// @ts-nocheck
const VERSION = import.meta.env.VITE_GIT_COMMIT;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
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
        keys.filter(cache => cache !== VERSION).map(cache => caches.delete(cache))
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
