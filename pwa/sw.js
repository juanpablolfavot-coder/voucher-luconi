// luconi sw.js — v6 (subfolder-safe para /pwa/)
var CACHE = 'luconi-pwa-v6';
var BASE = self.registration.scope; // ej: https://.../pwa/

function U(path) { return new URL(path, BASE).toString(); }

var APP_SHELL = [
  U('./'),
  U('./index.html'),
  U('./manifest.json'),
  U('./icon-192.png'),
  U('./icon-512.png'),
  U('./sw.js')
];

// (Opcional) best-effort: cache de libs externas
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
    await c.addAll(APP_SHELL);

    // No rompas el install si el CDN no deja cachear
    await Promise.all(CDN_ASSETS.map(async function (url) {
      try {
        var res = await fetch(url, { mode: 'no-cors' });
        await c.put(url, res);
      } catch (_) {}
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(caches.delete));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var accept = req.headers.get('accept') || '';
  var isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // HTML: network-first + fallback al index de /pwa/
  if (isHTML) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(U('./index.html'), copy); });
        return res;
      }).catch(function () {
        return caches.match(U('./index.html'), { ignoreSearch: true });
      })
    );
    return;
  }

  // Assets: cache-first
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;

      return fetch(req).then(function (res) {
        var url = new URL(req.url);
        var sameScope = url.href.startsWith(BASE);
        var isCDN = CDN_ASSETS.indexOf(req.url) !== -1;

        if (sameScope || isCDN) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      });
    })
  );
});
