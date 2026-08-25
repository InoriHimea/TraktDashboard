import {
    getDb,
    watchHistory,
    watchHistoryDeletions,
    episodes,
    shows,
    movies,
} from "@trakt-dashboard/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { HistoryDeletionEntry, RestoreDeletionsResult } from "@trakt-dashboard/types";
import { recalcShowProgress, recalcMovieProgress } from "./sync.js";

/**
 * Lists deletion-audit rows not yet recovered (restored_at IS NULL) — the "trash
 * can" view. Every row here was written by one of the two intentional-delete
 * flows (single-entry delete, duplicate-audit batch remove) right before the
 * live watch_history row was removed; see routes/shows.ts, routes/movies.ts,
 * and routes/history.ts's duplicates/remove for the writers.
 */
export async function findPendingDeletions(userId: number): Promise<HistoryDeletionEntry[]> {
    const db = getDb();
    const entries: HistoryDeletionEntry[] = [];

    const episodeRows = await db
        .select({
            id: watchHistoryDeletions.id,
            reason: watchHistoryDeletions.reason,
            deletedAt: watchHistoryDeletions.deletedAt,
            watchedAt: watchHistoryDeletions.watchedAt,
            showId: episodes.showId,
            showTitle: shows.title,
            showTranslatedName: shows.translatedName,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeTitle: episodes.title,
            episodeTranslatedTitle: episodes.translatedTitle,
        })
        .from(watchHistoryDeletions)
        .innerJoin(episodes, eq(watchHistoryDeletions.episodeId, episodes.id))
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .where(
            and(
                eq(watchHistoryDeletions.userId, userId),
                eq(watchHistoryDeletions.mediaType, "episode"),
                isNull(watchHistoryDeletions.restoredAt),
            ),
        );

    for (const row of episodeRows) {
        entries.push({
            id: row.id,
            mediaType: "episode",
            reason: row.reason as "manual" | "duplicate-cleanup",
            deletedAt: row.deletedAt.toISOString(),
            watchedAt: row.watchedAt ? row.watchedAt.toISOString() : null,
            showId: row.showId,
            showTitle: row.showTitle,
            showTranslatedName: row.showTranslatedName,
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
            episodeTitle: row.episodeTitle,
            episodeTranslatedTitle: row.episodeTranslatedTitle,
            movieId: null,
            movieTitle: null,
        });
    }

    const movieRows = await db
        .select({
            id: watchHistoryDeletions.id,
            reason: watchHistoryDeletions.reason,
            deletedAt: watchHistoryDeletions.deletedAt,
            watchedAt: watchHistoryDeletions.watchedAt,
            movieId: movies.id,
            movieTitle: movies.title,
        })
        .from(watchHistoryDeletions)
        .innerJoin(movies, eq(watchHistoryDeletions.movieId, movies.id))
        .where(
            and(
                eq(watchHistoryDeletions.userId, userId),
                eq(watchHistoryDeletions.mediaType, "movie"),
                isNull(watchHistoryDeletions.restoredAt),
            ),
        );

    for (const row of movieRows) {
        entries.push({
            id: row.id,
            mediaType: "movie",
            reason: row.reason as "manual" | "duplicate-cleanup",
            deletedAt: row.deletedAt.toISOString(),
            watchedAt: row.watchedAt ? row.watchedAt.toISOString() : null,
            showId: null,
            showTitle: null,
            showTranslatedName: null,
            seasonNumber: null,
            episodeNumber: null,
            episodeTitle: null,
            episodeTranslatedTitle: null,
            movieId: row.movieId,
            movieTitle: row.movieTitle,
        });
    }

    entries.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return entries;
}

/**
 * Recovers the given audit rows: re-inserts each as a fresh local watch_history
 * row (source='manual', trakt_play_id=null — it genuinely isn't on Trakt right
 * now, which is exactly what lets the existing /history/restore page pick it up
 * later if the user also wants it pushed back to Trakt) and marks the audit row
 * restored so it drops out of the pending list. Each row's insert+mark-restored
 * pair is its own transaction — a crash mid-loop leaves already-processed rows
 * fully done and the rest untouched, never a half-written row.
 *
 * A row whose referenced episode/movie no longer exists (the rare case the
 * schema's `onDelete: "set null"` is there for) is skipped, not counted as
 * restored — there's nothing left to recreate a watch_history row against.
 */
export async function restoreFromDeletions(
    userId: number,
    auditIds: number[],
): Promise<RestoreDeletionsResult> {
    const db = getDb();

    const rows = await db
        .select()
        .from(watchHistoryDeletions)
        .where(
            and(
                eq(watchHistoryDeletions.userId, userId),
                inArray(watchHistoryDeletions.id, auditIds),
                isNull(watchHistoryDeletions.restoredAt),
            ),
        );

    if (rows.length === 0) return { ok: true, restored: 0 };

    const affectedShowIds = new Set<number>();
    const affectedMovieIds = new Set<number>();
    let restored = 0;

    for (const row of rows) {
        if (row.mediaType === "episode" && row.episodeId == null) continue;
        if (row.mediaType === "movie" && row.movieId == null) continue;

        await db.transaction(async (tx) => {
            await tx.insert(watchHistory).values({
                userId,
                episodeId: row.episodeId,
                movieId: row.movieId,
                mediaType: row.mediaType,
                watchedAt: row.watchedAt,
                source: "manual",
                traktPlayId: null,
            });
            await tx
                .update(watchHistoryDeletions)
                .set({ restoredAt: new Date() })
                .where(eq(watchHistoryDeletions.id, row.id));
        });

        restored++;
        if (row.mediaType === "episode" && row.episodeId != null) {
            const [ep] = await db
                .select({ showId: episodes.showId })
                .from(episodes)
                .where(eq(episodes.id, row.episodeId));
            if (ep) affectedShowIds.add(ep.showId);
        } else if (row.mediaType === "movie" && row.movieId != null) {
            affectedMovieIds.add(row.movieId);
        }
    }

    for (const showId of affectedShowIds) await recalcShowProgress(userId, showId);
    for (const movieId of affectedMovieIds) await recalcMovieProgress(userId, movieId);

    return { ok: true, restored };
}
