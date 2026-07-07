import { Hono } from "hono";
import { getDb, userRatings, shows, movies } from "@trakt-dashboard/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { validateBody } from "../lib/validate.js";
import { getTraktClient, TraktApiError } from "../services/trakt.js";
import { toIsoOrNull } from "../lib/datetime.js";
import type { UserRating } from "@trakt-dashboard/types";

export const ratingsRoutes = new Hono<{ Variables: { userId: number } }>();

const rateSchema = z.object({
    type: z.enum(["show", "movie"]),
    localId: z.number().int().positive(),
    rating: z.number().int().min(1).max(10),
});

const removeSchema = z.object({
    type: z.enum(["show", "movie"]),
    localId: z.number().int().positive(),
});

// GET /api/ratings?type=show|movie|all
ratingsRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const type = c.req.query("type") ?? "all";
    const db = getDb();

    const rows = await db.select().from(userRatings).where(eq(userRatings.userId, userId));

    const data: UserRating[] = rows
        .filter((r) => {
            if (type === "show") return r.mediaType === "show";
            if (type === "movie") return r.mediaType === "movie";
            return true;
        })
        .map((r) => ({
            id: r.id,
            mediaType: r.mediaType as "show" | "movie",
            showId: r.showId,
            movieId: r.movieId,
            rating: r.rating,
            ratedAt: toIsoOrNull(r.ratedAt),
        }));

    return c.json({ data });
});

// PUT /api/ratings — upsert a rating (write to local DB + Trakt)
ratingsRoutes.put("/", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, rateSchema);
    if (parsed instanceof Response) return parsed;
    const { type, localId, rating } = parsed.data;

    const db = getDb();
    const trakt = getTraktClient();

    // Resolve Trakt IDs for the API call
    const traktIds: { trakt?: number; tmdb?: number } = {};
    if (type === "show") {
        const [row] = await db
            .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
            .from(shows)
            .where(eq(shows.id, localId));
        if (!row) return c.json({ error: "Show not found" }, 404);
        if (row.traktId) traktIds.trakt = row.traktId;
        if (row.tmdbId) traktIds.tmdb = row.tmdbId;
    } else {
        const [row] = await db
            .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
            .from(movies)
            .where(eq(movies.id, localId));
        if (!row) return c.json({ error: "Movie not found" }, 404);
        if (row.traktId) traktIds.trakt = row.traktId;
        if (row.tmdbId) traktIds.tmdb = row.tmdbId;
    }

    const ratedAt = new Date();

    // Write to Trakt (best-effort — store locally even if Trakt fails)
    try {
        await trakt.addRating(userId, type === "show" ? "shows" : "movies", traktIds, rating);
    } catch (err) {
        if (!(err instanceof TraktApiError)) throw err;
        console.warn("[ratings] Trakt write failed, storing locally only:", err.message);
    }

    // Upsert into local DB
    await db
        .insert(userRatings)
        .values({
            userId,
            mediaType: type,
            showId: type === "show" ? localId : null,
            movieId: type === "movie" ? localId : null,
            rating,
            ratedAt,
        })
        .onConflictDoUpdate({
            target:
                type === "show"
                    ? [userRatings.userId, userRatings.showId]
                    : [userRatings.userId, userRatings.movieId],
            set: { rating, ratedAt },
        });

    return c.json({ ok: true, rating });
});

// DELETE /api/ratings — remove a rating
ratingsRoutes.delete("/", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, removeSchema);
    if (parsed instanceof Response) return parsed;
    const { type, localId } = parsed.data;

    const db = getDb();
    const trakt = getTraktClient();

    // Resolve Trakt IDs
    const traktIds: { trakt?: number; tmdb?: number } = {};
    if (type === "show") {
        const [row] = await db
            .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
            .from(shows)
            .where(eq(shows.id, localId));
        if (row?.traktId) traktIds.trakt = row.traktId;
        if (row?.tmdbId) traktIds.tmdb = row.tmdbId;
    } else {
        const [row] = await db
            .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
            .from(movies)
            .where(eq(movies.id, localId));
        if (row?.traktId) traktIds.trakt = row.traktId;
        if (row?.tmdbId) traktIds.tmdb = row.tmdbId;
    }

    try {
        await trakt.removeRating(userId, type === "show" ? "shows" : "movies", traktIds);
    } catch (err) {
        if (!(err instanceof TraktApiError)) throw err;
    }

    await db
        .delete(userRatings)
        .where(
            and(
                eq(userRatings.userId, userId),
                type === "show"
                    ? eq(userRatings.showId, localId)
                    : eq(userRatings.movieId, localId),
            ),
        );

    return c.json({ ok: true });
});
