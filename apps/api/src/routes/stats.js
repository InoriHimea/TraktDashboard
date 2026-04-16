import { Hono } from 'hono';
import { getDb, watchHistory, episodes, shows, userShowProgress } from '@trakt-dashboard/db';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
export const statsRoutes = new Hono();
// GET /api/stats/overview
statsRoutes.get('/overview', async (c) => {
    const userId = c.get('userId');
    const db = getDb();
    const [totals] = await db.select({
        totalWatched: sql `count(distinct ${watchHistory.episodeId})`,
        totalShows: sql `count(distinct ${episodes.showId})`,
    })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(eq(watchHistory.userId, userId));
    const [completedCount] = await db.select({ count: sql `count(*)` })
        .from(userShowProgress)
        .where(and(eq(userShowProgress.userId, userId), eq(userShowProgress.completed, true)));
    // Total runtime in minutes
    const [runtime] = await db.select({ total: sql `sum(${episodes.runtime})` })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(eq(watchHistory.userId, userId));
    // Watch activity per month (last 12 months)
    const monthlyActivity = await db.select({
        month: sql `to_char(watched_at, 'YYYY-MM')`,
        count: sql `count(*)`,
    })
        .from(watchHistory)
        .where(and(eq(watchHistory.userId, userId), gte(watchHistory.watchedAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))))
        .groupBy(sql `to_char(watched_at, 'YYYY-MM')`)
        .orderBy(sql `to_char(watched_at, 'YYYY-MM')`);
    // Top genres
    const allProgress = await db.select({ genres: shows.genres })
        .from(userShowProgress)
        .innerJoin(shows, eq(userShowProgress.showId, shows.id))
        .where(eq(userShowProgress.userId, userId));
    const genreCount = {};
    for (const row of allProgress) {
        for (const g of row.genres || []) {
            genreCount[g] = (genreCount[g] || 0) + 1;
        }
    }
    const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));
    // Recently watched
    const recentlyWatched = await db.select({
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
        .where(eq(watchHistory.userId, userId))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(15);
    return c.json({
        data: {
            totalEpisodesWatched: Number(totals?.totalWatched || 0),
            totalShowsWatched: Number(totals?.totalShows || 0),
            totalShowsCompleted: Number(completedCount?.count || 0),
            totalRuntimeMinutes: Number(runtime?.total || 0),
            monthlyActivity: monthlyActivity.map(r => ({ month: r.month, count: Number(r.count) })),
            topGenres,
            recentlyWatched,
        },
    });
});
//# sourceMappingURL=stats.js.map