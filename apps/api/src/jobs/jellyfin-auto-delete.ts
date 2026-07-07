import {
    getDb,
    userSettings,
    jellyfinDeleteQueue,
    jellyfinDeleteHistory,
    jellyfinDeleteExclusions,
    pushSubscriptions,
    userShowProgress,
    shows,
    seasons,
    episodes,
    watchHistory,
    movies,
} from "@trakt-dashboard/db";
import { and, eq, gt, inArray, isNotNull, isNull, lte, not, sql } from "drizzle-orm";
import {
    fetchJellyfinSeriesTmdbMap,
    fetchJellyfinMoviesTmdbMap,
    findJellyfinSeasonIdBySeriesId,
    deleteJellyfinItem,
    type JellyfinConfig,
} from "../services/jellyfin.js";
import { decryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";
import { sendPush, isPushConfigured } from "../lib/push.js";
import {
    buildExclusionIndex,
    isSeasonEligible,
    isMovieEligible,
    parseJellyfinDeleteStatus,
    annotate500Error,
    DEFER_AFTER_500_DAYS,
} from "./jellyfin-auto-delete-rules.js";

interface DeferTarget {
    showId?: number | null;
    movieId?: number | null;
    seasonNumber: number | null;
}

/**
 * N5-T10: after a Phase 2 delete 500s (Jellyfin 10.11 UserData tombstone bug,
 * jellyfin#16975 — the files are usually already gone from disk), write a 7-day defer
 * exclusion so Phase 1 doesn't re-queue the ghost entry the next day and loop forever.
 * Mirrors the replace-then-insert semantics of the cancel buttons' exclusion writes.
 */
async function deferEntryAfter500(
    db: ReturnType<typeof getDb>,
    userId: number,
    target: DeferTarget,
): Promise<void> {
    try {
        await db
            .delete(jellyfinDeleteExclusions)
            .where(
                and(
                    eq(jellyfinDeleteExclusions.userId, userId),
                    target.showId != null
                        ? eq(jellyfinDeleteExclusions.showId, target.showId)
                        : eq(jellyfinDeleteExclusions.movieId, target.movieId!),
                    target.seasonNumber !== null
                        ? eq(jellyfinDeleteExclusions.seasonNumber, target.seasonNumber)
                        : isNull(jellyfinDeleteExclusions.seasonNumber),
                ),
            );
        await db.insert(jellyfinDeleteExclusions).values({
            userId,
            showId: target.showId ?? null,
            movieId: target.movieId ?? null,
            seasonNumber: target.seasonNumber,
            mode: "defer",
            deferUntil: new Date(Date.now() + DEFER_AFTER_500_DAYS * 24 * 60 * 60 * 1000),
        });
    } catch (e) {
        // Best-effort: a failed defer write must not abort the rest of the batch —
        // worst case the entry is retried tomorrow, which is the pre-N5-T10 behavior.
        console.error(`[jellyfin-delete] Failed to write auto-defer for user ${userId}:`, e);
    }
}

// Shared failure handling for the four delete sites: classify the error, annotate
// 500s (see annotate500Error), and report whether the caller should auto-defer.
function classifyDeleteError(e: unknown): { errorMessage: string; shouldDefer: boolean } {
    const raw = e instanceof Error ? e.message : String(e);
    if (parseJellyfinDeleteStatus(raw) === 500) {
        return { errorMessage: annotate500Error(500), shouldDefer: true };
    }
    return { errorMessage: raw, shouldDefer: false };
}

/**
 * Push reminder for a just-queued (not re-queued) entry (N5-T03). Only fires on genuine
 * new inserts — callers gate this on `onConflictDoNothing()` returning a row — so an
 * already-queued item isn't re-notified every day until it's actually deleted.
 */
async function notifyQueuedForDeletion(
    db: ReturnType<typeof getDb>,
    userId: number,
    displayLanguage: string,
    title: string,
    seasonNumber: number | null,
): Promise<void> {
    const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return;

    const isZh = displayLanguage.startsWith("zh");
    const scope =
        seasonNumber !== null ? (isZh ? `第 ${seasonNumber} 季` : `Season ${seasonNumber}`) : "";
    const payload = {
        title: isZh ? "即将从 Jellyfin 删除" : "Scheduled for deletion",
        body: isZh
            ? `《${title}》${scope} 将于明天删除，如需保留请尽快处理`
            : `"${title}"${scope ? ` ${scope}` : ""} will be deleted from Jellyfin tomorrow`,
        url: "/settings",
    };

    const results = await Promise.all(
        subs.map((sub) =>
            sendPush(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
            )
                .then((res) => ({ sub, res }))
                .catch(() => ({ sub, res: { ok: false as const, statusCode: undefined } })),
        ),
    );
    for (const { sub, res } of results) {
        if (!res.ok && (res.statusCode === 404 || res.statusCode === 410)) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
    }
}

export interface AutoDeleteResult {
    deleted: number;
    queued: number;
}

export type DeleteNowStatus = "deleted" | "not_found" | "failed" | "no-jellyfin-config";

/**
 * Deletes one queue entry right now, bypassing the daily schedule (N5-T02). Shares the
 * single-item deletion logic Phase 2 uses, but resolves the series map for just this one
 * show instead of the whole library — cheap for a one-off, on-demand action.
 */
export async function deleteQueueEntryNow(
    userId: number,
    queueId: number,
): Promise<{ status: DeleteNowStatus; errorMessage?: string }> {
    const db = getDb();

    const [user] = await db
        .select({
            jellyfinUrl: userSettings.jellyfinUrl,
            jellyfinApiKey: userSettings.jellyfinApiKey,
            jellyfinAutoDeleteLibraryIds: userSettings.jellyfinAutoDeleteLibraryIds,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
    if (!user?.jellyfinUrl || !user.jellyfinApiKey || !user.jellyfinAutoDeleteLibraryIds) {
        return { status: "no-jellyfin-config" };
    }
    let autoDeleteIds: string[];
    try {
        autoDeleteIds = JSON.parse(user.jellyfinAutoDeleteLibraryIds) as string[];
    } catch {
        return { status: "no-jellyfin-config" };
    }
    if (!Array.isArray(autoDeleteIds) || autoDeleteIds.length === 0) {
        return { status: "no-jellyfin-config" };
    }

    const [queueRow] = await db
        .select({
            id: jellyfinDeleteQueue.id,
            showId: jellyfinDeleteQueue.showId,
            movieId: jellyfinDeleteQueue.movieId,
            seasonNumber: jellyfinDeleteQueue.seasonNumber,
        })
        .from(jellyfinDeleteQueue)
        .where(and(eq(jellyfinDeleteQueue.id, queueId), eq(jellyfinDeleteQueue.userId, userId)));
    if (!queueRow) return { status: "not_found" };

    let tmdbId: number | null;
    let title: string;
    if (queueRow.showId !== null) {
        const [show] = await db
            .select({ tmdbId: shows.tmdbId, title: shows.title })
            .from(shows)
            .where(eq(shows.id, queueRow.showId));
        if (!show) return { status: "not_found" };
        tmdbId = show.tmdbId;
        title = show.title;
    } else if (queueRow.movieId !== null) {
        const [movie] = await db
            .select({ tmdbId: movies.tmdbId, title: movies.title })
            .from(movies)
            .where(eq(movies.id, queueRow.movieId));
        if (!movie) return { status: "not_found" };
        tmdbId = movie.tmdbId;
        title = movie.title;
    } else {
        return { status: "not_found" };
    }

    const cfg: JellyfinConfig = {
        url: user.jellyfinUrl,
        apiKey: decryptToken(user.jellyfinApiKey, resolveApiSecret()),
    };

    let status: "deleted" | "not_found" | "failed" = "not_found";
    let errorMessage: string | null = null;
    try {
        let targetId: string | null = null;
        if (queueRow.showId !== null) {
            const seriesMap = await fetchJellyfinSeriesTmdbMap(cfg, autoDeleteIds);
            const seriesId = seriesMap.get(String(tmdbId)) ?? null;
            targetId =
                queueRow.seasonNumber === null
                    ? seriesId
                    : seriesId
                      ? await findJellyfinSeasonIdBySeriesId(cfg, seriesId, queueRow.seasonNumber)
                      : null;
        } else {
            const movieMap = await fetchJellyfinMoviesTmdbMap(cfg, autoDeleteIds);
            targetId = movieMap.get(String(tmdbId)) ?? null;
        }
        if (targetId) {
            await deleteJellyfinItem(cfg, targetId);
            status = "deleted";
        }
    } catch (e) {
        status = "failed";
        const classified = classifyDeleteError(e);
        errorMessage = classified.errorMessage;
        if (classified.shouldDefer) {
            await deferEntryAfter500(db, userId, {
                showId: queueRow.showId,
                movieId: queueRow.movieId,
                seasonNumber: queueRow.seasonNumber,
            });
        }
    }

    await db.insert(jellyfinDeleteHistory).values({
        userId,
        showId: queueRow.showId,
        movieId: queueRow.movieId,
        seasonNumber: queueRow.seasonNumber,
        title,
        status,
        errorMessage,
    });

    // Whole-show deletion also clears any stray season entries for the same show,
    // matching Phase 2's behavior.
    if (queueRow.showId !== null && queueRow.seasonNumber === null) {
        await db
            .delete(jellyfinDeleteQueue)
            .where(
                and(
                    eq(jellyfinDeleteQueue.userId, userId),
                    eq(jellyfinDeleteQueue.showId, queueRow.showId),
                ),
            );
    } else {
        await db.delete(jellyfinDeleteQueue).where(eq(jellyfinDeleteQueue.id, queueRow.id));
    }

    return { status, errorMessage: errorMessage ?? undefined };
}

export async function runJellyfinAutoDelete(): Promise<AutoDeleteResult> {
    const db = getDb();
    let deleted = 0;
    let queued = 0;

    const eligibleUsers = await db
        .select({
            userId: userSettings.userId,
            jellyfinUrl: userSettings.jellyfinUrl,
            jellyfinApiKey: userSettings.jellyfinApiKey,
            jellyfinAutoDeleteLibraryIds: userSettings.jellyfinAutoDeleteLibraryIds,
            displayLanguage: userSettings.displayLanguage,
        })
        .from(userSettings)
        .where(
            and(
                eq(userSettings.jellyfinAutoDeleteEnabled, true),
                isNotNull(userSettings.jellyfinUrl),
                isNotNull(userSettings.jellyfinApiKey),
                isNotNull(userSettings.jellyfinAutoDeleteLibraryIds),
            ),
        );

    const pushEnabled = isPushConfigured();

    for (const user of eligibleUsers) {
        let autoDeleteIds: string[];
        try {
            autoDeleteIds = JSON.parse(user.jellyfinAutoDeleteLibraryIds!) as string[];
        } catch {
            continue;
        }
        if (!Array.isArray(autoDeleteIds) || autoDeleteIds.length === 0) continue;

        const cfg: JellyfinConfig = {
            url: user.jellyfinUrl!,
            apiKey: decryptToken(user.jellyfinApiKey!, resolveApiSecret()),
        };
        const userId = user.userId;

        const result = await processUser(
            db,
            cfg,
            userId,
            autoDeleteIds,
            pushEnabled ? user.displayLanguage : null,
        );
        deleted += result.deleted;
        queued += result.queued;
    }

    return { deleted, queued };
}

async function processUser(
    db: ReturnType<typeof getDb>,
    cfg: JellyfinConfig,
    userId: number,
    autoDeleteIds: string[],
    // null when VAPID isn't configured — skips the push-reminder path entirely (N5-T03).
    notifyLanguage: string | null,
): Promise<AutoDeleteResult> {
    let deleted = 0;
    let queued = 0;

    // Fetched once and reused for both phases below: avoids re-fetching the full Jellyfin
    // series/movie lists (scoped to the user's auto-delete libraries) once per candidate.
    const seriesMap = await fetchJellyfinSeriesTmdbMap(cfg, autoDeleteIds);
    const movieMap = await fetchJellyfinMoviesTmdbMap(cfg, autoDeleteIds);

    // ── Exclusions (永不删除 / 推迟删除) ─────────────────────────────────────────
    // Expired defers are pruned first so the entry naturally re-enters the two-phase flow.
    await db
        .delete(jellyfinDeleteExclusions)
        .where(
            and(
                eq(jellyfinDeleteExclusions.userId, userId),
                eq(jellyfinDeleteExclusions.mode, "defer"),
                lte(jellyfinDeleteExclusions.deferUntil, new Date()),
            ),
        );
    const exclusions = await db
        .select({
            showId: jellyfinDeleteExclusions.showId,
            movieId: jellyfinDeleteExclusions.movieId,
            seasonNumber: jellyfinDeleteExclusions.seasonNumber,
        })
        .from(jellyfinDeleteExclusions)
        .where(eq(jellyfinDeleteExclusions.userId, userId));
    // Phase 2 mutates this via .add() when it auto-defers a 500'd entry (N5-T10), so the
    // same run's Phase 1 already sees the exclusion and doesn't re-queue it immediately.
    const exclusionIndex = buildExclusionIndex(exclusions);

    // ── Phase 2: execute pending deletions ──────────────────────────────────────

    const pendingEntries = (
        await db
            .select({
                id: jellyfinDeleteQueue.id,
                showId: jellyfinDeleteQueue.showId,
                seasonNumber: jellyfinDeleteQueue.seasonNumber,
                tmdbId: shows.tmdbId,
                title: shows.title,
            })
            .from(jellyfinDeleteQueue)
            .innerJoin(shows, eq(shows.id, jellyfinDeleteQueue.showId))
            .where(
                and(eq(jellyfinDeleteQueue.userId, userId), isNotNull(jellyfinDeleteQueue.showId)),
            )
    ).map((e) => ({ ...e, showId: e.showId! }));

    const wholeShowEntries = pendingEntries.filter((e) => e.seasonNumber === null);
    const seasonEntries = pendingEntries.filter((e) => e.seasonNumber !== null);

    // Delete whole shows first; track which showIds were handled so we skip stray season entries
    const handledShowIds = new Set<number>();
    for (const entry of wholeShowEntries) {
        let status: "deleted" | "not_found" | "failed" = "not_found";
        let errorMessage: string | null = null;
        try {
            const seriesId = seriesMap.get(String(entry.tmdbId));
            if (seriesId) {
                await deleteJellyfinItem(cfg, seriesId);
                status = "deleted";
                // Drop it from the snapshot so this run's Phase 1a existence check doesn't
                // see the stale entry and immediately re-queue the just-deleted show
                // (which would log a misleading "not_found" tomorrow).
                seriesMap.delete(String(entry.tmdbId));
            }
            console.log(
                `[jellyfin-delete] ${status === "deleted" ? "Deleted" : "Not found"} series "${entry.title}" (TMDB ${entry.tmdbId}) for user ${userId}`,
            );
            if (status === "deleted") deleted++;
        } catch (e) {
            status = "failed";
            const classified = classifyDeleteError(e);
            errorMessage = classified.errorMessage;
            if (classified.shouldDefer) {
                await deferEntryAfter500(db, userId, { showId: entry.showId, seasonNumber: null });
                exclusionIndex.add({
                    showId: entry.showId,
                    movieId: null,
                    seasonNumber: null,
                });
            }
            console.error(
                `[jellyfin-delete] Failed to delete series "${entry.title}" for user ${userId}:`,
                e,
            );
        }
        await db.insert(jellyfinDeleteHistory).values({
            userId,
            showId: entry.showId,
            seasonNumber: null,
            title: entry.title,
            status,
            errorMessage,
        });
        // Remove all queue entries for this show (including any stray season entries)
        await db
            .delete(jellyfinDeleteQueue)
            .where(
                and(
                    eq(jellyfinDeleteQueue.userId, userId),
                    eq(jellyfinDeleteQueue.showId, entry.showId),
                ),
            );
        handledShowIds.add(entry.showId);
    }

    // Delete individual seasons
    for (const entry of seasonEntries) {
        if (handledShowIds.has(entry.showId)) continue;
        const season = entry.seasonNumber!;
        let status: "deleted" | "not_found" | "failed" = "not_found";
        let errorMessage: string | null = null;
        try {
            const seriesId = seriesMap.get(String(entry.tmdbId));
            const seasonId = seriesId
                ? await findJellyfinSeasonIdBySeriesId(cfg, seriesId, season)
                : null;
            if (seasonId) {
                await deleteJellyfinItem(cfg, seasonId);
                status = "deleted";
            }
            console.log(
                `[jellyfin-delete] ${status === "deleted" ? "Deleted" : "Not found"} S${season} of "${entry.title}" for user ${userId}`,
            );
            if (status === "deleted") deleted++;
        } catch (e) {
            status = "failed";
            const classified = classifyDeleteError(e);
            errorMessage = classified.errorMessage;
            if (classified.shouldDefer) {
                await deferEntryAfter500(db, userId, {
                    showId: entry.showId,
                    seasonNumber: season,
                });
                exclusionIndex.add({
                    showId: entry.showId,
                    movieId: null,
                    seasonNumber: season,
                });
            }
            console.error(
                `[jellyfin-delete] Failed to delete S${season} of "${entry.title}" for user ${userId}:`,
                e,
            );
        }
        await db.insert(jellyfinDeleteHistory).values({
            userId,
            showId: entry.showId,
            seasonNumber: season,
            title: entry.title,
            status,
            errorMessage,
        });
        await db.delete(jellyfinDeleteQueue).where(eq(jellyfinDeleteQueue.id, entry.id));
    }

    // Delete queued movies (N5-T04)
    const pendingMovieEntries = (
        await db
            .select({
                id: jellyfinDeleteQueue.id,
                movieId: jellyfinDeleteQueue.movieId,
                tmdbId: movies.tmdbId,
                title: movies.title,
            })
            .from(jellyfinDeleteQueue)
            .innerJoin(movies, eq(movies.id, jellyfinDeleteQueue.movieId))
            .where(
                and(eq(jellyfinDeleteQueue.userId, userId), isNotNull(jellyfinDeleteQueue.movieId)),
            )
    ).map((e) => ({ ...e, movieId: e.movieId! }));

    for (const entry of pendingMovieEntries) {
        let status: "deleted" | "not_found" | "failed" = "not_found";
        let errorMessage: string | null = null;
        try {
            const itemId = movieMap.get(String(entry.tmdbId));
            if (itemId) {
                await deleteJellyfinItem(cfg, itemId);
                status = "deleted";
                // Same stale-snapshot guard as the series branch: keep Phase 1c from
                // re-queueing the movie this run just deleted.
                movieMap.delete(String(entry.tmdbId));
            }
            console.log(
                `[jellyfin-delete] ${status === "deleted" ? "Deleted" : "Not found"} movie "${entry.title}" (TMDB ${entry.tmdbId}) for user ${userId}`,
            );
            if (status === "deleted") deleted++;
        } catch (e) {
            status = "failed";
            const classified = classifyDeleteError(e);
            errorMessage = classified.errorMessage;
            if (classified.shouldDefer) {
                await deferEntryAfter500(db, userId, {
                    movieId: entry.movieId,
                    seasonNumber: null,
                });
                exclusionIndex.add({
                    showId: null,
                    movieId: entry.movieId,
                    seasonNumber: null,
                });
            }
            console.error(
                `[jellyfin-delete] Failed to delete movie "${entry.title}" for user ${userId}:`,
                e,
            );
        }
        await db.insert(jellyfinDeleteHistory).values({
            userId,
            movieId: entry.movieId,
            seasonNumber: null,
            title: entry.title,
            status,
            errorMessage,
        });
        await db.delete(jellyfinDeleteQueue).where(eq(jellyfinDeleteQueue.id, entry.id));
    }

    // ── Phase 1: queue newly eligible shows/seasons/movies ───────────────────────

    // 1a. Whole-show deletion: ended/canceled + all watched (completed)
    const completedEndedShows = await db
        .select({
            showId: userShowProgress.showId,
            tmdbId: shows.tmdbId,
            title: shows.title,
        })
        .from(userShowProgress)
        .innerJoin(shows, eq(shows.id, userShowProgress.showId))
        .where(
            and(
                eq(userShowProgress.userId, userId),
                eq(userShowProgress.completed, true),
                inArray(shows.status, ["ended", "canceled"]),
            ),
        );

    const wholeShowEligibleIds = new Set(completedEndedShows.map((s) => s.showId));

    for (const show of completedEndedShows) {
        // Any exclusion on the show (whole-show or single-season) blocks whole-show queueing.
        if (exclusionIndex.excludedShowIds.has(show.showId)) continue;
        // Skip shows that don't actually exist in one of the user's auto-delete libraries —
        // otherwise they'd be badged as "pending delete" even though there's nothing to
        // delete, and Phase 2 would later log a misleading "not_found" for them.
        if (!seriesMap.has(String(show.tmdbId))) continue;

        const inserted = await db
            .insert(jellyfinDeleteQueue)
            .values({ userId, showId: show.showId, seasonNumber: null })
            .onConflictDoNothing()
            .returning({ id: jellyfinDeleteQueue.id });
        if (inserted.length > 0) {
            queued++;
            console.log(
                `[jellyfin-delete] Queued whole show "${show.title}" (showId=${show.showId}) for user ${userId}`,
            );
            if (notifyLanguage !== null) {
                await notifyQueuedForDeletion(db, userId, notifyLanguage, show.title, null);
            }
        }
    }

    // 1b. Season-level deletion: not eligible for whole-show deletion
    //     Season has fully aired (reached its TMDB episode count) AND all of its
    //     episodes are watched AND the last episode aired > 7 days ago
    const userShowIds = (
        await db
            .select({ showId: userShowProgress.showId })
            .from(userShowProgress)
            .where(
                and(
                    eq(userShowProgress.userId, userId),
                    wholeShowEligibleIds.size > 0
                        ? not(inArray(userShowProgress.showId, [...wholeShowEligibleIds]))
                        : undefined,
                ),
            )
    ).map((r) => r.showId);

    if (userShowIds.length > 0) {
        const today = new Date().toISOString().split("T")[0]!;

        // seasonTotal comes from the synced `seasons.episode_count` (TMDB's stated total for
        // the season), NOT from counting locally-aired episode rows. Using "aired-so-far" as
        // the denominator would mark a still-airing season (e.g. weekly releases) as complete
        // the moment the user catches up with the latest episode — wrongly queuing it for
        // deletion mid-broadcast. Requiring airedCount to reach the TMDB total ensures the
        // season has actually finished airing before it's considered done.
        //
        // Both date comparisons below cast to ::date / compare epoch millis rather than doing
        // plain string comparison — episodes.airDate stores a full ISO timestamp (e.g.
        // "2026-06-24T14:30:00.000Z"), and a plain string compare against a date-only cutoff
        // ("2026-06-24") always evaluates the timestamp as "greater than" its own date prefix,
        // incorrectly excluding anything whose air date falls exactly on the boundary day
        // regardless of what time it aired.
        const seasonStats = await db
            .select({
                showId: episodes.showId,
                tmdbId: shows.tmdbId,
                title: shows.title,
                seasonNumber: episodes.seasonNumber,
                seasonTotal: seasons.episodeCount,
                airedCount: sql<number>`cast(count(distinct case when ${episodes.airDate} is not null and ${episodes.airDate}::date <= ${today}::date then ${episodes.id} end) as integer)`,
                watched: sql<number>`cast(count(distinct ${watchHistory.episodeId}) as integer)`,
                lastAirDate: sql<string | null>`max(${episodes.airDate})`,
            })
            .from(episodes)
            .innerJoin(shows, eq(shows.id, episodes.showId))
            .innerJoin(
                seasons,
                and(
                    eq(seasons.showId, episodes.showId),
                    eq(seasons.seasonNumber, episodes.seasonNumber),
                ),
            )
            .leftJoin(
                watchHistory,
                and(
                    eq(watchHistory.episodeId, episodes.id),
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.mediaType, "episode"),
                ),
            )
            .where(and(inArray(episodes.showId, userShowIds), gt(episodes.seasonNumber, 0)))
            .groupBy(
                episodes.showId,
                shows.tmdbId,
                shows.title,
                episodes.seasonNumber,
                seasons.episodeCount,
            );

        const nowMs = Date.now();
        for (const stat of seasonStats) {
            if (isSeasonEligible(stat, nowMs)) {
                if (exclusionIndex.isSeasonExcluded(stat.showId, stat.seasonNumber)) continue;
                // Same existence guard as the whole-show branch above: only queue a season
                // that's actually resolvable in Jellyfin within the scoped libraries.
                const seriesId = seriesMap.get(String(stat.tmdbId));
                const seasonId = seriesId
                    ? await findJellyfinSeasonIdBySeriesId(cfg, seriesId, stat.seasonNumber)
                    : null;
                if (!seasonId) continue;

                const inserted = await db
                    .insert(jellyfinDeleteQueue)
                    .values({ userId, showId: stat.showId, seasonNumber: stat.seasonNumber })
                    .onConflictDoNothing()
                    .returning({ id: jellyfinDeleteQueue.id });
                if (inserted.length > 0) {
                    queued++;
                    console.log(
                        `[jellyfin-delete] Queued S${stat.seasonNumber} of showId=${stat.showId} for user ${userId}`,
                    );
                    if (notifyLanguage !== null) {
                        await notifyQueuedForDeletion(
                            db,
                            userId,
                            notifyLanguage,
                            stat.title,
                            stat.seasonNumber,
                        );
                    }
                }
            }
        }
    }

    // 1c. Movie deletion (N5-T04): watched (any watch_history row) AND the most recent
    //     watch was more than MOVIE_DELETE_BUFFER_DAYS ago — see isMovieEligible.
    const watchedMovies = await db
        .select({
            movieId: movies.id,
            tmdbId: movies.tmdbId,
            title: movies.title,
            lastWatchedAt: sql<string | null>`max(${watchHistory.watchedAt})`,
        })
        .from(watchHistory)
        .innerJoin(movies, eq(movies.id, watchHistory.movieId))
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.mediaType, "movie")))
        .groupBy(movies.id, movies.tmdbId, movies.title);

    const movieNowMs = Date.now();
    for (const movie of watchedMovies) {
        if (exclusionIndex.excludedMovieIds.has(movie.movieId)) continue;
        if (movie.tmdbId === null || !movieMap.has(String(movie.tmdbId))) continue;
        if (!isMovieEligible(movie.lastWatchedAt, movieNowMs)) continue;

        const inserted = await db
            .insert(jellyfinDeleteQueue)
            .values({ userId, movieId: movie.movieId, seasonNumber: null })
            .onConflictDoNothing()
            .returning({ id: jellyfinDeleteQueue.id });
        if (inserted.length > 0) {
            queued++;
            console.log(
                `[jellyfin-delete] Queued movie "${movie.title}" (movieId=${movie.movieId}) for user ${userId}`,
            );
            if (notifyLanguage !== null) {
                await notifyQueuedForDeletion(db, userId, notifyLanguage, movie.title, null);
            }
        }
    }

    return { deleted, queued };
}
