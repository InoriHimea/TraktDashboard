const CACHE = "trakt-static-v1";
const STATIC_EXTS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".ico"];

self.addEventListener("install", (e) => {
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);
    // Only cache same-origin static assets; never cache API calls
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    const ext = url.pathname.slice(url.pathname.lastIndexOf("."));
    if (!STATIC_EXTS.includes(ext)) return;

    e.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const cached = await cache.match(e.request);
            if (cached) return cached;
            const res = await fetch(e.request);
            if (res.ok) cache.put(e.request, res.clone());
            return res;
        })
    );
});
