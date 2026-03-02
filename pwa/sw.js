var CACHE_NAME = 'luconi-v4';
var urlsToCache = [
  './',
  'index.html',
  'luconi_vouchers.html',
  'icon-192.png',
  'icon-512.png',
  'manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          var rc = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, rc); });
        }
        return networkResponse;
      });
    })
  );
});
