// Service Worker for Python Guide — SICT Year 2
// Caches static assets for offline read-only access.
// Version: bump CACHE_NAME to force cache refresh after updates.

const CACHE_NAME = 'python-guide-v1';
const ASSETS_TO_CACHE = [
  '/index.html',
  '/style.css',
  '/runner.js',
  '/manifest.json',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
// Note: Pyodide CDN requests always go to network (too large to cache and must stay fresh)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for Pyodide CDN requests
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return; // let browser handle normally
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
