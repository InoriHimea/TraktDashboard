import { Hono } from "hono";
import { getDb, watchHistory, episodes, shows, movies } from "@trakt-dashboard/db";
import { eq, and, gte, lte, desc, sql, or, isNull, isNotNull, inArray } from "drizzle-orm";
import { apiOk } from "../lib/response.js";
import { parseBoundedInt } from "../lib/number.js";
import { toIsoOrNull } from "../lib/datetime.js";
import type { HistoryEntry } from "@trakt-dashboard/types";
import { findDuplicateHistoryGroups } from "../services/history-duplicates.js";
import { getTraktClient } from "../services/trakt.js";
import { recalcShowProgress, recalcMovieProgress } from "../services/sync.js";

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
                // Title column is the episode title; movies have no episode title (the
                // movie name already appears in the "Show / Movie" column).
                isEp ? (row.episode?.title ?? "") : "",
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
        // Exact case-insensitive match (title is already lower-cased). Using lower()=
        // rather than ilike avoids LIKE metacharacters (% / _) in a title being treated
        // as wildcards, which would match the wrong show or fail to match its own row.
        const [row] = await db
            .select({ id: shows.id, title: shows.title, translatedName: shows.translatedName })
            .from(shows)
            .where(
                or(
                    sql`lower(${shows.title}) = ${title}`,
                    sql`lower(${shows.translatedName}) = ${title}`,
                ),
            )
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
            .where(sql`lower(${movies.title}) = ${title}`)
            .limit(1);
        if (row) movieCache.set(title, row.id);
    }

    // Batch-preload episodes for every resolved show, so the per-entry loop resolves
    // episodes from memory instead of issuing one SELECT per imported entry (N+1).
    const episodeCache = new Map<string, number>(); // `${showId}:${season}:${episode}` → episode.id
    const resolvedShowIds = [...new Set(showCache.values())];
    if (resolvedShowIds.length > 0) {
        const epRows = await db
            .select({
                id: episodes.id,
                showId: episodes.showId,
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
            })
            .from(episodes)
            .where(inArray(episodes.showId, resolvedShowIds));
        for (const r of epRows) {
            episodeCache.set(`${r.showId}:${r.seasonNumber}:${r.episodeNumber}`, r.id);
        }
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

                const epId = episodeCache.get(`${showId}:${seasonNumber}:${episodeNumber}`);
                if (!epId) {
                    skipped++;
                    continue;
                }

                // Duplicate check — include watchedAt in the key so a null-timestamp
                // entry only deduplicates against other null-timestamp entries, not
                // against existing timestamped rows for the same episode.
                const dupConds = [
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.episodeId, epId),
                ];
                if (watchedAt !== null) {
                    dupConds.push(eq(watchHistory.watchedAt, watchedAt));
                } else {
                    dupConds.push(isNull(watchHistory.watchedAt));
                }
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
                    episodeId: epId,
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
                if (watchedAt !== null) {
                    dupConds.push(eq(watchHistory.watchedAt, watchedAt));
                } else {
                    dupConds.push(isNull(watchHistory.watchedAt));
                }
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
            skipped++;
        }
    }

    return c.json({ ok: true, imported, skipped, errors });
});

const DEFAULT_DUPLICATE_WINDOW_HOURS = 72;
const MAX_DUPLICATE_WINDOW_HOURS = 24 * 30; // 30 days — a generous ceiling, still bounded
const TRAKT_REMOVE_CHUNK_SIZE = 100; // keep individual /sync/history/remove calls small to avoid timeouts

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}

