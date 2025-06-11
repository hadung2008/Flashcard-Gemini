
const CACHE_NAME = 'flashcard-pwa-v1';
const urlsToCache = [
  '/', // Caches the root, often serving index.html
  '/index.html',
  '/index.css',
  '/index.tsx', // Assuming this is how your main script is served
  '/manifest.json',
  '/icons/icon-192x192.png', // Add your icon paths
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&family=Roboto:wght@400;500&display=swap' // Cache Google Fonts CSS
  // Font files (.woff2) linked within the Google Fonts CSS will be cached by the fetch handler when requested
];

// Install service worker: open cache and add core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching core assets');
        // Use {cache: 'reload'} to ensure fresh copies are fetched from network during install, bypassing browser HTTP cache
        const cachePromises = urlsToCache.map(urlToCache => {
          return cache.add(new Request(urlToCache, {cache: 'reload'})).catch(err => {
            console.warn(`Failed to cache ${urlToCache} during install: ${err}`);
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting()) // Activate new SW immediately
      .catch(err => {
          console.error('Cache open/addAll failed during install:', err);
      })
  );
});

// Fetch event: serve cached content when offline, or fetch from network
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests for http/https schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    // For non-GET requests or non-http/https requests, pass through to the network.
    // This also means API calls (POST to Gemini) are not cached.
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Cache hit - return response
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(event.request.clone()).then(
          (networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200) {
              // Don't cache error responses or opaque responses directly unless intended
              return networkResponse;
            }
            // If it's a 'basic' type (same-origin) or a valid CORS response, cache it.
            // Opaque responses (type 'opaque') for cross-origin no-CORS requests shouldn't be cached
            // as we can't inspect them, but they are handled by the initial check for networkResponse.status !== 200.
            if (networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
            }
            return networkResponse;
          }
        ).catch(() => {
          // Network request failed, and not in cache
          // Optionally, return a custom offline fallback page for navigation requests:
          // if (event.request.mode === 'navigate') {
          //   return caches.match('/offline.html');
          // }
          // For now, let the browser handle the error.
        });
      })
  );
});

// Activate service worker: clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of uncontrolled clients
  );
});
