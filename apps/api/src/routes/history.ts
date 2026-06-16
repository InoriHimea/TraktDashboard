import { Hono } from "hono";
import { getDb, watchHistory, episodes, shows, movies } from "@trakt-dashboard/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { apiOk } from "../lib/response.js";
import { parseBoundedInt } from "../lib/number.js";
import { toIsoOrNull } from "../lib/datetime.js";
import type { HistoryEntry } from "@trakt-dashboard/types";

export const historyRoutes = new Hono<{ Variables: { userId: number } }>();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function buildConditions(
    userId: number,
    mediaType: string,
    startDate: string | undefined,
    endDate: string | undefined,
) {
    const conditions = [eq(watchHistory.userId, userId)];
    if (mediaType === "episode") conditions.push(eq(watchHistory.mediaType, "episode"));
    else if (mediaType === "movie") conditions.push(eq(watchHistory.mediaType, "movie"));
    if (startDate) {
        const d = new Date(startDate);
        if (!Number.isNaN(d.getTime())) conditions.push(gte(watchHistory.watchedAt, d));
    }
    if (endDate) {
        const d = new Date(endDate);
        if (!Number.isNaN(d.getTime())) conditions.push(lte(watchHistory.watchedAt, d));
    }
    return conditions;
}

// GET /api/history?mediaType=all|episode|movie&startDate=&endDate=&limit=50&offset=0
historyRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rawType = c.req.query("mediaType") ?? "all";
    const mediaType = ["all", "episode", "movie"].includes(rawType) ? rawType : "all";
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const limit = parseBoundedInt(c.req.query("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseBoundedInt(c.req.query("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    const conditions = buildConditions(userId, mediaType, startDate, endDate);

    const rows = await db
        .select({
            history: {
                id: watchHistory.id,
                mediaType: watchHistory.mediaType,
                watchedAt: watchHistory.watchedAt,
                source: watchHistory.source,
            },
            episode: {
                id: episodes.id,
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
                title: episodes.title,
            },
            show: {
                id: shows.id,
                title: shows.title,
                translatedName: shows.translatedName,
                posterPath: shows.posterPath,
            },
            movie: {
                id: movies.id,
                title: movies.title,
                posterPath: movies.posterPath,
            },
        })
        .from(watchHistory)
        .leftJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .leftJoin(shows, eq(episodes.showId, shows.id))
        .leftJoin(movies, eq(watchHistory.movieId, movies.id))
        .where(and(...conditions))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(limit)
        .offset(offset);

    const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(watchHistory)
        .where(and(...conditions));

    const entries: HistoryEntry[] = rows.map((row) => {
        const base = {
            id: row.history.id,
            mediaType: row.history.mediaType as "episode" | "movie",
            watchedAt: toIsoOrNull(row.history.watchedAt),
            source: row.history.source,
        };

        if (row.history.mediaType === "movie" && row.movie?.id) {
            return { ...base, movie: row.movie };
        }

        return {
            ...base,
            ...(row.episode?.id ? { episode: row.episode } : {}),
            ...(row.show?.id ? { show: row.show } : {}),
        };
    });

    return apiOk(c, { entries, total: countRow?.count ?? 0 });
});

// GET /api/history/export?mediaType=all|episode|movie&startDate=&endDate=&format=csv|json
historyRoutes.get("/export", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rawType = c.req.query("mediaType") ?? "all";
    const mediaType = ["all", "episode", "movie"].includes(rawType) ? rawType : "all";
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const format = c.req.query("format") === "json" ? "json" : "csv";

    const conditions = buildConditions(userId, mediaType, startDate, endDate);

    const rows = await db
        .select({
            history: {
                id: watchHistory.id,
                mediaType: watchHistory.mediaType,
                watchedAt: watchHistory.watchedAt,
                source: watchHistory.source,
            },
            episode: {
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
                title: episodes.title,
            },
            show: { title: shows.title },
            movie: { title: movies.title },
        })
        .from(watchHistory)
        .leftJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .leftJoin(shows, eq(episodes.showId, shows.id))
        .leftJoin(movies, eq(watchHistory.movieId, movies.id))
        .where(and(...conditions))
        .orderBy(desc(watchHistory.watchedAt));

    if (format === "json") {
        return new Response(JSON.stringify(rows), {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="watch-history.json"`,
            },
        });
    }

    // Prevent CSV formula injection: prefix cells starting with formula-trigger
    // characters (=, +, -, @, tab, CR) with a tab so spreadsheets treat them
    // as text. OWASP recommendation for CSV Injection defence.
    const sanitizeCsv = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `\t${v}` : v);

    const lines = [
        "Type,Show / Movie,Season,Episode,Title,WatchedAt,Source",
        ...rows.map((row) => {
            const isEp = row.history.mediaType === "episode";
            return [
                isEp ? "episode" : "movie",
                isEp ? (row.show?.title ?? "") : (row.movie?.title ?? ""),
                isEp ? (row.episode?.seasonNumber ?? "") : "",
                isEp ? (row.episode?.episodeNumber ?? "") : "",
                isEp ? (row.episode?.title ?? "") : (row.movie?.title ?? ""),
                toIsoOrNull(row.history.watchedAt) ?? "",
                row.history.source,
            ]
                .map((v) => `"${sanitizeCsv(String(v)).replace(/"/g, '""')}"`)
                .join(",");
        }),
    ];

    return new Response(lines.join("\r\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="watch-history.csv"`,
        },
    });
});
