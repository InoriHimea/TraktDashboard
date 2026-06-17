import { Hono } from "hono";
import {
    getDb,
    shows,
    seasons,
    episodes,
    watchHistory,
    userShowProgress,
    watchResetCursors,
    userSettings,
} from "@trakt-dashboard/db";
import { eq, and, desc, asc, sql, like } from "drizzle-orm";
import { autoDeleteJellyfinEpisode } from "../services/jellyfin.js";
import type {
    ShowProgress,
    SeasonProgress,
    EpisodeProgress,
    ShowStatus,
} from "@trakt-dashboard/types";
import { getTmdbEpisodeDetail } from "../services/tmdb.js";
import { z } from "zod";
import { validateBody } from "../lib/validate.js";
import { parseBoundedInt } from "../lib/number.js";
import { toIsoOrNull } from "../lib/datetime.js";

const watchedAtSchema = z.object({
    watchedAt: z.string().datetime({ offset: true }).nullable().optional(),
});
import { getTraktClient } from "../services/trakt.js";
import { recalcShowProgress, forceSyncShow } from "../services/sync.js";

export const showRoutes = new Hono<{ Variables: { userId: number } }>();

function toEpisodeDto(ep: typeof episodes.$inferSelect) {
    return {
        id: ep.id,
        showId: ep.showId,
        seasonId: ep.seasonId,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        overview: ep.overview,
        runtime: ep.runtime,
        airDate: ep.airDate,
        stillPath: ep.stillPath,
        traktId: ep.traktId,
        tmdbId: ep.tmdbId,
    };
}

// GET /api/shows/progress — all shows with progress for the user
showRoutes.get("/progress", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const rawFilter = c.req.query("filter") || "watching"; // watching | completed | all
    const filter = ["watching", "completed", "all"].includes(rawFilter) ? rawFilter : "watching";
    const search = (c.req.query("q") || "").trim();
    const limit = parseBoundedInt(c.req.query("limit"), 50, 1, 200);
    const offset = parseBoundedInt(c.req.query("offset"), 0, 0, 1_000_000);

    const whereClause = and(
        eq(userShowProgress.userId, userId),
        search ? like(shows.title, `%${search}%`) : undefined,
        filter === "watching" ? eq(userShowProgress.completed, false) : undefined,
        filter === "completed" ? eq(userShowProgress.completed, true) : undefined,
    );

    const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(userShowProgress)
        .innerJoin(shows, eq(userShowProgress.showId, shows.id))
        .where(whereClause);

    const progressRows = await db
        .select({
            progress: userShowProgress,
            show: shows,
            nextEp: episodes,
        })
        .from(userShowProgress)
        .innerJoin(shows, eq(userShowProgress.showId, shows.id))
        .leftJoin(episodes, eq(userShowProgress.nextEpisodeId, episodes.id))
        .where(whereClause)
        .orderBy(desc(userShowProgress.lastWatchedAt))
        .limit(limit)
        .offset(offset);

    const result = progressRows.map(
        (row) =>
            ({
                show: {
                    id: row.show.id,
                    tmdbId: row.show.tmdbId,
                    tvdbId: row.show.tvdbId,
                    imdbId: row.show.imdbId,
                    traktId: row.show.traktId,
                    traktSlug: row.show.traktSlug,
                    title: row.show.title,
                    overview: row.show.overview,
                    status: row.show.status as ShowStatus,
                    firstAired: row.show.firstAired,
                    network: row.show.network,
                    genres: row.show.genres,
                    posterPath: row.show.posterPath,
                    backdropPath: row.show.backdropPath,
                    totalEpisodes: row.show.totalEpisodes,
                    totalSeasons: row.show.totalSeasons,
                    lastSyncedAt: row.show.lastSyncedAt.toISOString(),
                    createdAt: row.show.createdAt.toISOString(),
                    // Task 7.2: multilingual fields
                    originalName: row.show.originalName ?? null,
                    originalLanguage: row.show.originalLanguage ?? null,
                    translatedName: row.show.translatedName ?? null,
                    translatedOverview: row.show.translatedOverview ?? null,
                    displayLanguage: row.show.displayLanguage ?? null,
                },
                airedEpisodes: row.progress.airedEpisodes,
                watchedEpisodes: row.progress.watchedEpisodes,
                nextEpisode: row.nextEp ? toEpisodeDto(row.nextEp) : null,
                lastWatchedAt: toIsoOrNull(row.progress.lastWatchedAt),
                completed: row.progress.completed,
                percentage:
                    row.progress.airedEpisodes > 0
                        ? Math.round(
                              (row.progress.watchedEpisodes / row.progress.airedEpisodes) * 100,
                          )
                        : 0,
                seasons: [],
            }) satisfies ShowProgress,
    );

    return c.json({ data: result, total: Number(total), limit, offset });
});

