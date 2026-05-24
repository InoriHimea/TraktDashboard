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
} from "@trakt-dashboard/db";
import { eq, and, sql, or, gt, isNull, desc } from "drizzle-orm";
import { getTraktClient } from "./trakt.js";
import { getTmdbShow, getTmdbSeason, getTmdbMovie } from "./tmdb.js";
import pLimit from "p-limit";
import dayjs from "dayjs";

// Concurrency: 5 shows in parallel, each show's seasons also fetched in parallel
const SHOW_CONCURRENCY = 5;
const SEASON_CONCURRENCY = 4;
const FAILED_RETRY_MAX = 2;
// Per-show hard timeout (ms) — prevents one stuck show from blocking a slot forever
const SHOW_TIMEOUT_MS = 90_000;

// ─── Language fallback chain builder ─────────────────────────────────────────
//
// Fallback order: user locale → zh-TW → zh-SG → zh-HK → zh-CN → en-US → original language.
//
// All known variants per language family:
const LANGUAGE_FAMILY_VARIANTS: Record<string, string[]> = {
    zh: ['zh-TW', 'zh-SG', 'zh-HK', 'zh-CN', 'zh'],
    en: ['en-US', 'en-GB', 'en'],
    ja: ['ja-JP', 'ja'],
    ko: ['ko-KR', 'ko'],
    fr: ['fr-FR', 'fr-BE', 'fr-CA', 'fr'],
    de: ['de-DE', 'de-AT', 'de-CH', 'de'],
    es: ['es-ES', 'es-MX', 'es-419', 'es'],
    pt: ['pt-BR', 'pt-PT', 'pt'],
    it: ['it-IT', 'it'],
    ru: ['ru-RU', 'ru'],
    ar: ['ar-SA', 'ar'],
    th: ['th-TH', 'th'],
    vi: ['vi-VN', 'vi'],
    id: ['id-ID', 'id'],
    tr: ['tr-TR', 'tr'],
    pl: ['pl-PL', 'pl'],
    nl: ['nl-NL', 'nl-BE', 'nl'],
    sv: ['sv-SE', 'sv'],
    da: ['da-DK', 'da'],
    fi: ['fi-FI', 'fi'],
    nb: ['nb-NO', 'nb'],
    cs: ['cs-CZ', 'cs'],
    hu: ['hu-HU', 'hu'],
    ro: ['ro-RO', 'ro'],
    uk: ['uk-UA', 'uk'],
    he: ['he-IL', 'he'],
};

/**
 * Extract the base language code from a locale string.
 * "zh-TW" → "zh", "en-US" → "en", "ja" → "ja"
 */
function getLanguageFamily(locale: string): string {
    return locale.split('-')[0].toLowerCase();
}

/**
 * Build the TMDB language query list for a given user locale + show original language.
 * Returns deduplicated list in priority order.
 */
export function buildLanguageFallbackChain(
    userLocale: string | null,
    originalLanguage: string | null, // TMDB original_language, e.g. "ja", "ko", "en"
): string[] {
    const chain: string[] = [];

    if (userLocale) chain.push(userLocale);
    chain.push('zh-TW', 'zh-SG', 'zh-HK', 'zh-CN', 'en-US');

    if (originalLanguage) {
        const origFamily = originalLanguage.toLowerCase();
        const variants = LANGUAGE_FAMILY_VARIANTS[origFamily] ?? [`${origFamily}-${origFamily.toUpperCase()}`, origFamily];
        chain.push(...variants);
    }

    return [...new Set(chain)];
}

type FailedShow = {
    tmdbId: number;
    title: string;
    error: string;
    retryCount?: number;
};

function toErrorMessage(e: unknown): string {
    return String((e as { message?: string })?.message || e || "Unknown error");
}

function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
                ms,
            ),
        ),
    ]);
}

