import { Hono } from "hono";
import { getDb, episodes, shows, userShowProgress, watchHistory } from "@trakt-dashboard/db";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { apiOk } from "../lib/response.js";
import { parseBoundedInt } from "../lib/number.js";
import type { CalendarEpisode } from "@trakt-dashboard/types";

export const calendarRoutes = new Hono<{ Variables: { userId: number } }>();

// Cap the scan window so an arbitrarily large before/after can't trigger a full-table date scan (P1-T13).
const MAX_WINDOW_DAYS = 90;

calendarRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const daysBefore = parseBoundedInt(c.req.query("before"), 14, 0, MAX_WINDOW_DAYS);
    const daysAfter = parseBoundedInt(c.req.query("after"), 30, 0, MAX_WINDOW_DAYS);

    const startDate = dayjs().subtract(daysBefore, "day").format("YYYY-MM-DD");
    const endDate = dayjs().add(daysAfter, "day").format("YYYY-MM-DD");

    const rows = await db
        .select({
            episode: episodes,
            show: shows,
            // P1-T13: per-episode watched flag via correlated EXISTS (avoids row fan-out
            // that a LEFT JOIN against multiple history rows would produce).
            watched: sql<boolean>`EXISTS (SELECT 1 FROM ${watchHistory} WHERE ${watchHistory.episodeId} = ${episodes.id} AND ${watchHistory.userId} = ${userId})`,
        })
        .from(episodes)
        .innerJoin(shows, eq(episodes.showId, shows.id))
        .innerJoin(userShowProgress, eq(shows.id, userShowProgress.showId))
        .where(
            and(
                eq(userShowProgress.userId, userId),
                gte(episodes.airDate, startDate),
                lte(episodes.airDate, endDate),
            ),
        )
        .orderBy(asc(episodes.airDate));

    // Group by airDate for easier frontend rendering
    const grouped = rows.reduce(
        (acc, row) => {
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
                watched: Boolean(row.watched),
                show: {
                    id: row.show.id,
                    title: row.show.title,
                    originalName: row.show.originalName,
                    translatedName: row.show.translatedName,
                    posterPath: row.show.posterPath,
                    backdropPath: row.show.backdropPath,
                    network: row.show.network,
                    status: row.show.status,
                },
            });
            return acc;
        },
        {} as Record<string, CalendarEpisode[]>,
    );

    return apiOk(c, grouped);
});
