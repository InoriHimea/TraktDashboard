import { getDb, metadataCache, userSettings } from "@trakt-dashboard/db";
import { eq, and } from "drizzle-orm";
import { providerFetch } from "../lib/http.js";
import { getProviderRateLimiter } from "../lib/rate-limit.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 12000;

// Per-source cache TTLs (P2-T04). Show/movie/season metadata is stable (30d); episode
// detail changes more often (7d). On provider failure we serve stale cache within a grace
// window so a transient TMDB outage degrades gracefully instead of erroring.
const CACHE_TTL_HOURS: Record<string, number> = {
    tmdb_show: 24 * 30,
    tmdb_movie: 24 * 30,
    tmdb_season: 24 * 30,
    tmdb_episode: 24 * 7,
};
const DEFAULT_TTL_HOURS = 24 * 7;
const STALE_GRACE_HOURS = 24 * 14;
// Longest a row can stay useful (max TTL + grace). The cleanup job must not delete inside this.
export const METADATA_MAX_AGE_HOURS = 24 * 30 + STALE_GRACE_HOURS;

function ttlHoursFor(source: string): number {
    return CACHE_TTL_HOURS[source] ?? DEFAULT_TTL_HOURS;
}

interface CachedFetchOptions<T> {
    source: string;
    cacheKey: string;
    fetcher: () => Promise<T>;
    /** Skip the freshness check and always re-fetch, but still fall back to stale on failure. */
    forceRefresh?: boolean;
}

// P2-T04: stale-while-revalidate cache wrapper. Fresh cache short-circuits; on a provider
// failure a still-within-grace stale row is served instead of throwing.
async function cachedProviderFetch<T>({
    source,
    cacheKey,
    fetcher,
    forceRefresh = false,
}: CachedFetchOptions<T>): Promise<T> {
    const db = getDb();
    const [cached] = await db
        .select()
        .from(metadataCache)
        .where(and(eq(metadataCache.source, source), eq(metadataCache.externalId, cacheKey)));

    const now = Date.now();
    const ttlMs = ttlHoursFor(source) * 60 * 60 * 1000;
    const graceMs = (ttlHoursFor(source) + STALE_GRACE_HOURS) * 60 * 60 * 1000;
    const ageMs = cached ? now - new Date(cached.cachedAt).getTime() : Infinity;

    if (cached && !forceRefresh && ageMs < ttlMs) {
        return cached.data as T;
    }

    try {
        const data = await fetcher();
        await db
            .insert(metadataCache)
            .values({ source, externalId: cacheKey, data, cachedAt: new Date() })
            .onConflictDoUpdate({
                target: [metadataCache.source, metadataCache.externalId],
                set: { data, cachedAt: new Date() },
            });
        return data;
    } catch (e) {
        if (cached && ageMs < graceMs) {
            console.warn(
                `[tmdb] Serving stale ${source}/${cacheKey} (age ${Math.round(ageMs / 3.6e6)}h) after fetch failure`,
            );
            return cached.data as T;
        }
        throw e;
    }
}

