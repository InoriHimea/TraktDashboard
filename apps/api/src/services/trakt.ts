import { randomUUID } from "node:crypto";
import { getDb, users, metadataCache, userSettings } from "@trakt-dashboard/db";
import { eq, and } from "drizzle-orm";
import { getRedis } from "../jobs/scheduler.js";
import { providerFetch, sleep } from "../lib/http.js";
import { getProviderRateLimiter } from "../lib/rate-limit.js";
import { encryptToken, decryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";

const FETCH_TIMEOUT_MS = 12000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_TTL_MS = 45_000;
const TOKEN_REFRESH_WAIT_BUDGET_MS = 15_000;

function tokenExpiresSoon(expiresAt: Date | string, bufferMs = TOKEN_REFRESH_BUFFER_MS) {
    return new Date(expiresAt).getTime() - Date.now() < bufferMs;
}

// Proxy support — user setting first, then HTTP_PROXY / HTTPS_PROXY from environment
async function getProxyUrl(userId?: number): Promise<string | undefined> {
    if (userId) {
        try {
            const db = getDb();
            const [row] = await db
                .select({ httpProxy: userSettings.httpProxy })
                .from(userSettings)
                .where(eq(userSettings.userId, userId));
            if (row?.httpProxy) return row.httpProxy;
        } catch {
            /* fall through to env */
        }
    }
    return (
        process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY ||
        process.env.https_proxy ||
        process.env.http_proxy ||
        undefined
    );
}

export interface TraktShow {
    title: string;
    year: number;
    ids: {
        trakt: number;
        slug: string;
        tvdb: number;
        imdb: string;
        tmdb: number;
    };
}

export interface TraktWatchedShow {
    plays: number;
    last_watched_at: string;
    last_updated_at: string;
    reset_at: string | null;
    show: TraktShow;
    seasons: Array<{
        number: number;
        episodes: Array<{
            number: number;
            plays: number;
            last_watched_at: string;
        }>;
    }>;
}

export interface TraktHistoryEntry {
    id: number;
    watched_at: string;
    action: string;
    type: string; // "episode" | "movie"
    // Present when type === "episode"
    episode?: {
        season: number;
        number: number;
        title: string;
        ids: {
            trakt: number;
            tvdb: number;
            imdb: string;
            tmdb: number;
            tvrage: number;
        };
    };
    show?: TraktShow;
    // Present when type === "movie"
    movie?: {
        title: string;
        year: number | null;
        ids: { trakt: number; slug: string; imdb: string | null; tmdb: number | null };
    };
}

export interface TraktMovieHistoryEntry {
    id: number;
    watched_at: string;
    action: string;
    type: string;
    movie: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            imdb: string | null;
            tmdb: number | null;
        };
    };
}

export interface TraktShowDetail {
    title: string;
    year: number | null;
    overview: string | null;
    status: string | null;
    first_aired: string | null;
    network: string | null;
    genres: string[];
    ids: {
        trakt: number;
        slug: string;
        tvdb: number | null;
        imdb: string | null;
        tmdb: number | null;
    };
}

export interface TraktSeasonDetail {
    number: number;
    episode_count: number;
    first_aired: string | null;
    overview: string | null;
    ids: {
        trakt: number;
        tvdb: number | null;
        tmdb: number | null;
    };
}

export interface TraktEpisodeDetail {
    number: number;
    season: number;
    title: string | null;
    overview: string | null;
    first_aired: string | null;
    runtime: number | null;
    ids: {
        trakt: number;
        tvdb: number | null;
        imdb: string | null;
        tmdb: number | null;
    };
}

export interface TraktWatchedMovie {
    movie: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            imdb: string | null;
            tmdb: number | null;
        };
    };
    plays: number;
    last_watched_at: string | null;
    last_updated_at: string | null;
}

export interface TraktWatchlistShow {
    listed_at: string;
    show: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            tvdb: number | null;
            imdb: string | null;
            tmdb: number | null;
        };
    };
}

export interface TraktWatchlistMovie {
    listed_at: string;
    movie: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            imdb: string | null;
            tmdb: number | null;
        };
    };
}

export interface TraktRatingShow {
    rated_at: string;
    rating: number; // 1-10
    show: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            tvdb: number | null;
            imdb: string | null;
            tmdb: number | null;
        };
    };
}

