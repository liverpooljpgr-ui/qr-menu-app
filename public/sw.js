const CACHE_NAME = "app-shell-v3";
const APP_SHELL_URLS = ["/"];

// Navigations answered from cache, keyed by the resulting window's client id,
// so the page can ask whether what it's showing is a stale offline copy.
const cacheServedClients = new Set();

self.addEventListener("message", (event) => {
  if (event.data?.type !== "served-from-cache?") return;
  const id = event.source?.id;
  const served = id ? cacheServedClients.delete(id) : false;
  event.source?.postMessage({ type: "served-from-cache", value: served });
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:png|svg|jpg|jpeg|gif|webp|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Menu photos live in Supabase Storage under timestamped, immutable names.
  // Cache-first so the offline copy of a menu keeps its pictures. <img> fetches
  // are no-cors, so the stored response is opaque (status 0, ok === false).
  if (url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok || response.type === "opaque") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never touch Next.js router (RSC) fetches or authenticated/dynamic areas —
  // a cached payload there shows stale data after mutations.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;
  if (
    url.pathname.startsWith("/app") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // Hashed static assets are immutable: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Public documents: network-first, cached copy only when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === "navigate") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreVary: true });
        if (cached && request.mode === "navigate" && event.resultingClientId) {
          cacheServedClients.add(event.resultingClientId);
        }
        return cached;
      })
  );
});
