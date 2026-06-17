const CACHE = "trakt-static-v2";
const SHELL = "/";
const STATIC_EXTS = [".js", ".css", ".woff2", ".woff", ".ttf", ".png", ".svg", ".ico"];

self.addEventListener("install", (e) => {
    // Precache the app shell so navigations work offline.
    // If the network is unavailable at install time, cache.add rejects and the
    // install fails — the browser keeps the previous SW active, preserving
    // offline support. skipWaiting runs only after a successful cache write.
    e.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.add(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
            )
            // Cache cleanup failure (e.g. quota error) must not prevent claim().
            .catch(() => {})
            .then(() => self.clients.claim())
    );
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
                    // Background cache update — fire-and-forget so the response
                    // is not delayed. The .catch() prevents unhandled rejections
                    // from storage quota or other cache errors.
                    caches
                        .open(CACHE)
                        .then((cache) => cache.put(SHELL, res.clone()))
                        .catch(() => {});
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

// Web Push (N2-T05): show airing-reminder notifications.
self.addEventListener("push", (e) => {
    let data = {};
    try {
        data = e.data ? e.data.json() : {};
    } catch {
        data = { body: e.data ? e.data.text() : "" };
    }
    e.waitUntil(
        self.registration.showNotification(data.title || "Trakt Dashboard", {
            body: data.body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { url: data.url || "/" },
        })
    );
});

self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    // Accept only same-origin relative paths. An absolute or cross-origin URL in
    // the push payload would make openWindow throw a SecurityError.
    const raw = (e.notification.data && e.notification.data.url) || "/";
    const url = typeof raw === "string" && raw.startsWith("/") ? raw : "/";
    e.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
                // Prefer a window already at the target path — focus it without
                // navigating away unrelated tabs.
                const match = clients.find(
                    (c) => new URL(c.url, self.location.origin).pathname === url,
                );
                if (match && "focus" in match) return match.focus();
                return self.clients.openWindow(url);
            })
    );
});
