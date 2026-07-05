import { Hono } from "hono";
import {
    getDb,
    userSettings,
    shows,
    movies,
    jellyfinDeleteQueue,
    jellyfinDeleteHistory,
    jellyfinDeleteExclusions,
} from "@trakt-dashboard/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
    fetchJellyfinLibraries,
    findJellyfinEpisode,
    findJellyfinSeasonEpisodes,
    findJellyfinMovie,
    deleteJellyfinItem,
    getActiveSessions,
    getJellyfinLibrarySummary,
    getJellyfinActivityLog,
    getJellyfinTopItems,
    getJellyfinPlayHeatmap,
} from "../services/jellyfin.js";
import { parseBoundedInt } from "../lib/number.js";
import { decryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";
import { validateBody } from "../lib/validate.js";
import type { JellyfinNowPlaying } from "@trakt-dashboard/types";

export const jellyfinRoutes = new Hono<{ Variables: { userId: number } }>();

async function getJellyfinConfig(userId: number) {
    const db = getDb();
    try {
        const [row] = await db
            .select({
                jellyfinUrl: userSettings.jellyfinUrl,
                jellyfinApiKey: userSettings.jellyfinApiKey,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        if (!row?.jellyfinUrl || !row?.jellyfinApiKey) return null;
        const apiKey = decryptToken(row.jellyfinApiKey, resolveApiSecret());
        return { url: row.jellyfinUrl, apiKey };
    } catch {
        return null;
    }
}

// GET /api/jellyfin/now-playing — returns active Jellyfin session, if any
jellyfinRoutes.get("/now-playing", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ data: null });

    try {
        // Optional JELLYFIN_USER restricts now-playing to a single account on a
        // shared Jellyfin server (avoids reporting another household member's playback).
        const session = await getActiveSessions(cfg, process.env.JELLYFIN_USER);
        if (!session) return c.json({ data: null });

        const db = getDb();
        let localShowId: number | null = null;
        let localMovieId: number | null = null;

        if (session.mediaType === "episode" && session.tmdbShowId) {
            const [row] = await db
                .select({ id: shows.id })
                .from(shows)
                .where(eq(shows.tmdbId, session.tmdbShowId))
                .limit(1);
            localShowId = row?.id ?? null;
        } else if (session.mediaType === "movie" && session.tmdbMovieId) {
            const [row] = await db
                .select({ id: movies.id })
                .from(movies)
                .where(eq(movies.tmdbId, session.tmdbMovieId))
                .limit(1);
            localMovieId = row?.id ?? null;
        }

        // Build Jellyfin poster URL — use series poster for episodes, item poster for movies
        const base = cfg.url.replace(/\/$/, "");
        let posterUrl: string | null = null;
        if (session.mediaType === "episode" && session.seriesJellyfinId) {
            posterUrl = `${base}/Items/${session.seriesJellyfinId}/Images/Primary?quality=80&maxHeight=300`;
        } else {
            posterUrl = `${base}/Items/${session.jellyfinItemId}/Images/Primary?quality=80&maxHeight=300`;
        }

        const data: JellyfinNowPlaying = {
            jellyfinItemId: session.jellyfinItemId,
            mediaType: session.mediaType,
            title: session.title,
            seriesTitle: session.seriesTitle,
            seasonNumber: session.seasonNumber,
            episodeNumber: session.episodeNumber,
            posterUrl,
            runtimeMinutes: session.runtimeMinutes,
            progressPct: session.progressPct,
            isPaused: session.isPaused,
            localShowId,
            localMovieId,
        };
        return c.json({ data });
    } catch {
        return c.json({ data: null });
    }
});

// GET /api/jellyfin/libraries — uses stored (encrypted) credentials
jellyfinRoutes.get("/libraries", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    try {
        const libraries = await fetchJellyfinLibraries(cfg);
        return c.json({ data: libraries });
    } catch (err) {
        return c.json({ error: "Failed to fetch Jellyfin libraries" }, 502);
    }
});

