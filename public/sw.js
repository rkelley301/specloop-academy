/* SpecLoop service worker: makes the installed app open offline.
 *
 * - Page navigations: network first; when offline, the last cached copy of
 *   that page, else /offline.html. Lesson data lives in the browser (local
 *   demo mode), so a cached page shell is enough to keep studying.
 * - /_next/static/* (content-hashed, immutable) and /icons/*: cache first.
 * - Never touched: /api/*, /auth/*, non-GET requests, other origins, and
 *   Next's RSC data requests. Those always go to the network.
 * - Redirected or failed responses are never cached, so a sign-in redirect
 *   (hosted mode) can't be stored as a page.
 */
const VERSION = "v1";
const PAGES = `specloop-pages-${VERSION}`;
const ASSETS = `specloop-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Core pages cached at install so the main study flow works offline right away.
const LESSONS = Array.from({ length: 10 }, (_, i) => `/lessons/sl${String(i + 1).padStart(2, "0")}`);
const PRECACHE_PAGES = ["/", "/welcome", "/today", "/path", "/review", "/library", "/audio", "/settings", "/about", ...LESSONS];

const isBypassed = (url) =>
  url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname === "/sw.js";
const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
const cacheable = (res) => res && res.ok && !res.redirected && res.type === "basic";

/** Caches a page and every /_next/static asset its HTML references. */
async function cachePage(pages, assets, path) {
  const res = await fetch(path, { credentials: "same-origin", cache: "no-cache" });
  if (!cacheable(res)) return;
  const html = await res.clone().text();
  await pages.put(path, res);
  const refs = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  await Promise.allSettled([...refs].map(async (ref) => {
    if (await assets.match(ref)) return;
    const r = await fetch(ref);
    if (cacheable(r)) await assets.put(ref, r);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [pages, assets] = await Promise.all([caches.open(PAGES), caches.open(ASSETS)]);
      await pages.add(OFFLINE_URL);
      // One unreachable page shouldn't block installation.
      await Promise.allSettled(PRECACHE_PAGES.map((p) => cachePage(pages, assets, p)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const key of await caches.keys()) if (key.startsWith("specloop-") && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isBypassed(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const pages = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (cacheable(res)) await pages.put(url.pathname, res.clone());
          return res;
        } catch {
          return (await pages.match(url.pathname)) || (await pages.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // RSC payloads for client-side navigation: network only. If offline, Next
  // falls back to a full navigation, which the handler above serves.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const assets = await caches.open(ASSETS);
        const hit = await assets.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (cacheable(res)) await assets.put(req, res.clone());
        return res;
      })(),
    );
  }
});