export interface TraktRatingMovie {
    rated_at: string;
    rating: number; // 1-10
    movie: {
        title: string;
        year: number | null;
        ids: { trakt: number; slug: string; imdb: string | null; tmdb: number | null };
    };
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface TraktTrendingShow {
    watchers: number;
    show: {
        title: string;
        year: number | null;
        ids: {
            trakt: number;
            slug: string;
            tvdb: number | null;
            imdb: string | null;
            tmdb: number | null;
        };
    };
}

export interface TraktPopularShow {
    title: string;
    year: number | null;
    ids: {
        trakt: number;
        slug: string;
        tvdb: number | null;
        imdb: string | null;
        tmdb: number | null;
    };
}

export interface TraktTrendingMovie {
    watchers: number;
    movie: {
        title: string;
        year: number | null;
        ids: { trakt: number; slug: string; imdb: string | null; tmdb: number | null };
    };
}

export interface TraktPopularMovie {
    title: string;
    year: number | null;
    ids: { trakt: number; slug: string; imdb: string | null; tmdb: number | null };
}

export interface TraktShowProgress {
    aired: number;
    completed: number;
    last_watched_at: string | null;
    reset_at: string | null;
    seasons: Array<{
        number: number;
        title: string;
        aired: number;
        completed: number;
        episodes: Array<{
            number: number;
            completed: boolean;
            last_watched_at: string | null;
        }>;
    }>;
    next_episode: {
        season: number;
        number: number;
        title: string;
        ids: { trakt: number };
    } | null;
}

type TraktUserTokens = typeof users.$inferSelect;

async function readUserTokens(userId: number): Promise<TraktUserTokens> {
    const [user] = await getDb().select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found");
    return user;
}

async function releaseOwnedLock(lockKey: string, lockValue: string) {
    const redis = getRedis();
    await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockValue,
    );
}

// Task 2.2: Token refresh with Redis distributed lock
async function refreshToken(userId: number): Promise<string> {
    const redis = getRedis();
    const lockKey = `lock:token-refresh:${userId}`;
    const lockValue = randomUUID();
    const waitStartedAt = Date.now();
    let attempt = 0;

    while (Date.now() - waitStartedAt < TOKEN_REFRESH_WAIT_BUDGET_MS) {
        const acquired = await redis.set(lockKey, lockValue, "PX", TOKEN_REFRESH_LOCK_TTL_MS, "NX");

        if (!acquired) {
            const user = await readUserTokens(userId);
            if (!tokenExpiresSoon(user.tokenExpiresAt))
                return decryptToken(user.traktAccessToken, resolveApiSecret());
            const backoffMs = Math.min(250 * 2 ** attempt, 2_000) + Math.floor(Math.random() * 100);
            attempt++;
            await sleep(backoffMs);
            continue;
        }

        try {
            const user = await readUserTokens(userId);
            if (!tokenExpiresSoon(user.tokenExpiresAt))
                return decryptToken(user.traktAccessToken, resolveApiSecret());

            const tokenUrl = "https://api.trakt.tv/oauth/token";
            const proxyUrl = await getProxyUrl();
            const tokenRes = await providerFetch({
                url: tokenUrl,
                init: {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        refresh_token: decryptToken(user.traktRefreshToken, resolveApiSecret()),
                        client_id: process.env.TRAKT_CLIENT_ID,
                        client_secret: process.env.TRAKT_CLIENT_SECRET,
                        redirect_uri: process.env.TRAKT_REDIRECT_URI,
                        grant_type: "refresh_token",
                    }),
                },
                proxyUrl,
                timeoutMs: FETCH_TIMEOUT_MS,
                maxRetries: 0,
                prefix: "trakt:refresh",
                rateLimiter: getProviderRateLimiter("trakt"),
            });

            if (!tokenRes.ok) {
                throw new TraktApiError(tokenRes.status, await tokenRes.text());
            }

            const data = (await tokenRes.json()) as {
                access_token: string;
                refresh_token: string;
                expires_in: number;
            };

            const apiSecret = resolveApiSecret();
            const updated = await getDb()
                .update(users)
                .set({
                    traktAccessToken: encryptToken(data.access_token, apiSecret),
                    traktRefreshToken: encryptToken(data.refresh_token, apiSecret),
                    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
                    updatedAt: new Date(),
                })
                .where(
                    and(eq(users.id, userId), eq(users.traktRefreshToken, user.traktRefreshToken)),
                )
                .returning({ traktAccessToken: users.traktAccessToken });

            if (updated.length === 0) {
                const latest = await readUserTokens(userId);
                if (!tokenExpiresSoon(latest.tokenExpiresAt))
                    return decryptToken(latest.traktAccessToken, resolveApiSecret());
                throw new Error(`Token refresh lost update race for user ${userId}`);
            }

            return data.access_token;
        } finally {
            await releaseOwnedLock(lockKey, lockValue);
        }
    }

    const user = await readUserTokens(userId);
    if (!tokenExpiresSoon(user.tokenExpiresAt))
        return decryptToken(user.traktAccessToken, resolveApiSecret());

    throw new Error(`Token refresh lock timed out for user ${userId}`);
}

