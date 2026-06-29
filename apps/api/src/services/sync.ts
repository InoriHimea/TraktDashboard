import {
    getDb,
    shows,
    seasons,
    episodes,
    movies,
    watchHistory,
    userShowProgress,
    userMovieProgress,
    syncState,
    userSettings,
    watchResetCursors,
    watchlist,
    userRatings,
    userCollection,
} from "@trakt-dashboard/db";
import {
    eq,
    and,
    sql,
    or,
    gt,
    isNull,
    isNotNull,
    desc,
    inArray,
    notInArray,
    ne,
} from "drizzle-orm";
import { getTraktClient } from "./trakt.js";
import type {
    TraktMovieHistoryEntry,
    TraktWatchedMovie,
    TraktShowProgress,
    TraktRatingShow,
    TraktRatingMovie,
} from "./trakt.js";
import { getTmdbShow, getTmdbSeason, getTmdbMovie } from "./tmdb.js";
import pLimit from "p-limit";
import dayjs from "dayjs";
import { withTimeout } from "../lib/timeout.js";
import { buildLanguageFallbackChain } from "@trakt-dashboard/i18n";
import { startSyncRun, endSyncRun, recordError } from "../lib/observability.js";

// Concurrency: 5 shows in parallel, each show's seasons also fetched in parallel
const SHOW_CONCURRENCY = 5;
const SEASON_CONCURRENCY = 4;
// Per-show hard timeout (ms) — prevents one stuck show from blocking a slot forever
const SHOW_TIMEOUT_MS = 90_000;

// Language fallback chain logic now lives in the shared @trakt-dashboard/i18n package (P2-T12).

// T04: window for force-refreshing missing translations. Episodes that aired within
// this window (or with an unknown air date) are eligible for a per-language cache-busting
// re-fetch; older episodes are not, to bound full-sync TMDB fanout.
const FORCE_REFRESH_AIR_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function airedWithinForceRefreshWindow(
    firstAired: string | null | undefined,
    now: number = Date.now(),
): boolean {
    if (!firstAired) return true; // unknown air date — refresh once, may be a brand-new episode
    const airedMs = Date.parse(firstAired);
    if (Number.isNaN(airedMs)) return true;
    return now - airedMs <= FORCE_REFRESH_AIR_WINDOW_MS;
}

type FailedShow = {
    tmdbId: number;
    title: string;
    error: string;
    retryCount?: number;
};

// Loose Trakt-show shape accepted by the upsert path. Most call sites pass a real
// TraktShow, but retry/forceSync paths pass synthetic fallbacks ({} or { ids: {} }),
// and the upsert only reads ids via optional chaining.
type TraktShowInput = {
    title?: string;
    year?: number;
    ids?: {
        trakt?: number;
        slug?: string;
        tvdb?: number;
        imdb?: string;
        tmdb?: number;
    };
};

function toErrorMessage(e: unknown): string {
    return String((e as { message?: string })?.message || e || "Unknown error");
}

async function ensureSyncState(userId: number) {
    await getDb().insert(syncState).values({ userId }).onConflictDoNothing();
}

async function markSyncRunning(
    userId: number,
    currentShow: string,
    resetFailedShows = false,
): Promise<boolean> {
    await ensureSyncState(userId);
    const result = await getDb()
        .update(syncState)
        .set({
            status: "running",
            progress: 0,
            total: 0,
            error: null,
            currentShow,
            ...(resetFailedShows ? { failedShows: [] } : {}),
            updatedAt: new Date(),
        })
        .where(and(eq(syncState.userId, userId), ne(syncState.status, "running")))
        .returning({ id: syncState.id });
    return result.length > 0;
}

