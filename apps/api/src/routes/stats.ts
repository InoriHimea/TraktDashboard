import { Hono } from "hono";
import {
    getDb,
    watchHistory,
    episodes,
    shows,
    userShowProgress,
    movies,
    userMovieProgress,
} from "@trakt-dashboard/db";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { longestConsecutiveDays } from "../lib/streak.js";

export const statsRoutes = new Hono<{ Variables: { userId: number } }>();

function watchedAtKey(value: Date | string | null): string {
    if (value instanceof Date) return value.toISOString();
    return value ?? "unknown";
}

function uniqueRecentItems<T>(items: T[], keyOf: (item: T) => string, limit: number): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const item of items) {
        const key = keyOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
        if (unique.length >= limit) break;
    }
    return unique;
}

// GET /api/stats/overview
statsRoutes.get("/overview", async (c) => {
    const userId = c.get("userId");
    const db = getDb();

    const [totals] = await db
        .select({
            totalWatched: sql<number>`count(distinct ${watchHistory.episodeId})`,
            totalShows: sql<number>`count(distinct ${episodes.showId})`,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(eq(watchHistory.userId, userId));

    const [completedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userShowProgress)
        .where(and(eq(userShowProgress.userId, userId), eq(userShowProgress.completed, true)));

    // Total runtime in minutes
    const [episodeRuntime] = await db
        .select({ total: sql<number>`sum(${episodes.runtime})` })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.mediaType, "episode")));

    const [movieTotals] = await db
        .select({
            totalMoviesWatched: sql<number>`count(distinct ${userMovieProgress.movieId})`,
            totalMovieWatches: sql<number>`coalesce(sum(${userMovieProgress.watchCount}), 0)`,
            totalMovieRuntimeMinutes: sql<number>`coalesce(sum(${movies.runtime} * ${userMovieProgress.watchCount}), 0)`,
        })
        .from(userMovieProgress)
        .innerJoin(movies, eq(userMovieProgress.movieId, movies.id))
        .where(and(eq(userMovieProgress.userId, userId), sql`${userMovieProgress.watchCount} > 0`));

    // Watch activity per month (last 12 months)
    const monthlyActivity = await db
        .select({
            month: sql<string>`to_char(watched_at, 'YYYY-MM')`,
            count: sql<number>`count(*)`,
        })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                gte(watchHistory.watchedAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
            ),
        )
        .groupBy(sql`to_char(watched_at, 'YYYY-MM')`)
        .orderBy(sql`to_char(watched_at, 'YYYY-MM')`);

    // Top genres
    const allShowProgress = await db
        .select({ genres: shows.genres })
        .from(userShowProgress)
        .innerJoin(shows, eq(userShowProgress.showId, shows.id))
        .where(eq(userShowProgress.userId, userId));

    const allMovieProgress = await db
        .select({ genres: movies.genres })
        .from(userMovieProgress)
        .innerJoin(movies, eq(userMovieProgress.movieId, movies.id))
        .where(and(eq(userMovieProgress.userId, userId), sql`${userMovieProgress.watchCount} > 0`));

    const genreCount: Record<string, number> = {};
    for (const row of [...allShowProgress, ...allMovieProgress]) {
        for (const g of (row.genres as string[]) || []) {
            genreCount[g] = (genreCount[g] || 0) + 1;
        }
    }
    const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

    // Recently watched
    const recentEpisodeRows = await db
        .select({
            episodeId: watchHistory.episodeId,
            showTitle: shows.title,
            showId: shows.id,
            posterPath: shows.posterPath,
            stillPath: episodes.stillPath,
            episodeTitle: episodes.title,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            watchedAt: watchHistory.watchedAt,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.mediaType, "episode")))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(45);

    const recentlyWatched = uniqueRecentItems(
        recentEpisodeRows,
        (row) => `${row.episodeId}:${watchedAtKey(row.watchedAt)}`,
        15,
    ).map(({ episodeId: _episodeId, ...row }) => row);

    const recentMovieRows = await db
        .select({
            movieTitle: movies.title,
            movieId: movies.id,
            posterPath: movies.posterPath,
            watchedAt: watchHistory.watchedAt,
        })
        .from(watchHistory)
        .innerJoin(movies, eq(watchHistory.movieId, movies.id))
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.mediaType, "movie")))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(30);

    const recentlyWatchedMovies = uniqueRecentItems(
        recentMovieRows,
        (row) => `${row.movieId}:${watchedAtKey(row.watchedAt)}`,
        10,
    );

    // D1 — trend metrics
    const now = new Date();
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const sameDayLastYear = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
    );

    const [[yearCurrentRow], [yearLastRow], watchDates, [avg30Row]] = await Promise.all([
        db
            .select({ count: sql<number>`count(*)` })
            .from(watchHistory)
            .where(
                and(eq(watchHistory.userId, userId), gte(watchHistory.watchedAt, thisYearStart)),
            ),
        db
            .select({ count: sql<number>`count(*)` })
            .from(watchHistory)
            .where(
                and(
                    eq(watchHistory.userId, userId),
                    gte(watchHistory.watchedAt, lastYearStart),
                    sql`${watchHistory.watchedAt} <= ${sameDayLastYear}`,
                ),
            ),
        db
            .selectDistinct({ day: sql<string>`DATE(${watchHistory.watchedAt})::text` })
            .from(watchHistory)
            .where(and(eq(watchHistory.userId, userId), sql`${watchHistory.watchedAt} IS NOT NULL`))
            .orderBy(sql`DATE(${watchHistory.watchedAt})`),
        db
            .select({ count: sql<number>`count(*)` })
            .from(watchHistory)
            .where(
                and(
                    eq(watchHistory.userId, userId),
                    gte(watchHistory.watchedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
                ),
            ),
    ]);

    const longestStreakDays = longestConsecutiveDays(watchDates.map((d) => d.day));

    const avgDailyWatches30d = Math.round((Number(avg30Row?.count || 0) / 30) * 10) / 10;

    return c.json({
        data: {
            totalEpisodesWatched: Number(totals?.totalWatched || 0),
            totalShowsWatched: Number(totals?.totalShows || 0),
            totalShowsCompleted: Number(completedCount?.count || 0),
            totalMoviesWatched: Number(movieTotals?.totalMoviesWatched || 0),
            totalMovieWatches: Number(movieTotals?.totalMovieWatches || 0),
            totalRuntimeMinutes:
                Number(episodeRuntime?.total || 0) +
                Number(movieTotals?.totalMovieRuntimeMinutes || 0),
            totalEpisodeRuntimeMinutes: Number(episodeRuntime?.total || 0),
            totalMovieRuntimeMinutes: Number(movieTotals?.totalMovieRuntimeMinutes || 0),
            monthlyActivity: monthlyActivity.map((r) => ({
                month: r.month,
                count: Number(r.count),
            })),
            topGenres,
            recentlyWatched,
            recentlyWatchedMovies,
            yearComparison: {
                thisYear: Number(yearCurrentRow?.count || 0),
                lastYear: Number(yearLastRow?.count || 0),
            },
            longestStreakDays,
            avgDailyWatches30d,
        },
    });
});