// Cache TTLs in milliseconds
const CACHE_TTL_7D = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_24H = 24 * 60 * 60 * 1000;

interface TraktWatchingResponse {
    expires_at: string;
    started_at: string;
    action: "watch";
    type: "episode";
    episode: {
        season: number;
        number: number;
        title: string;
        runtime: number | null;
        ids: { trakt: number; tvdb: number; imdb: string; tmdb: number };
    };
    show: {
        title: string;
        ids: {
            trakt: number;
            slug: string;
            tvdb: number;
            imdb: string;
            tmdb: number;
        };
    };
}

export interface TraktSearchResultItem {
    type: "show" | "movie";
    score: number;
    show?: {
        title: string;
        year: number;
        ids: { trakt: number; slug: string; tvdb?: number; imdb?: string; tmdb?: number };
    };
    movie?: {
        title: string;
        year: number;
        ids: { trakt: number; slug: string; imdb?: string; tmdb?: number };
    };
}

export interface TraktList {
    name: string;
    description: string | null;
    privacy: "private" | "friends" | "public";
    display_numbers: boolean;
    allow_comments: boolean;
    sort_by: string;
    sort_how: string;
    created_at: string;
    updated_at: string;
    item_count: number;
    ids: { trakt: number; slug: string };
}

export interface TraktListItem {
    rank: number;
    listed_at: string;
    notes: string | null;
    type: "show" | "movie";
    show?: {
        title: string;
        year: number;
        ids: { trakt: number; slug: string; tvdb?: number; imdb?: string; tmdb?: number };
    };
    movie?: {
        title: string;
        year: number;
        ids: { trakt: number; slug: string; imdb?: string; tmdb?: number };
    };
}

export class TraktApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
    ) {
        super(`Trakt API error: ${status} ${body}`);
        this.name = "TraktApiError";
    }
}

