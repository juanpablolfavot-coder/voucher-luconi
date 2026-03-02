// luconi sw.js — v4 (más robusto y rápido)
var CACHE = 'luconi-v4';

var APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js'
];

// Best-effort: cache de libs externas (si el CDN lo permite)
var CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);

    // App shell
    await c.addAll(APP_SHELL);

    // CDN assets (no rompas install si alguno falla)
    await Promise.all(CDN_ASSETS.map(function (u) {
      return fetch(u, { mode: 'no-cors' })
        .then(function (res) { return c.put(u, res); })
        .catch(function () {});
    }));
  })());

  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Estrategia:
// - Navegación/HTML: network-first + fallback a /index.html
// - Estáticos: cache-first (same-origin + cdn)
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  var isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('/index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('/index.html', { ignoreSearch: true });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;

      return fetch(req).then(function (res) {
        // Cache best-effort:
        // - Same origin: sí
        // - CDN_ASSETS: sí (si coincide)
        var shouldCache =
          url.origin === self.location.origin ||
          CDN_ASSETS.indexOf(req.url) !== -1;

        if (shouldCache) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // si falla un asset, devolvé algo cacheado si existe
        return caches.match(req);
      });
    })
  );
});