async function ensureSyncState(userId: number) {
    await getDb().insert(syncState).values({ userId }).onConflictDoNothing();
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function triggerFullSync(userId: number): Promise<void> {
    const db = getDb();
    await ensureSyncState(userId);
    const [currentState] = await db
        .select({ status: syncState.status })
        .from(syncState)
        .where(eq(syncState.userId, userId));
    if (currentState?.status === "running") {
        console.log(
            `[sync] Full sync already running for user ${userId}, skipping`,
        );
        return;
    }
    await db
        .update(syncState)
        .set({
            status: "running",
            progress: 0,
            total: 0,
            error: null,
            currentShow: "Fetching watched shows from Trakt…",
            failedShows: [],
            updatedAt: new Date(),
        })
        .where(eq(syncState.userId, userId));

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
                            syncSingleShow(userId, {
                                tmdbId,
                                traktId: ws.show.ids.trakt || null,
                                title,
                                traktShow: ws.show,
                            }),
                            SHOW_TIMEOUT_MS,
                            title,
                        );
                    } catch (e) {
                        console.error(
                            `[sync] Error syncing "${title}":`,
                            toErrorMessage(e),
                        );
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
                        console.log(
                            `[sync] ${processed}/${watchedShows.length} ${title}`,
                        );
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
                                syncSingleShow(userId, {
                                    tmdbId: f.tmdbId,
                                    traktId:
                                        watchedShows.find(
                                            (s) => s.show.ids.tmdb === f.tmdbId,
                                        )?.show.ids.trakt || null,
                                    title: f.title,
                                    traktShow: watchedShows.find(
                                        (s) => s.show.ids.tmdb === f.tmdbId,
                                    )?.show || { ids: {} },
                                }),
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
    } catch (e: any) {
        await db
            .update(syncState)
            .set({ status: "error", error: e.message, updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
        throw e;
    }
}

// ─── Incremental sync ─────────────────────────────────────────────────────────

export async function triggerIncrementalSync(userId: number): Promise<void> {
    const db = getDb();
    await ensureSyncState(userId);
    const [state] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.userId, userId));
    if (state?.status === "running") return;

    await db
        .update(syncState)
        .set({
            status: "running",
            progress: 0,
            total: 0,
            currentShow: "Fetching recent history…",
            error: null,
            updatedAt: new Date(),
        })
        .where(eq(syncState.userId, userId));

    try {
        const trakt = getTraktClient();
        const startAt = state?.lastSyncAt
            ? dayjs(state.lastSyncAt).toISOString()
            : undefined;
        const history = await trakt.getHistory(userId, startAt);
        console.log(
            `[sync:incr] ${history.length} new entries since ${startAt || "beginning"}`,
        );

        const showMap = new Map<number, typeof history>();
        for (const entry of history) {
            if (entry.type !== "episode") continue;
            const tmdbId = entry.show.ids.tmdb;
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
                        const traktId = entries[0].show.ids.trakt;
                        if (!traktId) {
                            console.warn(
                                `[sync:incr] Missing Trakt id for tmdb ${tmdbId}, skipping`,
                            );
                            return;
                        }
                        const showId = await upsertShowFromTrakt(
                            traktId,
                            entries[0].show,
                            userId,
                        );
                        for (const entry of entries) {
                            const ep = await findOrCreateEpisode(
                                showId,
                                tmdbId,
                                entry.episode.season,
                                entry.episode.number,
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
                                .onConflictDoNothing({
                                    target: watchHistory.traktPlayId,
                                });
                        }
                        await recalcShowProgress(userId, showId);
                    } catch (e) {
                        console.error(
                            `[sync:incr] Error on tmdb ${tmdbId}:`,
                            toErrorMessage(e),
                        );
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
    } catch (e: any) {
        await db
            .update(syncState)
            .set({ status: "error", error: e.message, updatedAt: new Date() })
            .where(eq(syncState.userId, userId));
    }
}

// ─── Single show sync ─────────────────────────────────────────────────────────

async function syncSingleShow(
    userId: number,
    input: {
        tmdbId: number;
        traktId: number | null;
        title: string;
        traktShow: any;
    },
) {
    if (!input.traktId) throw new Error("Missing Trakt id");
    const trakt = getTraktClient();

    const showId = await upsertShowFromTrakt(
        input.traktId,
        input.traktShow,
        userId,
    );
    await getDb()
        .insert(userShowProgress)
        .values({ userId, showId })
        .onConflictDoNothing();

    const progress = await trakt.getShowProgress(userId, input.traktId);
    await syncEpisodeProgress(userId, showId, input.tmdbId, progress);
    await recalcShowProgress(userId, showId);
}

// ─── Trakt-primary upsert ─────────────────────────────────────────────────────

async function upsertShowFromTrakt(
    traktId: number,
    traktShow: any,
    userId: number,
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
    const traktDetail = await trakt.getShowDetail(traktId, userId);

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
    if (displayLanguage) {
        const languageFallbackChain = buildLanguageFallbackChain(
            displayLanguage,
            baseTmdbShow?.original_language ?? null,
        );

        for (const lang of languageFallbackChain) {
            try {
                const tmdbShow = await getTmdbShow(tmdbId, lang, userId);
                // Poster/backdrop: prefer base (language-neutral), fall back to localized
                if (!posterPath) posterPath = tmdbShow.poster_path || null;
                if (!backdropPath) backdropPath = tmdbShow.backdrop_path || null;
                
                if (!translatedName && tmdbShow.name && tmdbShow.name !== traktDetail.title) {
                    translatedName = tmdbShow.name;
                }
                if (!translatedOverview && tmdbShow.overview && tmdbShow.overview !== traktDetail.overview) {
                    translatedOverview = tmdbShow.overview;
                }
                
                if (translatedName && translatedOverview) break;
            } catch (e) {
                console.warn(
                    `[sync] TMDB show fetch failed for tmdb ${tmdbId} lang ${lang}: ${toErrorMessage(e)}`,
                );
            }
        }
    }

    // Fetch seasons from Trakt
    const traktSeasons = await trakt.getSeasons(traktId, userId);
    const totalSeasons = traktSeasons.length;
    const totalEpisodes = traktSeasons.reduce(
        (sum, s) => sum + (s.episode_count || 0),
        0,
    );

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
    let tmdbSeasonPosterMap = new Map<number, string | null>();
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
            console.warn(`[sync] Failed to fetch TMDB season posters for tmdb ${tmdbId}: ${toErrorMessage(e)}`);
        }
    }

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

                let traktEpisodes: import("./trakt.js").TraktEpisodeDetail[] =
                    [];
                try {
                    traktEpisodes = await trakt.getEpisodes(
                        traktId,
                        s.number,
                        userId,
                    );
                } catch (e) {
                    console.warn(
                        `[sync] Failed to fetch Trakt episodes for show ${traktId} season ${s.number}: ${toErrorMessage(e)}`,
                    );
                    return;
                }

                // Fetch TMDB episode data (translations + still images)
                // tmdbEpisodeMap stores the best available title/overview per episode
                // across the full fallback chain: locale → zh-TW → zh-HK → zh-SG → zh-CN → ja-JP → en-US
                let tmdbEpisodeMap = new Map<
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
                        const tmdbSeason = await getTmdbSeason(tmdbId, s.number, lang, userId);
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
                    ...traktEpisodes.map(ep => ep.number),
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
                        const ep = season.episodes?.find(e => e.episode_number === epNum);
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
                    epNum => !tmdbEpisodeMap.get(epNum)?.translatedTitle,
                );
                if (missingTitleEpNums.length > 0 && languageFallbackChain.length > 0) {
                    console.log(
                        `[sync] ${missingTitleEpNums.length} episode(s) missing translated title in tmdb ${tmdbId} s${s.number} — force-refreshing translation cache`,
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
                    // Re-run title resolution for only the missing episodes
                    for (const epNum of missingTitleEpNums) {
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
                            const ep = season.episodes?.find(e => e.episode_number === epNum);
                            if (!ep) continue;
                            if (!bestTitle && ep.name?.trim()) bestTitle = ep.name.trim();
                            if (!bestOverview && ep.overview?.trim()) bestOverview = ep.overview.trim();
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

    return show.id;
}

// ─── TMDB upsert (kept for reference) ────────────────────────────────────────

async function upsertShowFromTmdb(
    tmdbId: number,
    traktShow: any,
    userId?: number,
): Promise<number> {
    const db = getDb();

    // Task 7.1: Read user's displayLanguage for translated title
    let displayLanguage: string | null = null;
    if (userId) {
        try {
            const [settings] = await db
                .select({ displayLanguage: userSettings.displayLanguage })
                .from(userSettings)
                .where(eq(userSettings.userId, userId));
            displayLanguage = settings?.displayLanguage ?? null;
        } catch {
            /* ignore */
        }
    }

    // Fetch base show data (no language = original)
    const tmdb = await getTmdbShow(tmdbId, undefined, userId);

    // Fetch translated title if language is set
    let translatedName: string | null = null;
    let translatedOverview: string | null = null;
    if (displayLanguage) {
        try {
            const translated = await getTmdbShow(
                tmdbId,
                displayLanguage,
                userId,
            );
            // Store translated name if it differs from the original-language name
            if (translated.name && translated.name !== tmdb.original_name) {
                translatedName = translated.name;
            }
            // Store translated overview if non-empty and different from original
            if (translated.overview && translated.overview !== tmdb.overview) {
                translatedOverview = translated.overview;
            }
        } catch {
            // Translation fetch failed — skip, don't break sync
        }
    }

    const [show] = await db
        .insert(shows)
        .values({
            tmdbId,
            tvdbId: tmdb.external_ids?.tvdb_id || traktShow.ids?.tvdb || null,
            imdbId: tmdb.external_ids?.imdb_id || traktShow.ids?.imdb || null,
            traktId: traktShow.ids?.trakt || null,
            traktSlug: traktShow.ids?.slug || null,
            title: tmdb.name,
            overview: tmdb.overview || null,
            status: tmdb.status?.toLowerCase() || "unknown",
            firstAired: tmdb.first_air_date || null,
            network: tmdb.networks?.[0]?.name || null,
            genres: tmdb.genres?.map((g: any) => g.name) || [],
            posterPath: tmdb.poster_path || null,
            backdropPath: tmdb.backdrop_path || null,
            totalEpisodes: tmdb.number_of_episodes || 0,
            totalSeasons: tmdb.number_of_seasons || 0,
            originalName: tmdb.original_name || null,
            translatedName,
            translatedOverview,
            displayLanguage,
            lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [shows.tmdbId],
            set: {
                tvdbId:
                    tmdb.external_ids?.tvdb_id || traktShow.ids?.tvdb || null,
                title: tmdb.name,
                overview: tmdb.overview || null,
                status: tmdb.status?.toLowerCase() || "unknown",
                network: tmdb.networks?.[0]?.name || null,
                genres: tmdb.genres?.map((g: any) => g.name) || [],
                posterPath: tmdb.poster_path || null,
                backdropPath: tmdb.backdrop_path || null,
                totalEpisodes: tmdb.number_of_episodes || 0,
                totalSeasons: tmdb.number_of_seasons || 0,
                originalName: tmdb.original_name || null,
                translatedName,
                translatedOverview,
                displayLanguage,
                lastSyncedAt: new Date(),
            },
        })
        .returning({ id: shows.id });

    // Fetch all seasons concurrently (include season 0 = Specials)
    const validSeasons = (tmdb.seasons || []).filter(
        (s) => s.season_number >= 0,
    );
    const seasonLimit = pLimit(SEASON_CONCURRENCY);

    await Promise.all(
        validSeasons.map((s) =>
            seasonLimit(async () => {
                const [season] = await db
                    .insert(seasons)
                    .values({
                        showId: show.id,
                        seasonNumber: s.season_number,
                        episodeCount: s.episode_count,
                        airDate: s.air_date || null,
                        overview: s.overview || null,
                        posterPath: s.poster_path || null,
                    })
                    .onConflictDoUpdate({
                        target: [seasons.showId, seasons.seasonNumber],
                        set: {
                            episodeCount: s.episode_count,
                            airDate: s.air_date || null,
                        },
                    })
                    .returning({ id: seasons.id });

                try {
                    // Fetch episode data in user's language (language-aware cache key prevents stale English cache)
                    const seasonData = await getTmdbSeason(
                        tmdbId,
                        s.season_number,
                        displayLanguage ?? undefined,
                        userId,
                    );

                    // If language is set and differs from default, also fetch original for fallback
                    let fallbackSeason: typeof seasonData | null = null;
                    if (displayLanguage) {
                        try {
                            fallbackSeason = await getTmdbSeason(
                                tmdbId,
                                s.season_number,
                                undefined,
                                userId,
                            );
                        } catch {
                            /* ignore */
                        }
                    }

                    for (const ep of seasonData.episodes || []) {
                        const fallbackEp = fallbackSeason?.episodes?.find(
                            (e) => e.episode_number === ep.episode_number,
                        );

                        // Determine translated vs original title/overview
                        // fallbackEp = original language (English), ep = user's language
                        const originalTitle =
                            fallbackEp?.name?.trim() || ep.name?.trim() || null;
                        const translatedEpTitle =
                            displayLanguage &&
                            ep.name?.trim() &&
                            ep.name !== fallbackEp?.name
                                ? ep.name.trim()
                                : null;
                        const originalOverview =
                            fallbackEp?.overview?.trim() ||
                            ep.overview?.trim() ||
                            null;
                        const translatedEpOverview =
                            displayLanguage &&
                            ep.overview?.trim() &&
                            ep.overview !== fallbackEp?.overview
                                ? ep.overview.trim()
                                : null;

                        await db
                            .insert(episodes)
                            .values({
                                showId: show.id,
                                seasonId: season.id,
                                seasonNumber: ep.season_number,
                                episodeNumber: ep.episode_number,
                                title: originalTitle,
                                overview: originalOverview,
                                translatedTitle: translatedEpTitle,
                                translatedOverview: translatedEpOverview,
                                runtime: ep.runtime || null,
                                airDate: ep.air_date || null,
                                stillPath: ep.still_path || null,
                                tmdbId: ep.id || null,
                            })
                            .onConflictDoUpdate({
                                target: [
                                    episodes.showId,
                                    episodes.seasonNumber,
                                    episodes.episodeNumber,
                                ],
                                set: {
                                    title: originalTitle,
                                    overview: originalOverview,
                                    translatedTitle: translatedEpTitle,
                                    translatedOverview: translatedEpOverview,
                                    runtime: ep.runtime || null,
                                    airDate: ep.air_date || null,
                                    stillPath: ep.still_path || null,
                                },
                            });
                    }
                } catch (e) {
                    console.warn(
                        `[sync] Failed to fetch season ${s.season_number} for tmdb ${tmdbId}: ${toErrorMessage(e)}`,
                    );
                }
            }),
        ),
    );

    return show.id;
}

// ─── Episode progress ─────────────────────────────────────────────────────────

async function syncEpisodeProgress(
    userId: number,
    showId: number,
    tmdbId: number,
    progress: any,
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
    language?: string,
    userId?: number,
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
        const traktEpisodes = await trakt.getEpisodes(
            showRow.traktId,
            seasonNum,
            userId ?? 0,
        );
        const traktEp = traktEpisodes.find((e) => e.number === episodeNum);
        if (!traktEp) return null;

        const [season] = await db
            .select()
            .from(seasons)
            .where(
                and(
                    eq(seasons.showId, showId),
                    eq(seasons.seasonNumber, seasonNum),
                ),
            );

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

export async function computeWatchedEpisodes(
    userId: number,
    showId: number,
): Promise<number> {
    const db = getDb();

    // Get latest WatchResetCursor (max resetAt)
    const [cursor] = await db
        .select({ resetAt: watchResetCursors.resetAt })
        .from(watchResetCursors)
        .where(
            and(
                eq(watchResetCursors.userId, userId),
                eq(watchResetCursors.showId, showId),
            ),
        )
        .orderBy(desc(watchResetCursors.resetAt))
        .limit(1);

    const resetAt = cursor?.resetAt ?? null;

    // Build WHERE conditions
    const whereConditions = [
        eq(watchHistory.userId, userId),
        eq(episodes.showId, showId),
    ];

    // Cursor filter: watchedAt > resetAt OR watchedAt IS NULL
    if (resetAt) {
        whereConditions.push(
            or(
                gt(watchHistory.watchedAt, resetAt),
                isNull(watchHistory.watchedAt),
            )!,
        );
    }

    const [{ count }] = await db
        .select({
            count: sql<number>`count(distinct ${watchHistory.episodeId})`,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(...whereConditions));

    return Number(count);
}

// ─── Progress recalc ──────────────────────────────────────────────────────────

export async function recalcShowProgress(
    userId: number,
    showId: number,
): Promise<void> {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    const [airedResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(episodes)
        .where(
            and(
                eq(episodes.showId, showId),
                sql`air_date IS NOT NULL AND air_date <= ${today}`,
            ),
        );
    const airedEpisodes = Number(airedResult?.count || 0);

    // Use computeWatchedEpisodes for cursor-aware calculation
    const watchedEpisodes = await computeWatchedEpisodes(userId, showId);

    const [lastWatched] = await db
        .select({ watchedAt: watchHistory.watchedAt })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(
            and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)),
        )
        .orderBy(sql`watched_at DESC`)
        .limit(1);

    const watchedIds = (
        await db
            .select({ id: watchHistory.episodeId })
            .from(watchHistory)
            .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
            .where(
                and(
                    eq(watchHistory.userId, userId),
                    eq(episodes.showId, showId),
                ),
            )
    ).map((r) => r.id);

    let nextEpisodeId: number | null = null;
    if (watchedIds.length > 0) {
        const [next] = await db
            .select({ id: episodes.id })
            .from(episodes)
            .where(
                and(
                    eq(episodes.showId, showId),
                    sql`id NOT IN (${sql.join(
                        watchedIds.map((id) => sql`${id}`),
                        sql`, `,
                    )})`,
                    sql`air_date IS NOT NULL AND air_date <= ${today}`,
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

export async function syncMovies(userId: number): Promise<void> {
  const db = getDb()
  const trakt = getTraktClient()

  console.log(`[sync:movies] Starting movie sync for user ${userId}`)

  let displayLanguage: string | null = null
  try {
    const [settings] = await db
      .select({ displayLanguage: userSettings.displayLanguage })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
    displayLanguage = settings?.displayLanguage ?? null
  } catch {
    displayLanguage = null
  }

  let watchedMovies: import('./trakt.js').TraktWatchedMovie[]
  try {
    watchedMovies = await trakt.getWatchedMovies(userId)
  } catch (e) {
    console.error(`[sync:movies] Failed to fetch watched movies:`, toErrorMessage(e))
    return
  }

  console.log(`[sync:movies] Found ${watchedMovies.length} watched movies`)

  const limit = pLimit(SHOW_CONCURRENCY)

  await Promise.all(watchedMovies.map(wm => limit(async () => {
    const tmdbId = wm.movie.ids.tmdb
    let title = wm.movie.title

    if (!tmdbId) {
      console.warn(`[sync:movies] Skipping "${title}" — missing TMDB id`)
      return
    }

    try {
      // Fetch TMDB images (degrade gracefully on failure)
      let posterPath: string | null = null
      let backdropPath: string | null = null
      let overview: string | null = null
      let releaseDate: string | null = null
      let runtime: number | null = null
      let genres: string[] = []

      try {
        const baseMovie = await getTmdbMovie(tmdbId, userId)
        let selectedMovie = baseMovie
        let localizedTitle: string | null = null
        let localizedOverview: string | null = null

        if (displayLanguage) {
          for (const language of buildLanguageFallbackChain(displayLanguage, baseMovie.original_language)) {
            try {
              const candidate = await getTmdbMovie(tmdbId, userId, language)
              if (!localizedTitle && candidate.title?.trim() && candidate.title !== baseMovie.original_title) {
                localizedTitle = candidate.title.trim()
              }
              if (!localizedOverview && candidate.overview?.trim()) {
                localizedOverview = candidate.overview.trim()
                selectedMovie = candidate
              }
              if (localizedTitle && localizedOverview) break
            } catch {
              continue
            }
          }
        }

        title = localizedTitle || baseMovie.title || title
        posterPath = selectedMovie.poster_path || baseMovie.poster_path || null
        backdropPath = selectedMovie.backdrop_path || baseMovie.backdrop_path || null
        overview = localizedOverview || baseMovie.overview || null
        releaseDate = selectedMovie.release_date || baseMovie.release_date || null
        runtime = selectedMovie.runtime ?? baseMovie.runtime ?? null
        genres = (selectedMovie.genres?.length ? selectedMovie.genres : baseMovie.genres)?.map(g => g.name) || []
      } catch (e) {
        console.warn(`[sync:movies] TMDB fetch failed for "${title}" (tmdb:${tmdbId}): ${toErrorMessage(e)}`)
      }

      // Upsert movie record
      const [movie] = await db.insert(movies).values({
        tmdbId,
        traktId: wm.movie.ids.trakt,
        traktSlug: wm.movie.ids.slug,
        imdbId: wm.movie.ids.imdb || null,
        title,
        overview,
        releaseDate,
        runtime,
        posterPath,
        backdropPath,
        genres,
        lastSyncedAt: new Date(),
      }).onConflictDoUpdate({
        target: [movies.tmdbId],
        set: {
          traktId: wm.movie.ids.trakt,
          traktSlug: wm.movie.ids.slug,
          imdbId: wm.movie.ids.imdb || null,
          title,
          overview,
          releaseDate,
          runtime,
          posterPath,
          backdropPath,
          genres,
          lastSyncedAt: new Date(),
        },
      }).returning({ id: movies.id })

      // Upsert progress summary
      await db.insert(userMovieProgress).values({
        userId,
        movieId: movie.id,
        watchCount: wm.plays,
        lastWatchedAt: wm.last_watched_at ? new Date(wm.last_watched_at) : null,
      }).onConflictDoUpdate({
        target: [userMovieProgress.userId, userMovieProgress.movieId],
        set: {
          watchCount: wm.plays,
          lastWatchedAt: wm.last_watched_at ? new Date(wm.last_watched_at) : null,
          updatedAt: new Date(),
        },
      })

      if (wm.last_watched_at) {
        const watchedAt = new Date(wm.last_watched_at)
        const [existing] = await db.select({ id: watchHistory.id })
          .from(watchHistory)
          .where(and(
            eq(watchHistory.userId, userId),
            eq(watchHistory.movieId, movie.id),
            eq(watchHistory.mediaType, 'movie'),
            eq(watchHistory.watchedAt, watchedAt),
            eq(watchHistory.source, 'trakt'),
          ))

        if (!existing) {
          await db.insert(watchHistory).values({
            userId,
            movieId: movie.id,
            episodeId: null,
            mediaType: 'movie',
            watchedAt,
            source: 'trakt',
          })
        }
      }

      console.log(`[sync:movies] Synced "${title}"`)
    } catch (e) {
      console.error(`[sync:movies] Error syncing "${title}":`, toErrorMessage(e))
    }
  })))

  console.log(`[sync:movies] Movie sync complete`)
}

// ─── Watchlist sync ───────────────────────────────────────────────────────────

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

        // Import watchlist module
        const { watchlist } = await import("@trakt-dashboard/db");

        // Sync shows
        for (const item of watchlistShows) {
            const tmdbId = item.show.ids.tmdb;
            if (!tmdbId) {
                console.warn(
                    `[sync:watchlist] Skipping show "${item.show.title}" — missing TMDB id`,
                );
                continue;
            }

            // Find show in database
            const [show] = await db
                .select({ id: shows.id })
                .from(shows)
                .where(eq(shows.tmdbId, tmdbId));

            if (!show) {
                console.warn(
                    `[sync:watchlist] Show "${item.show.title}" not in database, skipping`,
                );
                continue;
            }

            // Insert or update watchlist entry
            await db
                .insert(watchlist)
                .values({
                    userId,
                    showId: show.id,
                    movieId: null,
                    listedAt: new Date(item.listed_at),
                })
                .onConflictDoUpdate({
                    target: [watchlist.userId, watchlist.showId],
                    set: {
                        listedAt: new Date(item.listed_at),
                    },
                });
        }

        // Sync movies
        for (const item of watchlistMovies) {
            const tmdbId = item.movie.ids.tmdb;
            if (!tmdbId) {
                console.warn(
                    `[sync:watchlist] Skipping movie "${item.movie.title}" — missing TMDB id`,
                );
                continue;
            }

            // Find movie in database
            const [movie] = await db
                .select({ id: movies.id })
                .from(movies)
                .where(eq(movies.tmdbId, tmdbId));

            if (!movie) {
                console.warn(
                    `[sync:watchlist] Movie "${item.movie.title}" not in database, skipping`,
                );
                continue;
            }

            // Insert or update watchlist entry
            await db
                .insert(watchlist)
                .values({
                    userId,
                    showId: null,
                    movieId: movie.id,
                    listedAt: new Date(item.listed_at),
                })
                .onConflictDoUpdate({
                    target: [watchlist.userId, watchlist.movieId],
                    set: {
                        listedAt: new Date(item.listed_at),
                    },
                });
        }

        console.log(`[sync:watchlist] Watchlist sync complete`);
    } catch (e) {
        console.error(
            `[sync:watchlist] Failed to sync watchlist:`,
            toErrorMessage(e),
        );
    }
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
