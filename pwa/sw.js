// Satzfabrik service worker: keeps the game on the device so it starts without internet.
// The voices have their own cache (src/ui/neural.worker.ts) and are left alone here.
const VERSION = "__VERSION__";
const APP = `satzfabrik-app-${VERSION}`;
const FONTS = "satzfabrik-fonts";
const FILES = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("satzfabrik-app-") && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** The cached copy at once; the network copy refreshes the cache for next time. */
async function fromCache(request, cacheName, key = request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === "opaque") void cache.put(key, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) return hit;
  return (await fresh) ?? new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(fromCache(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fromCache(req, APP, new URL("./", self.location).href));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
