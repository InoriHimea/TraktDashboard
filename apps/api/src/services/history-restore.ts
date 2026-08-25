import { getDb, watchHistory, episodes, shows, movies } from "@trakt-dashboard/db";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { RestorableHistoryEntry, RestoreHistoryResult } from "@trakt-dashboard/types";
import { getTraktClient, type TraktAddHistoryItem } from "./trakt.js";

const TRAKT_ADD_CHUNK_SIZE = 100; // mirrors the remove path's chunk size (routes/history.ts)
// Reconciliation lookback buffer: /sync/history's start_at is inclusive-ish but
// clock skew between the local timestamp and Trakt's own is possible — a few
// minutes of slack costs nothing (the match is by exact watched_at + item id).
const RECONCILE_LOOKBACK_MS = 5 * 60 * 1000;

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}

/**
 * Finds local watch_history rows that are not currently reflected on Trakt.
 *
 * Two distinct cases, controlled by `includeManual`:
 * - source='trakt': the row was synced FROM Trakt at some point (has a
 *   trakt_play_id) but that id is no longer present in Trakt's current history —
 *   it was lost there (deleted directly, or corrupted by some other client).
 *   Always included — this is the primary, most urgent case.
 * - source='manual': marked watched inside this app but never pushed to Trakt at
 *   all (there is no push path for it today). Only included when the caller
 *   opts in — these were never on Trakt, so "restoring" them is a bigger,
 *   different claim than recovering lost data.
 *
 * source='import' rows are deliberately never included (see the plan doc — their
 * origin isn't necessarily Trakt-compatible data).
 */
