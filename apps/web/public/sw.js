const CACHE = "trakt-static-v2";
const SHELL = "/";
const STATIC_EXTS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".ico"];

self.addEventListener("install", (e) => {
    // Precache the app shell so navigations work offline.
    e.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
            )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);
    // Only handle same-origin requests; never cache API calls
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;

    // App shell: network-first for navigations, falling back to the cached shell
    // when offline so the SPA still loads instead of a browser error page.
    if (e.request.mode === "navigate") {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    caches.open(CACHE).then((cache) => cache.put(SHELL, res.clone()));
                    return res;
                })
                .catch(() => caches.match(SHELL).then((cached) => cached || Response.error()))
        );
        return;
    }

    // Static assets: cache-first.
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
