const VERSION = '2b676d3';

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
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
    .then(keys => Promise.all(
      keys.map(cache => cache == VERSION ? undefined : caches.delete(cache))
    ))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
    .then(cached => cached || fetch(e.request))
  );
});
