// Service Worker for Python Guide — SICT Year 2
// Strategy: network-first for documents, cache-first for static assets.
// Version: bump CACHE_NAME to force cache refresh after updates.

const CACHE_NAME = "python-guide-v11";
const ASSETS_TO_CACHE = [
  "/index.html",
  "/style.css",
  "/runner.js",
  "/manifest.json",
  "/pyodide-worker.js",
  "/favicon.png?v=5",
];
const CDN_BYPASS_HOSTS = [
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url)),
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(
            "[sw] Failed to precache:",
            ASSETS_TO_CACHE[index],
            result.reason,
          );
        }
      });
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Add COOP/COEP headers required for SharedArrayBuffer (Web Worker + Atomics)
function addIsolationHeaders(response) {
  if (!response || response.type !== "basic") {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Always bypass cache for CDN requests (no CORP headers on CDN — fetch directly via CORS mode)
  if (
    CDN_BYPASS_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  ) {
    return;
  }

  // Network-first for HTML — always serve fresh page
  if (event.request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 3000),
          );
          const networkResponse = await Promise.race([
            fetch(event.request),
            timeoutPromise,
          ]);
          if (networkResponse.ok && networkResponse.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());
          }
          return addIsolationHeaders(networkResponse);
        } catch {
          const cached = await caches.match(event.request);
          if (cached) {
            return addIsolationHeaders(cached);
          }
          return new Response("Offline — please reconnect and reload.", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request))
      .then((response) => addIsolationHeaders(response))
      .catch(
        () =>
          new Response("Resource unavailable offline", {
            status: 503,
          }),
      ),
  );
});
