// BackFLO service worker — app-shell caching only. Intentionally
// minimal: MVP installability per blueprint §7 Phase 5, not offline
// sync (v2+). Data reads + writes bypass the SW entirely; only static
// assets are cached so the PWA wrapper feels snappy.
//
// Cache bust: bump SW_VERSION. On activate, anything not matching the
// current version is dropped. No Workbox — ~40 lines is enough.

const SW_VERSION = "backflo-v1";
const CACHE_NAME = `backflo-shell-${SW_VERSION}`;

// Bypass the SW entirely for these path prefixes. Auth callbacks,
// Supabase /auth/* calls, and any future API must always hit the
// network. Data is not offline-first in MVP.
const NETWORK_ONLY_PREFIXES = ["/auth/", "/api/"];

self.addEventListener("install", (event) => {
  // Fresh SW takes over on next navigation; no waiting for all tabs
  // to close. Acceptable at MVP scale.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // Static assets: cache-first. Next emits immutable URLs under
  // /_next/static/, so once cached they can be served without
  // revalidation forever (they change URL on bust).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML navigations: network-first with a cache fallback. Keeps the
  // app up-to-date when online, still launches when the phone has
  // gone into a tunnel mid-route.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
