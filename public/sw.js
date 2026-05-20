const CACHE_NAME = 'smart-nursery-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Hanya handle GET
  if (event.request.method !== 'GET') return;

  // Jangan intercept: API GAS, extension, non-http
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname === 'script.google.com') return;
  if (url.hostname === 'api.fonnte.com') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // Hanya cache response yang valid dari origin sendiri
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic'
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Jika fetch gagal, kembalikan cache jika ada
          return cached || new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });

      return cached || fetchPromise;
    })
  );
});
