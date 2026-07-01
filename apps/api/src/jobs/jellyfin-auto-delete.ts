import {
    getDb,
    userSettings,
    jellyfinDeleteQueue,
    jellyfinDeleteHistory,
    userShowProgress,
    shows,
    seasons,
    episodes,
    watchHistory,
} from "@trakt-dashboard/db";
import { and, eq, gt, inArray, isNotNull, not, sql } from "drizzle-orm";
import {
    deleteJellyfinSeries,
    deleteJellyfinSeason,
    type JellyfinConfig,
} from "../services/jellyfin.js";

export interface AutoDeleteResult {
    deleted: number;
    queued: number;
}

export async function runJellyfinAutoDelete(): Promise<AutoDeleteResult> {
    const db = getDb();
    let deleted = 0;
    let queued = 0;

    const eligibleUsers = await db
        .select({
            userId: userSettings.userId,
            jellyfinUrl: userSettings.jellyfinUrl,
            jellyfinApiKey: userSettings.jellyfinApiKey,
            jellyfinAutoDeleteLibraryIds: userSettings.jellyfinAutoDeleteLibraryIds,
        })
        .from(userSettings)
        .where(
            and(
                isNotNull(userSettings.jellyfinUrl),
                isNotNull(userSettings.jellyfinApiKey),
                isNotNull(userSettings.jellyfinAutoDeleteLibraryIds),
            ),
        );

    for (const user of eligibleUsers) {
        let autoDeleteIds: string[];
        try {
            autoDeleteIds = JSON.parse(user.jellyfinAutoDeleteLibraryIds!) as string[];
        } catch {
            continue;
        }
        if (!Array.isArray(autoDeleteIds) || autoDeleteIds.length === 0) continue;

        const cfg: JellyfinConfig = { url: user.jellyfinUrl!, apiKey: user.jellyfinApiKey! };
        const userId = user.userId;

        const result = await processUser(db, cfg, userId, autoDeleteIds);
        deleted += result.deleted;
        queued += result.queued;
    }

    return { deleted, queued };
}

