const VERSION = '420c958';

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
    ].map(url => fetch(new Request(url, {cache: 'no-cache'}))
      .then(resp => cache.put(url, resp.clone()))
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
  e.respondWith(
    caches.match(e.request)
    .then(cached => cached || fetch(e.request))
  );
});
