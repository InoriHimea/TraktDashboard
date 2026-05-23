import { Hono } from "hono";
import { getDb, watchlist, shows, movies } from "@trakt-dashboard/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { validateBody } from "../lib/validate";

const addSchema = z.object({
    type: z.enum(["show", "movie"]),
    id: z.number().int().positive(),
    notes: z.string().max(500).optional(),
});

export const watchlistRoutes = new Hono<{ Variables: { userId: number } }>();

// GET /api/watchlist
watchlistRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const type = c.req.query("type");
    const db = getDb();

    let whereClause = eq(watchlist.userId, userId);
    if (type === "shows") whereClause = and(whereClause, isNotNull(watchlist.showId))!;
    else if (type === "movies") whereClause = and(whereClause, isNotNull(watchlist.movieId))!;

    const items = await db
        .select()
        .from(watchlist)
        .leftJoin(shows, eq(watchlist.showId, shows.id))
        .leftJoin(movies, eq(watchlist.movieId, movies.id))
        .where(whereClause)
        .orderBy(desc(watchlist.addedAt));

    const result = items.map((item) => {
        const base = {
            id: item.watchlist.id,
            addedAt: item.watchlist.addedAt.toISOString(),
            listedAt: item.watchlist.listedAt.toISOString(),
            notes: item.watchlist.notes,
        };
        if (item.shows) {
            return {
                ...base,
                show: {
                    ...item.shows,
                    lastSyncedAt: item.shows.lastSyncedAt.toISOString(),
                    createdAt: item.shows.createdAt.toISOString(),
                },
            };
        }
        if (item.movies) {
            return {
                ...base,
                movie: {
                    ...item.movies,
                    lastSyncedAt: item.movies.lastSyncedAt.toISOString(),
                    createdAt: item.movies.createdAt.toISOString(),
                },
            };
        }
        throw new Error("Invalid watchlist item");
    });

    return c.json({ data: result });
});

// POST /api/watchlist
watchlistRoutes.post("/", async (c) => {
    const userId = c.get("userId");
    const validated = await validateBody(c, addSchema);
    if (validated instanceof Response) return validated;
    const { type, id, notes } = validated.data;

    const db = getDb();
    try {
        const [item] = await db
            .insert(watchlist)
            .values({
                userId,
                showId: type === "show" ? id : null,
                movieId: type === "movie" ? id : null,
                listedAt: new Date(),
                notes: notes || null,
            })
            .returning();
        return c.json({ data: item });
    } catch (error) {
        console.error("[watchlist] Add failed:", error);
        return c.json({ error: "Failed to add to watchlist" }, 500);
    }
});

// DELETE /api/watchlist/:id
watchlistRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = parseInt(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    try {
        await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
        return c.json({ ok: true });
    } catch (error) {
        console.error("[watchlist] Delete failed:", error);
        return c.json({ error: "Failed to remove from watchlist" }, 500);
    }
});
