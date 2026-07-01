import { Hono } from "hono";
import {
    getDb,
    userSettings,
    shows,
    movies,
    jellyfinDeleteQueue,
    jellyfinDeleteHistory,
} from "@trakt-dashboard/db";
import { and, desc, eq } from "drizzle-orm";
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
