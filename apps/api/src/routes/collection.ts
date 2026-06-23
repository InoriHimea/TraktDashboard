import { Hono } from "hono";
import { getDb, userCollection, shows, movies } from "@trakt-dashboard/db";
import { eq, and, isNull, isNotNull, asc, or } from "drizzle-orm";
import { getTraktClient } from "../services/trakt.js";
import { syncUserCollection } from "../services/sync.js";
import { apiOk } from "../lib/response.js";
import type {
    UserCollectionItem,
    CollectionEpisodeDetail,
    CollectionShowEpisodes,
} from "@trakt-dashboard/types";

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
                // Only return show-level rows (season IS NULL). Episode-level rows from the
                // old sync design are excluded so the listing stays consistent with /check,
                // which also requires season IS NULL for shows.
                isNull(userCollection.season),
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

// GET /api/collection/shows/:showId/episodes — episode-level detail for a collected show
collectionRoutes.get("/shows/:showId/episodes", async (c) => {
    const userId = c.get("userId");
    const showId = Number(c.req.param("showId"));
    if (!Number.isFinite(showId)) return c.json({ error: "Invalid showId" }, 400);
    const db = getDb();

    const rows = await db
        .select({
            season: userCollection.season,
            episode: userCollection.episode,
            mediaFormat: userCollection.mediaFormat,
            resolution: userCollection.resolution,
            hdr: userCollection.hdr,
            audio: userCollection.audio,
            audioChannels: userCollection.audioChannels,
            collectedAt: userCollection.collectedAt,
        })
        .from(userCollection)
        .where(
            and(
                eq(userCollection.userId, userId),
                eq(userCollection.showId, showId),
                isNotNull(userCollection.season),
                isNotNull(userCollection.episode),
            ),
        )
        .orderBy(asc(userCollection.season), asc(userCollection.episode));

    const seasons: CollectionShowEpisodes = {};
    for (const r of rows) {
        const key = String(r.season!);
        if (!seasons[key]) seasons[key] = [];
        const ep: CollectionEpisodeDetail = {
            episode: r.episode!,
            mediaFormat: r.mediaFormat,
            resolution: r.resolution,
            hdr: r.hdr,
            audio: r.audio,
            audioChannels: r.audioChannels,
            collectedAt: r.collectedAt?.toISOString() ?? null,
        };
        seasons[key].push(ep);
    }

    return c.json({ data: seasons });
});

