import { getDb, users, metadataCache } from "@trakt-dashboard/db";
import { eq, and } from "drizzle-orm";
import { getRedis } from "../jobs/scheduler.js";
const FETCH_TIMEOUT_MS = 12000;
// Proxy support — reads HTTP_PROXY / HTTPS_PROXY from environment
function buildFetchOptions() {
    const proxyUrl = process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY ||
        process.env.https_proxy ||
        process.env.http_proxy;
    if (!proxyUrl)
        return {};
    return { proxy: proxyUrl };
}
const BASE_FETCH_OPTIONS = buildFetchOptions();
// Reliable timeout via Promise.race (AbortController unreliable in Bun for established connections)
function withTimeout(promise, ms, label) {
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => reject(new Error(`[trakt] Timeout after ${ms}ms: ${label}`)), ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timerId)),
        timeoutPromise,
    ]);
}
async function fetchWithTimeout(url, options) {
    return withTimeout(fetch(url, { ...BASE_FETCH_OPTIONS, ...options }), FETCH_TIMEOUT_MS, url);
}
// Task 8.1: Generic fetch with 429 retry
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetchWithTimeout(url, options);
        if (res.status !== 429)
            return res;
        if (attempt === maxRetries)
            return res;
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5");
        console.warn(`[trakt] Rate limited, retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
    // unreachable
    throw new Error("fetchWithRetry: unreachable");
}
// Task 2.2: Token refresh with Redis distributed lock
async function refreshToken(userId) {
    const redis = getRedis();
    const lockKey = `lock:token-refresh:${userId}`;
    // Try to acquire lock
    for (let attempt = 0; attempt < 10; attempt++) {
        const acquired = await redis.set(lockKey, "1", "EX", 30, "NX");
        if (acquired) {
            try {
                const db = getDb();
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, userId));
                if (!user)
                    throw new Error("User not found");
                const res = await fetchWithRetry("https://api.trakt.tv/oauth/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        refresh_token: user.traktRefreshToken,
                        client_id: process.env.TRAKT_CLIENT_ID,
                        client_secret: process.env.TRAKT_CLIENT_SECRET,
                        redirect_uri: process.env.TRAKT_REDIRECT_URI,
                        grant_type: "refresh_token",
                    }),
                });
                if (!res.ok)
                    throw new Error("Token refresh failed");
                const data = (await res.json());
                await db
                    .update(users)
                    .set({
                    traktAccessToken: data.access_token,
                    traktRefreshToken: data.refresh_token,
                    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
                    updatedAt: new Date(),
                })
                    .where(eq(users.id, userId));
                return data.access_token;
            }
            finally {
                await redis.del(lockKey);
            }
        }
        // Lock held by another process — wait and re-read token from DB
        await new Promise((r) => setTimeout(r, 500));
    }
    // Another process refreshed the token; read the latest from DB
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user)
        throw new Error("User not found");
    return user.traktAccessToken;
}
// Cache TTLs in milliseconds
const CACHE_TTL_7D = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_24H = 24 * 60 * 60 * 1000;
export function getTraktClient() {
    const clientId = process.env.TRAKT_CLIENT_ID;
    // Task 3.1: traktFetch returns data + headers for pagination support
    async function traktFetchRaw(path, userId, params) {
        const db = getDb();
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));
        if (!user)
            throw new Error("User not found");
        let token = user.traktAccessToken;
        const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
        if (new Date(user.tokenExpiresAt).getTime() - Date.now() < bufferMs) {
            token = await refreshToken(userId);
        }
        const url = new URL(`https://api.trakt.tv${path}`);
        if (params)
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        // Task 8.2: Use fetchWithRetry
        const res = await fetchWithRetry(url.toString(), {
            headers: {
                Authorization: `Bearer ${token}`,
                "trakt-api-version": "2",
                "trakt-api-key": clientId,
                "Content-Type": "application/json",
            },
        });
        if (!res.ok) {
            throw new Error(`Trakt API error: ${res.status} ${await res.text()}`);
        }
        if (res.status === 204)
            return { data: null, headers: res.headers };
        return { data: await res.json(), headers: res.headers };
    }
    async function traktFetch(path, userId, params) {
        const { data } = await traktFetchRaw(path, userId, params);
        return data;
    }
    return {
        getWatchedShows: (userId) => traktFetch("/sync/watched/shows?extended=noseasons", userId),
        // Task 3.2: getHistory now uses traktFetchRaw (unified token refresh + 429 retry)
        getHistory: async (userId, startAt) => {
            const all = [];
            let page = 1;
            while (true) {
                const params = {
                    limit: "100",
                    page: String(page),
                };
                if (startAt)
                    params.start_at = startAt;
                const { data, headers } = await traktFetchRaw("/sync/history/episodes", userId, params);
                all.push(...data);
                const pageCount = parseInt(headers.get("X-Pagination-Page-Count") || "1");
                if (page >= pageCount)
                    break;
                page++;
            }
            return all;
        },
        getShowProgress: (userId, traktId) => traktFetch(`/shows/${traktId}/progress/watched`, userId),
        getWatching: async (userId) => {
            const { data } = await traktFetchRaw("/users/me/watching?extended=full", userId);
            if (!data)
                return null;
            if (data.type !== "episode")
                return null;
            return data;
        },
        getShowDetail: async (traktId, userId) => {
            const db = getDb();
            const externalId = `trakt_show_${traktId}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(and(eq(metadataCache.source, "trakt_show"), eq(metadataCache.externalId, externalId)));
            if (cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D) {
                return cached.data;
            }
            const data = await traktFetch(`/shows/${traktId}?extended=full`, userId);
            await db
                .insert(metadataCache)
                .values({
                source: "trakt_show",
                externalId,
                data,
                cachedAt: new Date(),
            })
                .onConflictDoUpdate({
                target: [metadataCache.source, metadataCache.externalId],
                set: { data, cachedAt: new Date() },
            });
            return data;
        },
        getSeasons: async (traktId, userId) => {
            const db = getDb();
            const externalId = `trakt_seasons_${traktId}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(and(eq(metadataCache.source, "trakt_seasons"), eq(metadataCache.externalId, externalId)));
            if (cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D) {
                return cached.data;
            }
            const data = await traktFetch(`/shows/${traktId}/seasons?extended=full`, userId);
            await db
                .insert(metadataCache)
                .values({
                source: "trakt_seasons",
                externalId,
                data,
                cachedAt: new Date(),
            })
                .onConflictDoUpdate({
                target: [metadataCache.source, metadataCache.externalId],
                set: { data, cachedAt: new Date() },
            });
            return data;
        },
        getEpisodes: async (traktId, seasonNumber, userId) => {
            const db = getDb();
            const externalId = `trakt_episodes_${traktId}_s${seasonNumber}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(and(eq(metadataCache.source, "trakt_episodes"), eq(metadataCache.externalId, externalId)));
            if (cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_24H) {
                return cached.data;
            }
            const data = await traktFetch(`/shows/${traktId}/seasons/${seasonNumber}/episodes?extended=full`, userId);
            await db
                .insert(metadataCache)
                .values({
                source: "trakt_episodes",
                externalId,
                data,
                cachedAt: new Date(),
            })
                .onConflictDoUpdate({
                target: [metadataCache.source, metadataCache.externalId],
                set: { data, cachedAt: new Date() },
            });
            return data;
        },
        getEpisodeRating: async (traktId, season, episode, userId) => {
            try {
                const data = await traktFetch(`/shows/${traktId}/seasons/${season}/episodes/${episode}/ratings`, userId);
                // Convert 0-10 float to 0-100 integer
                return Math.round(data.rating * 10);
            }
            catch (e) {
                console.warn(`[trakt] Episode rating fetch failed for ${traktId} s${season}e${episode}:`, e);
                return null; // Degradation
            }
        },
    };
}
//# sourceMappingURL=trakt.js.map