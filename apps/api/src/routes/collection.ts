import { Hono } from "hono";
import { getDb, userCollection, shows, movies } from "@trakt-dashboard/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { getTraktClient, TraktApiError } from "../services/trakt.js";
import type { UserCollectionItem } from "@trakt-dashboard/types";

export const collectionRoutes = new Hono<{ Variables: { userId: number } }>();

function toItem(
    r: typeof userCollection.$inferSelect,
    extra?: { title?: string | null; posterPath?: string | null; year?: number | null },
): UserCollectionItem {
    return {
        id: r.id,
        mediaType: r.mediaType as "show" | "movie" | "episode",
        showId: r.showId,
        movieId: r.movieId,
        season: r.season,
        episode: r.episode,
        mediaFormat: r.mediaFormat,
        resolution: r.resolution,
        hdr: r.hdr,
        audio: r.audio,
        audioChannels: r.audioChannels,
        collectedAt: r.collectedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        title: extra?.title ?? undefined,
        posterPath: extra?.posterPath ?? null,
        year: extra?.year ?? null,
    };
}

// GET /api/collection?type=show|movie|all
collectionRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const rawType = c.req.query("type") ?? "all";
    const db = getDb();

    const rows = await db
        .select({
            col: userCollection,
            showTitle: shows.title,
            showFirstAired: shows.firstAired,
            showPoster: shows.posterPath,
            movieTitle: movies.title,
            movieReleaseDate: movies.releaseDate,
            moviePoster: movies.posterPath,
        })
        .from(userCollection)
        .leftJoin(shows, eq(userCollection.showId, shows.id))
        .leftJoin(movies, eq(userCollection.movieId, movies.id))
        .where(
            and(
                eq(userCollection.userId, userId),
                rawType === "show"
                    ? isNotNull(userCollection.showId)
                    : rawType === "movie"
                      ? isNotNull(userCollection.movieId)
                      : undefined,
            ),
        )
        .orderBy(userCollection.createdAt);

    const items: UserCollectionItem[] = rows.map((r) => {
        const year = r.showFirstAired
            ? Number(r.showFirstAired.substring(0, 4)) || null
            : r.movieReleaseDate
              ? Number(r.movieReleaseDate.substring(0, 4)) || null
              : null;
        return toItem(r.col, {
            title: r.showTitle ?? r.movieTitle,
            posterPath: r.showPoster ?? r.moviePoster,
            year,
        });
    });

    return c.json({ data: items });
});

// GET /api/collection/check?showId=&movieId= — check if item is in collection
collectionRoutes.get("/check", async (c) => {
    const userId = c.get("userId");
    const showId = c.req.query("showId") ? Number(c.req.query("showId")) : null;
    const movieId = c.req.query("movieId") ? Number(c.req.query("movieId")) : null;
    const db = getDb();

    if (showId && movieId) {
        return c.json({ error: "Provide either showId or movieId, not both" }, 400);
    }

    const conds = [eq(userCollection.userId, userId)];
    if (showId) {
        conds.push(eq(userCollection.showId, showId));
        conds.push(isNull(userCollection.season));
        conds.push(isNull(userCollection.episode));
    } else if (movieId) {
        conds.push(eq(userCollection.movieId, movieId));
    } else {
        return c.json({ inCollection: false });
    }

    const [row] = await db
        .select({ id: userCollection.id })
        .from(userCollection)
        .where(and(...conds))
        .limit(1);

    return c.json({ inCollection: !!row });
});

