const CACHE_NAME = 'andclaw-cache-v13';
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline');
  }
}

self.addEventListener('install', event => {
  // Não cachear nada no install para evitar falhas por 401/404
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  const isAppShell =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/config.js');

  if (isAppShell) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'AndClaw', {
      body: data.body || 'Nova notificação',
      icon: '/icon-192.png'
    })
  );
});
