// Cache-first for app shell (works both at domain root and when deployed under a subfolder)
var CACHE = 'luconi-v3';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sw.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(
        k.filter(function (n) {
          return n !== CACHE;
        }).map(function (n) {
          return caches.delete(n);
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first for HTML, cache-first for the rest.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html');
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (r) {
      return (
        r ||
        fetch(req).then(function (res) {
          // Best-effort cache for same-origin requests
          try {
            var url = new URL(req.url);
            if (url.origin === self.location.origin) {
              var copy = res.clone();
              caches.open(CACHE).then(function (c) { c.put(req, copy); });
            }
          } catch (_) {}
          return res;
        })
      );
    })
  );
});