// GET /api/shows/:id — single show with full season/episode progress
showRoutes.get("/:id", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (showId < 1) return c.json({ error: "Invalid show id" }, 400);
    const db = getDb();

    const [show] = await db.select().from(shows).where(eq(shows.id, showId));
    if (!show) return c.json({ error: "Show not found" }, 404);

    const [progress] = await db
        .select()
        .from(userShowProgress)
        .where(and(eq(userShowProgress.userId, userId), eq(userShowProgress.showId, showId)));

    const allSeasons = await db
        .select()
        .from(seasons)
        .where(eq(seasons.showId, showId))
        .orderBy(asc(seasons.seasonNumber));

    const allEpisodes = await db
        .select()
        .from(episodes)
        .where(eq(episodes.showId, showId))
        .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));

    // Get all watched episode IDs for this show and user
    const watched = await db
        .select({ episodeId: watchHistory.episodeId, watchedAt: watchHistory.watchedAt })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
        .orderBy(desc(watchHistory.watchedAt));

    const watchedMap = new Map<number, string>();
    for (const w of watched) {
        if (w.episodeId == null) continue;
        if (!watchedMap.has(w.episodeId) && w.watchedAt) {
            watchedMap.set(w.episodeId, w.watchedAt.toISOString());
        } else if (!watchedMap.has(w.episodeId)) {
            // watchedAt is null (Unknown date) — still mark as watched
            watchedMap.set(w.episodeId, "");
        }
    }

    const today = new Date().toISOString().split("T")[0];
    const episodesBySeason = new Map<number, typeof allEpisodes>();
    for (const ep of allEpisodes) {
        const grouped = episodesBySeason.get(ep.seasonNumber);
        if (grouped) {
            grouped.push(ep);
        } else {
            episodesBySeason.set(ep.seasonNumber, [ep]);
        }
    }

    const seasonData: SeasonProgress[] = allSeasons.map((s) => {
        const sEps = episodesBySeason.get(s.seasonNumber) || [];
        const epProgress: EpisodeProgress[] = sEps.map((ep) => {
            const watchedAt = watchedMap.get(ep.id) || null;
            const aired = !!ep.airDate && ep.airDate <= today;
            return {
                episodeId: ep.id,
                seasonNumber: ep.seasonNumber,
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                translatedTitle: ep.translatedTitle ?? null,
                overview: ep.overview,
                translatedOverview: ep.translatedOverview ?? null,
                airDate: ep.airDate,
                watched: watchedMap.has(ep.id),
                watchedAt,
                aired,
                stillPath: ep.stillPath,
                runtime: ep.runtime,
            };
        });

        const airedCount = epProgress.filter((e) => e.aired).length;
        const watchedCount = epProgress.filter((e) => e.watched).length;

        return {
            seasonNumber: s.seasonNumber,
            episodeCount: s.episodeCount,
            airedCount,
            watchedCount,
            posterPath: s.posterPath ?? null,
            episodes: epProgress,
        };
    });

    const airedEpisodes = progress?.airedEpisodes ?? 0;
    const watchedEpisodes = progress?.watchedEpisodes ?? 0;
    const [nextEpisode] = progress?.nextEpisodeId
        ? await db.select().from(episodes).where(eq(episodes.id, progress.nextEpisodeId)).limit(1)
        : [];

    return c.json({
        data: {
            show: {
                ...show,
                status: show.status as ShowStatus,
                genres: show.genres,
                lastSyncedAt: show.lastSyncedAt.toISOString(),
                createdAt: show.createdAt.toISOString(),
                originalName: show.originalName ?? null,
                originalLanguage: show.originalLanguage ?? null,
                translatedName: show.translatedName ?? null,
                translatedOverview: show.translatedOverview ?? null,
                displayLanguage: show.displayLanguage ?? null,
            },
            airedEpisodes,
            watchedEpisodes,
            nextEpisode: nextEpisode ? toEpisodeDto(nextEpisode) : null,
            lastWatchedAt: toIsoOrNull(progress?.lastWatchedAt),
            completed: progress?.completed ?? false,
            percentage: airedEpisodes > 0 ? Math.round((watchedEpisodes / airedEpisodes) * 100) : 0,
            seasons: seasonData,
        } satisfies ShowProgress,
    });
});

