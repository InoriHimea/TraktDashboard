import { Hono } from "hono";
import { getDb, episodes, shows, userShowProgress } from "@trakt-dashboard/db";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import dayjs from "dayjs";

export const calendarRoutes = new Hono<{ Variables: { userId: number } }>();

calendarRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const daysBefore = parseInt(c.req.query("before") || "14");
    const daysAfter = parseInt(c.req.query("after") || "30");

    const startDate = dayjs().subtract(daysBefore, "day").format("YYYY-MM-DD");
    const endDate = dayjs().add(daysAfter, "day").format("YYYY-MM-DD");

    const rows = await db
        .select({
            episode: episodes,
            show: shows,
        })
        .from(episodes)
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .innerJoin(userShowProgress, eq(shows.id, userShowProgress.showId))
        .where(
            and(
                eq(userShowProgress.userId, userId),
                gte(episodes.airDate, startDate),
                lte(episodes.airDate, endDate)
            )
        )
        .orderBy(asc(episodes.airDate));

    // Group by airDate for easier frontend rendering
    const grouped = rows.reduce((acc, row) => {
        const date = row.episode.airDate!;
        if (!acc[date]) acc[date] = [];
        acc[date].push({
            id: row.episode.id,
            seasonNumber: row.episode.seasonNumber,
            episodeNumber: row.episode.episodeNumber,
            title: row.episode.title,
            overview: row.episode.overview,
            runtime: row.episode.runtime,
            stillPath: row.episode.stillPath,
            airDate: row.episode.airDate,
            show: {
                id: row.show.id,
                title: row.show.title,
                originalName: row.show.originalName,
                translatedName: row.show.translatedName,
                posterPath: row.show.posterPath,
                network: row.show.network,
                status: row.show.status,
            }
        });
        return acc;
    }, {} as Record<string, any[]>);

    return c.json({
        ok: true,
        data: grouped,
    });
});