// GET /api/history/duplicates?windowHours=72
// Audits the local watch_history mirror (not a fresh Trakt fetch — see
// findDuplicateHistoryGroups for why the local table is already a reliable 1:1
// mirror) for episodes/movies with more than one Trakt-sourced history entry,
// clustering entries into "bursts" of watches within windowHours of each other so
// the UI can pre-suggest same-session/same-bug duplicates while leaving genuinely
// separate rewatches untouched.
historyRoutes.get("/duplicates", async (c) => {
    const userId = c.get("userId");
    const windowHours = parseBoundedInt(
        c.req.query("windowHours"),
        DEFAULT_DUPLICATE_WINDOW_HOURS,
        1,
        MAX_DUPLICATE_WINDOW_HOURS,
    );

    const groups = await findDuplicateHistoryGroups(userId, windowHours);

    return apiOk(c, { groups, windowHours });
});

// POST /api/history/duplicates/remove — body: { ids: number[] } (local watch_history.id)
// Permanently removes the given entries from the user's Trakt.tv history (not just
// the local mirror) — otherwise the next scheduled sync would re-fetch and resurrect
// them. Unknown/foreign/manual (no trakt_play_id) ids are silently dropped rather
// than failing the whole request, so one stale id doesn't block cleanup of the rest.
historyRoutes.post("/duplicates/remove", async (c) => {
    const userId = c.get("userId");

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON" }, 400);
    }

    const rawIds = (body as Record<string, unknown> | null)?.ids;
    const localIds = Array.isArray(rawIds)
        ? rawIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id))
        : [];

    if (localIds.length === 0) {
        return c.json({ error: "No valid ids provided" }, 400);
    }

    const db = getDb();
    const rows = await db
        .select({
            id: watchHistory.id,
            traktPlayId: watchHistory.traktPlayId,
            mediaType: watchHistory.mediaType,
            episodeId: watchHistory.episodeId,
            movieId: watchHistory.movieId,
        })
        .from(watchHistory)
        .where(
            and(
                eq(watchHistory.userId, userId),
                inArray(watchHistory.id, localIds),
                isNotNull(watchHistory.traktPlayId),
            ),
        );

    if (rows.length === 0) {
        return c.json({ ok: true, deleted: 0, notFound: 0 });
    }

    const trakt = getTraktClient();
    let deleted = 0;
    let notFound = 0;
    const confirmedLocalIds: number[] = [];

    for (const batch of chunk(rows, TRAKT_REMOVE_CHUNK_SIZE)) {
        const traktIds = batch.map((r) => Number(r.traktPlayId));
        try {
            const result = await trakt.removeFromHistory(userId, traktIds);
            deleted += result.deleted.movies + result.deleted.episodes;
            notFound += result.not_found.ids.length;
            // Both "deleted" and "not_found" mean the Trakt-side entry is gone
            // (or never existed) — either way our local mirror row is stale and
            // should be removed too.
            confirmedLocalIds.push(...batch.map((r) => r.id));
        } catch (e) {
            console.error(`[history:duplicates] Failed to remove a batch from Trakt:`, e);
            // Leave this batch's local rows untouched — safer to retry later than to
            // delete a local row we couldn't confirm was actually removed from Trakt.
        }
    }

    const affectedShowIds = new Set<number>();
    const affectedMovieIds = new Set<number>();

    if (confirmedLocalIds.length > 0) {
        const confirmedRows = rows.filter((r) => confirmedLocalIds.includes(r.id));
        await db.delete(watchHistory).where(inArray(watchHistory.id, confirmedLocalIds));

        for (const row of confirmedRows) {
            if (row.mediaType === "episode" && row.episodeId) {
                const [ep] = await db
                    .select({ showId: episodes.showId })
                    .from(episodes)
                    .where(eq(episodes.id, row.episodeId));
                if (ep) affectedShowIds.add(ep.showId);
            } else if (row.mediaType === "movie" && row.movieId) {
                affectedMovieIds.add(row.movieId);
            }
        }

        for (const showId of affectedShowIds) await recalcShowProgress(userId, showId);
        for (const movieId of affectedMovieIds) await recalcMovieProgress(userId, movieId);
    }

    return c.json({ ok: true, deleted, notFound });
});