// GET /api/shows/:id/seasons — season breakdown only
showRoutes.get("/:id/seasons", async (c) => {
    const showId = parseBoundedInt(c.req.param("id"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (showId < 1) return c.json({ error: "Invalid show id" }, 400);
    const db = getDb();

    const allSeasons = await db
        .select()
        .from(seasons)
        .where(eq(seasons.showId, showId))
        .orderBy(asc(seasons.seasonNumber));

    return c.json({ data: allSeasons });
});

// GET /api/shows/:showId/episodes/:season/:episode
showRoutes.get("/:showId/episodes/:season/:episode", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    const episode = parseBoundedInt(c.req.param("episode"), -1, 1, 1000);

    if (showId < 1 || season < 0 || episode < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();

    // Check show exists
    const [show] = await db.select().from(shows).where(eq(shows.id, showId));
    if (!show) return c.json({ error: "Show not found" }, 404);

    // Check episode exists
    const [ep] = await db
        .select()
        .from(episodes)
        .where(
            and(
                eq(episodes.showId, showId),
                eq(episodes.seasonNumber, season),
                eq(episodes.episodeNumber, episode),
            ),
        );
    if (!ep) return c.json({ error: "Episode not found" }, 404);

    // Get latest watch record (cursor-aware)
    const [latestWatch] = await db
        .select()
        .from(watchHistory)
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.episodeId, ep.id)))
        .orderBy(desc(watchHistory.watchedAt))
        .limit(1);

    const watched = !!latestWatch;
    const watchedAt = toIsoOrNull(latestWatch?.watchedAt);

    // Get TMDB directors (degradation on failure)
    const { directors } = await getTmdbEpisodeDetail(
        show.tmdbId,
        season,
        episode,
        show.displayLanguage ?? undefined,
        userId,
    );

    // Get Trakt rating (degradation on failure)
    let traktRating: number | null = null;
    if (show.traktId) {
        traktRating = await getTraktClient().getEpisodeRating(
            show.traktId,
            season,
            episode,
            userId,
        );
    }

    // Get all episodes in current season
    const seasonEpisodes = await db
        .select()
        .from(episodes)
        .where(and(eq(episodes.showId, showId), eq(episodes.seasonNumber, season)))
        .orderBy(asc(episodes.episodeNumber));

    const watchedEpisodeIds = new Set(
        (
            await db
                .select({ episodeId: watchHistory.episodeId })
                .from(watchHistory)
                .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
                .where(
                    and(
                        eq(watchHistory.userId, userId),
                        eq(episodes.showId, showId),
                        eq(episodes.seasonNumber, season),
                    ),
                )
        )
            .map((r) => r.episodeId)
            .filter((id): id is number => id != null),
    );

    const today = new Date().toISOString().split("T")[0];
    const seasonEpisodesProgress = seasonEpisodes.map((e) => ({
        episodeId: e.id,
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: e.title,
        translatedTitle: e.translatedTitle ?? null,
        overview: e.overview,
        translatedOverview: e.translatedOverview ?? null,
        airDate: e.airDate,
        watched: watchedEpisodeIds.has(e.id),
        watchedAt: null, // Not needed for strip
        aired: !!e.airDate && e.airDate <= today,
        stillPath: e.stillPath,
        runtime: e.runtime,
    }));

    return c.json({
        data: {
            episodeId: ep.id,
            showId: show.id,
            seasonNumber: season,
            episodeNumber: episode,
            title: ep.title,
            translatedTitle: ep.translatedTitle ?? null,
            overview: ep.overview,
            translatedOverview: ep.translatedOverview ?? null,
            airDate: ep.airDate,
            runtime: ep.runtime,
            stillPath: ep.stillPath,
            watched,
            watchedAt,
            traktRating,
            directors,
            show: {
                id: show.id,
                title: show.title,
                translatedName: show.translatedName ?? null,
                posterPath: show.posterPath,
                backdropPath: show.backdropPath ?? null,
                genres: show.genres,
                traktId: show.traktId,
                traktSlug: show.traktSlug,
                tmdbId: show.tmdbId,
                imdbId: show.imdbId,
                tvdbId: show.tvdbId,
            },
            seasonEpisodes: seasonEpisodesProgress,
        },
    });
});

