// Service Worker pour Touba TV PWA
const CACHE_NAME = 'toubatv-v3';
const RUNTIME_CACHE = 'toubatv-runtime-v3';

// Fichiers à mettre en cache au moment de l'installation
const PRECACHE_URLS = [
  '/watch',
  '/logo-broadcast-sn.png',
  '/logo-toubatv.png',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
  '/icon.svg'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache ouvert');
        return cache.addAll(PRECACHE_URLS)
          .catch((err) => {
            // Ne bloque pas l'activation du SW si un asset est introuvable.
            console.warn('[SW] Precache échoué:', err)
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Suppression du cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Stratégie de cache: Network First pour le streaming, Cache First pour les assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isWatchScope = url.pathname.startsWith('/watch') || url.pathname.includes('/oceanfm') || url.pathname.includes('/toubatv');
  const isPrecacheAsset = PRECACHE_URLS.includes(url.pathname);

  // Important: ne jamais intercepter les chunks Next.js de l'interface admin.
  // Cela evite les erreurs de chunks obsoletes apres un redeploiement.
  if (url.pathname.startsWith('/_next/static')) {
    return;
  }

  // Le SW ne gere que l'experience "watch" et ses assets associes.
  if (!isWatchScope && !isPrecacheAsset) {
    return;
  }

  // Ne pas mettre en cache le stream audio
  if (url.pathname.includes('/oceanfm') || url.pathname.includes('/toubatv')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache First pour les assets statiques
  if (request.destination === 'image' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network First pour les pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
