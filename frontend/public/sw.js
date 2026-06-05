const CACHE_VERSION = 'andclaw-v1';
const CACHE_NAME = 'andclaw-static-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

async function cachedIndexFallback() {
  const cached = await caches.match('/index.html');
  if (cached) return cached;
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (_error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Service unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests: Network-first, with cache fallback on network error
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(event.request).catch(() => new Response('Service unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }))
    );
    return;
  }

  // 2. Navigation Requests: Offline fallback to /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response || cachedIndexFallback())
        .catch(() => cachedIndexFallback())
    );
    return;
  }

  // 3. Static Assets: Cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // Cache new static assets (JS, CSS, Fonts, etc.)
          const isStatic = 
            url.pathname.endsWith('.js') || 
            url.pathname.endsWith('.css') || 
            url.pathname.match(/\.(woff2?|ttf|otf|eot)$/) ||
            url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/);

          if (isStatic && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          if (event.request.mode === 'navigate') {
            return cachedIndexFallback();
          }
          return new Response('Asset unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        });
    })
  );
});
