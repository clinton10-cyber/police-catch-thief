/* Service worker — offline play. Network-first for code (new builds show up when online), cache fallback. */
const V = "pct-v1";
const FILES = ["./", "./index.html", "./style.css", "./manifest.webmanifest", "./js/main.js", "./js/rules.js", "./js/scene.js",
  "./vendor/three.module.min.js", "./assets/icon-192.png", "./assets/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html"))));
});
