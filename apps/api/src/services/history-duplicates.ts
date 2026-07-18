import { getDb, watchHistory, episodes, shows, movies } from "@trakt-dashboard/db";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { HistoryDuplicateEntry, HistoryDuplicateGroup } from "@trakt-dashboard/types";

export interface ClusterEntry {
    id: number;
    watchedAt: string;
}

export interface Burst {
    /** Entry ids in this burst, sorted ascending by watchedAt. */
    entryIds: number[];
}

/**
 * Chains entries into "bursts" of consecutive watches no more than `windowHours`
 * apart. Chain-based (not whole-group-span) clustering matters: a genuine rewatch
 * months later must not suppress detection of a same-day duplicate sitting right
 * next to either watch, which a whole-span check would miss entirely.
 */
export function clusterBursts(entries: ClusterEntry[], windowHours: number): Burst[] {
    if (entries.length === 0) return [];

    const sorted = [...entries].sort(
        (a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime(),
    );
    const windowMs = windowHours * 60 * 60 * 1000;

    const bursts: Burst[] = [];
    let current: ClusterEntry[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const prev = current[current.length - 1];
        const gapMs = new Date(sorted[i].watchedAt).getTime() - new Date(prev.watchedAt).getTime();
        if (gapMs <= windowMs) {
            current.push(sorted[i]);
        } else {
            bursts.push({ entryIds: current.map((e) => e.id) });
            current = [sorted[i]];
        }
    }
    bursts.push({ entryIds: current.map((e) => e.id) });

    return bursts;
}

function enrichGroup(
    meta: Omit<HistoryDuplicateGroup, "entries">,
    rawEntries: ClusterEntry[],
    windowHours: number,
): HistoryDuplicateGroup {
    const sorted = [...rawEntries].sort(
        (a, b) => new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime(),
    );
    const bursts = clusterBursts(sorted, windowHours);
    const suggestedIds = new Set<number>();
    for (const burst of bursts) {
        if (burst.entryIds.length > 1) {
            for (const id of burst.entryIds.slice(1)) suggestedIds.add(id);
        }
    }

    const entries: HistoryDuplicateEntry[] = sorted.map((entry, i) => ({
        id: entry.id,
        watchedAt: entry.watchedAt,
        gapFromPreviousHours:
            i === 0
                ? null
                : (new Date(entry.watchedAt).getTime() -
                      new Date(sorted[i - 1].watchedAt).getTime()) /
                  (60 * 60 * 1000),
        suggested: suggestedIds.has(entry.id),
    }));

    return { ...meta, entries };
}

/**
 * Finds groups of >1 watch-history entries for the same episode/movie, sourced
 * from a real Trakt history sync (not manual/imported rows — those have no
 * trakt_play_id and can't be removed from Trakt anyway). Filtering on
 * trakt_play_id rather than `source = 'trakt'` matters: the episode-history
 * incremental sync never sets `source`, so it silently falls back to the
 * schema default of 'manual' — filtering on source would miss every TV-episode
 * duplicate, which is the dominant case this feature exists to clean up.
 */
export async function findDuplicateHistoryGroups(
    userId: number,
    windowHours: number,
): Promise<HistoryDuplicateGroup[]> {
    const db = getDb();
    const groups: HistoryDuplicateGroup[] = [];

    // ── Episodes ─────────────────────────────────────────────────────────────
    const dupEpisodeRows = await db
        .select({ episodeId: watchHistory.episodeId })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.mediaType, "episode"),
                isNotNull(watchHistory.episodeId),
                isNotNull(watchHistory.traktPlayId),
                isNotNull(watchHistory.watchedAt),
            ),
        )
        .groupBy(watchHistory.episodeId)
        .having(sql`count(*) > 1`);

    const dupEpisodeIds = dupEpisodeRows
        .map((r) => r.episodeId)
        .filter((id): id is number => id != null);

    if (dupEpisodeIds.length > 0) {
        const rows = await db
            .select({
                id: watchHistory.id,
                episodeId: watchHistory.episodeId,
                watchedAt: watchHistory.watchedAt,
                showId: episodes.showId,
                showTitle: shows.title,
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
                episodeTitle: episodes.title,
            })
            .from(watchHistory)
            .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
            .innerJoin(shows, eq(episodes.showId, shows.id))
            .where(
                and(
                    eq(watchHistory.userId, userId),
                    inArray(watchHistory.episodeId, dupEpisodeIds),
                    isNotNull(watchHistory.watchedAt),
                ),
            )
            .orderBy(asc(watchHistory.episodeId), asc(watchHistory.watchedAt));

        const byEpisode = new Map<number, typeof rows>();
        for (const row of rows) {
            const key = row.episodeId!;
            if (!byEpisode.has(key)) byEpisode.set(key, []);
            byEpisode.get(key)!.push(row);
        }

        for (const groupRows of byEpisode.values()) {
            if (groupRows.length < 2) continue; // defensive — rows can change between the two queries above
            const first = groupRows[0];
            groups.push(
                enrichGroup(
                    {
                        mediaType: "episode",
                        showId: first.showId,
                        showTitle: first.showTitle,
                        seasonNumber: first.seasonNumber,
                        episodeNumber: first.episodeNumber,
                        episodeTitle: first.episodeTitle,
                        movieId: null,
                        movieTitle: null,
                    },
                    groupRows.map((r) => ({ id: r.id, watchedAt: r.watchedAt!.toISOString() })),
                    windowHours,
                ),
            );
        }
    }

    // ── Movies ───────────────────────────────────────────────────────────────
    const dupMovieRows = await db
        .select({ movieId: watchHistory.movieId })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(watchHistory.mediaType, "movie"),
                isNotNull(watchHistory.movieId),
                isNotNull(watchHistory.traktPlayId),
                isNotNull(watchHistory.watchedAt),
            ),
        )
        .groupBy(watchHistory.movieId)
        .having(sql`count(*) > 1`);

    const dupMovieIds = dupMovieRows.map((r) => r.movieId).filter((id): id is number => id != null);

    if (dupMovieIds.length > 0) {
        const rows = await db
            .select({
                id: watchHistory.id,
                movieId: watchHistory.movieId,
                watchedAt: watchHistory.watchedAt,
                movieTitle: movies.title,
            })
            .from(watchHistory)
            .innerJoin(movies, eq(watchHistory.movieId, movies.id))
            .where(
                and(
                    eq(watchHistory.userId, userId),
                    inArray(watchHistory.movieId, dupMovieIds),
                    isNotNull(watchHistory.watchedAt),
                ),
            )
            .orderBy(asc(watchHistory.movieId), asc(watchHistory.watchedAt));

        const byMovie = new Map<number, typeof rows>();
        for (const row of rows) {
            const key = row.movieId!;
            if (!byMovie.has(key)) byMovie.set(key, []);
            byMovie.get(key)!.push(row);
        }

        for (const groupRows of byMovie.values()) {
            if (groupRows.length < 2) continue;
            const first = groupRows[0];
            groups.push(
                enrichGroup(
                    {
                        mediaType: "movie",
                        showId: null,
                        showTitle: null,
                        seasonNumber: null,
                        episodeNumber: null,
                        episodeTitle: null,
                        movieId: first.movieId,
                        movieTitle: first.movieTitle,
                    },
                    groupRows.map((r) => ({ id: r.id, watchedAt: r.watchedAt!.toISOString() })),
                    windowHours,
                ),
            );
        }
    }

    return groups;
}
