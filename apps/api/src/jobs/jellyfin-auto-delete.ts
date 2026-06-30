import {
    getDb,
    userSettings,
    jellyfinDeleteQueue,
    userShowProgress,
    shows,
    episodes,
    watchHistory,
} from "@trakt-dashboard/db";
import { and, eq, gt, inArray, isNotNull, isNull, lte, not, sql } from "drizzle-orm";
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

    const pendingEntries = await db
        .select({
            id: jellyfinDeleteQueue.id,
            showId: jellyfinDeleteQueue.showId,
            seasonNumber: jellyfinDeleteQueue.seasonNumber,
            tmdbId: shows.tmdbId,
            title: shows.title,
        })
        .from(jellyfinDeleteQueue)
        .innerJoin(shows, eq(shows.id, jellyfinDeleteQueue.showId))
        .where(eq(jellyfinDeleteQueue.userId, userId));

    const wholeShowEntries = pendingEntries.filter((e) => e.seasonNumber === null);
    const seasonEntries = pendingEntries.filter((e) => e.seasonNumber !== null);

    // Delete whole shows first; track which showIds were handled so we skip stray season entries
    const handledShowIds = new Set<number>();
    for (const entry of wholeShowEntries) {
        try {
            const found = await deleteJellyfinSeries(cfg, entry.tmdbId, autoDeleteIds);
            console.log(
                `[jellyfin-delete] ${found ? "Deleted" : "Not found"} series "${entry.title}" (TMDB ${entry.tmdbId}) for user ${userId}`,
            );
            deleted++;
        } catch (e) {
            console.error(
                `[jellyfin-delete] Failed to delete series "${entry.title}" for user ${userId}:`,
                e,
            );
        }
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
        try {
            const found = await deleteJellyfinSeason(cfg, entry.tmdbId, season, autoDeleteIds);
            console.log(
                `[jellyfin-delete] ${found ? "Deleted" : "Not found"} S${season} of "${entry.title}" for user ${userId}`,
            );
            deleted++;
        } catch (e) {
            console.error(
                `[jellyfin-delete] Failed to delete S${season} of "${entry.title}" for user ${userId}:`,
                e,
            );
        }
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
    //     All aired episodes in the season are watched + last aired > 7 days ago
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

        const seasonStats = await db
            .select({
                showId: episodes.showId,
                seasonNumber: episodes.seasonNumber,
                totalAired: sql<number>`cast(count(distinct ${episodes.id}) as integer)`,
                watched: sql<number>`cast(count(distinct ${watchHistory.episodeId}) as integer)`,
                lastAirDate: sql<string | null>`max(${episodes.airDate})`,
            })
            .from(episodes)
            .leftJoin(
                watchHistory,
                and(
                    eq(watchHistory.episodeId, episodes.id),
                    eq(watchHistory.userId, userId),
                    eq(watchHistory.mediaType, "episode"),
                ),
            )
            .where(
                and(
                    inArray(episodes.showId, userShowIds),
                    gt(episodes.seasonNumber, 0),
                    isNotNull(episodes.airDate),
                    lte(episodes.airDate, today),
                ),
            )
            .groupBy(episodes.showId, episodes.seasonNumber);

        for (const stat of seasonStats) {
            if (
                stat.totalAired > 0 &&
                stat.watched >= stat.totalAired &&
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
