import { Hono } from "hono";
import { getDb, shows, movies, watchlist } from "@trakt-dashboard/db";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { getTraktClient, TraktApiError } from "../services/trakt.js";
import { validateBody } from "../lib/validate.js";
import type { SearchResult } from "@trakt-dashboard/types";

export const searchRoutes = new Hono<{ Variables: { userId: number } }>();

const watchlistAddSchema = z.object({
    type: z.enum(["show", "movie"]),
    traktId: z.number().int().positive(),
    tmdbId: z.number().int().positive().optional(),
});

// GET /api/search?q=foo&type=show|movie|all&limit=8
searchRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const q = (c.req.query("q") ?? "").trim();
    const type = c.req.query("type") ?? "all";
    const limit = Math.min(Number(c.req.query("limit") ?? "8"), 20);

    if (q.length < 2) return c.json({ data: [] });

    const db = getDb();
    const trakt = getTraktClient();
    const results: SearchResult[] = [];

    try {
        if (type === "show" || type === "all") {
            const perType = type === "all" ? Math.ceil(limit / 2) : limit;
            const raw = await trakt.searchShows(userId, q, perType);
            const traktIds = raw.flatMap((r) => (r.show ? [r.show.ids.trakt] : []));

            const localRows =
                traktIds.length > 0
                    ? await db
                          .select({
                              id: shows.id,
                              traktId: shows.traktId,
                              posterPath: shows.posterPath,
                          })
                          .from(shows)
                          .where(inArray(shows.traktId, traktIds))
                    : [];
            const localMap = new Map(localRows.map((s) => [s.traktId, s]));

            const localIds = localRows.map((s) => s.id);
            const wlRows =
                localIds.length > 0
                    ? await db
                          .select({ showId: watchlist.showId })
                          .from(watchlist)
                          .where(
                              and(
                                  eq(watchlist.userId, userId),
                                  inArray(watchlist.showId, localIds),
                              ),
                          )
                    : [];
            const wlShowIds = new Set(wlRows.map((w) => w.showId));

            for (const r of raw) {
                if (!r.show) continue;
                const { trakt: traktId, slug, tmdb } = r.show.ids;
                const local = localMap.get(traktId);
                results.push({
                    type: "show",
                    traktId,
                    slug,
                    title: r.show.title,
                    year: r.show.year,
                    tmdbId: tmdb ?? null,
                    posterPath: local?.posterPath ?? null,
                    localId: local?.id ?? null,
                    inWatchlist: !!local && wlShowIds.has(local.id),
                });
            }
        }

        if (type === "movie" || type === "all") {
            const perType = type === "all" ? Math.floor(limit / 2) : limit;
            const raw = await trakt.searchMovies(userId, q, perType);
            const traktIds = raw.flatMap((r) => (r.movie ? [r.movie.ids.trakt] : []));

            const localRows =
                traktIds.length > 0
                    ? await db
                          .select({
                              id: movies.id,
                              traktId: movies.traktId,
                              posterPath: movies.posterPath,
                          })
                          .from(movies)
                          .where(inArray(movies.traktId, traktIds))
                    : [];
            const localMap = new Map(localRows.map((m) => [m.traktId, m]));

            const localIds = localRows.map((m) => m.id);
            const wlRows =
                localIds.length > 0
                    ? await db
                          .select({ movieId: watchlist.movieId })
                          .from(watchlist)
                          .where(
                              and(
                                  eq(watchlist.userId, userId),
                                  inArray(watchlist.movieId, localIds),
                              ),
                          )
                    : [];
            const wlMovieIds = new Set(wlRows.map((w) => w.movieId));

            for (const r of raw) {
                if (!r.movie) continue;
                const { trakt: traktId, slug, tmdb } = r.movie.ids;
                const local = localMap.get(traktId);
                results.push({
                    type: "movie",
                    traktId,
                    slug,
                    title: r.movie.title,
                    year: r.movie.year,
                    tmdbId: tmdb ?? null,
                    posterPath: local?.posterPath ?? null,
                    localId: local?.id ?? null,
                    inWatchlist: !!local && wlMovieIds.has(local.id),
                });
            }
        }
    } catch (err) {
        if (err instanceof TraktApiError) {
            return c.json({ error: "upstream_error", data: [] }, 502);
        }
        throw err;
    }

    return c.json({ data: results });
});

// POST /api/search/watchlist-add — add by Trakt ID (item not yet in local DB)
searchRoutes.post("/watchlist-add", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, watchlistAddSchema);
    if (parsed instanceof Response) return parsed;
    const { type, traktId, tmdbId } = parsed.data;

    const trakt = getTraktClient();
    const ids: { trakt: number; tmdb?: number } = { trakt: traktId };
    if (tmdbId) ids.tmdb = tmdbId;

    await trakt.addToWatchlist(userId, type === "show" ? "shows" : "movies", ids);
    return c.json({ ok: true });
});