export async function getSyncStatus(userId: number) {
    await ensureSyncState(userId);
    const [state] = await getDb().select().from(syncState).where(eq(syncState.userId, userId));
    return state;
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function triggerFullSync(userId: number): Promise<void> {
    const db = getDb();
    const acquired = await markSyncRunning(userId, "Fetching watched shows from Trakt…", true);
    if (!acquired) {
        console.log(`[sync] Full sync already running for user ${userId}, skipping`);
        return;
    }

    const run = startSyncRun(); // P2-T05 observability
    console.log(`[sync] Full sync run ${run.runId} started for user ${userId}`);
    try {
        const trakt = getTraktClient();
        const watchedShows = await trakt.getWatchedShows(userId);
        console.log(`[sync] Found ${watchedShows.length} watched shows`);

        await db
            .update(syncState)
            .set({ total: watchedShows.length, updatedAt: new Date() })
            .where(eq(syncState.userId, userId));

        let processed = 0;
        const failureMap = new Map<number, FailedShow>();
        const limit = pLimit(SHOW_CONCURRENCY);

        await Promise.all(
            watchedShows.map((ws) =>
                limit(async () => {
                    const tmdbId = ws.show.ids.tmdb;
                    const title = ws.show.title;

                    if (!tmdbId) {
                        failureMap.set(0, {
                            tmdbId: 0,
                            title,
                            error: "Missing TMDB id",
                        });
                        processed++;
                        return;
                    }

                    try {
                        await withTimeout(
                            syncSingleShow(
                                userId,
                                {
                                    tmdbId,
                                    traktId: ws.show.ids.trakt || null,
                                    title,
                                    traktShow: ws.show,
                                },
                                true,
                            ),
                            SHOW_TIMEOUT_MS,
                            title,
                        );
                    } catch (e) {
                        console.error(`[sync] Error syncing "${title}":`, toErrorMessage(e));
                        failureMap.set(tmdbId, {
                            tmdbId,
                            title,
                            error: toErrorMessage(e),
                        });
                    } finally {
                        processed++;
                        await db
                            .update(syncState)
                            .set({
                                progress: processed,
                                currentShow: `${processed}/${watchedShows.length} · ${title}`,
                                failedShows: Array.from(failureMap.values()),
                                updatedAt: new Date(),
                            })
                            .where(eq(syncState.userId, userId));
                        console.log(`[sync] ${processed}/${watchedShows.length} ${title}`);
                    }
                }),
            ),
        );

        // Retry failed shows once
        if (failureMap.size > 0) {
            console.log(`[sync] Retrying ${failureMap.size} failed shows…`);
            await db
                .update(syncState)
                .set({
                    currentShow: `Retrying ${failureMap.size} failed shows…`,
                    updatedAt: new Date(),
                })
                .where(eq(syncState.userId, userId));

            const retryLimit = pLimit(2);
            await Promise.all(
                Array.from(failureMap.values()).map((f) =>
                    retryLimit(async () => {
                        try {
                            await withTimeout(
                                syncSingleShow(
                                    userId,
                                    {
                                        tmdbId: f.tmdbId,
                                        traktId:
                                            watchedShows.find((s) => s.show.ids.tmdb === f.tmdbId)
                                                ?.show.ids.trakt || null,
                                        title: f.title,
                                        traktShow: watchedShows.find(
                                            (s) => s.show.ids.tmdb === f.tmdbId,
                                        )?.show || { ids: {} },
                                    },
                                    true,
                                ),
                                SHOW_TIMEOUT_MS,
                                f.title,
                            );
                            failureMap.delete(f.tmdbId);
                        } catch (e) {
                            failureMap.set(f.tmdbId, {
                                ...f,
                                error: toErrorMessage(e),
                                retryCount: (f.retryCount ?? 0) + 1,
                            });
                            console.error(
                                `[sync] Retry failed for "${f.title}":`,
                                toErrorMessage(e),
                            );
                        }
                    }),
                ),
            );
        }

        // Sync movies after shows
        await db
            .update(syncState)
            .set({ currentShow: "Syncing movies…", updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        await syncMovies(userId);

        // Sync watchlist after movies
        await db
            .update(syncState)
            .set({ currentShow: "Syncing watchlist…", updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        await syncWatchlist(userId);

        // Sync ratings after watchlist
        await db
            .update(syncState)
            .set({ currentShow: "Syncing ratings…", updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        await syncRatings(userId);

        // Sync collection after ratings (add-only local archive)
        await db
            .update(syncState)
            .set({ currentShow: "Syncing collection…", updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        await syncUserCollection(userId);

        await db
            .update(syncState)
            .set({
                status: "completed",
                lastSyncAt: new Date(),
                currentShow: null,
                progress: processed,
                failedShows: Array.from(failureMap.values()),
                updatedAt: new Date(),
            })
            .where(eq(syncState.userId, userId));

        console.log(`[sync] Full sync complete. ${failureMap.size} failures.`);
    } catch (e) {
        recordError();
        await db
            .update(syncState)
            .set({ status: "error", error: toErrorMessage(e), updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        throw e;
    } finally {
        const m = endSyncRun();
        if (m) {
            console.log(
                `[sync] run ${m.runId} finished in ${m.durationMs}ms — provider calls ${m.providerCalls.total} (tmdb ${m.providerCalls.tmdb}, trakt ${m.providerCalls.trakt}), retries ${m.retries}, 429s ${m.rateLimited}, errors ${m.errors}`,
            );
        }
    }
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function triggerIncrementalSync(userId: number): Promise<void> {
    const db = getDb();
    const state = await getSyncStatus(userId);
    const acquired = await markSyncRunning(userId, "Fetching recent history…");
    if (!acquired) return;

    const run = startSyncRun(); // P2-T05 observability
    console.log(`[sync:incr] run ${run.runId} started for user ${userId}`);
    try {
        const trakt = getTraktClient();
        const startAt = state?.lastSyncAt ? dayjs(state.lastSyncAt).toISOString() : undefined;
        const history = await trakt.getHistory(userId, startAt);
        console.log(`[sync:incr] ${history.length} new entries since ${startAt || "beginning"}`);

        const showMap = new Map<number, typeof history>();
        for (const entry of history) {
            if (entry.type !== "episode") continue;
            const tmdbId = entry.show!.ids.tmdb;
            if (!tmdbId) continue;
            if (!showMap.has(tmdbId)) showMap.set(tmdbId, []);
            showMap.get(tmdbId)!.push(entry);
        }

        const totalShows = showMap.size;
        let processed = 0;
        // Track the earliest watched_at among failed entries so we can roll back
        // the cursor to before the first failure — ensuring gaps are re-fetched
        // on the next incremental sync rather than silently dropped.
        let failedEntryMinWatchedAt: Date | null = null;
        await db
            .update(syncState)
            .set({ total: totalShows, updatedAt: new Date() })
            .where(eq(syncState.userId, userId));

        const limit = pLimit(SHOW_CONCURRENCY);
        await Promise.all(
            Array.from(showMap.entries()).map(([tmdbId, entries]) =>
                limit(async () => {
                    try {
                        const traktId = entries[0].show!.ids.trakt;
                        if (!traktId) {
                            console.warn(
                                `[sync:incr] Missing Trakt id for tmdb ${tmdbId}, skipping`,
                            );
                            return;
                        }
                        const showId = await upsertShowFromTrakt(
                            traktId,
                            entries[0].show!,
                            userId,
                            true,
                        );
                        for (const entry of entries) {
                            const ep = await findOrCreateEpisode(
                                showId,
                                tmdbId,
                                entry.episode!.season,
                                entry.episode!.number,
                                userId,
                            );
                            if (!ep) continue;
                            // Use traktPlayId unique constraint for dedup
                            const traktPlayId = String(entry.id);
                            await db
                                .insert(watchHistory)
                                .values({
                                    userId,
                                    episodeId: ep.id,
                                    watchedAt: new Date(entry.watched_at),
                                    traktPlayId,
                                })
                                .onConflictDoUpdate({
                                    target: watchHistory.traktPlayId,
                                    set: {
                                        episodeId: ep.id,
                                        watchedAt: new Date(entry.watched_at),
                                    },
                                });
                        }
                        await recalcShowProgress(userId, showId);
                    } catch (e) {
                        console.error(`[sync:incr] Error on tmdb ${tmdbId}:`, toErrorMessage(e));
                        // Record the earliest watched_at of this failed show's entries
                        // so we can roll back the cursor to before this failure.
                        for (const entry of entries) {
                            const t = new Date(entry.watched_at);
                            if (!failedEntryMinWatchedAt || t < failedEntryMinWatchedAt) {
                                failedEntryMinWatchedAt = t;
                            }
                        }
                    } finally {
                        processed++;
                        await db
                            .update(syncState)
                            .set({
                                progress: processed,
                                currentShow: `${processed}/${totalShows} · ${entries[0]?.show?.title || `tmdb:${tmdbId}`}`,
                                updatedAt: new Date(),
                            })
                            .where(eq(syncState.userId, userId));
                    }
                }),
            ),
        );

        // ── Incremental movie history ─────────────────────────────────────────
        const movieEntries = history.filter((e) => e.type === "movie") as Array<
            (typeof history)[0] & {
                movie: {
                    title: string;
                    year: number | null;
                    ids: { trakt: number; slug: string; imdb: string | null; tmdb: number | null };
                };
            }
        >;
        const movieMap = new Map<number, typeof movieEntries>();
        for (const entry of movieEntries) {
            const traktId = entry.movie?.ids?.trakt;
            if (!traktId) continue;
            if (!movieMap.has(traktId)) movieMap.set(traktId, []);
            movieMap.get(traktId)!.push(entry);
        }

        if (movieMap.size > 0) {
            await db
                .update(syncState)
                .set({ currentShow: `Syncing ${movieMap.size} movie(s)…`, updatedAt: new Date() })
                .where(eq(syncState.userId, userId));

            await Promise.all(
                Array.from(movieMap.entries()).map(([movieTraktId, entries]) =>
                    limit(async () => {
                        try {
                            const tmdbId = entries[0].movie?.ids?.tmdb;
                            const movieTitle = entries[0].movie?.title ?? `trakt:${movieTraktId}`;

                            // Resolve or upsert the movie row
                            const [existingMovie] = await db
                                .select({ id: movies.id })
                                .from(movies)
                                .where(eq(movies.traktId, movieTraktId));

                            let movieId: number;
                            if (existingMovie) {
                                movieId = existingMovie.id;
                            } else if (tmdbId) {
                                // 新电影且有 TMDB ID：拉取元数据后 upsert
                                let title = movieTitle;
                                let posterPath: string | null = null;
                                let backdropPath: string | null = null;
                                let overview: string | null = null;
                                let releaseDate: string | null = null;
                                let runtime: number | null = null;
                                let genres: string[] = [];
                                try {
                                    const tmdbData = await getTmdbMovie(tmdbId, userId);
                                    title = tmdbData.title || title;
                                    posterPath = tmdbData.poster_path ?? null;
                                    backdropPath = tmdbData.backdrop_path ?? null;
                                    overview = tmdbData.overview ?? null;
                                    releaseDate = tmdbData.release_date ?? null;
                                    runtime = tmdbData.runtime ?? null;
                                    genres = tmdbData.genres?.map((g) => g.name) ?? [];
                                } catch (e) {
                                    console.warn(
                                        `[sync:incr] TMDB fetch failed for "${movieTitle}": ${toErrorMessage(e)}`,
                                    );
                                }
                                const mov = entries[0].movie;
                                const [upserted] = await db
                                    .insert(movies)
                                    .values({
                                        tmdbId,
                                        traktId: mov.ids.trakt,
                                        traktSlug: mov.ids.slug,
                                        imdbId: mov.ids.imdb ?? null,
                                        title,
                                        overview,
                                        releaseDate,
                                        runtime,
                                        posterPath,
                                        backdropPath,
                                        genres,
                                        lastSyncedAt: new Date(),
                                    })
                                    .onConflictDoUpdate({
                                        target: [movies.tmdbId],
                                        set: { traktId: mov.ids.trakt, lastSyncedAt: new Date() },
                                    })
                                    .returning({ id: movies.id });
                                movieId = upserted.id;
                            } else {
                                // 无 TMDB ID 的新电影（如部分中文电影）：仅存 Trakt 元数据
                                console.warn(
                                    `[sync:incr] "${movieTitle}" 无 TMDB ID，使用 Trakt 元数据存储`,
                                );
                                const mov = entries[0].movie;
                                const [newMovie] = await db
                                    .insert(movies)
                                    .values({
                                        tmdbId: null,
                                        traktId: movieTraktId,
                                        traktSlug: mov.ids.slug,
                                        imdbId: mov.ids.imdb ?? null,
                                        title: movieTitle,
                                        overview: null,
                                        releaseDate: null,
                                        runtime: null,
                                        posterPath: null,
                                        backdropPath: null,
                                        genres: [],
                                        lastSyncedAt: new Date(),
                                    })
                                    .returning({ id: movies.id });
                                movieId = newMovie.id;
                            }

                            for (const entry of entries) {
                                await db
                                    .insert(watchHistory)
                                    .values({
                                        userId,
                                        movieId,
                                        episodeId: null,
                                        mediaType: "movie",
                                        watchedAt: new Date(entry.watched_at),
                                        source: "trakt",
                                        traktPlayId: String(entry.id),
                                    })
                                    .onConflictDoUpdate({
                                        target: watchHistory.traktPlayId,
                                        set: {
                                            userId,
                                            movieId,
                                            mediaType: "movie",
                                            watchedAt: new Date(entry.watched_at),
                                            source: "trakt",
                                        },
                                    });
                            }
                            await recalcMovieProgress(userId, movieId);
                            console.log(`[sync:incr] Synced movie "${entries[0].movie?.title}"`);
                        } catch (e) {
                            console.error(
                                `[sync:incr] Error on movie trakt:${movieTraktId}:`,
                                toErrorMessage(e),
                            );
                            // Mirror the show-loop cursor-rollback logic: record the earliest
                            // failed watched_at so the next incremental sync re-fetches the gap.
                            for (const entry of entries) {
                                const t = new Date(entry.watched_at);
                                if (!failedEntryMinWatchedAt || t < failedEntryMinWatchedAt) {
                                    failedEntryMinWatchedAt = t;
                                }
                            }
                        }
                    }),
                ),
            );
        }

        // ── Incremental watchlist ─────────────────────────────────────────────
        try {
            await db
                .update(syncState)
                .set({ currentShow: "Syncing watchlist…", updatedAt: new Date() })
                .where(eq(syncState.userId, userId));
            await syncWatchlist(userId);
        } catch (e) {
            console.error("[sync:incr] Watchlist sync failed:", toErrorMessage(e));
        }

        // ── Incremental ratings ───────────────────────────────────────────────
        try {
            await db
                .update(syncState)
                .set({ currentShow: "Syncing ratings…", updatedAt: new Date() })
                .where(eq(syncState.userId, userId));
            await syncRatings(userId);
        } catch (e) {
            console.error("[sync:incr] Ratings sync failed:", toErrorMessage(e));
        }

        // ── Incremental collection (add-only local archive) ───────────────────
        try {
            await db
                .update(syncState)
                .set({ currentShow: "Syncing collection…", updatedAt: new Date() })
                .where(eq(syncState.userId, userId));
            await syncUserCollection(userId);
        } catch (e) {
            console.error("[sync:incr] Collection sync failed:", toErrorMessage(e));
        }

        // Conservative cursor advance: if any show failed, roll back the cursor
        // to 1 second before the earliest failed entry so the next incremental
        // sync re-fetches that window and fills the gap automatically.
        // If everything succeeded, advance to now as usual.
        const earliestFailedWatchedAt = failedEntryMinWatchedAt as Date | null;
        const newLastSyncAt = earliestFailedWatchedAt
            ? new Date(earliestFailedWatchedAt.getTime() - 1000)
            : new Date();

        if (earliestFailedWatchedAt) {
            console.log(
                `[sync:incr] ${processed - (totalShows - 1)} show(s) failed — rolling cursor back to ${newLastSyncAt.toISOString()} to re-fetch gaps next run`,
            );
        }

        await db
            .update(syncState)
            .set({
                status: "completed",
                lastSyncAt: newLastSyncAt,
                currentShow: null,
                updatedAt: new Date(),
            })
            .where(eq(syncState.userId, userId));
    } catch (e) {
        recordError();
        await db
            .update(syncState)
            .set({ status: "error", error: toErrorMessage(e), updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
    } finally {
        const m = endSyncRun();
        if (m) {
            console.log(
                `[sync:incr] run ${m.runId} finished in ${m.durationMs}ms — provider calls ${m.providerCalls.total} (tmdb ${m.providerCalls.tmdb}, trakt ${m.providerCalls.trakt}), retries ${m.retries}, 429s ${m.rateLimited}, errors ${m.errors}`,
            );
        }
    }
}

// ─── Single show sync ─────────────────────────────────────────────────────────

export async function forceSyncShow(userId: number, showId: number): Promise<void> {
    const db = getDb();
    const [show] = await db.select().from(shows).where(eq(shows.id, showId));
    if (!show || !show.traktId) throw new Error("Show not found or missing Trakt ID");

    await syncSingleShow(
        userId,
        {
            tmdbId: show.tmdbId,
            traktId: show.traktId,
            title: show.title,
            traktShow: {}, // Not used in upsertShowFromTrakt
        },
        true, // forceRefreshMetadata
    );
}

async function syncSingleShow(
    userId: number,
    input: {
        tmdbId: number;
        traktId: number | null;
        title: string;
        traktShow: TraktShowInput;
    },
    forceRefreshMetadata = false,
) {
    if (!input.traktId) throw new Error("Missing Trakt id");
    const trakt = getTraktClient();

    const showId = await upsertShowFromTrakt(
        input.traktId,
        input.traktShow,
        userId,
        forceRefreshMetadata,
    );
    await getDb().insert(userShowProgress).values({ userId, showId }).onConflictDoNothing();

    const progress = await trakt.getShowProgress(userId, input.traktId);
    await syncEpisodeProgress(userId, showId, input.tmdbId, progress);
    await recalcShowProgress(userId, showId);
}

// ─── Trakt-primary upsert ─────────────────────────────────────────────────────

async function upsertShowFromTrakt(
    traktId: number,
    traktShow: TraktShowInput,
    userId: number,
    forceRefreshMetadata = false,
): Promise<number> {
    const db = getDb();
    const trakt = getTraktClient();

    // Read displayLanguage
    let displayLanguage: string | null = null;
    try {
        const [settings] = await db
            .select({ displayLanguage: userSettings.displayLanguage })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        displayLanguage = settings?.displayLanguage ?? null;
    } catch {
        /* ignore */
    }

    // Fetch Trakt show detail
    const traktDetail = await trakt.getShowDetail(traktId, userId, forceRefreshMetadata);

    if (!traktDetail.ids.tmdb) {
        throw new Error("Missing TMDB id (required for poster/image support)");
    }
    const tmdbId = traktDetail.ids.tmdb;

    // Fetch TMDB data for images + translations
    // Always fetch base (no language) first — this gives us reliable poster_path/backdrop_path
    // and the seasons[] array with per-season poster_path values.
    let posterPath: string | null = null;
    let backdropPath: string | null = null;
    let translatedName: string | null = null;
    let translatedOverview: string | null = null;
    let baseTmdbShow: import("./tmdb.js").TmdbShow | null = null;

    try {
        baseTmdbShow = await getTmdbShow(tmdbId, undefined, userId);
        posterPath = baseTmdbShow.poster_path || null;
        backdropPath = baseTmdbShow.backdrop_path || null;
    } catch (e) {
        console.warn(`[sync] TMDB base show fetch failed for tmdb ${tmdbId}: ${toErrorMessage(e)}`);
    }

    // Multi-language fallback chain: user locale family → show original language → English
    if (displayLanguage && baseTmdbShow) {
        const languageFallbackChain = buildLanguageFallbackChain(
            displayLanguage,
            baseTmdbShow.original_language ?? null,
        );

        const translations = baseTmdbShow.translations?.translations || [];

        for (const lang of languageFallbackChain) {
            const [langCode, countryCode] = lang.split("-");
            const match = translations.find((t) =>
                countryCode
                    ? t.iso_639_1 === langCode && t.iso_3166_1 === countryCode.toUpperCase()
                    : t.iso_639_1 === langCode,
            );

            if (match && match.data) {
                if (!translatedName && match.data.name && match.data.name !== traktDetail.title) {
                    translatedName = match.data.name;
                }
                if (
                    !translatedOverview &&
                    match.data.overview &&
                    match.data.overview !== traktDetail.overview
                ) {
                    translatedOverview = match.data.overview;
                }

                if (translatedName && translatedOverview) break;
            }
        }
    }

    // Fetch seasons from Trakt
    const traktSeasons = await trakt.getSeasons(traktId, userId, forceRefreshMetadata);
    const totalSeasons = traktSeasons.length;
    const totalEpisodes = traktSeasons.reduce((sum, s) => sum + (s.episode_count || 0), 0);

    // Upsert show
    const [show] = await db
        .insert(shows)
        .values({
            tmdbId,
            traktId: traktDetail.ids.trakt,
            traktSlug: traktDetail.ids.slug,
            tvdbId: traktDetail.ids.tvdb,
            imdbId: traktDetail.ids.imdb,
            title: traktDetail.title,
            overview: traktDetail.overview,
            status: traktDetail.status?.toLowerCase() || "unknown",
            firstAired: traktDetail.first_aired,
            network: traktDetail.network,
            genres: traktDetail.genres || [],
            posterPath,
            backdropPath,
            totalSeasons,
            totalEpisodes,
            originalName: traktDetail.title,
            originalLanguage: baseTmdbShow?.original_language ?? null,
            translatedName,
            translatedOverview,
            displayLanguage,
            lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [shows.tmdbId],
            set: {
                traktId: traktDetail.ids.trakt,
                traktSlug: traktDetail.ids.slug,
                tvdbId: traktDetail.ids.tvdb,
                title: traktDetail.title,
                overview: traktDetail.overview,
                status: traktDetail.status?.toLowerCase() || "unknown",
                firstAired: traktDetail.first_aired,
                network: traktDetail.network,
                genres: traktDetail.genres || [],
                posterPath,
                backdropPath,
                totalSeasons,
                totalEpisodes,
                originalName: traktDetail.title,
                originalLanguage: baseTmdbShow?.original_language ?? null,
                translatedName,
                translatedOverview,
                displayLanguage,
                lastSyncedAt: new Date(),
            },
        })
        .returning({ id: shows.id });

    // Build a map of season_number → poster_path from the base TMDB show data (language-neutral)
    const tmdbSeasonPosterMap = new Map<number, string | null>();
    if (baseTmdbShow) {
        for (const ts of baseTmdbShow.seasons || []) {
            tmdbSeasonPosterMap.set(ts.season_number, ts.poster_path || null);
        }
    } else {
        // baseTmdbShow failed earlier — try once more with no language
        try {
            const tmdbShowForSeasons = await getTmdbShow(tmdbId, undefined, userId);
            for (const ts of tmdbShowForSeasons.seasons || []) {
                tmdbSeasonPosterMap.set(ts.season_number, ts.poster_path || null);
            }
        } catch (e) {
            console.warn(
                `[sync] Failed to fetch TMDB season posters for tmdb ${tmdbId}: ${toErrorMessage(e)}`,
            );
        }
    }

    const sourceSeasonNumbers = traktSeasons.map((s) => s.number);
    const sourceEpisodeKeys = new Set<string>();
    let hasIncompleteEpisodeSource = false;

    // Upsert seasons + episodes concurrently
    const seasonLimit = pLimit(SEASON_CONCURRENCY);
    await Promise.all(
        traktSeasons.map((s) =>
            seasonLimit(async () => {
                const seasonPosterPath = tmdbSeasonPosterMap.get(s.number) ?? null;
                const [season] = await db
                    .insert(seasons)
                    .values({
                        showId: show.id,
                        seasonNumber: s.number,
                        episodeCount: s.episode_count,
                        airDate: s.first_aired || null,
                        overview: s.overview || null,
                        posterPath: seasonPosterPath,
                    })
                    .onConflictDoUpdate({
                        target: [seasons.showId, seasons.seasonNumber],
                        set: {
                            episodeCount: s.episode_count,
                            airDate: s.first_aired || null,
                            overview: s.overview || null,
                            posterPath: seasonPosterPath,
                        },
                    })
                    .returning({ id: seasons.id });

                let traktEpisodes: import("./trakt.js").TraktEpisodeDetail[] = [];
                try {
                    traktEpisodes = await trakt.getEpisodes(
                        traktId,
                        s.number,
                        userId,
                        forceRefreshMetadata,
                    );
                } catch (e) {
                    hasIncompleteEpisodeSource = true;
                    console.warn(
                        `[sync] Failed to fetch Trakt episodes for show ${traktId} season ${s.number}: ${toErrorMessage(e)}`,
                    );
                    return;
                }

                // Fetch TMDB episode data (translations + still images)
                // tmdbEpisodeMap stores the best available title/overview per episode
                // across the full fallback chain: locale → zh-TW → zh-HK → zh-SG → zh-CN → ja-JP → en-US
                const tmdbEpisodeMap = new Map<
                    number,
                    {
                        translatedTitle: string | null;
                        translatedOverview: string | null;
                        stillPath: string | null;
                    }
                >();

                // Step 1: Always fetch base season (no language) for still_path
                try {
                    const baseTmdbSeason = await getTmdbSeason(
                        tmdbId,
                        s.number,
                        undefined,
                        userId,
                        forceRefreshMetadata,
                    );
                    for (const ep of baseTmdbSeason.episodes || []) {
                        tmdbEpisodeMap.set(ep.episode_number, {
                            translatedTitle: null,
                            translatedOverview: null,
                            stillPath: ep.still_path || null,
                        });
                    }
                } catch (e) {
                    console.warn(
                        `[sync] TMDB base season fetch failed for tmdb ${tmdbId} s${s.number}: ${toErrorMessage(e)}`,
                    );
                }

                // Step 2: Fill translations per-episode via fallback chain.
                // Each episode independently walks the chain until it finds a non-empty title.
                // Chain: user locale family → show original language → English
                const languageFallbackChain = buildLanguageFallbackChain(
                    displayLanguage,
                    baseTmdbShow?.original_language ?? null,
                );

                // Cache fetched seasons to avoid duplicate requests
                const fetchedSeasons = new Map<string, import("./tmdb.js").TmdbSeason>();
                for (const lang of languageFallbackChain) {
                    try {
                        const tmdbSeason = await getTmdbSeason(
                            tmdbId,
                            s.number,
                            lang,
                            userId,
                            forceRefreshMetadata,
                        );
                        fetchedSeasons.set(lang, tmdbSeason);
                    } catch (e) {
                        console.warn(
                            `[sync] TMDB season fetch failed for tmdb ${tmdbId} s${s.number} lang ${lang}: ${toErrorMessage(e)}`,
                        );
                    }
                }

                // For each episode, walk the chain and pick the first non-empty title/overview
                const allEpisodeNumbers = new Set([
                    ...Array.from(tmdbEpisodeMap.keys()),
                    ...traktEpisodes.map((ep) => ep.number),
                ]);

                for (const epNum of allEpisodeNumbers) {
                    const existing = tmdbEpisodeMap.get(epNum) ?? {
                        translatedTitle: null,
                        translatedOverview: null,
                        stillPath: null,
                    };

                    let bestTitle: string | null = null;
                    let bestOverview: string | null = null;

                    for (const lang of languageFallbackChain) {
                        const season = fetchedSeasons.get(lang);
                        if (!season) continue;
                        const ep = season.episodes?.find((e) => e.episode_number === epNum);
                        if (!ep) continue;

                        if (!bestTitle && ep.name?.trim()) {
                            bestTitle = ep.name.trim();
                        }
                        if (!bestOverview && ep.overview?.trim()) {
                            bestOverview = ep.overview.trim();
                        }
                        // Both found — no need to check further languages for this episode
                        if (bestTitle && bestOverview) break;
                    }

                    tmdbEpisodeMap.set(epNum, {
                        translatedTitle: bestTitle,
                        translatedOverview: bestOverview,
                        stillPath: existing.stillPath,
                    });
                }

                // If any episode still has no title after the cache pass, force-refresh
                // the translation languages and retry. This handles the case where TMDB
                // had no translation when the cache was first populated (e.g. new episodes)
                // but has since added one — without waiting for the 7-day cache TTL.
                const missingTitleEpNums = Array.from(allEpisodeNumbers).filter(
                    (epNum) => !tmdbEpisodeMap.get(epNum)?.translatedTitle,
                );
                // T04: Gate force-refresh fanout. Older episodes that genuinely have no
                // TMDB translation would otherwise trigger a full per-language re-fetch on
                // every sync. Only force-refresh when at least one missing episode aired
                // recently (or has an unknown air date), since that is the realistic case
                // where TMDB has since added a translation worth picking up early.
                const airDateByEpNum = new Map<number, string | null>();
                for (const ep of traktEpisodes) {
                    airDateByEpNum.set(ep.number, ep.first_aired ?? null);
                }
                const recentlyMissingEpNums = missingTitleEpNums.filter((epNum) =>
                    airedWithinForceRefreshWindow(airDateByEpNum.get(epNum) ?? null),
                );
                if (recentlyMissingEpNums.length > 0 && languageFallbackChain.length > 0) {
                    console.log(
                        `[sync] ${recentlyMissingEpNums.length}/${missingTitleEpNums.length} recently-aired episode(s) missing translated title in tmdb ${tmdbId} s${s.number} — force-refreshing translation cache`,
                    );
                    for (const lang of languageFallbackChain) {
                        try {
                            const fresh = await getTmdbSeason(tmdbId, s.number, lang, userId, true);
                            fetchedSeasons.set(lang, fresh);
                        } catch (e) {
                            console.warn(
                                `[sync] Force-refresh failed for tmdb ${tmdbId} s${s.number} lang ${lang}: ${toErrorMessage(e)}`,
                            );
                        }
                    }
                    // Re-run title resolution for only the recently-aired missing episodes
                    for (const epNum of recentlyMissingEpNums) {
                        const existing = tmdbEpisodeMap.get(epNum) ?? {
                            translatedTitle: null,
                            translatedOverview: null,
                            stillPath: null,
                        };
                        let bestTitle: string | null = null;
                        let bestOverview: string | null = null;
                        for (const lang of languageFallbackChain) {
                            const season = fetchedSeasons.get(lang);
                            if (!season) continue;
                            const ep = season.episodes?.find((e) => e.episode_number === epNum);
                            if (!ep) continue;
                            if (!bestTitle && ep.name?.trim()) bestTitle = ep.name.trim();
                            if (!bestOverview && ep.overview?.trim())
                                bestOverview = ep.overview.trim();
                            if (bestTitle && bestOverview) break;
                        }
                        tmdbEpisodeMap.set(epNum, {
                            translatedTitle: bestTitle,
                            translatedOverview: bestOverview,
                            stillPath: existing.stillPath,
                        });
                    }
                }

                for (const ep of traktEpisodes) {
                    sourceEpisodeKeys.add(`${ep.season}:${ep.number}`);
                    const tmdbEp = tmdbEpisodeMap.get(ep.number);
                    // Store TMDB title as translatedTitle regardless of whether it matches
                    // the Trakt title — resolveEpisodeTitle handles display priority.
                    // This ensures en-US fallback titles are stored when locale translations
                    // are unavailable, preventing "第 x 集" fallback for titled episodes.
                    const translatedEpTitle = tmdbEp?.translatedTitle?.trim() || null;
                    const translatedEpOverview = tmdbEp?.translatedOverview?.trim() || null;
                    const stillPath = tmdbEp?.stillPath ?? null;

                    await db
                        .insert(episodes)
                        .values({
                            showId: show.id,
                            seasonId: season.id,
                            seasonNumber: ep.season,
                            episodeNumber: ep.number,
                            title: ep.title,
                            overview: ep.overview,
                            translatedTitle: translatedEpTitle,
                            translatedOverview: translatedEpOverview,
                            runtime: ep.runtime,
                            airDate: ep.first_aired,
                            stillPath,
                            traktId: ep.ids.trakt,
                            tmdbId: ep.ids.tmdb,
                        })
                        .onConflictDoUpdate({
                            target: [
                                episodes.showId,
                                episodes.seasonNumber,
                                episodes.episodeNumber,
                            ],
                            set: {
                                title: ep.title,
                                overview: ep.overview,
                                translatedTitle: translatedEpTitle,
                                translatedOverview: translatedEpOverview,
                                runtime: ep.runtime,
                                airDate: ep.first_aired,
                                stillPath,
                                traktId: ep.ids.trakt,
                                tmdbId: ep.ids.tmdb,
                            },
                        });
                }
            }),
        ),
    );

    if (hasIncompleteEpisodeSource) {
        console.warn(
            `[sync] Skipping stale episode cleanup for show ${show.id} because at least one season failed to fetch`,
        );
    } else {
        await removeStaleShowMetadata(show.id, sourceSeasonNumbers, sourceEpisodeKeys);
    }

    return show.id;
}

async function removeStaleShowMetadata(
    showId: number,
    sourceSeasonNumbers: number[],
    sourceEpisodeKeys: Set<string>,
) {
    const db = getDb();

    if (sourceSeasonNumbers.length > 0) {
        await db
            .delete(seasons)
            .where(
                and(
                    eq(seasons.showId, showId),
                    notInArray(seasons.seasonNumber, sourceSeasonNumbers),
                ),
            );
    }

    if (sourceEpisodeKeys.size === 0) return;

    const currentEpisodes = await db
        .select({
            id: episodes.id,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            traktId: episodes.traktId,
            tmdbId: episodes.tmdbId,
        })
        .from(episodes)
        .where(eq(episodes.showId, showId));

    const activeEpisodes = currentEpisodes.filter((ep) =>
        sourceEpisodeKeys.has(`${ep.seasonNumber}:${ep.episodeNumber}`),
    );
    const staleEpisodes = currentEpisodes.filter(
        (ep) => !sourceEpisodeKeys.has(`${ep.seasonNumber}:${ep.episodeNumber}`),
    );

    if (staleEpisodes.length === 0) return;

    for (const stale of staleEpisodes) {
        const replacement = activeEpisodes.find(
            (ep) =>
                (stale.traktId != null && ep.traktId === stale.traktId) ||
                (stale.tmdbId != null && ep.tmdbId === stale.tmdbId),
        );
        if (!replacement) continue;
        await db
            .update(watchHistory)
            .set({ episodeId: replacement.id })
            .where(eq(watchHistory.episodeId, stale.id));
    }

    const staleEpisodeIds = staleEpisodes.map((ep) => ep.id);
    const referencedRows = await db
        .select({ episodeId: watchHistory.episodeId })
        .from(watchHistory)
        .where(inArray(watchHistory.episodeId, staleEpisodeIds));
    const referencedIds = new Set(
        referencedRows.map((row) => row.episodeId).filter((id): id is number => id != null),
    );
    const deletableIds = staleEpisodeIds.filter((id) => !referencedIds.has(id));

    if (deletableIds.length === 0) return;

    await db.delete(episodes).where(inArray(episodes.id, deletableIds));
}

// ─── Episode progress ─────────────────────────────────────────────────────────

async function syncEpisodeProgress(
    userId: number,
    showId: number,
    tmdbId: number,
    progress: TraktShowProgress,
): Promise<void> {
    const db = getDb();
    for (const season of progress.seasons || []) {
        for (const ep of season.episodes || []) {
            if (!ep.completed || !ep.last_watched_at) continue;
            const episode = await findOrCreateEpisode(
                showId,
                tmdbId,
                season.number,
                ep.number,
                userId,
            );
            if (!episode) continue;
            const watchedAt = new Date(ep.last_watched_at);
            // Check if this exact record already exists
            const [existing] = await db
                .select()
                .from(watchHistory)
                .where(
                    and(
                        eq(watchHistory.userId, userId),
                        eq(watchHistory.episodeId, episode.id),
                        eq(watchHistory.watchedAt, watchedAt),
                    ),
                );
            if (!existing) {
                await db.insert(watchHistory).values({
                    userId,
                    episodeId: episode.id,
                    watchedAt,
                    traktPlayId: null,
                });
            }
        }
    }
}

async function findOrCreateEpisode(
    showId: number,
    tmdbId: number,
    seasonNum: number,
    episodeNum: number,
    // P2-T03: required — fetching missing episodes from Trakt needs the user's token.
    // A silent `userId ?? 0` fallback previously masked missing-context bugs.
    userId: number,
) {
    const db = getDb();
    const [ep] = await db
        .select()
        .from(episodes)
        .where(
            and(
                eq(episodes.showId, showId),
                eq(episodes.seasonNumber, seasonNum),
                eq(episodes.episodeNumber, episodeNum),
            ),
        );
    if (ep) return ep;

    // Get traktId for this show to fetch from Trakt
    try {
        const [showRow] = await db
            .select({ traktId: shows.traktId })
            .from(shows)
            .where(eq(shows.id, showId));
        if (!showRow?.traktId) return null;

        const trakt = getTraktClient();
        const traktEpisodes = await trakt.getEpisodes(showRow.traktId, seasonNum, userId);
        const traktEp = traktEpisodes.find((e) => e.number === episodeNum);
        if (!traktEp) return null;

        const [season] = await db
            .select()
            .from(seasons)
            .where(and(eq(seasons.showId, showId), eq(seasons.seasonNumber, seasonNum)));

        const [newEp] = await db
            .insert(episodes)
            .values({
                showId,
                seasonId: season?.id || null,
                seasonNumber: seasonNum,
                episodeNumber: episodeNum,
                title: traktEp.title,
                overview: traktEp.overview,
                translatedTitle: null,
                translatedOverview: null,
                runtime: traktEp.runtime,
                airDate: traktEp.first_aired,
                stillPath: null,
                traktId: traktEp.ids.trakt,
                tmdbId: traktEp.ids.tmdb,
            })
            .onConflictDoNothing()
            .returning();
        return newEp || null;
    } catch {
        return null;
    }
}

// ─── Watched Episodes Computation (Cursor-Aware) ─────────────────────────────

// P2-T01: latest reset cursor (max resetAt) for a user+show, or null if never reset.
async function getResetAt(userId: number, showId: number): Promise<Date | null> {
    const db = getDb();
    const [cursor] = await db
        .select({ resetAt: watchResetCursors.resetAt })
        .from(watchResetCursors)
        .where(and(eq(watchResetCursors.userId, userId), eq(watchResetCursors.showId, showId)))
        .orderBy(desc(watchResetCursors.resetAt))
        .limit(1);
    return cursor?.resetAt ?? null;
}

// P2-T01: watch-history WHERE conditions scoped to a user+show, honoring the reset cursor
// (watchedAt > resetAt OR watchedAt IS NULL). Single source of truth so count / next-episode /
// lastWatchedAt all reflect the same post-reset history.
function postResetWatchWhere(userId: number, showId: number, resetAt: Date | null) {
    const conditions = [eq(watchHistory.userId, userId), eq(episodes.showId, showId)];
    if (resetAt) {
        conditions.push(or(gt(watchHistory.watchedAt, resetAt), isNull(watchHistory.watchedAt))!);
    }
    return conditions;
}

// P2-T01: distinct episode IDs the user has watched AFTER the reset cursor.
export async function getPostResetWatchedEpisodeIds(
    userId: number,
    showId: number,
): Promise<number[]> {
    const db = getDb();
    const resetAt = await getResetAt(userId, showId);
    const rows = await db
        .selectDistinct({ id: watchHistory.episodeId })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(...postResetWatchWhere(userId, showId, resetAt)));
    return rows.map((r) => r.id).filter((id): id is number => id != null);
}

export async function computeWatchedEpisodes(userId: number, showId: number): Promise<number> {
    return (await getPostResetWatchedEpisodeIds(userId, showId)).length;
}

// ─── Progress recalc ──────────────────────────────────────────────────────────

export async function recalcShowProgress(userId: number, showId: number): Promise<void> {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    const [airedResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(episodes)
        .where(
            and(
                eq(episodes.showId, showId),
                sql`air_date IS NOT NULL AND LEFT(air_date, 10) <= ${today}`,
            ),
        );
    const airedEpisodes = Number(airedResult?.count || 0);

    // P2-T01: all three of watchedEpisodes / nextEpisode / lastWatchedAt must reflect the
    // SAME post-reset history. Compute the reset cursor once and reuse it everywhere.
    const resetAt = await getResetAt(userId, showId);

    // Cursor-aware watched episode IDs (also drives the watched count and next-episode exclusion).
    const watchedIds = (
        await db
            .selectDistinct({ id: watchHistory.episodeId })
            .from(watchHistory)
            .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
            .where(and(...postResetWatchWhere(userId, showId, resetAt)))
    )
        .map((r) => r.id)
        .filter((id): id is number => id != null);

    const watchedEpisodes = watchedIds.length;

    // Most recent watch AFTER the reset cursor (NULLS LAST so a real date beats an unknown one).
    const [lastWatched] = await db
        .select({ watchedAt: watchHistory.watchedAt })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(...postResetWatchWhere(userId, showId, resetAt)))
        .orderBy(sql`watched_at DESC NULLS LAST`)
        .limit(1);

    // P3-T01: next unwatched aired episode via a correlated NOT EXISTS anti-join (cursor-aware),
    // instead of materializing all watched IDs and emitting a large `id NOT IN (...)` list.
    let nextEpisodeId: number | null = null;
    if (watchedEpisodes > 0) {
        const cursorClause = resetAt
            ? sql` AND (${watchHistory.watchedAt} > ${resetAt} OR ${watchHistory.watchedAt} IS NULL)`
            : sql``;
        const [next] = await db
            .select({ id: episodes.id })
            .from(episodes)
            .where(
                and(
                    eq(episodes.showId, showId),
                    sql`air_date IS NOT NULL AND LEFT(air_date, 10) <= ${today}`,
                    sql`NOT EXISTS (SELECT 1 FROM ${watchHistory} WHERE ${watchHistory.episodeId} = ${episodes.id} AND ${watchHistory.userId} = ${userId}${cursorClause})`,
                ),
            )
            .orderBy(episodes.seasonNumber, episodes.episodeNumber)
            .limit(1);
        nextEpisodeId = next?.id || null;
    }

    const [show] = await db
        .select({ status: shows.status })
        .from(shows)
        .where(eq(shows.id, showId));
    const completed =
        (show?.status === "ended" || show?.status === "canceled") &&
        watchedEpisodes >= airedEpisodes &&
        airedEpisodes > 0;

    await db
        .insert(userShowProgress)
        .values({
            userId,
            showId,
            airedEpisodes,
            watchedEpisodes,
            nextEpisodeId,
            lastWatchedAt: lastWatched?.watchedAt || null,
            completed,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [userShowProgress.userId, userShowProgress.showId],
            set: {
                airedEpisodes,
                watchedEpisodes,
                nextEpisodeId,
                lastWatchedAt: lastWatched?.watchedAt || null,
                completed,
                updatedAt: new Date(),
            },
        });
}

// ─── Movie sync ───────────────────────────────────────────────────────────────

export async function recalcMovieProgress(userId: number, movieId: number): Promise<void> {
    const db = getDb();
    const [{ count, lastWatched }] = await db
        .select({
            count: sql<number>`count(distinct (${watchHistory.movieId}, ${watchHistory.watchedAt}, ${watchHistory.source}))`,
            lastWatched: sql<Date | null>`max(watched_at)`,
        })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.movieId, movieId),
                eq(watchHistory.mediaType, "movie"),
            ),
        );

    await db
        .insert(userMovieProgress)
        .values({
            userId,
            movieId,
            watchCount: Number(count),
            lastWatchedAt: lastWatched,
        })
        .onConflictDoUpdate({
            target: [userMovieProgress.userId, userMovieProgress.movieId],
            set: {
                watchCount: Number(count),
                lastWatchedAt: lastWatched,
                updatedAt: new Date(),
            },
        });
}

export async function syncMovies(userId: number): Promise<void> {
    const db = getDb();
    const trakt = getTraktClient();

    console.log(`[sync:movies] Starting movie sync for user ${userId}`);

    let displayLanguage: string | null = null;
    try {
        const [settings] = await db
            .select({ displayLanguage: userSettings.displayLanguage })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        displayLanguage = settings?.displayLanguage ?? null;
    } catch {
        displayLanguage = null;
    }

    let watchedMovies: TraktWatchedMovie[];
    let movieHistory: TraktMovieHistoryEntry[];
    try {
        const [remoteWatchedMovies, remoteMovieHistory] = await Promise.all([
            trakt.getWatchedMovies(userId),
            trakt.getMovieHistory(userId),
        ]);
        watchedMovies = remoteWatchedMovies;
        movieHistory = remoteMovieHistory;
    } catch (e) {
        console.error(`[sync:movies] Failed to fetch watched movie state:`, toErrorMessage(e));
        return;
    }

    console.log(
        `[sync:movies] Found ${watchedMovies.length} watched movies and ${movieHistory.length} history entries`,
    );

    const limit = pLimit(SHOW_CONCURRENCY);
    const watchedByTraktId = new Map<number, TraktWatchedMovie>();
    const historyByTraktId = new Map<number, TraktMovieHistoryEntry[]>();
    const remoteTraktPlayIds = movieHistory.map((entry) => String(entry.id));
    const affectedMovieIds = new Set<number>();

    for (const wm of watchedMovies) {
        const traktId = wm.movie.ids.trakt;
        if (traktId) watchedByTraktId.set(traktId, wm);
    }

    for (const entry of movieHistory) {
        if (entry.type !== "movie") continue;
        const traktId = entry.movie?.ids?.trakt;
        if (!traktId) continue;
        if (!historyByTraktId.has(traktId)) historyByTraktId.set(traktId, []);
        historyByTraktId.get(traktId)!.push(entry);
    }

    const staleTraktHistoryWhere = remoteTraktPlayIds.length
        ? and(
              eq(watchHistory.userId, userId),
              eq(watchHistory.mediaType, "movie"),
              eq(watchHistory.source, "trakt"),
              or(
                  isNull(watchHistory.traktPlayId),
                  notInArray(watchHistory.traktPlayId, remoteTraktPlayIds),
              ),
          )
        : and(
              eq(watchHistory.userId, userId),
              eq(watchHistory.mediaType, "movie"),
              eq(watchHistory.source, "trakt"),
          );

    const staleRows = await db
        .select({ movieId: watchHistory.movieId })
        .from(watchHistory)
        .where(staleTraktHistoryWhere);

    for (const row of staleRows) {
        if (row.movieId) affectedMovieIds.add(row.movieId);
    }

    if (staleRows.length > 0) {
        await db.delete(watchHistory).where(staleTraktHistoryWhere);
    }

    const remoteMovieTraktIds = new Set([...watchedByTraktId.keys(), ...historyByTraktId.keys()]);

    await Promise.all(
        Array.from(remoteMovieTraktIds).map((traktId) =>
            limit(async () => {
                const wm = watchedByTraktId.get(traktId);
                const historyEntries = historyByTraktId.get(traktId) ?? [];
                const remoteMovie = wm?.movie ?? historyEntries[0]?.movie;
                const tmdbId = remoteMovie?.ids.tmdb;
                let title = remoteMovie?.title ?? `trakt:${traktId}`;

                try {
                    let movieId: number;

                    if (tmdbId) {
                        // 有 TMDB ID：拉取完整元数据并 upsert
                        let posterPath: string | null = null;
                        let backdropPath: string | null = null;
                        let overview: string | null = null;
                        let releaseDate: string | null = null;
                        let runtime: number | null = null;
                        let genres: string[] = [];

                        try {
                            const baseMovie = await getTmdbMovie(tmdbId, userId);
                            let localizedTitle: string | null = null;
                            let localizedOverview: string | null = null;

                            if (displayLanguage) {
                                const languageFallbackChain = buildLanguageFallbackChain(
                                    displayLanguage,
                                    baseMovie.original_language,
                                );
                                const translations = baseMovie.translations?.translations || [];

                                for (const language of languageFallbackChain) {
                                    const [langCode, countryCode] = language.split("-");
                                    const match = translations.find((t) =>
                                        countryCode
                                            ? t.iso_639_1 === langCode &&
                                              t.iso_3166_1 === countryCode.toUpperCase()
                                            : t.iso_639_1 === langCode,
                                    );

                                    if (match && match.data) {
                                        if (
                                            !localizedTitle &&
                                            match.data.title &&
                                            match.data.title !== baseMovie.original_title
                                        ) {
                                            localizedTitle = match.data.title;
                                        }
                                        if (!localizedOverview && match.data.overview) {
                                            localizedOverview = match.data.overview;
                                        }
                                        if (localizedTitle && localizedOverview) break;
                                    }
                                }
                            }

                            title = localizedTitle || baseMovie.title || title;
                            posterPath = baseMovie.poster_path || null;
                            backdropPath = baseMovie.backdrop_path || null;
                            overview = localizedOverview || baseMovie.overview || null;
                            releaseDate = baseMovie.release_date || null;
                            runtime = baseMovie.runtime ?? null;
                            genres = baseMovie.genres?.map((g) => g.name) || [];
                        } catch (e) {
                            console.warn(
                                `[sync:movies] TMDB fetch failed for "${title}" (tmdb:${tmdbId}): ${toErrorMessage(e)}`,
                            );
                        }

                        const [movie] = await db
                            .insert(movies)
                            .values({
                                tmdbId,
                                traktId: remoteMovie.ids.trakt,
                                traktSlug: remoteMovie.ids.slug,
                                imdbId: remoteMovie.ids.imdb || null,
                                title,
                                overview,
                                releaseDate,
                                runtime,
                                posterPath,
                                backdropPath,
                                genres,
                                lastSyncedAt: new Date(),
                            })
                            .onConflictDoUpdate({
                                target: [movies.tmdbId],
                                set: {
                                    traktId: remoteMovie.ids.trakt,
                                    traktSlug: remoteMovie.ids.slug,
                                    imdbId: remoteMovie.ids.imdb || null,
                                    title,
                                    overview,
                                    releaseDate,
                                    runtime,
                                    posterPath,
                                    backdropPath,
                                    genres,
                                    lastSyncedAt: new Date(),
                                },
                            })
                            .returning({ id: movies.id });
                        movieId = movie.id;
                    } else {
                        // 无 TMDB ID（如部分中文电影）：按 traktId 查找或插入，保留 Trakt 元数据
                        console.warn(`[sync:movies] "${title}" 无 TMDB ID，使用 Trakt 元数据存储`);
                        const [existing] = await db
                            .select({ id: movies.id })
                            .from(movies)
                            .where(eq(movies.traktId, traktId));

                        if (existing) {
                            movieId = existing.id;
                        } else {
                            const [newMovie] = await db
                                .insert(movies)
                                .values({
                                    tmdbId: null,
                                    traktId,
                                    traktSlug: remoteMovie.ids.slug,
                                    imdbId: remoteMovie.ids.imdb || null,
                                    title,
                                    overview: null,
                                    releaseDate: null,
                                    runtime: null,
                                    posterPath: null,
                                    backdropPath: null,
                                    genres: [],
                                    lastSyncedAt: new Date(),
                                })
                                .returning({ id: movies.id });
                            movieId = newMovie.id;
                        }
                    }

                    affectedMovieIds.add(movieId);

                    // 有历史条目时同步每次观看记录
                    for (const entry of historyEntries) {
                        await db
                            .insert(watchHistory)
                            .values({
                                userId,
                                movieId,
                                episodeId: null,
                                mediaType: "movie",
                                watchedAt: new Date(entry.watched_at),
                                source: "trakt",
                                traktPlayId: String(entry.id),
                            })
                            .onConflictDoUpdate({
                                target: watchHistory.traktPlayId,
                                set: {
                                    userId,
                                    movieId,
                                    episodeId: null,
                                    mediaType: "movie",
                                    watchedAt: new Date(entry.watched_at),
                                    source: "trakt",
                                },
                            });
                    }

                    // 兜底：watched 摘要中 plays>0 但无 history 条目时（Trakt 旧数据或手动清除过），
                    // 直接用摘要数据写入进度，避免 watchCount 被重置为 0
                    if (historyEntries.length === 0 && wm && (wm.plays ?? 0) > 0) {
                        await db
                            .insert(userMovieProgress)
                            .values({
                                userId,
                                movieId,
                                watchCount: wm.plays,
                                lastWatchedAt: wm.last_watched_at
                                    ? new Date(wm.last_watched_at)
                                    : null,
                            })
                            .onConflictDoUpdate({
                                target: [userMovieProgress.userId, userMovieProgress.movieId],
                                set: {
                                    watchCount: wm.plays,
                                    lastWatchedAt: wm.last_watched_at
                                        ? new Date(wm.last_watched_at)
                                        : null,
                                    updatedAt: new Date(),
                                },
                            });
                        // 不需要 recalcMovieProgress，已直接写入
                        affectedMovieIds.delete(movieId);
                    }

                    console.log(`[sync:movies] Synced "${title}"`);
                } catch (e) {
                    console.error(`[sync:movies] Error syncing "${title}":`, toErrorMessage(e));
                }
            }),
        ),
    );

    await Promise.all(
        Array.from(affectedMovieIds).map((movieId) =>
            limit(() => recalcMovieProgress(userId, movieId)),
        ),
    );

    console.log(`[sync:movies] Movie sync complete`);
}

// ─── Watchlist sync ───────────────────────────────────────────────────────────

type WatchlistRemoteIds = {
    tmdb?: number | null;
    trakt?: number | null;
    imdb?: string | null;
};

type WatchlistMatchMethod = "tmdb" | "trakt" | "imdb";

interface WatchlistLocalMatch {
    id: number;
    matchedBy: WatchlistMatchMethod;
}

function describeWatchlistIds(ids: WatchlistRemoteIds): string {
    return [
        `tmdb:${ids.tmdb ?? "none"}`,
        `trakt:${ids.trakt ?? "none"}`,
        `imdb:${ids.imdb ?? "none"}`,
    ].join(", ");
}

async function findWatchlistShow(
    db: ReturnType<typeof getDb>,
    title: string,
    ids: WatchlistRemoteIds,
): Promise<WatchlistLocalMatch | null> {
    if (ids.tmdb) {
        const [show] = await db
            .select({ id: shows.id })
            .from(shows)
            .where(eq(shows.tmdbId, ids.tmdb));
        if (show) return { id: show.id, matchedBy: "tmdb" };
    }

    if (ids.trakt) {
        const [show] = await db
            .select({ id: shows.id })
            .from(shows)
            .where(eq(shows.traktId, ids.trakt));
        if (show) return { id: show.id, matchedBy: "trakt" };
    }

    if (ids.imdb) {
        const [show] = await db
            .select({ id: shows.id })
            .from(shows)
            .where(eq(shows.imdbId, ids.imdb));
        if (show) return { id: show.id, matchedBy: "imdb" };
    }

    console.warn(
        `[sync:watchlist] Show "${title}" could not be resolved locally (${describeWatchlistIds(ids)}); preserving local show watchlist entries for this sync`,
    );
    return null;
}

async function findWatchlistMovie(
    db: ReturnType<typeof getDb>,
    title: string,
    ids: WatchlistRemoteIds,
): Promise<WatchlistLocalMatch | null> {
    if (ids.tmdb) {
        const [movie] = await db
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.tmdbId, ids.tmdb));
        if (movie) return { id: movie.id, matchedBy: "tmdb" };
    }

    if (ids.trakt) {
        const [movie] = await db
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.traktId, ids.trakt));
        if (movie) return { id: movie.id, matchedBy: "trakt" };
    }

    if (ids.imdb) {
        const [movie] = await db
            .select({ id: movies.id })
            .from(movies)
            .where(eq(movies.imdbId, ids.imdb));
        if (movie) return { id: movie.id, matchedBy: "imdb" };
    }

    console.warn(
        `[sync:watchlist] Movie "${title}" could not be resolved locally (${describeWatchlistIds(ids)}); preserving local movie watchlist entries for this sync`,
    );
    return null;
}

export async function syncWatchlist(userId: number): Promise<void> {
    const db = getDb();
    const trakt = getTraktClient();

    console.log(`[sync:watchlist] Starting watchlist sync for user ${userId}`);

    try {
        // Fetch watchlist from Trakt
        const [watchlistShows, watchlistMovies] = await Promise.all([
            trakt.getWatchlistShows(userId),
            trakt.getWatchlistMovies(userId),
        ]);

        console.log(
            `[sync:watchlist] Found ${watchlistShows.length} shows, ${watchlistMovies.length} movies`,
        );

        const syncedShowIds = new Set<number>();
        const syncedMovieIds = new Set<number>();
        let unresolvedShowCount = 0;
        let unresolvedMovieCount = 0;
        let fallbackShowMatchCount = 0;
        let fallbackMovieMatchCount = 0;

        // Sync shows
        for (const item of watchlistShows) {
            const match = await findWatchlistShow(db, item.show.title, item.show.ids);
            if (!match) {
                unresolvedShowCount++;
                continue;
            }
            if (match.matchedBy !== "tmdb") {
                fallbackShowMatchCount++;
                console.log(
                    `[sync:watchlist] Matched show "${item.show.title}" by ${match.matchedBy} fallback`,
                );
            }

            // Insert or update watchlist entry
            await db
                .insert(watchlist)
                .values({
                    userId,
                    showId: match.id,
                    movieId: null,
                    listedAt: new Date(item.listed_at),
                })
                .onConflictDoUpdate({
                    target: [watchlist.userId, watchlist.showId],
                    set: {
                        listedAt: new Date(item.listed_at),
                    },
                });
            syncedShowIds.add(match.id);
        }

        // Sync movies
        for (const item of watchlistMovies) {
            const match = await findWatchlistMovie(db, item.movie.title, item.movie.ids);
            if (!match) {
                unresolvedMovieCount++;
                continue;
            }
            if (match.matchedBy !== "tmdb") {
                fallbackMovieMatchCount++;
                console.log(
                    `[sync:watchlist] Matched movie "${item.movie.title}" by ${match.matchedBy} fallback`,
                );
            }

            // Insert or update watchlist entry
            await db
                .insert(watchlist)
                .values({
                    userId,
                    showId: null,
                    movieId: match.id,
                    listedAt: new Date(item.listed_at),
                })
                .onConflictDoUpdate({
                    target: [watchlist.userId, watchlist.movieId],
                    set: {
                        listedAt: new Date(item.listed_at),
                    },
                });
            syncedMovieIds.add(match.id);
        }

        const syncedShowIdList = [...syncedShowIds];
        const syncedMovieIdList = [...syncedMovieIds];

        if (unresolvedShowCount > 0) {
            console.warn(
                `[sync:watchlist] Skipping show cleanup: ${unresolvedShowCount} remote show(s) could not be resolved locally`,
            );
        } else {
            const showCleanupWhere = and(
                eq(watchlist.userId, userId),
                isNotNull(watchlist.showId),
                syncedShowIdList.length > 0
                    ? notInArray(watchlist.showId, syncedShowIdList)
                    : undefined,
            );
            await db.delete(watchlist).where(showCleanupWhere);
        }

        if (unresolvedMovieCount > 0) {
            console.warn(
                `[sync:watchlist] Skipping movie cleanup: ${unresolvedMovieCount} remote movie(s) could not be resolved locally`,
            );
        } else {
            const movieCleanupWhere = and(
                eq(watchlist.userId, userId),
                isNotNull(watchlist.movieId),
                syncedMovieIdList.length > 0
                    ? notInArray(watchlist.movieId, syncedMovieIdList)
                    : undefined,
            );
            await db.delete(watchlist).where(movieCleanupWhere);
        }

        console.log(
            `[sync:watchlist] Watchlist sync complete (shows synced:${syncedShowIdList.length}, movies synced:${syncedMovieIdList.length}, show fallback:${fallbackShowMatchCount}, movie fallback:${fallbackMovieMatchCount}, unresolved shows:${unresolvedShowCount}, unresolved movies:${unresolvedMovieCount})`,
        );
    } catch (e) {
        console.error(`[sync:watchlist] Failed to sync watchlist:`, toErrorMessage(e));
    }
}

// ─── Ratings sync ─────────────────────────────────────────────────────────────

export async function syncRatings(userId: number): Promise<void> {
    const db = getDb();
    const trakt = getTraktClient();

    try {
        const [showRatings, movieRatings] = await Promise.all([
            trakt.getRatingsShows(userId) as Promise<TraktRatingShow[]>,
            trakt.getRatingsMovies(userId) as Promise<TraktRatingMovie[]>,
        ]);

        // Resolve show Trakt IDs → local show IDs
        const showTraktIds = showRatings.flatMap((r) =>
            r.show.ids.trakt ? [r.show.ids.trakt] : [],
        );
        const localShows =
            showTraktIds.length > 0
                ? await db
                      .select({ id: shows.id, traktId: shows.traktId })
                      .from(shows)
                      .where(inArray(shows.traktId, showTraktIds))
                : [];
        const showIdByTraktId = new Map(localShows.map((s) => [s.traktId, s.id]));

        // Resolve movie Trakt IDs → local movie IDs
        const movieTraktIds = movieRatings.flatMap((r) =>
            r.movie.ids.trakt ? [r.movie.ids.trakt] : [],
        );
        const localMovies =
            movieTraktIds.length > 0
                ? await db
                      .select({ id: movies.id, traktId: movies.traktId })
                      .from(movies)
                      .where(inArray(movies.traktId, movieTraktIds))
                : [];
        const movieIdByTraktId = new Map(localMovies.map((m) => [m.traktId, m.id]));

        // Upsert show ratings
        for (const r of showRatings) {
            const localId = showIdByTraktId.get(r.show.ids.trakt);
            if (!localId) continue;
            await db
                .insert(userRatings)
                .values({
                    userId,
                    mediaType: "show",
                    showId: localId,
                    movieId: null,
                    rating: r.rating,
                    ratedAt: r.rated_at ? new Date(r.rated_at) : null,
                })
                .onConflictDoUpdate({
                    target: [userRatings.userId, userRatings.showId],
                    set: { rating: r.rating, ratedAt: r.rated_at ? new Date(r.rated_at) : null },
                });
        }

        // Upsert movie ratings
        for (const r of movieRatings) {
            const localId = movieIdByTraktId.get(r.movie.ids.trakt);
            if (!localId) continue;
            await db
                .insert(userRatings)
                .values({
                    userId,
                    mediaType: "movie",
                    showId: null,
                    movieId: localId,
                    rating: r.rating,
                    ratedAt: r.rated_at ? new Date(r.rated_at) : null,
                })
                .onConflictDoUpdate({
                    target: [userRatings.userId, userRatings.movieId],
                    set: { rating: r.rating, ratedAt: r.rated_at ? new Date(r.rated_at) : null },
                });
        }

        console.log(
            `[sync:ratings] Synced ${showRatings.length} show ratings and ${movieRatings.length} movie ratings`,
        );
    } catch (e) {
        console.error("[sync:ratings] Failed to sync ratings:", e instanceof Error ? e.message : e);
    }
}

/**
 * Pull the user's Trakt collection into the local DB.
 *
 * Design: the local collection is an unbounded, add-only archive while Trakt is the
 * capped (≤100) syncable subset. This sync therefore ONLY inserts/refreshes rows and
 * NEVER deletes — items dropped from Trakt (including cap eviction) stay archived
 * locally. Local→Trakt deletion is handled separately in the collection route.
 *
 * Shows are tracked at show level (one row per show). Per-episode media-format
 * archival is a deferred enhancement (would need an episode-grouped UI); the previous
 * code declared but silently discarded the per-episode payload, which is removed here.
 */
export async function syncUserCollection(userId: number): Promise<number> {
    const db = getDb();
    const trakt = getTraktClient();
    const now = new Date();
    let synced = 0;

    // ── Shows (show-level header + per-episode rows) ─────────────────────────
    try {
        const traktShows = (await trakt.getCollectionShows(userId)) as Array<{
            collected_at?: string;
            last_collected_at?: string;
            show?: { ids?: { tmdb?: number } };
            seasons?: Array<{
                number: number;
                episodes?: Array<{
                    number: number;
                    collected_at?: string;
                    metadata?: {
                        media_type?: string;
                        resolution?: string;
                        hdr?: string;
                        audio?: string;
                        audio_channels?: string;
                    };
                }>;
            }>;
        }>;

        const tmdbIds = traktShows.flatMap((ts) => (ts.show?.ids?.tmdb ? [ts.show.ids.tmdb] : []));
        const localShows =
            tmdbIds.length > 0
                ? await db
                      .select({ id: shows.id, tmdbId: shows.tmdbId })
                      .from(shows)
                      .where(inArray(shows.tmdbId, tmdbIds))
                : [];
        const showIdByTmdb = new Map(localShows.map((s) => [s.tmdbId, s.id]));

        for (const ts of traktShows) {
            const tmdbId = ts.show?.ids?.tmdb;
            const localId = tmdbId ? showIdByTmdb.get(tmdbId) : undefined;
            if (!localId) continue;

            const collectedAt = ts.last_collected_at
                ? new Date(ts.last_collected_at)
                : ts.collected_at
                  ? new Date(ts.collected_at)
                  : now;

            // Use first episode with any media metadata as representative format for the show
            const firstMeta = ts.seasons
                ?.flatMap((s) => s.episodes ?? [])
                .find(
                    (e) => e.metadata?.media_type || e.metadata?.resolution || e.metadata?.hdr,
                )?.metadata;

            const formatVals = {
                mediaFormat: firstMeta?.media_type ?? null,
                resolution: firstMeta?.resolution ?? null,
                hdr: firstMeta?.hdr ?? null,
                audio: firstMeta?.audio ?? null,
                audioChannels: firstMeta?.audio_channels ?? null,
            };

            const [existing] = await db
                .select({ id: userCollection.id })
                .from(userCollection)
                .where(
                    and(
                        eq(userCollection.userId, userId),
                        eq(userCollection.showId, localId),
                        isNull(userCollection.season),
                        isNull(userCollection.episode),
                    ),
                )
                .limit(1);
            if (existing) {
                await db
                    .update(userCollection)
                    .set({ collectedAt, updatedAt: now, ...formatVals })
                    .where(eq(userCollection.id, existing.id));
            } else {
                await db.insert(userCollection).values({
                    userId,
                    mediaType: "show",
                    showId: localId,
                    collectedAt,
                    updatedAt: now,
                    createdAt: now,
                    ...formatVals,
                });
            }
            synced++;

            // Upsert per-episode rows with individual metadata
            for (const season of ts.seasons ?? []) {
                for (const ep of season.episodes ?? []) {
                    const epMeta = ep.metadata;
                    const epCollectedAt = ep.collected_at ? new Date(ep.collected_at) : collectedAt;
                    const epVals = {
                        mediaFormat: epMeta?.media_type ?? null,
                        resolution: epMeta?.resolution ?? null,
                        hdr: epMeta?.hdr ?? null,
                        audio: epMeta?.audio ?? null,
                        audioChannels: epMeta?.audio_channels ?? null,
                        collectedAt: epCollectedAt,
                        updatedAt: now,
                    };
                    const [existingEp] = await db
                        .select({ id: userCollection.id })
                        .from(userCollection)
                        .where(
                            and(
                                eq(userCollection.userId, userId),
                                eq(userCollection.showId, localId),
                                eq(userCollection.season, season.number),
                                eq(userCollection.episode, ep.number),
                            ),
                        )
                        .limit(1);
                    if (existingEp) {
                        await db
                            .update(userCollection)
                            .set(epVals)
                            .where(eq(userCollection.id, existingEp.id));
                    } else {
                        await db.insert(userCollection).values({
                            userId,
                            mediaType: "episode",
                            showId: localId,
                            season: season.number,
                            episode: ep.number,
                            ...epVals,
                            createdAt: now,
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error("[sync:collection] shows failed:", e instanceof Error ? e.message : e);
    }

    // ── Movies (with media-format metadata) ─────────────────────────────────
    try {
        const traktMovies = (await trakt.getCollectionMovies(userId)) as Array<{
            collected_at?: string;
            metadata?: {
                media_type?: string;
                resolution?: string;
                hdr?: string;
                audio?: string;
                audio_channels?: string;
            };
            movie?: { ids?: { tmdb?: number } };
        }>;

        const tmdbIds = traktMovies.flatMap((tm) =>
            tm.movie?.ids?.tmdb ? [tm.movie.ids.tmdb] : [],
        );
        const localMovies =
            tmdbIds.length > 0
                ? await db
                      .select({ id: movies.id, tmdbId: movies.tmdbId })
                      .from(movies)
                      .where(inArray(movies.tmdbId, tmdbIds))
                : [];
        const movieIdByTmdb = new Map(localMovies.map((m) => [m.tmdbId, m.id]));

        for (const tm of traktMovies) {
            const tmdbId = tm.movie?.ids?.tmdb;
            const localId = tmdbId ? movieIdByTmdb.get(tmdbId) : undefined;
            if (!localId) continue;

            const meta = tm.metadata;
            const vals = {
                mediaFormat: meta?.media_type ?? null,
                resolution: meta?.resolution ?? null,
                hdr: meta?.hdr ?? null,
                audio: meta?.audio ?? null,
                audioChannels: meta?.audio_channels ?? null,
                collectedAt: tm.collected_at ? new Date(tm.collected_at) : now,
                updatedAt: now,
            };
            const [existing] = await db
                .select({ id: userCollection.id })
                .from(userCollection)
                .where(and(eq(userCollection.userId, userId), eq(userCollection.movieId, localId)))
                .limit(1);
            if (existing) {
                await db.update(userCollection).set(vals).where(eq(userCollection.id, existing.id));
            } else {
                await db.insert(userCollection).values({
                    userId,
                    mediaType: "movie",
                    movieId: localId,
                    ...vals,
                    createdAt: now,
                });
            }
            synced++;
        }
    } catch (e) {
        console.error("[sync:collection] movies failed:", e instanceof Error ? e.message : e);
    }

    return synced;
}

// ─── Startup cleanup ──────────────────────────────────────────────────────────

/**
 * Reset any sync states stuck in "running" from a previous crashed/killed process.
 * Called once at server startup before any sync jobs are registered.
 */
export async function resetStaleRunningSyncs(): Promise<void> {
    const db = getDb();
    const result = await db
        .update(syncState)
        .set({
            status: "error",
            error: "Sync was interrupted by a server restart",
            currentShow: null,
            updatedAt: new Date(),
        })
        .where(eq(syncState.status, "running"))
        .returning({ userId: syncState.userId });

    if (result.length > 0) {
        console.log(
            `[sync] Reset ${result.length} stale "running" sync state(s) on startup (userIds: ${result.map((r) => r.userId).join(", ")})`,
        );
    }
}
