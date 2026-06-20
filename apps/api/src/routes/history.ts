import { Hono } from "hono";
import { getDb, watchHistory, episodes, shows, movies } from "@trakt-dashboard/db";
import { eq, and, gte, lte, desc, sql, ilike, or } from "drizzle-orm";
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

    // CSV Injection defence (OWASP):
    // 1. Replace embedded CR/LF with a space — non-RFC-4180 parsers split on
    //    bare newlines even inside a quoted field, injecting a new row.
    // 2. Prefix with a single space when the first character is a formula trigger
    //    (=, +, -, @). Detection and prefix both apply to the same string so they
    //    stay consistent. A value already starting with whitespace (e.g. " =X") is
    //    safe without a prefix because spreadsheets don't evaluate cells whose
    //    first character is a space as a formula.
    //    Space prefix (not \t) because \t is itself a trigger in some parsers.
    const sanitizeCsv = (v: string) => {
        const clean = v.replace(/[\r\n]/g, " ");
        return /^[=+\-@]/.test(clean) ? ` ${clean}` : clean;
    };

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

// POST /api/history/import — JSON 导入（与 export 格式对称）
historyRoutes.post("/import", async (c) => {
    const userId = c.get("userId");

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON" }, 400);
    }

    const rawEntries: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray((body as Record<string, unknown>)?.entries)
          ? ((body as Record<string, unknown>).entries as unknown[])
          : [];

    if (rawEntries.length === 0) return c.json({ error: "No entries found" }, 400);
    if (rawEntries.length > 50_000) return c.json({ error: "Too many entries (max 50000)" }, 400);

    const db = getDb();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // ── Pre-build lookup caches ─────────────────────────────────────────────
    // Collect unique show titles and movie titles first, then batch-query.
    const showTitles = new Set<string>();
    const movieTitles = new Set<string>();

    for (const entry of rawEntries) {
        const e = entry as Record<string, unknown>;
        const mt = (e.history as Record<string, unknown> | undefined)?.mediaType;
        if (mt === "episode") {
            const st = (e.show as Record<string, unknown> | undefined)?.title;
            if (typeof st === "string") showTitles.add(st.toLowerCase());
        } else if (mt === "movie") {
            const mt2 = (e.movie as Record<string, unknown> | undefined)?.title;
            if (typeof mt2 === "string") movieTitles.add(mt2.toLowerCase());
        }
    }

    // Batch show lookup: title or translatedName match (case-insensitive)
    const showCache = new Map<string, number>(); // lowercase title → local show.id
    for (const title of showTitles) {
        const [row] = await db
            .select({ id: shows.id, title: shows.title, translatedName: shows.translatedName })
            .from(shows)
            .where(or(ilike(shows.title, title), ilike(shows.translatedName, title)))
            .limit(1);
        if (row) {
            showCache.set(title, row.id);
            if (row.translatedName) showCache.set(row.translatedName.toLowerCase(), row.id);
        }
    }

    // Batch movie lookup
    const movieCache = new Map<string, number>(); // lowercase title → local movie.id
    for (const title of movieTitles) {
        const [row] = await db
            .select({ id: movies.id })
            .from(movies)
            .where(ilike(movies.title, title))
            .limit(1);
        if (row) movieCache.set(title, row.id);
    }

    // ── Process entries ─────────────────────────────────────────────────────
    for (const entry of rawEntries) {
        try {
            const e = entry as Record<string, unknown>;
            const h = (e.history as Record<string, unknown>) ?? {};
            const mediaType = h.mediaType as string | undefined;
            const rawWatchedAt = h.watchedAt as string | undefined;
            const watchedAt = rawWatchedAt ? new Date(rawWatchedAt) : null;

            if (mediaType !== "episode" && mediaType !== "movie") {
                skipped++;
                continue;
            }

            if (mediaType === "episode") {
                const ep = (e.episode as Record<string, unknown>) ?? {};
                const showTitle = ((e.show as Record<string, unknown>) ?? {}).title as
                    | string
                    | undefined;
                const seasonNumber = ep.seasonNumber as number | undefined;
                const episodeNumber = ep.episodeNumber as number | undefined;

                if (!showTitle || seasonNumber == null || episodeNumber == null) {
                    skipped++;
                    continue;
                }

                const showId = showCache.get(showTitle.toLowerCase());
                if (!showId) {
                    skipped++;
                    continue;
                }

                const [epRow] = await db
                    .select({ id: episodes.id })
                    .from(episodes)
                    .where(
                        and(
                            eq(episodes.showId, showId),
                            eq(episodes.seasonNumber, seasonNumber),
                            eq(episodes.episodeNumber, episodeNumber),
                        ),
                    )
                    .limit(1);

                if (!epRow) {
                    skipped++;
                    continue;
                }

                // Duplicate check
                const dupConds = [
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.episodeId, epRow.id),
                ];
                if (watchedAt) dupConds.push(eq(watchHistory.watchedAt, watchedAt));
                const [dup] = await db
                    .select({ id: watchHistory.id })
                    .from(watchHistory)
                    .where(and(...dupConds))
                    .limit(1);
                if (dup) {
                    skipped++;
                    continue;
                }

                await db.insert(watchHistory).values({
                    userId,
                    episodeId: epRow.id,
                    mediaType: "episode",
                    watchedAt,
                    source: "import",
                });
                imported++;
            } else {
                // movie
                const movieTitle = ((e.movie as Record<string, unknown>) ?? {}).title as
                    | string
                    | undefined;
                if (!movieTitle) {
                    skipped++;
                    continue;
                }

                const movieId = movieCache.get(movieTitle.toLowerCase());
                if (!movieId) {
                    skipped++;
                    continue;
                }

                const dupConds = [
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.movieId, movieId),
                ];
                if (watchedAt) dupConds.push(eq(watchHistory.watchedAt, watchedAt));
                const [dup] = await db
                    .select({ id: watchHistory.id })
                    .from(watchHistory)
                    .where(and(...dupConds))
                    .limit(1);
                if (dup) {
                    skipped++;
                    continue;
                }

                await db.insert(watchHistory).values({
                    userId,
                    movieId,
                    mediaType: "movie",
                    watchedAt,
                    source: "import",
                });
                imported++;
            }
        } catch (err) {
            if (errors.length < 20) errors.push(String(err));
        }
    }

    return c.json({ ok: true, imported, skipped, errors });
});