// ─── Dynamic proxy (Task 6.3) ─────────────────────────────────────────────────
export async function getProxyUrl(userId?: number): Promise<string | undefined> {
    if (userId) {
        try {
            const db = getDb();
            const [row] = await db
                .select({ httpProxy: userSettings.httpProxy })
                .from(userSettings)
                .where(eq(userSettings.userId, userId));
            if (row?.httpProxy) return row.httpProxy;
        } catch {
            /* fall through */
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

async function tmdbFetch<T>(
    path: string,
    params?: Record<string, string>,
    userId?: number,
): Promise<T> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        throw new Error("[tmdb] TMDB_API_KEY environment variable is not set");
    }
    const url = new URL(`${TMDB_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const proxyUrl = await getProxyUrl(userId);

    // TMDB supports two auth methods:
    // - v4 Read Access Token (long JWT starting with "eyJ"): Authorization: Bearer <token>
    // - v3 API Key (short alphanumeric): ?api_key=<key>
    const isBearer = apiKey.startsWith("eyJ");
    const headers: Record<string, string> = {
        ...(isBearer ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
    if (!isBearer) {
        url.searchParams.set("api_key", apiKey);
    }

    const res = await providerFetch({
        url: url.toString(),
        init: { headers },
        proxyUrl,
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRetries: 3,
        prefix: "tmdb",
        rateLimiter: getProviderRateLimiter("tmdb"),
    });
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
    return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TmdbShow {
    id: number;
    name: string;
    original_name: string;
    original_language: string; // e.g. "ja", "en", "ko", "zh"
    overview: string;
    status: string;
    first_air_date: string;
    networks: Array<{ name: string }>;
    genres: Array<{ id: number; name: string }>;
    poster_path: string | null;
    backdrop_path: string | null;
    number_of_episodes: number;
    number_of_seasons: number;
    external_ids?: { imdb_id?: string; tvdb_id?: number };
    seasons: Array<{
        id: number;
        season_number: number;
        episode_count: number;
        air_date: string;
        overview: string;
        poster_path: string | null;
    }>;
    translations?: {
        translations: Array<{
            iso_3166_1: string;
            iso_639_1: string;
            name: string;
            english_name: string;
            data: {
                name: string;
                overview: string;
                homepage: string;
                tagline: string;
            };
        }>;
    };
}

export interface TmdbMovie {
    id: number;
    title: string;
    original_title: string;
    original_language: string;
    overview: string | null;
    release_date: string | null;
    runtime: number | null;
    genres: Array<{ id: number; name: string }>;
    poster_path: string | null;
    backdrop_path: string | null;
    imdb_id: string | null;
    translations?: {
        translations: Array<{
            iso_3166_1: string;
            iso_639_1: string;
            name: string;
            english_name: string;
            data: {
                title: string;
                overview: string;
                homepage: string;
                tagline: string;
            };
        }>;
    };
}

export interface TmdbSeason {
    id: number;
    season_number: number;
    episodes: Array<{
        id: number;
        episode_number: number;
        season_number: number;
        name: string;
        overview: string;
        runtime: number | null;
        air_date: string | null;
        still_path: string | null;
    }>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Task 6.2: language param → separate cache key per language
export async function getTmdbShow(
    tmdbId: number,
    language?: string,
    userId?: number,
): Promise<TmdbShow> {
    const cacheKey = language ? `${tmdbId}_${language}` : String(tmdbId);
    const params: Record<string, string> = {
        append_to_response: "external_ids,translations",
    };
    if (language) params.language = language;

    return cachedProviderFetch<TmdbShow>({
        source: "tmdb_show",
        cacheKey,
        fetcher: () => tmdbFetch<TmdbShow>(`/tv/${tmdbId}`, params, userId),
    });
}

export async function getTmdbMovie(
    tmdbId: number,
    userId?: number,
    language?: string,
): Promise<TmdbMovie> {
    const cacheKey = `tmdb_movie_${tmdbId}_${language || "base"}`;
    const params: Record<string, string> = {
        append_to_response: "translations",
    };
    if (language) params.language = language;

    return cachedProviderFetch<TmdbMovie>({
        source: "tmdb_movie",
        cacheKey,
        fetcher: () => tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, params, userId),
    });
}

export async function getTmdbSeason(
    tmdbId: number,
    seasonNumber: number,
    language?: string,
    userId?: number,
    forceRefresh?: boolean,
): Promise<TmdbSeason> {
    // Language-aware cache key — prevents stale English cache being reused for localized requests
    const cacheKey = language
        ? `${tmdbId}_s${seasonNumber}_${language}`
        : `${tmdbId}_s${seasonNumber}`;

    const params: Record<string, string> = {};
    if (language) params.language = language;

    return cachedProviderFetch<TmdbSeason>({
        source: "tmdb_season",
        cacheKey,
        forceRefresh,
        fetcher: () =>
            tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${seasonNumber}`, params, userId),
    });
}

export function getTmdbImageUrl(path: string | null, size = "w500"): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function getTmdbEpisodeDetail(
    tmdbShowId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
    userId?: number,
): Promise<{ directors: string[] }> {
    const cacheKey = language
        ? `tmdb_episode_${tmdbShowId}_s${seasonNumber}e${episodeNumber}_${language}`
        : `tmdb_episode_${tmdbShowId}_s${seasonNumber}e${episodeNumber}`;

    const params: Record<string, string> = { append_to_response: "credits" };
    if (language) params.language = language;

    try {
        // cachedProviderFetch handles per-source TTL + stale-while-revalidate; the outer
        // catch preserves the existing graceful degradation when no cache is available.
        return await cachedProviderFetch<{ directors: string[] }>({
            source: "tmdb_episode",
            cacheKey,
            fetcher: async () => {
                const data = await tmdbFetch<{
                    credits?: { crew?: Array<{ job?: string; name?: string }> };
                }>(
                    `/tv/${tmdbShowId}/season/${seasonNumber}/episode/${episodeNumber}`,
                    params,
                    userId,
                );
                const directors = (data.credits?.crew ?? [])
                    .filter((c) => c.job === "Director")
                    .map((c) => c.name)
                    .filter((name): name is string => Boolean(name));
                return { directors };
            },
        });
    } catch (e) {
        console.warn(
            `[tmdb] Episode detail fetch failed for ${tmdbShowId} s${seasonNumber}e${episodeNumber}:`,
            e,
        );
        return { directors: [] }; // Degradation: return empty
    }
}
