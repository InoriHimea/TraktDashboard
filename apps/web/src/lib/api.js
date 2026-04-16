const API_BASE = "/api";
async function request(path, options, base = API_BASE) {
    // Fix: only set Content-Type for requests that carry a body (not GET / HEAD)
    const method = options?.method?.toUpperCase() ?? "GET";
    const headers = {};
    if (method !== "GET" && method !== "HEAD") {
        headers["Content-Type"] = "application/json";
    }
    // Merge any caller-supplied headers (allow overrides)
    Object.assign(headers, options?.headers);
    const res = await fetch(`${base}${path}`, {
        credentials: "include",
        ...options,
        headers,
    });
    if (!res.ok) {
        // Fix: attach HTTP status code to the thrown error for callers to inspect
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const error = new Error(err.error || "Request failed");
        error.status = res.status;
        throw error;
    }
    return res.json();
}
export const api = {
    auth: {
        me: () => request("/auth/me", undefined, ""),
        logout: () => request("/auth/logout", { method: "POST" }, ""),
    },
    shows: {
        // Task 4.2: Accept optional limit/offset pagination params
        // Fix: use URLSearchParams so filter/q values are always properly URL-encoded
        progress: (filter = "watching", q = "", limit = 50, offset = 0) => {
            const params = new URLSearchParams({
                filter,
                q,
                limit: String(limit),
                offset: String(offset),
            });
            return request(`/shows/progress?${params}`);
        },
        detail: (id) => request(`/shows/${id}`),
        history: (showId) => request(`/shows/${showId}/history`),
        deleteHistory: (showId, historyId) => request(`/shows/${showId}/history/${historyId}`, {
            method: "DELETE",
        }),
        reset: (showId) => request(`/shows/${showId}/reset`, {
            method: "POST",
        }),
    },
    episodes: {
        detail: (showId, season, episode) => request(`/shows/${showId}/episodes/${season}/${episode}`),
        watch: (showId, season, episode, watchedAt) => request(`/shows/${showId}/episodes/${season}/${episode}/watch`, { method: "POST", body: JSON.stringify({ watchedAt }) }),
        history: (showId, season, episode) => request(`/shows/${showId}/episodes/${season}/${episode}/history`),
    },
    sync: {
        status: () => request("/sync/status"),
        debug: () => request("/sync/debug"),
        trigger: () => request("/sync/trigger", { method: "POST" }),
        full: () => request("/sync/full", { method: "POST" }),
    },
    stats: {
        overview: () => request("/stats/overview"),
    },
    settings: {
        get: () => request("/settings"),
        update: (body) => request("/settings", {
            method: "PUT",
            body: JSON.stringify(body),
        }),
    },
    trakt: {
        watching: () => request("/trakt/watching"),
    },
};
//# sourceMappingURL=api.js.map