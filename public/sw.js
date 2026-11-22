// Lifestyle OS service worker: caches the app shell so the installed app opens offline.
// Data (Supabase) and /api routes are never cached here — they always go to the network.
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const SHELL_ROUTES = ["/expenses", "/shopping", "/inventory", "/scan", "/settings"];
// Build chunks plus the favicon and icons referenced from each page's HTML.
const ASSET_REF = /(?:src|href)="(\/(?:_next\/static\/|icon|favicon|apple-icon)[^"]*)"/g;
const isStaticAsset = (path) => /^\/(?:_next\/static\/|icons\/|icon|favicon|apple-icon)/.test(path);

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

// Cache every tab's HTML plus the JS/CSS chunks it references, so a tab never opened
// while online still works offline. Each route is settled on its own so one failure
// doesn't abort the install.
async function precacheShell() {
  const [shell, assets] = await Promise.all([caches.open(SHELL_CACHE), caches.open(STATIC_CACHE)]);
  const assetUrls = new Set();
  await Promise.allSettled(
    SHELL_ROUTES.map(async (route) => {
      const response = await fetch(route, { cache: "no-cache" });
      if (!response.ok || response.redirected) return;
      const html = await response.clone().text();
      for (const match of html.matchAll(ASSET_REF)) assetUrls.add(match[1].replaceAll("&amp;", "&"));
      await shell.put(route, response);
    }),
  );
  await Promise.allSettled([...assetUrls].map((url) => assets.add(url)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fonts CDN, etc.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Page navigations: network-first so deploys show up immediately; fall back to cache offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed build assets never change for a given URL: cache-first.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Client-side navigation payloads (RSC) and other same-origin GETs.
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match("/expenses");
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