export async function findRestorableHistoryEntries(
    userId: number,
    includeManual: boolean,
): Promise<RestorableHistoryEntry[]> {
    const db = getDb();
    const trakt = getTraktClient();

    const remoteHistory = await trakt.getHistory(userId);
    const remoteTraktPlayIds = new Set(remoteHistory.map((entry) => String(entry.id)));

    const sourceCondition = includeManual
        ? or(eq(watchHistory.source, "trakt"), eq(watchHistory.source, "manual"))
        : eq(watchHistory.source, "trakt");

    function isRestorable(row: { source: string; traktPlayId: string | null }): boolean {
        if (row.source === "trakt") {
            return row.traktPlayId != null && !remoteTraktPlayIds.has(row.traktPlayId);
        }
        return true; // source === "manual" — never synced, always a candidate once opted in
    }

    const entries: RestorableHistoryEntry[] = [];

    const episodeRows = await db
        .select({
            id: watchHistory.id,
            watchedAt: watchHistory.watchedAt,
            source: watchHistory.source,
            traktPlayId: watchHistory.traktPlayId,
            showId: episodes.showId,
            showTitle: shows.title,
            showTranslatedName: shows.translatedName,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeTitle: episodes.title,
            episodeTranslatedTitle: episodes.translatedTitle,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.mediaType, "episode"),
                sourceCondition,
                isNotNull(watchHistory.watchedAt),
            ),
        );

    for (const row of episodeRows) {
        if (!isRestorable(row)) continue;
        entries.push({
            id: row.id,
            mediaType: "episode",
            source: row.source as "trakt" | "manual",
            watchedAt: row.watchedAt!.toISOString(),
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
            id: watchHistory.id,
            watchedAt: watchHistory.watchedAt,
            source: watchHistory.source,
            traktPlayId: watchHistory.traktPlayId,
            movieId: watchHistory.movieId,
            movieTitle: movies.title,
        })
        .from(watchHistory)
        .innerJoin(movies, eq(watchHistory.movieId, movies.id))
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.mediaType, "movie"),
                sourceCondition,
                isNotNull(watchHistory.watchedAt),
            ),
        );

    for (const row of movieRows) {
        if (!isRestorable(row)) continue;
        entries.push({
            id: row.id,
            mediaType: "movie",
            source: row.source as "trakt" | "manual",
            watchedAt: row.watchedAt!.toISOString(),
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

    entries.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
    return entries;
}

interface RestoreRow {
    id: number;
    watchedAt: Date;
    mediaType: string;
    episodeId: number | null;
    movieId: number | null;
}

/**
 * Pushes the given local watch_history rows back to Trakt via POST /sync/history,
 * then reconciles: Trakt's add-history response never returns the new history
 * id (trakt/trakt-api#248 is still open asking for this), so the only way to
 * learn it — and update the local row so it isn't flagged as restorable again,
 * or re-inserted as a duplicate by the next sync — is to re-fetch history and
 * match the newly created entry by (type, item's own trakt id, watched_at).
 *
 * A row that fails to add, or adds but can't be matched back, is never silently
 * treated as done — it's counted separately (`failed` / `unconfirmed`) so the
 * caller can tell the user exactly what still needs attention.
 */
export async function restoreHistoryEntries(
    userId: number,
    localIds: number[],
): Promise<RestoreHistoryResult> {
    const db = getDb();
    const trakt = getTraktClient();

    const rows = (await db
        .select({
            id: watchHistory.id,
            watchedAt: watchHistory.watchedAt,
            mediaType: watchHistory.mediaType,
            episodeId: watchHistory.episodeId,
            movieId: watchHistory.movieId,
        })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                inArray(watchHistory.id, localIds),
                isNotNull(watchHistory.watchedAt),
            ),
        )) as RestoreRow[];

    if (rows.length === 0) return { ok: true, restored: 0, unconfirmed: 0, failed: 0 };

    const episodeIds = [
        ...new Set(rows.filter((r) => r.episodeId != null).map((r) => r.episodeId!)),
    ];
    const movieIds = [...new Set(rows.filter((r) => r.movieId != null).map((r) => r.movieId!))];

    const episodeTraktIdMap = new Map<number, number>();
    if (episodeIds.length > 0) {
        const epRows = await db
            .select({ id: episodes.id, traktId: episodes.traktId })
            .from(episodes)
            .where(inArray(episodes.id, episodeIds));
        for (const e of epRows) if (e.traktId != null) episodeTraktIdMap.set(e.id, e.traktId);
    }

    const movieTraktIdMap = new Map<number, number>();
    if (movieIds.length > 0) {
        const movRows = await db
            .select({ id: movies.id, traktId: movies.traktId })
            .from(movies)
            .where(inArray(movies.id, movieIds));
        for (const m of movRows) if (m.traktId != null) movieTraktIdMap.set(m.id, m.traktId);
    }

    function rowTraktId(row: RestoreRow): number | undefined {
        if (row.mediaType === "episode") {
            return row.episodeId != null ? episodeTraktIdMap.get(row.episodeId) : undefined;
        }
        return row.movieId != null ? movieTraktIdMap.get(row.movieId) : undefined;
    }

    let failed = 0;
    const pushedRows: RestoreRow[] = []; // successfully included in a successful POST /sync/history call

    for (const batch of chunk(rows, TRAKT_ADD_CHUNK_SIZE)) {
        const episodeItems: TraktAddHistoryItem[] = [];
        const movieItems: TraktAddHistoryItem[] = [];
        const batchRows: RestoreRow[] = [];

        for (const row of batch) {
            const traktId = rowTraktId(row);
            if (traktId == null) {
                failed++; // no known Trakt id for this item — can't be added at all
                continue;
            }
            const item: TraktAddHistoryItem = {
                watched_at: row.watchedAt.toISOString(),
                ids: { trakt: traktId },
            };
            if (row.mediaType === "episode") episodeItems.push(item);
            else movieItems.push(item);
            batchRows.push(row);
        }

        if (batchRows.length === 0) continue;

        try {
            await trakt.addToHistory(userId, { movies: movieItems, episodes: episodeItems });
            pushedRows.push(...batchRows);
        } catch (e) {
            console.error(`[history:restore] Failed to add a batch to Trakt:`, e);
            failed += batchRows.length;
        }
    }

    if (pushedRows.length === 0) {
        return { ok: true, restored: 0, unconfirmed: 0, failed };
    }

    const minWatchedAtMs = Math.min(...pushedRows.map((r) => r.watchedAt.getTime()));
    const lookbackStart = new Date(minWatchedAtMs - RECONCILE_LOOKBACK_MS).toISOString();

    let freshHistory: Awaited<ReturnType<typeof trakt.getHistory>> = [];
    try {
        freshHistory = await trakt.getHistory(userId, lookbackStart);
    } catch (e) {
        console.error(`[history:restore] Failed to re-fetch history for id reconciliation:`, e);
        // Every pushed row is now unconfirmed rather than restored — the write
        // itself succeeded, we just couldn't verify or record its new id.
        return { ok: true, restored: 0, unconfirmed: pushedRows.length, failed };
    }

    let restored = 0;
    let unconfirmed = 0;

    for (const row of pushedRows) {
        const traktId = rowTraktId(row)!;
        const watchedAtIso = row.watchedAt.toISOString();
        const match = freshHistory.find((entry) => {
            if (entry.watched_at !== watchedAtIso) return false;
            if (row.mediaType === "episode") {
                return entry.type === "episode" && entry.episode?.ids.trakt === traktId;
            }
            return entry.type === "movie" && entry.movie?.ids.trakt === traktId;
        });

        if (match) {
            await db
                .update(watchHistory)
                .set({ traktPlayId: String(match.id), source: "trakt" })
                .where(eq(watchHistory.id, row.id));
            restored++;
        } else {
            unconfirmed++;
        }
    }

    return { ok: true, restored, unconfirmed, failed };
}