async function processUser(
    db: ReturnType<typeof getDb>,
    cfg: JellyfinConfig,
    userId: number,
    autoDeleteIds: string[],
): Promise<AutoDeleteResult> {
    let deleted = 0;
    let queued = 0;

    // ── Phase 2: execute pending deletions ──────────────────────────────────────

    const pendingEntries = (
        await db
            .select({
                id: jellyfinDeleteQueue.id,
                showId: jellyfinDeleteQueue.showId,
                seasonNumber: jellyfinDeleteQueue.seasonNumber,
                tmdbId: shows.tmdbId,
                title: shows.title,
            })
            .from(jellyfinDeleteQueue)
            .innerJoin(shows, eq(shows.id, jellyfinDeleteQueue.showId))
            .where(
                and(eq(jellyfinDeleteQueue.userId, userId), isNotNull(jellyfinDeleteQueue.showId)),
            )
    ).map((e) => ({ ...e, showId: e.showId! }));

    const wholeShowEntries = pendingEntries.filter((e) => e.seasonNumber === null);
    const seasonEntries = pendingEntries.filter((e) => e.seasonNumber !== null);

    // Delete whole shows first; track which showIds were handled so we skip stray season entries
    const handledShowIds = new Set<number>();
    for (const entry of wholeShowEntries) {
        let status: "deleted" | "not_found" | "failed" = "not_found";
        let errorMessage: string | null = null;
        try {
            const found = await deleteJellyfinSeries(cfg, entry.tmdbId, autoDeleteIds);
            status = found ? "deleted" : "not_found";
            console.log(
                `[jellyfin-delete] ${found ? "Deleted" : "Not found"} series "${entry.title}" (TMDB ${entry.tmdbId}) for user ${userId}`,
            );
            deleted++;
        } catch (e) {
            status = "failed";
            errorMessage = e instanceof Error ? e.message : String(e);
            console.error(
                `[jellyfin-delete] Failed to delete series "${entry.title}" for user ${userId}:`,
                e,
            );
        }
        await db.insert(jellyfinDeleteHistory).values({
            userId,
            showId: entry.showId,
            seasonNumber: null,
            title: entry.title,
            status,
            errorMessage,
        });
        // Remove all queue entries for this show (including any stray season entries)
        await db
            .delete(jellyfinDeleteQueue)
            .where(
                and(
                    eq(jellyfinDeleteQueue.userId, userId),
                    eq(jellyfinDeleteQueue.showId, entry.showId),
                ),
            );
        handledShowIds.add(entry.showId);
    }

    // Delete individual seasons
    for (const entry of seasonEntries) {
        if (handledShowIds.has(entry.showId)) continue;
        const season = entry.seasonNumber!;
        let status: "deleted" | "not_found" | "failed" = "not_found";
        let errorMessage: string | null = null;
        try {
            const found = await deleteJellyfinSeason(cfg, entry.tmdbId, season, autoDeleteIds);
            status = found ? "deleted" : "not_found";
            console.log(
                `[jellyfin-delete] ${found ? "Deleted" : "Not found"} S${season} of "${entry.title}" for user ${userId}`,
            );
            deleted++;
        } catch (e) {
            status = "failed";
            errorMessage = e instanceof Error ? e.message : String(e);
            console.error(
                `[jellyfin-delete] Failed to delete S${season} of "${entry.title}" for user ${userId}:`,
                e,
            );
        }
        await db.insert(jellyfinDeleteHistory).values({
            userId,
            showId: entry.showId,
            seasonNumber: season,
            title: entry.title,
            status,
            errorMessage,
        });
        await db.delete(jellyfinDeleteQueue).where(eq(jellyfinDeleteQueue.id, entry.id));
    }

    // ── Phase 1: queue newly eligible shows/seasons ──────────────────────────────

    // 1a. Whole-show deletion: ended/canceled + all watched (completed)
    const completedEndedShows = await db
        .select({
            showId: userShowProgress.showId,
            title: shows.title,
        })
        .from(userShowProgress)
        .innerJoin(shows, eq(shows.id, userShowProgress.showId))
        .where(
            and(
                eq(userShowProgress.userId, userId),
                eq(userShowProgress.completed, true),
                inArray(shows.status, ["ended", "canceled"]),
            ),
        );

    const wholeShowEligibleIds = new Set(completedEndedShows.map((s) => s.showId));

    for (const show of completedEndedShows) {
        const inserted = await db
            .insert(jellyfinDeleteQueue)
            .values({ userId, showId: show.showId, seasonNumber: null })
            .onConflictDoNothing()
            .returning({ id: jellyfinDeleteQueue.id });
        if (inserted.length > 0) {
            queued++;
            console.log(
                `[jellyfin-delete] Queued whole show "${show.title}" (showId=${show.showId}) for user ${userId}`,
            );
        }
    }

    // 1b. Season-level deletion: not eligible for whole-show deletion
    //     Season has fully aired (reached its TMDB episode count) AND all of its
    //     episodes are watched AND the last episode aired > 7 days ago
    const userShowIds = (
        await db
            .select({ showId: userShowProgress.showId })
            .from(userShowProgress)
            .where(
                and(
                    eq(userShowProgress.userId, userId),
                    wholeShowEligibleIds.size > 0
                        ? not(inArray(userShowProgress.showId, [...wholeShowEligibleIds]))
                        : undefined,
                ),
            )
    ).map((r) => r.showId);

    if (userShowIds.length > 0) {
        const today = new Date().toISOString().split("T")[0]!;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]!;

        // seasonTotal comes from the synced `seasons.episode_count` (TMDB's stated total for
        // the season), NOT from counting locally-aired episode rows. Using "aired-so-far" as
        // the denominator would mark a still-airing season (e.g. weekly releases) as complete
        // the moment the user catches up with the latest episode — wrongly queuing it for
        // deletion mid-broadcast. Requiring airedCount to reach the TMDB total ensures the
        // season has actually finished airing before it's considered done.
        const seasonStats = await db
            .select({
                showId: episodes.showId,
                seasonNumber: episodes.seasonNumber,
                seasonTotal: seasons.episodeCount,
                airedCount: sql<number>`cast(count(distinct case when ${episodes.airDate} is not null and ${episodes.airDate} <= ${today} then ${episodes.id} end) as integer)`,
                watched: sql<number>`cast(count(distinct ${watchHistory.episodeId}) as integer)`,
                lastAirDate: sql<string | null>`max(${episodes.airDate})`,
            })
            .from(episodes)
            .innerJoin(
                seasons,
                and(
                    eq(seasons.showId, episodes.showId),
                    eq(seasons.seasonNumber, episodes.seasonNumber),
                ),
            )
            .leftJoin(
                watchHistory,
                and(
                    eq(watchHistory.episodeId, episodes.id),
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.mediaType, "episode"),
                ),
            )
            .where(and(inArray(episodes.showId, userShowIds), gt(episodes.seasonNumber, 0)))
            .groupBy(episodes.showId, episodes.seasonNumber, seasons.episodeCount);

        for (const stat of seasonStats) {
            if (
                stat.seasonTotal > 0 &&
                stat.airedCount >= stat.seasonTotal &&
                stat.watched >= stat.seasonTotal &&
                stat.lastAirDate !== null &&
                stat.lastAirDate < sevenDaysAgo
            ) {
                const inserted = await db
                    .insert(jellyfinDeleteQueue)
                    .values({ userId, showId: stat.showId, seasonNumber: stat.seasonNumber })
                    .onConflictDoNothing()
                    .returning({ id: jellyfinDeleteQueue.id });
                if (inserted.length > 0) {
                    queued++;
                    console.log(
                        `[jellyfin-delete] Queued S${stat.seasonNumber} of showId=${stat.showId} for user ${userId}`,
                    );
                }
            }
        }
    }

    return { deleted, queued };
}
