const CACHE_NAME = "moveup-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/moveup.png"
];

// Install Service Worker and cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate and clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event handler (required for PWA installability)
self.addEventListener("fetch", (event) => {
  // Let the browser handle external APIs and Supabase requests normally
  if (
    event.request.url.startsWith(self.location.origin) &&
    !event.request.url.includes("/api/") &&
    event.request.method === "GET"
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache and update in background (Stale-While-Revalidate)
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {
              /* Ignore network errors for background update */
            });
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          // Cache new static pages/assets dynamically
          if (
            response.status === 200 &&
            !event.request.url.includes("/_next/") &&
            !event.request.url.includes("/admin")
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
