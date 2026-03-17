const CACHE_NAME = 'andclaw-cache-v12';
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

// Instala: cacheia só assets estáticos (ícones, manifest)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Ativa: remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: estratégia diferenciada por tipo de recurso
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API calls: sempre network, sem cache
  if (url.pathname.startsWith('/api/')) return;

  // JS, CSS, HTML: network-first (pega atualização), fallback para cache
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets estáticos (ícones): cache-first
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'AndClaw', {
      body: data.body || 'Nova notificação',
      icon: '/icon-192.png'
    })
  );
});