// POST /api/collection/sync — pull all from Trakt → upsert local DB
collectionRoutes.post("/sync", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const trakt = getTraktClient();
    const now = new Date();
    let synced = 0;

    // ── Shows ──────────────────────────────────────────────────────────────
    try {
        const traktShows = (await trakt.getCollectionShows(userId)) as Array<{
            collected_at?: string;
            show?: { ids?: { trakt?: number; tmdb?: number } };
            seasons?: Array<{
                number: number;
                episodes: Array<{
                    number: number;
                    collected_at?: string;
                    media_type?: string;
                    resolution?: string;
                    hdr?: string;
                    audio?: string;
                    audio_channels?: string;
                }>;
            }>;
        }>;

        for (const ts of traktShows) {
            const tmdbId = ts.show?.ids?.tmdb;
            if (!tmdbId) continue;

            const [show] = await db
                .select({ id: shows.id })
                .from(shows)
                .where(eq(shows.tmdbId, tmdbId))
                .limit(1);
            if (!show) continue;

            // Upsert show-level entry
            const [existing] = await db
                .select({ id: userCollection.id })
                .from(userCollection)
                .where(
                    and(
                        eq(userCollection.userId, userId),
                        eq(userCollection.showId, show.id),
                        isNull(userCollection.season),
                        isNull(userCollection.episode),
                    ),
                )
                .limit(1);

            const collectedAt = ts.collected_at ? new Date(ts.collected_at) : now;
            if (existing) {
                await db
                    .update(userCollection)
                    .set({ collectedAt, updatedAt: now })
                    .where(eq(userCollection.id, existing.id));
            } else {
                await db.insert(userCollection).values({
                    userId,
                    mediaType: "show",
                    showId: show.id,
                    collectedAt,
                    updatedAt: now,
                    createdAt: now,
                });
            }
            synced++;
        }
    } catch (err) {
        if (!(err instanceof TraktApiError)) throw err;
        console.warn("[collection] shows sync failed:", (err as Error).message);
    }

    // ── Movies ─────────────────────────────────────────────────────────────
    try {
        const traktMovies = (await trakt.getCollectionMovies(userId)) as Array<{
            collected_at?: string;
            media_type?: string;
            resolution?: string;
            hdr?: string;
            audio?: string;
            audio_channels?: string;
            movie?: { ids?: { trakt?: number; tmdb?: number } };
        }>;

        for (const tm of traktMovies) {
            const tmdbId = tm.movie?.ids?.tmdb;
            if (!tmdbId) continue;

            const [movie] = await db
                .select({ id: movies.id })
                .from(movies)
                .where(eq(movies.tmdbId, tmdbId))
                .limit(1);
            if (!movie) continue;

            const [existing] = await db
                .select({ id: userCollection.id })
                .from(userCollection)
                .where(and(eq(userCollection.userId, userId), eq(userCollection.movieId, movie.id)))
                .limit(1);

            const collectedAt = tm.collected_at ? new Date(tm.collected_at) : now;
            const vals = {
                mediaFormat: tm.media_type ?? null,
                resolution: tm.resolution ?? null,
                hdr: tm.hdr ?? null,
                audio: tm.audio ?? null,
                audioChannels: tm.audio_channels ?? null,
                collectedAt,
                updatedAt: now,
            };
            if (existing) {
                await db.update(userCollection).set(vals).where(eq(userCollection.id, existing.id));
            } else {
                await db.insert(userCollection).values({
                    userId,
                    mediaType: "movie",
                    movieId: movie.id,
                    ...vals,
                    createdAt: now,
                });
            }
            synced++;
        }
    } catch (err) {
        if (!(err instanceof TraktApiError)) throw err;
        console.warn("[collection] movies sync failed:", (err as Error).message);
    }

    return c.json({ ok: true, synced });
});

// POST /api/collection/clear-remote — delete ALL remote Trakt collection (requires confirm)
collectionRoutes.post("/clear-remote", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.confirm !== true) {
        return c.json(
            { error: 'Send { "confirm": true } to confirm this destructive action' },
            400,
        );
    }

    const userId = c.get("userId");
    const db = getDb();
    const trakt = getTraktClient();

    // Collect Trakt IDs from local DB for all collected shows/movies
    const showRows = await db
        .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
        .from(userCollection)
        .innerJoin(shows, eq(userCollection.showId, shows.id))
        .where(and(eq(userCollection.userId, userId), isNotNull(userCollection.showId)));

    const movieRows = await db
        .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
        .from(userCollection)
        .innerJoin(movies, eq(userCollection.movieId, movies.id))
        .where(and(eq(userCollection.userId, userId), isNotNull(userCollection.movieId)));

    let removed = 0;

    if (showRows.length > 0) {
        const items = showRows
            .filter((r) => r.traktId || r.tmdbId)
            .map((r) => ({
                ids: {
                    ...(r.traktId ? { trakt: r.traktId } : {}),
                    ...(r.tmdbId ? { tmdb: r.tmdbId } : {}),
                },
            }));
        if (items.length > 0) {
            await trakt.removeCollectionShows(userId, items);
            removed += items.length;
        }
    }

    if (movieRows.length > 0) {
        const items = movieRows
            .filter((r) => r.traktId || r.tmdbId)
            .map((r) => ({
                ids: {
                    ...(r.traktId ? { trakt: r.traktId } : {}),
                    ...(r.tmdbId ? { tmdb: r.tmdbId } : {}),
                },
            }));
        if (items.length > 0) {
            await trakt.removeCollectionMovies(userId, items);
            removed += items.length;
        }
    }

    return c.json({ ok: true, removed });
});

// DELETE /api/collection/:id — remove single item from local collection
collectionRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const db = getDb();

    const [item] = await db
        .select()
        .from(userCollection)
        .where(and(eq(userCollection.id, id), eq(userCollection.userId, userId)))
        .limit(1);
    if (!item) return c.json({ error: "Not found" }, 404);

    await db
        .delete(userCollection)
        .where(and(eq(userCollection.id, id), eq(userCollection.userId, userId)));
    return c.json({ ok: true });
});
