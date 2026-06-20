import { Hono } from "hono";
import { getDb, userNotes } from "@trakt-dashboard/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { validateBody } from "../lib/validate.js";
import type { UserNote } from "@trakt-dashboard/types";

export const notesRoutes = new Hono<{ Variables: { userId: number } }>();

const upsertSchema = z.object({
    mediaType: z.enum(["episode", "show", "movie"]),
    showId: z.number().int().positive().nullable().optional(),
    movieId: z.number().int().positive().nullable().optional(),
    season: z.number().int().positive().nullable().optional(),
    episode: z.number().int().positive().nullable().optional(),
    content: z.string().max(10000),
});

function toNote(r: typeof userNotes.$inferSelect): UserNote {
    return {
        id: r.id,
        mediaType: r.mediaType as UserNote["mediaType"],
        showId: r.showId,
        movieId: r.movieId,
        season: r.season,
        episode: r.episode,
        content: r.content,
        updatedAt: r.updatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
    };
}

function buildLookupConditions(
    userId: number,
    opts: {
        mediaType?: string;
        showId?: number | null;
        movieId?: number | null;
        season?: number | null;
        episode?: number | null;
    },
) {
    const conds = [eq(userNotes.userId, userId)];
    if (opts.mediaType) conds.push(eq(userNotes.mediaType, opts.mediaType));

    if (opts.showId != null) conds.push(eq(userNotes.showId, opts.showId));
    else if (opts.showId === null) conds.push(isNull(userNotes.showId));

    if (opts.movieId != null) conds.push(eq(userNotes.movieId, opts.movieId));
    else if (opts.movieId === null) conds.push(isNull(userNotes.movieId));

    if (opts.season != null) conds.push(eq(userNotes.season, opts.season));
    else if (opts.season === null) conds.push(isNull(userNotes.season));

    if (opts.episode != null) conds.push(eq(userNotes.episode, opts.episode));
    else if (opts.episode === null) conds.push(isNull(userNotes.episode));

    return conds;
}

// GET /api/notes?mediaType=&showId=&movieId=&season=&episode=
notesRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const mediaType = c.req.query("mediaType") as UserNote["mediaType"] | undefined;
    const showId = c.req.query("showId") ? Number(c.req.query("showId")) : undefined;
    const movieId = c.req.query("movieId") ? Number(c.req.query("movieId")) : undefined;
    const season = c.req.query("season") != null ? Number(c.req.query("season")) : undefined;
    const episode = c.req.query("episode") != null ? Number(c.req.query("episode")) : undefined;

    const db = getDb();
    const conds = [eq(userNotes.userId, userId)];
    if (mediaType) conds.push(eq(userNotes.mediaType, mediaType));
    if (showId != null) conds.push(eq(userNotes.showId, showId));
    if (movieId != null) conds.push(eq(userNotes.movieId, movieId));
    if (season != null) conds.push(eq(userNotes.season, season));
    else if (mediaType === "show") conds.push(isNull(userNotes.season));
    if (episode != null) conds.push(eq(userNotes.episode, episode));

    const rows = await db
        .select()
        .from(userNotes)
        .where(and(...conds));

    const isSingle =
        (mediaType === "episode" && showId != null && season != null && episode != null) ||
        (mediaType === "show" && showId != null) ||
        (mediaType === "movie" && movieId != null);

    if (isSingle) {
        return c.json({ data: rows[0] ? toNote(rows[0]) : null });
    }
    return c.json({ data: rows.map(toNote) });
});

// PUT /api/notes — upsert (manual select → insert or update)
notesRoutes.put("/", async (c) => {
    const userId = c.get("userId");
    const parsed = await validateBody(c, upsertSchema);
    if (parsed instanceof Response) return parsed;
    const { mediaType, showId, movieId, season, episode, content } = parsed.data;

    const db = getDb();
    const now = new Date();

    const lookupConds = buildLookupConditions(userId, {
        mediaType,
        showId: showId ?? null,
        movieId: movieId ?? null,
        season: season ?? null,
        episode: episode ?? null,
    });

    const [existing] = await db
        .select()
        .from(userNotes)
        .where(and(...lookupConds));

    if (existing) {
        const [updated] = await db
            .update(userNotes)
            .set({ content, updatedAt: now })
            .where(eq(userNotes.id, existing.id))
            .returning();
        return c.json({ data: toNote(updated) });
    }

    const [created] = await db
        .insert(userNotes)
        .values({
            userId,
            mediaType,
            showId: showId ?? null,
            movieId: movieId ?? null,
            season: season ?? null,
            episode: episode ?? null,
            content,
            updatedAt: now,
            createdAt: now,
        })
        .returning();

    return c.json({ data: toNote(created) }, 201);
});

// DELETE /api/notes/:id
notesRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

    const db = getDb();
    await db.delete(userNotes).where(and(eq(userNotes.id, id), eq(userNotes.userId, userId)));

    return c.json({ ok: true });
});
