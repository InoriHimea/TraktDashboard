import { Hono } from "hono";
import { getDb, userLists, userListItems, shows, movies } from "@trakt-dashboard/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { validateBody } from "../lib/validate.js";
import { getTraktClient, TraktApiError } from "../services/trakt.js";
import type { UserList, UserListItem } from "@trakt-dashboard/types";

export const listsRoutes = new Hono<{ Variables: { userId: number } }>();

function toList(r: typeof userLists.$inferSelect): UserList {
    return {
        id: r.id,
        traktId: r.traktId,
        traktSlug: r.traktSlug,
        name: r.name,
        description: r.description,
        privacy: r.privacy as UserList["privacy"],
        sortBy: r.sortBy,
        sortHow: r.sortHow,
        itemCount: r.itemCount,
        updatedAt: r.updatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
    };
}

const createSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(500).optional(),
    privacy: z.enum(["private", "friends", "public"]).default("private"),
    sortBy: z.string().default("rank"),
    sortHow: z.enum(["asc", "desc"]).default("asc"),
});

const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(500).optional(),
    privacy: z.enum(["private", "friends", "public"]).optional(),
});

const addItemSchema = z.object({
    mediaType: z.enum(["show", "movie"]),
    localId: z.number().int().positive(),
    notes: z.string().max(500).optional(),
});

const removeItemSchema = z.object({
    mediaType: z.enum(["show", "movie"]),
    localId: z.number().int().positive(),
});

// GET /api/lists
listsRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rows = await db
        .select()
        .from(userLists)
        .where(eq(userLists.userId, userId))
        .orderBy(userLists.createdAt);
    return c.json({ data: rows.map(toList) });
});

// POST /api/lists — create list (writes to Trakt then local)
listsRoutes.post("/", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, createSchema);
    if (parsed instanceof Response) return parsed;
    const { name, description, privacy, sortBy, sortHow } = parsed.data;

    const db = getDb();
    const trakt = getTraktClient();
    const now = new Date();

    let traktId: number | null = null;
    let traktSlug: string | null = null;
    try {
        const traktList = await trakt.createList(userId, {
            name,
            description,
            privacy,
            sort_by: sortBy,
            sort_how: sortHow,
        });
        traktId = traktList.ids.trakt;
        traktSlug = traktList.ids.slug;
    } catch (err) {
        if (!(err instanceof TraktApiError)) throw err;
        console.warn("[lists] Trakt create failed, storing locally only:", (err as Error).message);
    }

    const [row] = await db
        .insert(userLists)
        .values({
            userId,
            traktId,
            traktSlug,
            name,
            description,
            privacy,
            sortBy,
            sortHow,
            updatedAt: now,
            createdAt: now,
        })
        .returning();

    return c.json({ data: toList(row) }, 201);
});

// PUT /api/lists/:id
listsRoutes.put("/:id", async (c) => {
    const userId = c.get("userId");
    const listId = Number(c.req.param("id"));
    const parsed = await validateBody(c, updateSchema);
    if (parsed instanceof Response) return parsed;
    const updates = parsed.data;

    const db = getDb();
    const trakt = getTraktClient();

    const [list] = await db
        .select()
        .from(userLists)
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)));
    if (!list) return c.json({ error: "Not found" }, 404);

    if (list.traktSlug) {
        try {
            await trakt.updateList(userId, list.traktSlug, {
                name: updates.name,
                description: updates.description,
                privacy: updates.privacy,
            });
        } catch (err) {
            if (!(err instanceof TraktApiError)) throw err;
        }
    }

    const [updated] = await db
        .update(userLists)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)))
        .returning();

    return c.json({ data: toList(updated) });
});

// DELETE /api/lists/:id
listsRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const listId = Number(c.req.param("id"));
    const db = getDb();
    const trakt = getTraktClient();

    const [list] = await db
        .select()
        .from(userLists)
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)));
    if (!list) return c.json({ error: "Not found" }, 404);

    if (list.traktSlug) {
        try {
            await trakt.deleteList(userId, list.traktSlug);
        } catch (err) {
            if (!(err instanceof TraktApiError)) throw err;
        }
    }

    await db.delete(userLists).where(eq(userLists.id, listId));
    return c.json({ ok: true });
});

// GET /api/lists/:id/items
listsRoutes.get("/:id/items", async (c) => {
    const userId = c.get("userId");
    const listId = Number(c.req.param("id"));
    const db = getDb();

    const [list] = await db
        .select()
        .from(userLists)
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)));
    if (!list) return c.json({ error: "Not found" }, 404);

    const rows = await db
        .select({
            id: userListItems.id,
            listId: userListItems.listId,
            mediaType: userListItems.mediaType,
            showId: userListItems.showId,
            movieId: userListItems.movieId,
            rank: userListItems.rank,
            notes: userListItems.notes,
            listedAt: userListItems.listedAt,
            showTitle: shows.title,
            showFirstAired: shows.firstAired,
            showPoster: shows.posterPath,
            movieTitle: movies.title,
            movieReleaseDate: movies.releaseDate,
            moviePoster: movies.posterPath,
        })
        .from(userListItems)
        .leftJoin(shows, eq(userListItems.showId, shows.id))
        .leftJoin(movies, eq(userListItems.movieId, movies.id))
        .where(eq(userListItems.listId, listId))
        .orderBy(userListItems.rank, userListItems.createdAt);

    const items: UserListItem[] = rows.map((r) => {
        const showYear = r.showFirstAired ? Number(r.showFirstAired.substring(0, 4)) || null : null;
        const movieYear = r.movieReleaseDate
            ? Number(r.movieReleaseDate.substring(0, 4)) || null
            : null;
        return {
            id: r.id,
            listId: r.listId,
            mediaType: r.mediaType as "show" | "movie",
            showId: r.showId,
            movieId: r.movieId,
            rank: r.rank,
            notes: r.notes,
            listedAt: r.listedAt?.toISOString() ?? null,
            title: r.showTitle ?? r.movieTitle ?? undefined,
            year: showYear ?? movieYear ?? null,
            posterPath: r.showPoster ?? r.moviePoster ?? null,
        };
    });

    return c.json({ data: items });
});