// POST /api/shows/:showId/episodes/:season/:episode/watch
showRoutes.post("/:showId/episodes/:season/:episode/watch", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    const episode = parseBoundedInt(c.req.param("episode"), -1, 1, 1000);

    if (showId < 1 || season < 0 || episode < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    const validated = await validateBody(c, watchedAtSchema);
    if (validated instanceof Response) return validated;
    const watchedAt = validated.data.watchedAt ?? null;

    const db = getDb();

    const [ep] = await db
        .select()
        .from(episodes)
        .where(
            and(
                eq(episodes.showId, showId),
                eq(episodes.seasonNumber, season),
                eq(episodes.episodeNumber, episode),
            ),
        );
    if (!ep) return c.json({ error: "Episode not found" }, 404);

    const [result] = await db
        .insert(watchHistory)
        .values({
            userId,
            episodeId: ep.id,
            watchedAt: watchedAt ? new Date(watchedAt) : null,
            source: "manual",
        })
        .returning({ id: watchHistory.id });

    // Recalc progress
    await recalcShowProgress(userId, showId);

    // Jellyfin auto-delete (fire-and-forget; never fails the watch record)
    (async () => {
        try {
            const [cfg] = await db
                .select()
                .from(userSettings)
                .where(eq(userSettings.userId, userId));
            if (!cfg?.jellyfinUrl || !cfg?.jellyfinApiKey || !cfg?.jellyfinAutoDeleteLibraryIds)
                return;
            const autoDeleteIds = JSON.parse(cfg.jellyfinAutoDeleteLibraryIds) as string[];
            if (autoDeleteIds.length === 0) return;
            const [show] = await db.select().from(shows).where(eq(shows.id, showId));
            if (!show?.tmdbId) return;
            await autoDeleteJellyfinEpisode(
                { url: cfg.jellyfinUrl, apiKey: cfg.jellyfinApiKey },
                autoDeleteIds,
                show.tmdbId,
                ep.seasonNumber,
                ep.episodeNumber,
            );
        } catch {
            // Auto-delete errors are intentionally swallowed
        }
    })();

    return c.json({ ok: true, historyId: result.id }, 201);
});

// GET /api/shows/:showId/episodes/:season/:episode/history
showRoutes.get("/:showId/episodes/:season/:episode/history", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    const episode = parseBoundedInt(c.req.param("episode"), -1, 1, 1000);

    if (showId < 1 || season < 0 || episode < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();

    const history = await db
        .select({
            id: watchHistory.id,
            episodeId: episodes.id,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeTitle: episodes.title,
            watchedAt: watchHistory.watchedAt,
            source: watchHistory.source,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(
            and(
                eq(watchHistory.userId, userId),
                eq(episodes.showId, showId),
                eq(episodes.seasonNumber, season),
                eq(episodes.episodeNumber, episode),
            ),
        )
        .orderBy(sql`watched_at DESC NULLS LAST`);

    return c.json({
        data: history.map((h) => ({
            ...h,
            watchedAt: toIsoOrNull(h.watchedAt),
        })),
    });
});

// GET /api/shows/:showId/history
showRoutes.get("/:showId/history", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);

    if (showId < 1) {
        return c.json({ error: "Invalid show id" }, 400);
    }

    const db = getDb();

    const history = await db
        .select({
            id: watchHistory.id,
            episodeId: episodes.id,
            seasonNumber: episodes.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeTitle: episodes.title,
            watchedAt: watchHistory.watchedAt,
            source: watchHistory.source,
        })
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(and(eq(watchHistory.userId, userId), eq(episodes.showId, showId)))
        .orderBy(sql`watched_at DESC NULLS LAST`);

    return c.json({
        data: history.map((h) => ({
            ...h,
            watchedAt: toIsoOrNull(h.watchedAt),
        })),
    });
});

// DELETE /api/shows/:showId/history/:historyId
showRoutes.delete("/:showId/history/:historyId", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const historyId = parseBoundedInt(c.req.param("historyId"), -1, 1, Number.MAX_SAFE_INTEGER);

    if (showId < 1 || historyId < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    const db = getDb();

    // Verify ownership
    const [record] = await db
        .select()
        .from(watchHistory)
        .innerJoin(episodes, eq(watchHistory.episodeId, episodes.id))
        .where(
            and(
                eq(watchHistory.id, historyId),
                eq(watchHistory.userId, userId),
                eq(episodes.showId, showId),
            ),
        );

    if (!record) return c.json({ error: "History record not found" }, 404);

    await db.delete(watchHistory).where(eq(watchHistory.id, historyId));

    // Recalc progress
    await recalcShowProgress(userId, showId);

    return c.json({ ok: true });
});

