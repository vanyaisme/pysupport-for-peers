// The release builder replaces this local-preview configuration with hashed URLs
// and integrity checks for every required asset.
const RELEASE = {
  id: "v21",
  assets: [
    { url: "/index.html" },
    { url: "/style.css?v=21" },
    { url: "/runner.js?v=21" },
    { url: "/vendor/prism.js?v=21" },
    { url: "/pyodide-worker.js?v=21" },
    { url: "/manifest.json" },
    { url: "/favicon.png?v=5" },
    { url: "/icon-192.png" },
    { url: "/icon-512.png" },
    { url: "/assets/og-image.png" },
  ],
};
const CACHE_PREFIX = "python-guide-";
const CACHE_NAME = CACHE_PREFIX + RELEASE.id;
const assetURLs = new Set(RELEASE.assets.map((asset) => new URL(asset.url, self.location).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll commits atomically. Missing, stale or corrupt required assets
      // reject installation, leaving the currently active release usable.
      await cache.addAll(
        RELEASE.assets.map(
          (asset) =>
            new Request(new URL(asset.url, self.location), {
              cache: "reload",
              integrity: asset.integrity || "",
            })
        )
      );
      // No skipWaiting: existing tabs retain their page, worker and files.
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      // No clients.claim(): never take over a document from another release.
    })()
  );
});

function addIsolationHeaders(response) {
  if (!response || response.type !== "basic") return response;
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
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const appNavigation =
    event.request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html");
  if (!appNavigation && !assetURLs.has(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(appNavigation ? "/index.html" : event.request);
      if (cached) return addIsolationHeaders(cached);
      const asset = RELEASE.assets.find((entry) =>
        appNavigation
          ? entry.url === "/index.html"
          : new URL(entry.url, self.location).href === url.href
      );
      try {
        // Integrity permits recovery after eviction without mixing releases.
        const request = new Request(new URL(asset.url, self.location), {
          cache: "reload",
          integrity: asset.integrity || "",
        });
        const response = await fetch(request);
        if (!response.ok) throw new Error("Required asset unavailable");
        await cache.put(request, response.clone());
        return addIsolationHeaders(response);
      } catch {
        // Keep the failure visible if this release is unavailable online too.
      }
      return new Response(
        "Site files are unavailable. Reconnect, close all site tabs and reopen.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    })()
  );
});