// GET /api/collection/check?showId=&movieId= — check if item is in collection
collectionRoutes.get("/check", async (c) => {
    const userId = c.get("userId");
    const rawShowId = c.req.query("showId");
    const rawMovieId = c.req.query("movieId");
    const showId = rawShowId ? Number(rawShowId) : null;
    const movieId = rawMovieId ? Number(rawMovieId) : null;
    const db = getDb();

    if (showId !== null && !Number.isFinite(showId))
        return c.json({ error: "Invalid showId" }, 400);
    if (movieId !== null && !Number.isFinite(movieId))
        return c.json({ error: "Invalid movieId" }, 400);

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

// POST /api/collection/sync — pull all from Trakt → upsert local DB (add-only archive)
collectionRoutes.post("/sync", async (c) => {
    const userId = c.get("userId");
    try {
        const synced = await syncUserCollection(userId);
        return c.json({ ok: true, synced });
    } catch (err) {
        return c.json({ ok: false, error: (err as Error).message }, 500);
    }
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

    // Only select show-level rows (isNull(season)) to avoid sending duplicate IDs when
    // episode-level rows share the same showId as a show-level row.
    const showRows = await db
        .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
        .from(userCollection)
        .innerJoin(shows, eq(userCollection.showId, shows.id))
        .where(
            and(
                eq(userCollection.userId, userId),
                isNotNull(userCollection.showId),
                isNull(userCollection.season),
            ),
        );

    const movieRows = await db
        .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
        .from(userCollection)
        .innerJoin(movies, eq(userCollection.movieId, movies.id))
        .where(
            and(
                eq(userCollection.userId, userId),
                isNotNull(userCollection.movieId),
                isNull(userCollection.season),
            ),
        );

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

    return apiOk(c, { removed });
});

// GET /api/collection/capacity — remote usage vs. limit from Trakt settings
collectionRoutes.get("/capacity", async (c) => {
    const userId = c.get("userId");
    const trakt = getTraktClient();
    const [stats, settings] = await Promise.all([
        trakt.getTraktStats(userId),
        trakt.getUserSettings(userId),
    ]);
    const used = stats.shows.collected + stats.movies.collected;
    const knownLimit = settings.limits.collection?.item_count;
    const limitIsDefault = knownLimit == null;
    const limit = knownLimit != null && knownLimit > 0 ? knownLimit : 1000;
    const pct = Math.round((used / limit) * 100);
    return apiOk(c, { used, limit, pct, nearLimit: pct >= 95, limitIsDefault });
});

// POST /api/collection/prune-remote — delete oldest remote items until below targetPct
// Local DB is kept intact (add-only archive); next sync won't re-add pruned items.
collectionRoutes.post("/prune-remote", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
        confirm?: boolean;
        targetPct?: number;
    };
    if (body.confirm !== true)
        return c.json(
            { error: 'Send { "confirm": true } to confirm this destructive action' },
            400,
        );

    const userId = c.get("userId");
    const targetPct = Math.min(Math.max(body.targetPct ?? 80, 10), 95);
    const db = getDb();
    const trakt = getTraktClient();

    const [stats, settings] = await Promise.all([
        trakt.getTraktStats(userId),
        trakt.getUserSettings(userId),
    ]);
    const rawLimit = settings.limits.collection?.item_count;
    const limit = rawLimit != null && rawLimit > 0 ? rawLimit : 1000;
    // Trakt item_count counts shows (not episodes) + movies as individual slots
    const currentCount = stats.shows.collected + stats.movies.collected;
    const targetCount = Math.floor((targetPct / 100) * limit);

    if (currentCount <= targetCount) {
        return apiOk(c, { freed: 0, currentCount, targetCount });
    }

    let toFree = currentCount - targetCount;
    let freed = 0;
    let partialError: string | undefined;

    // Delete oldest shows first — each show occupies 1 item slot on Trakt.
    // Pre-filter rows that have at least one valid ID so .limit(toFree) is exact
    // and the loop never hits the empty-ids continue path.
    const showItems = await db
        .select({
            showId: userCollection.showId,
            collectedAt: userCollection.collectedAt,
            traktId: shows.traktId,
            tmdbId: shows.tmdbId,
        })
        .from(userCollection)
        .innerJoin(shows, eq(userCollection.showId, shows.id))
        .where(
            and(
                eq(userCollection.userId, userId),
                isNotNull(userCollection.showId),
                isNull(userCollection.season),
                or(isNotNull(shows.traktId), isNotNull(shows.tmdbId)),
            ),
        )
        .orderBy(asc(userCollection.collectedAt))
        .limit(toFree);

    for (const item of showItems) {
        if (toFree <= 0) break;
        const ids = {
            ...(item.traktId ? { trakt: item.traktId } : {}),
            ...(item.tmdbId ? { tmdb: item.tmdbId } : {}),
        };
        if (Object.keys(ids).length === 0) continue;
        try {
            await trakt.removeCollectionShows(userId, [{ ids }]);
        } catch (err) {
            partialError = (err as Error).message ?? String(err);
            break;
        }
        freed++;
        toFree--;
    }

    // If still over target, delete oldest movies
    if (partialError === undefined && toFree > 0) {
        const movieItems = await db
            .select({
                movieId: userCollection.movieId,
                collectedAt: userCollection.collectedAt,
                traktId: movies.traktId,
                tmdbId: movies.tmdbId,
            })
            .from(userCollection)
            .innerJoin(movies, eq(userCollection.movieId, movies.id))
            .where(
                and(
                    eq(userCollection.userId, userId),
                    isNotNull(userCollection.movieId),
                    isNull(userCollection.season),
                    or(isNotNull(movies.traktId), isNotNull(movies.tmdbId)),
                ),
            )
            .orderBy(asc(userCollection.collectedAt))
            .limit(toFree);

        for (const item of movieItems) {
            if (toFree <= 0) break;
            const ids = {
                ...(item.traktId ? { trakt: item.traktId } : {}),
                ...(item.tmdbId ? { tmdb: item.tmdbId } : {}),
            };
            if (Object.keys(ids).length === 0) continue;
            try {
                await trakt.removeCollectionMovies(userId, [{ ids }]);
            } catch (err) {
                partialError = (err as Error).message ?? String(err);
                break;
            }
            freed++;
            toFree--;
        }
    }

    return apiOk(c, { freed, currentCount, targetCount, partialError });
});

// DELETE /api/collection/:id — remove single item from local collection AND Trakt
collectionRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
    const db = getDb();
    const trakt = getTraktClient();

    const [item] = await db
        .select()
        .from(userCollection)
        .where(and(eq(userCollection.id, id), eq(userCollection.userId, userId)))
        .limit(1);
    if (!item) return c.json({ error: "Not found" }, 404);

    // Local→Trakt deletion propagation (本地删→删远端). Best-effort: ANY Trakt failure
    // (including network errors, not just TraktApiError) must not block the local delete,
    // since the local archive is the source of truth.
    // Only propagate show-level rows to Trakt — episode-level rows (season/episode non-null)
    // would incorrectly remove the entire show if passed to removeCollectionShows.
    try {
        if (item.showId && item.season === null && item.episode === null) {
            const [row] = await db
                .select({ traktId: shows.traktId, tmdbId: shows.tmdbId })
                .from(shows)
                .where(eq(shows.id, item.showId))
                .limit(1);
            const ids = {
                ...(row?.traktId ? { trakt: row.traktId } : {}),
                ...(row?.tmdbId ? { tmdb: row.tmdbId } : {}),
            };
            if (Object.keys(ids).length > 0) await trakt.removeCollectionShows(userId, [{ ids }]);
        } else if (item.movieId) {
            const [row] = await db
                .select({ traktId: movies.traktId, tmdbId: movies.tmdbId })
                .from(movies)
                .where(eq(movies.id, item.movieId))
                .limit(1);
            const ids = {
                ...(row?.traktId ? { trakt: row.traktId } : {}),
                ...(row?.tmdbId ? { tmdb: row.tmdbId } : {}),
            };
            if (Object.keys(ids).length > 0) await trakt.removeCollectionMovies(userId, [{ ids }]);
        }
    } catch (err) {
        console.warn(
            "[collection] Trakt remove failed, deleting locally only:",
            (err as Error).message,
        );
    }

    await db
        .delete(userCollection)
        .where(and(eq(userCollection.id, id), eq(userCollection.userId, userId)));
    return c.json({ ok: true });
});