// POST /api/shows/:showId/reset
showRoutes.post("/:showId/reset", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);

    if (showId < 1) {
        return c.json({ error: "Invalid show id" }, 400);
    }

    const db = getDb();

    const [show] = await db.select().from(shows).where(eq(shows.id, showId));
    if (!show) return c.json({ error: "Show not found" }, 404);

    // Insert reset cursor
    await db.insert(watchResetCursors).values({
        userId,
        showId,
        resetAt: new Date(),
    });

    // Recalc progress (will use new cursor)
    await recalcShowProgress(userId, showId);

    // Return updated progress
    const [progress] = await db
        .select()
        .from(userShowProgress)
        .where(and(eq(userShowProgress.userId, userId), eq(userShowProgress.showId, showId)));

    const airedEpisodes = progress?.airedEpisodes ?? 0;
    const watchedEpisodes = progress?.watchedEpisodes ?? 0;

    return c.json({
        data: {
            show: {
                ...show,
                status: show.status as ShowStatus,
                genres: show.genres,
                lastSyncedAt: show.lastSyncedAt.toISOString(),
                createdAt: show.createdAt.toISOString(),
                originalName: show.originalName ?? null,
                originalLanguage: show.originalLanguage ?? null,
                translatedName: show.translatedName ?? null,
                translatedOverview: show.translatedOverview ?? null,
                displayLanguage: show.displayLanguage ?? null,
            },
            airedEpisodes,
            watchedEpisodes,
            nextEpisode: null,
            lastWatchedAt: toIsoOrNull(progress?.lastWatchedAt),
            completed: progress?.completed ?? false,
            percentage: airedEpisodes > 0 ? Math.round((watchedEpisodes / airedEpisodes) * 100) : 0,
            seasons: [],
        },
    });
});

// POST /api/shows/:showId/seasons/:season/mark-watched
showRoutes.post("/:showId/seasons/:season/mark-watched", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);

    if (showId < 1 || season < 0) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    const validated = await validateBody(c, watchedAtSchema);
    if (validated instanceof Response) return validated;
    const watchedAt: Date | null = validated.data.watchedAt
        ? new Date(validated.data.watchedAt)
        : null;

    const db = getDb();

    // Get all episodes in the season
    const seasonEpisodes = await db
        .select({ id: episodes.id })
        .from(episodes)
        .where(and(eq(episodes.showId, showId), eq(episodes.seasonNumber, season)));

    if (!seasonEpisodes.length) {
        return c.json({ error: "Season not found or has no episodes" }, 404);
    }

    // Find already-watched episode IDs
    const alreadyWatched = await db
        .select({ episodeId: watchHistory.episodeId })
        .from(watchHistory)
        .where(and(eq(watchHistory.userId, userId), eq(watchHistory.mediaType, "episode")));

    const watchedSet = new Set(
        alreadyWatched.map((r) => r.episodeId).filter((id): id is number => id != null),
    );

    // Only insert for unwatched episodes
    const unwatched = seasonEpisodes.filter((e) => !watchedSet.has(e.id));

    if (unwatched.length > 0) {
        await db.insert(watchHistory).values(
            unwatched.map((e) => ({
                userId,
                episodeId: e.id,
                watchedAt,
                source: "manual",
            })),
        );
    }

    await recalcShowProgress(userId, showId);

    return c.json({ ok: true, marked: unwatched.length, alreadyWatched: watchedSet.size });
});

// POST /api/shows/:showId/force-sync
showRoutes.post("/:showId/force-sync", async (c) => {
    const userId = c.get("userId");
    const showId = parseBoundedInt(c.req.param("showId"), -1, 1, Number.MAX_SAFE_INTEGER);

    if (showId < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    try {
        await forceSyncShow(userId, showId);
        return c.json({ ok: true });
    } catch (error) {
        console.error(`[shows] Force sync failed for show ${showId}:`, error);
        const message = error instanceof Error ? error.message : "Failed to force sync show";
        return c.json({ error: message }, 500);
    }
});
