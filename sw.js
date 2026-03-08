// Service Worker for Python Guide — SICT Year 2
// Caches static assets for offline read-only access.
// Version: bump CACHE_NAME to force cache refresh after updates.

const CACHE_NAME = "python-guide-v7";
const ASSETS_TO_CACHE = [
  "/index.html",
  "/style.css",
  "/runner.js",
  "/manifest.json",
  "/pyodide-worker.js",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Add COOP/COEP headers required for SharedArrayBuffer (Web Worker + Atomics)
function addIsolationHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Fetch: serve from cache first, fall back to network
// Note: Pyodide CDN requests always go to network (too large to cache and must stay fresh)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for CDN requests (no CORP headers on CDN — fetch directly via CORS mode)
  if (
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    return;
  }

  // Network-first for HTML — always serve fresh page
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return addIsolationHeaders(response);
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || fetch(event.request))
        )
    );
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request))
      .then((response) => addIsolationHeaders(response)),
  );
});
