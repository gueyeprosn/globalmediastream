const CACHE_NAME = "watch-scope-v1"
const WATCH_ROUTES = ["/watch"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(WATCH_ROUTES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Laisser Next.js gerer ses chunks statiques.
  if (url.pathname.startsWith("/_next/static")) return

  // Streaming: network only.
  if (
    url.pathname.includes("/oceanfm") ||
    url.pathname.includes("/toubatv") ||
    url.pathname.endsWith(".m3u8") ||
    url.pathname.endsWith(".ts")
  ) {
    event.respondWith(fetch(request))
    return
  }

  // Pour les pages watch, network first avec fallback cache.
  if (url.pathname.startsWith("/watch")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        return cached || Response.error()
      })
    )
  }
})

