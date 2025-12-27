const VERSION = 'e598da7';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
    .then(cache => cache.addAll([
      '.',
      '404.html',
      'index.html',
      'favicon.svg',
      'assets/index.js',
      'assets/index.css'
    ]))
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
  e.respondWith(
    caches.match(e.request)
    .then(cached => cached || fetch(e.request))
  );
});