// POST /api/lists/:id/items — add item
listsRoutes.post("/:id/items", async (c) => {
    const userId = c.get("userId");
    const listId = Number(c.req.param("id"));
    const parsed = await validateBody(c, addItemSchema);
    if (parsed instanceof Response) return parsed;
    const { mediaType, localId, notes } = parsed.data;

    const db = getDb();
    const trakt = getTraktClient();

    const [list] = await db
        .select()
        .from(userLists)
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)));
    if (!list) return c.json({ error: "Not found" }, 404);

    // Resolve Trakt IDs for remote sync
    let traktIds: { trakt?: number; tmdb?: number } = {};
    if (mediaType === "show") {
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

    if (list.traktSlug && (traktIds.trakt || traktIds.tmdb)) {
        try {
            await trakt.addListItems(userId, list.traktSlug, [{ type: mediaType, ids: traktIds }]);
        } catch (err) {
            if (!(err instanceof TraktApiError)) throw err;
        }
    }

    const now = new Date();
    const [item] = await db
        .insert(userListItems)
        .values({
            userId,
            listId,
            mediaType,
            showId: mediaType === "show" ? localId : null,
            movieId: mediaType === "movie" ? localId : null,
            notes: notes ?? null,
            listedAt: now,
            createdAt: now,
        })
        .returning();

    // Update item_count atomically to avoid lost increments under concurrent requests.
    await db
        .update(userLists)
        .set({ itemCount: sql`${userLists.itemCount} + 1`, updatedAt: now })
        .where(eq(userLists.id, listId));

    return c.json({ data: { id: item.id } }, 201);
});

// DELETE /api/lists/:id/items/:itemId
listsRoutes.delete("/:id/items/:itemId", async (c) => {
    const userId = c.get("userId");
    const listId = Number(c.req.param("id"));
    const itemId = Number(c.req.param("itemId"));

    const db = getDb();
    const trakt = getTraktClient();

    const [list] = await db
        .select()
        .from(userLists)
        .where(and(eq(userLists.id, listId), eq(userLists.userId, userId)));
    if (!list) return c.json({ error: "Not found" }, 404);

    const [item] = await db
        .select()
        .from(userListItems)
        .where(and(eq(userListItems.id, itemId), eq(userListItems.listId, listId)));
    if (!item) return c.json({ error: "Item not found" }, 404);

    if (list.traktSlug) {
        let traktIds: { trakt?: number; tmdb?: number } = {};
        if (item.mediaType === "show" && item.showId) {
            const [row] = await db
                .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
                .from(shows)
                .where(eq(shows.id, item.showId));
            if (row?.traktId) traktIds.trakt = row.traktId;
        } else if (item.movieId) {
            const [row] = await db
                .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
                .from(movies)
                .where(eq(movies.id, item.movieId));
            if (row?.traktId) traktIds.trakt = row.traktId;
        }
        if (traktIds.trakt || traktIds.tmdb) {
            try {
                await trakt.removeListItems(userId, list.traktSlug, [
                    { type: item.mediaType as "show" | "movie", ids: traktIds },
                ]);
            } catch (err) {
                if (!(err instanceof TraktApiError)) throw err;
            }
        }
    }

    await db.delete(userListItems).where(eq(userListItems.id, itemId));
    await db
        .update(userLists)
        .set({ itemCount: sql`GREATEST(${userLists.itemCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(userLists.id, listId));

    return c.json({ ok: true });
});

// POST /api/lists/sync — pull all lists from Trakt into local DB
listsRoutes.post("/sync", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const trakt = getTraktClient();

    const traktLists = await trakt.getLists(userId);
    const now = new Date();
    let synced = 0;

    for (const tl of traktLists) {
        const [existing] = await db
            .select()
            .from(userLists)
            .where(and(eq(userLists.userId, userId), eq(userLists.traktId, tl.ids.trakt)));

        if (existing) {
            await db
                .update(userLists)
                .set({
                    name: tl.name,
                    description: tl.description,
                    privacy: tl.privacy,
                    sortBy: tl.sort_by,
                    sortHow: tl.sort_how,
                    itemCount: tl.item_count,
                    traktSlug: tl.ids.slug,
                    updatedAt: now,
                })
                .where(eq(userLists.id, existing.id));
        } else {
            await db.insert(userLists).values({
                userId,
                traktId: tl.ids.trakt,
                traktSlug: tl.ids.slug,
                name: tl.name,
                description: tl.description,
                privacy: tl.privacy,
                sortBy: tl.sort_by,
                sortHow: tl.sort_how,
                itemCount: tl.item_count,
                updatedAt: now,
                createdAt: now,
            });
        }
        synced++;
    }

    return c.json({ ok: true, synced });
});