const testLibrariesSchema = z.object({
    url: z.string().regex(/^https?:\/\//i, "url must be a valid http:// or https:// URL"),
    apiKey: z.string().min(1),
});

// POST /api/jellyfin/libraries — test arbitrary credentials (before saving to DB)
jellyfinRoutes.post("/libraries", async (c) => {
    const parsed = await validateBody(c, testLibrariesSchema);
    if (parsed instanceof Response) return parsed;
    const { url, apiKey } = parsed.data;

    try {
        const libraries = await fetchJellyfinLibraries({ url, apiKey });
        return c.json({ data: libraries });
    } catch (err) {
        return c.json({ error: "Failed to fetch Jellyfin libraries" }, 502);
    }
});

// GET /api/jellyfin/episode/:showTmdbId/:season/:episode
jellyfinRoutes.get("/episode/:showTmdbId/:season/:episode", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const showTmdbId = parseBoundedInt(c.req.param("showTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    const episode = parseBoundedInt(c.req.param("episode"), -1, 1, 1000);

    if (showTmdbId < 1 || season < 0 || episode < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    try {
        const ep = await findJellyfinEpisode(cfg, showTmdbId, season, episode);
        return c.json({ data: ep });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/movie/:movieTmdbId
jellyfinRoutes.get("/movie/:movieTmdbId", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const movieTmdbId = parseBoundedInt(c.req.param("movieTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (movieTmdbId < 1) return c.json({ error: "Invalid parameters" }, 400);

    try {
        const movie = await findJellyfinMovie(cfg, movieTmdbId);
        return c.json({ data: movie });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/show/:showTmdbId/season/:season — list episodes in Jellyfin for a season
jellyfinRoutes.get("/show/:showTmdbId/season/:season", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const showTmdbId = parseBoundedInt(c.req.param("showTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    if (showTmdbId < 1 || season < 0) return c.json({ error: "Invalid parameters" }, 400);

    try {
        const episodes = await findJellyfinSeasonEpisodes(cfg, showTmdbId, season);
        return c.json({ data: episodes });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// DELETE /api/jellyfin/show/:showTmdbId/season/:season — delete all episode files of a season
jellyfinRoutes.delete("/show/:showTmdbId/season/:season", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const showTmdbId = parseBoundedInt(c.req.param("showTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    if (showTmdbId < 1 || season < 0) return c.json({ error: "Invalid parameters" }, 400);

    try {
        const episodes = await findJellyfinSeasonEpisodes(cfg, showTmdbId, season);
        await Promise.all(episodes.map((ep) => deleteJellyfinItem(cfg, ep.id)));
        return c.json({ ok: true, deleted: episodes.length });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// DELETE /api/jellyfin/items/:jellyfinItemId
jellyfinRoutes.delete("/items/:jellyfinItemId", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const itemId = c.req.param("jellyfinItemId");
    if (!itemId) return c.json({ error: "Missing item ID" }, 400);

    try {
        await deleteJellyfinItem(cfg, itemId);
        return c.json({ ok: true });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// ─── Auto-Delete Queue / History ────────────────────────────────────────────────

// GET /api/jellyfin/delete-queue — pending two-phase auto-delete entries for the user
jellyfinRoutes.get("/delete-queue", async (c) => {
    const userId = c.get("userId");
    const db = getDb();

    const rows = await db
        .select({
            id: jellyfinDeleteQueue.id,
            seasonNumber: jellyfinDeleteQueue.seasonNumber,
            queuedAt: jellyfinDeleteQueue.queuedAt,
            showId: shows.id,
            showTitle: shows.title,
            showPoster: shows.posterPath,
            movieId: movies.id,
            movieTitle: movies.title,
            moviePoster: movies.posterPath,
        })
        .from(jellyfinDeleteQueue)
        .leftJoin(shows, eq(shows.id, jellyfinDeleteQueue.showId))
        .leftJoin(movies, eq(movies.id, jellyfinDeleteQueue.movieId))
        .where(eq(jellyfinDeleteQueue.userId, userId))
        .orderBy(desc(jellyfinDeleteQueue.queuedAt));

    const data = rows.map((r) => ({
        id: r.id,
        seasonNumber: r.seasonNumber,
        queuedAt: r.queuedAt.toISOString(),
        show: r.showId ? { id: r.showId, title: r.showTitle!, posterPath: r.showPoster } : null,
        movie: r.movieId
            ? { id: r.movieId, title: r.movieTitle!, posterPath: r.moviePoster }
            : null,
    }));

    return c.json({ data });
});

// DELETE /api/jellyfin/delete-queue/:id — cancel a pending auto-delete entry
jellyfinRoutes.delete("/delete-queue/:id", async (c) => {
    const userId = c.get("userId");
    const id = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (id < 1) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    const deleted = await db
        .delete(jellyfinDeleteQueue)
        .where(and(eq(jellyfinDeleteQueue.id, id), eq(jellyfinDeleteQueue.userId, userId)))
        .returning({ id: jellyfinDeleteQueue.id });

    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
});

// 取消拆分：推迟 7 天 / 永不删除。两者都把队列行转成排除记录——直接删队列行的话
// 次日 Phase 1 会重新入队，取消形同虚设。
const DEFER_DAYS = 7;

async function excludeQueueEntry(userId: number, queueId: number, mode: "never" | "defer") {
    const db = getDb();
    const [entry] = await db
        .select({
            id: jellyfinDeleteQueue.id,
            showId: jellyfinDeleteQueue.showId,
            movieId: jellyfinDeleteQueue.movieId,
            seasonNumber: jellyfinDeleteQueue.seasonNumber,
        })
        .from(jellyfinDeleteQueue)
        .where(and(eq(jellyfinDeleteQueue.id, queueId), eq(jellyfinDeleteQueue.userId, userId)));
    if (!entry) return false;

    // Replace any existing exclusion for the same target (e.g. defer → never upgrade).
    await db
        .delete(jellyfinDeleteExclusions)
        .where(
            and(
                eq(jellyfinDeleteExclusions.userId, userId),
                entry.showId !== null
                    ? eq(jellyfinDeleteExclusions.showId, entry.showId)
                    : eq(jellyfinDeleteExclusions.movieId, entry.movieId!),
                entry.seasonNumber !== null
                    ? eq(jellyfinDeleteExclusions.seasonNumber, entry.seasonNumber)
                    : isNull(jellyfinDeleteExclusions.seasonNumber),
            ),
        );
    await db.insert(jellyfinDeleteExclusions).values({
        userId,
        showId: entry.showId,
        movieId: entry.movieId,
        seasonNumber: entry.seasonNumber,
        mode,
        deferUntil:
            mode === "defer" ? new Date(Date.now() + DEFER_DAYS * 24 * 60 * 60 * 1000) : null,
    });
    await db.delete(jellyfinDeleteQueue).where(eq(jellyfinDeleteQueue.id, entry.id));
    return true;
}

// POST /api/jellyfin/delete-queue/:id/defer — 推迟 7 天后重新进入两段式流程
jellyfinRoutes.post("/delete-queue/:id/defer", async (c) => {
    const userId = c.get("userId");
    const id = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (id < 1) return c.json({ error: "Invalid id" }, 400);
    const ok = await excludeQueueEntry(userId, id, "defer");
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
});

// POST /api/jellyfin/delete-queue/:id/never — 永不自动删除该条目
jellyfinRoutes.post("/delete-queue/:id/never", async (c) => {
    const userId = c.get("userId");
    const id = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (id < 1) return c.json({ error: "Invalid id" }, 400);
    const ok = await excludeQueueEntry(userId, id, "never");
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
});

// POST /api/jellyfin/delete-queue/:id/now — 立即删除，不等次日定时任务（N5-T02）
jellyfinRoutes.post("/delete-queue/:id/now", async (c) => {
    const userId = c.get("userId");
    const id = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (id < 1) return c.json({ error: "Invalid id" }, 400);

    const { deleteQueueEntryNow } = await import("../jobs/jellyfin-auto-delete.js");
    const result = await deleteQueueEntryNow(userId, id);
    if (result.status === "no-jellyfin-config") {
        return c.json({ error: "Jellyfin not configured" }, 503);
    }
    if (result.status === "not_found") return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true, status: result.status, errorMessage: result.errorMessage ?? null });
});

// GET /api/jellyfin/delete-exclusions — 排除列表（永不删除 + 未到期的推迟）
jellyfinRoutes.get("/delete-exclusions", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rows = await db
        .select({
            id: jellyfinDeleteExclusions.id,
            showId: jellyfinDeleteExclusions.showId,
            movieId: jellyfinDeleteExclusions.movieId,
            seasonNumber: jellyfinDeleteExclusions.seasonNumber,
            mode: jellyfinDeleteExclusions.mode,
            deferUntil: jellyfinDeleteExclusions.deferUntil,
            createdAt: jellyfinDeleteExclusions.createdAt,
            showTitle: shows.title,
            movieTitle: movies.title,
        })
        .from(jellyfinDeleteExclusions)
        .leftJoin(shows, eq(shows.id, jellyfinDeleteExclusions.showId))
        .leftJoin(movies, eq(movies.id, jellyfinDeleteExclusions.movieId))
        .where(eq(jellyfinDeleteExclusions.userId, userId))
        .orderBy(desc(jellyfinDeleteExclusions.createdAt));

    const data = rows.map((r) => ({
        id: r.id,
        showId: r.showId,
        movieId: r.movieId,
        seasonNumber: r.seasonNumber,
        mode: r.mode as "never" | "defer",
        deferUntil: r.deferUntil?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        title: r.showTitle ?? r.movieTitle ?? "—",
    }));
    return c.json({ data });
});

const createExclusionSchema = z.object({
    showId: z.number().int().positive().optional(),
    movieId: z.number().int().positive().optional(),
    seasonNumber: z.number().int().min(0).nullable().optional(),
});

// POST /api/jellyfin/delete-exclusions — 详情页"永不自动删除"开关（直接按媒体创建）
jellyfinRoutes.post("/delete-exclusions", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, createExclusionSchema);
    if (parsed instanceof Response) return parsed;
    const { showId, movieId, seasonNumber } = parsed.data;
    if (!showId && !movieId) return c.json({ error: "showId or movieId required" }, 400);

    const db = getDb();
    const season = seasonNumber ?? null;
    await db
        .delete(jellyfinDeleteExclusions)
        .where(
            and(
                eq(jellyfinDeleteExclusions.userId, userId),
                showId
                    ? eq(jellyfinDeleteExclusions.showId, showId)
                    : eq(jellyfinDeleteExclusions.movieId, movieId!),
                season !== null
                    ? eq(jellyfinDeleteExclusions.seasonNumber, season)
                    : isNull(jellyfinDeleteExclusions.seasonNumber),
            ),
        );
    const [created] = await db
        .insert(jellyfinDeleteExclusions)
        .values({
            userId,
            showId: showId ?? null,
            movieId: movieId ?? null,
            seasonNumber: season,
            mode: "never",
            deferUntil: null,
        })
        .returning({ id: jellyfinDeleteExclusions.id });

    // Purge already-queued entries the new exclusion covers. A season exclusion also removes
    // the whole-show queue entry (deleting the series would delete the protected season).
    if (showId) {
        await db
            .delete(jellyfinDeleteQueue)
            .where(
                and(
                    eq(jellyfinDeleteQueue.userId, userId),
                    eq(jellyfinDeleteQueue.showId, showId),
                    season !== null
                        ? sql`(${jellyfinDeleteQueue.seasonNumber} = ${season} OR ${jellyfinDeleteQueue.seasonNumber} IS NULL)`
                        : sql`TRUE`,
                ),
            );
    } else if (movieId) {
        await db
            .delete(jellyfinDeleteQueue)
            .where(
                and(
                    eq(jellyfinDeleteQueue.userId, userId),
                    eq(jellyfinDeleteQueue.movieId, movieId),
                ),
            );
    }
    return c.json({ data: { id: created.id } });
});

// DELETE /api/jellyfin/delete-exclusions/:id — 移除排除，恢复自动判定
jellyfinRoutes.delete("/delete-exclusions/:id", async (c) => {
    const userId = c.get("userId");
    const id = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (id < 1) return c.json({ error: "Invalid id" }, 400);
    const db = getDb();
    const deleted = await db
        .delete(jellyfinDeleteExclusions)
        .where(
            and(eq(jellyfinDeleteExclusions.id, id), eq(jellyfinDeleteExclusions.userId, userId)),
        )
        .returning({ id: jellyfinDeleteExclusions.id });
    if (deleted.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
});

// GET /api/jellyfin/delete-history?limit=20 — recent auto-delete outcomes
jellyfinRoutes.get("/delete-history", async (c) => {
    const userId = c.get("userId");
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));

    const db = getDb();
    const rows = await db
        .select()
        .from(jellyfinDeleteHistory)
        .where(eq(jellyfinDeleteHistory.userId, userId))
        .orderBy(desc(jellyfinDeleteHistory.processedAt))
        .limit(limit);

    const data = rows.map((r) => ({
        id: r.id,
        showId: r.showId,
        movieId: r.movieId,
        seasonNumber: r.seasonNumber,
        title: r.title,
        status: r.status as "deleted" | "not_found" | "failed",
        errorMessage: r.errorMessage,
        processedAt: r.processedAt.toISOString(),
    }));

    return c.json({ data });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

// GET /api/jellyfin/stats/overview
jellyfinRoutes.get("/stats/overview", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);
    try {
        const data = await getJellyfinLibrarySummary(cfg);
        return c.json({ data });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/stats/activity?limit=50
jellyfinRoutes.get("/stats/activity", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
    try {
        const data = await getJellyfinActivityLog(cfg, limit);
        return c.json({ data });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/stats/top-content
jellyfinRoutes.get("/stats/top-content", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);
    try {
        const data = await getJellyfinTopItems(cfg);
        return c.json({ data });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/stats/heatmap
jellyfinRoutes.get("/stats/heatmap", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);
    try {
        const data = await getJellyfinPlayHeatmap(cfg);
        return c.json({ data });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});
