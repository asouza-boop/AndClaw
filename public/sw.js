const CACHE_NAME = 'andclaw-cache-v13';

self.addEventListener('install', event => {
  // Não cachear nada no install para evitar falhas por 401/404
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Nunca interceptar chamadas de API
  if (url.pathname.startsWith('/api/')) return;

  // JS e CSS: network-first, fallback para cache
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tudo mais: network primeiro, sem forçar cache
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