export function getTraktClient() {
    const clientId = process.env.TRAKT_CLIENT_ID!;

    // Task 3.1: traktFetch returns data + headers for pagination support
    async function traktFetchRaw(
        path: string,
        userId: number,
        params?: Record<string, string>,
        init?: RequestInit,
    ): Promise<{ data: unknown; headers: Headers }> {
        const db = getDb();
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user) throw new Error("User not found");

        let token = decryptToken(user.traktAccessToken, resolveApiSecret());

        if (tokenExpiresSoon(user.tokenExpiresAt)) {
            token = await refreshToken(userId);
        }

        const url = new URL(`https://api.trakt.tv${path}`);
        if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

        // Resolve proxy after token refresh so that any DB select order matches
        // the original fetchWithTimeout pattern (getProxyUrl was called post-refresh).
        const proxyUrl = await getProxyUrl(userId);
        const mergedInit = {
            ...init,
            headers: {
                Authorization: `Bearer ${token}`,
                "trakt-api-version": "2",
                "trakt-api-key": clientId,
                "Content-Type": "application/json",
                ...(init?.headers as Record<string, string> | undefined),
            },
        };

        const res = await providerFetch({
            url: url.toString(),
            init: mergedInit,
            proxyUrl,
            timeoutMs: FETCH_TIMEOUT_MS,
            maxRetries: 3,
            prefix: "trakt",
            retryStatuses: [429, 500, 502, 503, 504],
            rateLimiter: getProviderRateLimiter("trakt"),
        });

        if (!res.ok) throw new TraktApiError(res.status, await res.text());

        if (res.status === 204) return { data: null, headers: res.headers };
        return { data: await res.json(), headers: res.headers };
    }

    async function traktFetch<T>(
        path: string,
        userId: number,
        params?: Record<string, string>,
    ): Promise<T> {
        const { data } = await traktFetchRaw(path, userId, params);
        return data as T;
    }

    return {
        getWatchedShows: (userId: number) =>
            traktFetch<TraktWatchedShow[]>("/sync/watched/shows?extended=noseasons", userId),

        getWatchedMovies: (userId: number) =>
            traktFetch<TraktWatchedMovie[]>("/sync/watched/movies", userId),

        // getHistory fetches /sync/history (episodes + movies) so incremental sync
        // can pick up both media types in one pass, rather than calling two endpoints.
        getHistory: async (userId: number, startAt?: string): Promise<TraktHistoryEntry[]> => {
            const all: TraktHistoryEntry[] = [];
            let page = 1;

            while (true) {
                const params: Record<string, string> = {
                    limit: "100",
                    page: String(page),
                };
                if (startAt) params.start_at = startAt;

                const { data, headers } = await traktFetchRaw("/sync/history", userId, params);
                all.push(...(data as TraktHistoryEntry[]));

                const rawPageCount = parseInt(headers.get("X-Pagination-Page-Count") ?? "1", 10);
                const pageCount =
                    Number.isFinite(rawPageCount) && rawPageCount > 0 ? rawPageCount : 1;
                if (!Number.isFinite(rawPageCount) || rawPageCount < 1) {
                    console.warn("[trakt] Invalid X-Pagination-Page-Count, defaulting to 1");
                }
                if (page >= pageCount) break;
                page++;
            }

            return all;
        },

        getMovieHistory: async (userId: number): Promise<TraktMovieHistoryEntry[]> => {
            const all: TraktMovieHistoryEntry[] = [];
            let page = 1;

            while (true) {
                const { data, headers } = await traktFetchRaw("/sync/history/movies", userId, {
                    limit: "100",
                    page: String(page),
                });
                all.push(...(data as TraktMovieHistoryEntry[]));

                const rawPageCount = parseInt(headers.get("X-Pagination-Page-Count") ?? "1", 10);
                const pageCount =
                    Number.isFinite(rawPageCount) && rawPageCount > 0 ? rawPageCount : 1;
                if (!Number.isFinite(rawPageCount) || rawPageCount < 1) {
                    console.warn("[trakt] Invalid X-Pagination-Page-Count, defaulting to 1");
                }
                if (page >= pageCount) break;
                page++;
            }

            return all;
        },

        getShowProgress: (userId: number, traktId: number) =>
            traktFetch<TraktShowProgress>(
                `/shows/${traktId}/progress/watched?specials=true`,
                userId,
            ),

        getWatching: async (userId: number): Promise<TraktWatchingResponse | null> => {
            const { data } = await traktFetchRaw("/users/me/watching?extended=full", userId);
            if (!data) return null;
            if ((data as { type?: string }).type !== "episode") return null;
            return data as TraktWatchingResponse;
        },

        getShowDetail: async (
            traktId: number,
            userId: number,
            forceRefresh = false,
        ): Promise<TraktShowDetail> => {
            const db = getDb();
            const externalId = `trakt_show_${traktId}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(
                    and(
                        eq(metadataCache.source, "trakt_show"),
                        eq(metadataCache.externalId, externalId),
                    ),
                );
            if (
                !forceRefresh &&
                cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D
            ) {
                return cached.data as TraktShowDetail;
            }
            const data = await traktFetch<TraktShowDetail>(
                `/shows/${traktId}?extended=full`,
                userId,
            );
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

        getSeasons: async (
            traktId: number,
            userId: number,
            forceRefresh = false,
        ): Promise<TraktSeasonDetail[]> => {
            const db = getDb();
            const externalId = `trakt_seasons_${traktId}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(
                    and(
                        eq(metadataCache.source, "trakt_seasons"),
                        eq(metadataCache.externalId, externalId),
                    ),
                );
            if (
                !forceRefresh &&
                cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_7D
            ) {
                return cached.data as TraktSeasonDetail[];
            }
            const data = await traktFetch<TraktSeasonDetail[]>(
                `/shows/${traktId}/seasons?extended=full`,
                userId,
            );
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

        getEpisodes: async (
            traktId: number,
            seasonNumber: number,
            userId: number,
            forceRefresh = false,
        ): Promise<TraktEpisodeDetail[]> => {
            const db = getDb();
            const externalId = `trakt_episodes_${traktId}_s${seasonNumber}`;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(
                    and(
                        eq(metadataCache.source, "trakt_episodes"),
                        eq(metadataCache.externalId, externalId),
                    ),
                );
            if (
                !forceRefresh &&
                cached &&
                Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_24H
            ) {
                return cached.data as TraktEpisodeDetail[];
            }
            const data = await traktFetch<TraktEpisodeDetail[]>(
                `/shows/${traktId}/seasons/${seasonNumber}/episodes?extended=full`,
                userId,
            );
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

        getEpisodeRating: async (
            traktId: number,
            season: number,
            episode: number,
            userId: number,
        ): Promise<number | null> => {
            // P2-T04: ratings change slowly — cache for 24h instead of a live fetch on every
            // episode detail view, with stale fallback on provider failure.
            const db = getDb();
            const cacheKey = `${traktId}_s${season}e${episode}`;
            const RATING_TTL_MS = 24 * 60 * 60 * 1000;
            const [cached] = await db
                .select()
                .from(metadataCache)
                .where(
                    and(
                        eq(metadataCache.source, "trakt_episode_rating"),
                        eq(metadataCache.externalId, cacheKey),
                    ),
                );
            if (cached) {
                const age = Date.now() - new Date(cached.cachedAt).getTime();
                if (age < RATING_TTL_MS) {
                    return (cached.data as { rating: number | null }).rating;
                }
            }
            try {
                const data = await traktFetch<{
                    rating: number;
                    votes: number;
                }>(`/shows/${traktId}/seasons/${season}/episodes/${episode}/ratings`, userId);
                // Convert 0-10 float to 0-100 integer
                const rating = Math.round(data.rating * 10);
                await db
                    .insert(metadataCache)
                    .values({
                        source: "trakt_episode_rating",
                        externalId: cacheKey,
                        data: { rating },
                        cachedAt: new Date(),
                    })
                    .onConflictDoUpdate({
                        target: [metadataCache.source, metadataCache.externalId],
                        set: { data: { rating }, cachedAt: new Date() },
                    });
                return rating;
            } catch (e) {
                if (cached) {
                    return (cached.data as { rating: number | null }).rating;
                }
                console.warn(
                    `[trakt] Episode rating fetch failed for ${traktId} s${season}e${episode}:`,
                    e,
                );
                return null; // Degradation
            }
        },

        // Watchlist methods
        getWatchlistShows: (userId: number) =>
            traktFetch<TraktWatchlistShow[]>("/sync/watchlist/shows", userId),

        getWatchlistMovies: (userId: number) =>
            traktFetch<TraktWatchlistMovie[]>("/sync/watchlist/movies", userId),

        addToWatchlist: async (
            userId: number,
            type: "shows" | "movies",
            ids: { trakt?: number; tmdb?: number; imdb?: string },
        ): Promise<void> => {
            await traktFetchRaw("/sync/watchlist", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [type]: [{ ids }],
                }),
            });
        },

        removeFromWatchlist: async (
            userId: number,
            type: "shows" | "movies",
            ids: { trakt?: number; tmdb?: number; imdb?: string },
        ): Promise<void> => {
            await traktFetchRaw("/sync/watchlist/remove", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [type]: [{ ids }],
                }),
            });
        },

        searchShows: (userId: number, q: string, limit = 8) =>
            traktFetch<TraktSearchResultItem[]>("/search/show", userId, {
                query: q,
                limit: String(limit),
            }),

        searchMovies: (userId: number, q: string, limit = 8) =>
            traktFetch<TraktSearchResultItem[]>("/search/movie", userId, {
                query: q,
                limit: String(limit),
            }),

        // Discovery
        getTrendingShows: (userId: number, limit = 20) =>
            traktFetch<TraktTrendingShow[]>("/shows/trending", userId, { limit: String(limit) }),
        getPopularShows: (userId: number, limit = 20) =>
            traktFetch<TraktPopularShow[]>("/shows/popular", userId, { limit: String(limit) }),
        getTrendingMovies: (userId: number, limit = 20) =>
            traktFetch<TraktTrendingMovie[]>("/movies/trending", userId, { limit: String(limit) }),
        getPopularMovies: (userId: number, limit = 20) =>
            traktFetch<TraktPopularMovie[]>("/movies/popular", userId, { limit: String(limit) }),

        // Rating methods
        getRatingsShows: (userId: number) =>
            traktFetch<TraktRatingShow[]>("/sync/ratings/shows", userId),

        getRatingsMovies: (userId: number) =>
            traktFetch<TraktRatingMovie[]>("/sync/ratings/movies", userId),

        addRating: async (
            userId: number,
            type: "shows" | "movies",
            ids: { trakt?: number; tmdb?: number; imdb?: string },
            rating: number,
        ): Promise<void> => {
            await traktFetchRaw("/sync/ratings", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [type]: [{ ids, rating }],
                }),
            });
        },

        removeRating: async (
            userId: number,
            type: "shows" | "movies",
            ids: { trakt?: number; tmdb?: number; imdb?: string },
        ): Promise<void> => {
            await traktFetchRaw("/sync/ratings/remove", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [type]: [{ ids }],
                }),
            });
        },

        // ── List methods ────────────────────────────────────────────────────

        getLists: (userId: number) => traktFetch<TraktList[]>("/users/me/lists", userId),

        getListItems: (userId: number, slug: string) =>
            traktFetch<TraktListItem[]>(`/users/me/lists/${slug}/items`, userId),

        createList: async (
            userId: number,
            data: {
                name: string;
                description?: string;
                privacy?: string;
                sort_by?: string;
                sort_how?: string;
            },
        ): Promise<TraktList> => {
            const { data: result } = await traktFetchRaw("/users/me/lists", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            return result as TraktList;
        },

        updateList: async (
            userId: number,
            slug: string,
            data: { name?: string; description?: string; privacy?: string },
        ): Promise<TraktList> => {
            const { data: result } = await traktFetchRaw(
                `/users/me/lists/${slug}`,
                userId,
                undefined,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                },
            );
            return result as TraktList;
        },

        deleteList: async (userId: number, slug: string): Promise<void> => {
            await traktFetchRaw(`/users/me/lists/${slug}`, userId, undefined, {
                method: "DELETE",
            });
        },

        addListItems: async (
            userId: number,
            slug: string,
            items: Array<{ type: "show" | "movie"; ids: { trakt?: number; tmdb?: number } }>,
        ): Promise<void> => {
            const body: Record<string, Array<{ ids: object }>> = { shows: [], movies: [] };
            for (const item of items) {
                if (item.type === "show") body.shows.push({ ids: item.ids });
                else body.movies.push({ ids: item.ids });
            }
            await traktFetchRaw(`/users/me/lists/${slug}/items`, userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        },

        removeListItems: async (
            userId: number,
            slug: string,
            items: Array<{ type: "show" | "movie"; ids: { trakt?: number; tmdb?: number } }>,
        ): Promise<void> => {
            const body: Record<string, Array<{ ids: object }>> = { shows: [], movies: [] };
            for (const item of items) {
                if (item.type === "show") body.shows.push({ ids: item.ids });
                else body.movies.push({ ids: item.ids });
            }
            await traktFetchRaw(`/users/me/lists/${slug}/items/remove`, userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        },

        // ── Collection ──────────────────────────────────────────────────────
        getCollectionShows: async (userId: number): Promise<unknown[]> => {
            return traktFetch<unknown[]>("/sync/collection/shows", userId);
        },

        getCollectionMovies: async (userId: number): Promise<unknown[]> => {
            return traktFetch<unknown[]>("/sync/collection/movies", userId);
        },

        removeCollectionShows: async (
            userId: number,
            items: Array<{ ids: { trakt?: number; tmdb?: number } }>,
        ): Promise<void> => {
            await traktFetchRaw("/sync/collection/remove", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shows: items }),
            });
        },

        removeCollectionMovies: async (
            userId: number,
            items: Array<{ ids: { trakt?: number; tmdb?: number } }>,
        ): Promise<void> => {
            await traktFetchRaw("/sync/collection/remove", userId, undefined, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ movies: items }),
            });
        },
    };
}
