import { Hono } from "hono";
import { getDb, shows, movies, watchlist } from "@trakt-dashboard/db";
import { eq, and, inArray } from "drizzle-orm";
import { getTraktClient } from "../services/trakt.js";
import type { DiscoverItem } from "@trakt-dashboard/types";

export const discoverRoutes = new Hono<{ Variables: { userId: number } }>();

interface Normalized {
    traktId: number;
    traktSlug: string;
    title: string;
    year: number | null;
    tmdbId: number | null;
    imdbId: string | null;
    watchers?: number;
}

// GET /api/discover?mediaType=show|movie&tab=trending|popular&limit=20
discoverRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const mediaType = c.req.query("mediaType") === "movie" ? "movie" : "show";
    const tab = c.req.query("tab") === "popular" ? "popular" : "trending";
    const limit = Math.min(Number(c.req.query("limit") ?? "20"), 40);

    const trakt = getTraktClient();
    const db = getDb();

    let normalized: Normalized[] = [];

    if (mediaType === "show") {
        if (tab === "trending") {
            const raw = await trakt.getTrendingShows(userId, limit);
            normalized = raw.map((r) => ({
                traktId: r.show.ids.trakt,
                traktSlug: r.show.ids.slug,
                title: r.show.title,
                year: r.show.year,
                tmdbId: r.show.ids.tmdb ?? null,
                imdbId: r.show.ids.imdb ?? null,
                watchers: r.watchers,
            }));
        } else {
            const raw = await trakt.getPopularShows(userId, limit);
            normalized = raw.map((r) => ({
                traktId: r.ids.trakt,
                traktSlug: r.ids.slug,
                title: r.title,
                year: r.year,
                tmdbId: r.ids.tmdb ?? null,
                imdbId: r.ids.imdb ?? null,
            }));
        }

        if (normalized.length === 0) return c.json({ data: [] });

        const traktIds = normalized.map((n) => n.traktId);
        const localRows = await db
            .select({ id: shows.id, traktId: shows.traktId, posterPath: shows.posterPath })
            .from(shows)
            .where(inArray(shows.traktId, traktIds));
        const localMap = new Map(localRows.map((s) => [s.traktId, s]));

        const localIds = localRows.map((s) => s.id);
        const wlRows =
            localIds.length > 0
                ? await db
                      .select({ showId: watchlist.showId })
                      .from(watchlist)
                      .where(and(eq(watchlist.userId, userId), inArray(watchlist.showId, localIds)))
                : [];
        const wlSet = new Set(wlRows.map((w) => w.showId));

        const data: DiscoverItem[] = normalized.map((n) => {
            const local = localMap.get(n.traktId);
            return {
                type: "show",
                ...n,
                localId: local?.id ?? null,
                posterPath: local?.posterPath ?? null,
                inWatchlist: !!local && wlSet.has(local.id),
            };
        });
        return c.json({ data });
    } else {
        if (tab === "trending") {
            const raw = await trakt.getTrendingMovies(userId, limit);
            normalized = raw.map((r) => ({
                traktId: r.movie.ids.trakt,
                traktSlug: r.movie.ids.slug,
                title: r.movie.title,
                year: r.movie.year,
                tmdbId: r.movie.ids.tmdb ?? null,
                imdbId: r.movie.ids.imdb ?? null,
                watchers: r.watchers,
            }));
        } else {
            const raw = await trakt.getPopularMovies(userId, limit);
            normalized = raw.map((r) => ({
                traktId: r.ids.trakt,
                traktSlug: r.ids.slug,
                title: r.title,
                year: r.year,
                tmdbId: r.ids.tmdb ?? null,
                imdbId: r.ids.imdb ?? null,
            }));
        }

        if (normalized.length === 0) return c.json({ data: [] });

        const traktIds = normalized.map((n) => n.traktId);
        const localRows = await db
            .select({ id: movies.id, traktId: movies.traktId, posterPath: movies.posterPath })
            .from(movies)
            .where(inArray(movies.traktId, traktIds));
        const localMap = new Map(localRows.map((m) => [m.traktId, m]));

        const localIds = localRows.map((m) => m.id);
        const wlRows =
            localIds.length > 0
                ? await db
                      .select({ movieId: watchlist.movieId })
                      .from(watchlist)
                      .where(
                          and(eq(watchlist.userId, userId), inArray(watchlist.movieId, localIds)),
                      )
                : [];
        const wlSet = new Set(wlRows.map((w) => w.movieId));

        const data: DiscoverItem[] = normalized.map((n) => {
            const local = localMap.get(n.traktId);
            return {
                type: "movie",
                ...n,
                localId: local?.id ?? null,
                posterPath: local?.posterPath ?? null,
                inWatchlist: !!local && wlSet.has(local.id),
            };
        });
        return c.json({ data });
    }
});
