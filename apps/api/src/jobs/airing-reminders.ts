import {
    getDb,
    pushSubscriptions,
    episodes,
    shows,
    userShowProgress,
    watchHistory,
} from "@trakt-dashboard/db";
import { and, eq, gte, lt, asc, sql } from "drizzle-orm";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { sendPush } from "../lib/push.js";

dayjs.extend(utc);

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Daily airing-reminder digest (N2-T05). For every user that has push
 * subscriptions, finds episodes from their tracked shows airing *today* and
 * sends a single language-neutral push (show titles + episode codes). Notifying
 * on the air day (run once daily) keeps it dedup-free. Dead subscriptions
 * (404/410) are pruned. Returns counts for observability/tests.
 */
export async function runAiringReminders(): Promise<{ sent: number; pruned: number }> {
    const db = getDb();

    // Step 1: find all distinct userIds that have at least one subscription.
    // Selecting only userId (not p256dh/auth) keeps this initial probe lightweight
    // even when the total subscription count is large.
    const userIdRows = await db
        .select({ userId: pushSubscriptions.userId })
        .from(pushSubscriptions);
    if (userIdRows.length === 0) return { sent: 0, pruned: 0 };

    const subscribedUserIds = [...new Set(userIdRows.map((r) => r.userId))];

    // Step 2: use UTC so the date window is timezone-consistent regardless of
    // which timezone the server process runs in.
    const today = dayjs.utc().format("YYYY-MM-DD");
    const tomorrow = dayjs.utc().add(1, "day").format("YYYY-MM-DD");

    let sent = 0;
    let pruned = 0;

    // Step 3: query airing episodes per user, then load subscriptions only for
    // users that actually have episodes today. Sequential DB queries keep load
    // predictable; push sends within a user are parallelised.
    for (const userId of subscribedUserIds) {
        const airing = await db
            .select({
                title: episodes.title,
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
                showTitle: shows.title,
            })
            .from(episodes)
            .innerJoin(shows, eq(episodes.showId, shows.id))
            .innerJoin(userShowProgress, eq(shows.id, userShowProgress.showId))
            .where(
                and(
                    eq(userShowProgress.userId, userId),
                    gte(episodes.airDate, today),
                    lt(episodes.airDate, tomorrow),
                    sql`NOT EXISTS (
                    SELECT 1 FROM ${watchHistory}
                    WHERE ${watchHistory.episodeId} = ${episodes.id}
                      AND ${watchHistory.userId} = ${userId}
                )`,
                ),
            )
            .orderBy(asc(shows.title));

        if (airing.length === 0) continue;

        // Only fetch endpoint keys for this user after confirming they have
        // airing episodes — avoids loading keys for inactive users.
        const userSubs = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, userId));

        const first = airing[0];
        const payload =
            airing.length === 1
                ? {
                      title: first.showTitle,
                      body: `S${pad(first.seasonNumber)}E${pad(first.episodeNumber)}${
                          first.title ? ` · ${first.title}` : ""
                      }`,
                      url: "/calendar",
                  }
                : (() => {
                      // Compute only for multi-episode cases to avoid wasted allocation
                      // when there is exactly one airing episode.
                      const distinctShows = new Set(airing.map((e) => e.showTitle));
                      const shown = airing.slice(0, 4);
                      const overflow = airing.length - shown.length;
                      const overflowSuffix = overflow > 0 ? ` +${overflow}` : "";
                      if (distinctShows.size === 1) {
                          // Multiple episodes from the same show — omit redundant show prefix.
                          return {
                              title: first.showTitle,
                              body:
                                  shown
                                      .map((e) => `S${pad(e.seasonNumber)}E${pad(e.episodeNumber)}`)
                                      .join(" · ") + overflowSuffix,
                              url: "/calendar",
                          };
                      }
                      // Multiple shows — title shows first show + count of additional shows.
                      return {
                          title: `${first.showTitle} +${distinctShows.size - 1}`,
                          body:
                              shown
                                  .map(
                                      (e) =>
                                          `${e.showTitle} S${pad(e.seasonNumber)}E${pad(e.episodeNumber)}`,
                                  )
                                  .join(" · ") + overflowSuffix,
                          url: "/calendar",
                      };
                  })();

        // Parallelise sends across subscriptions for this user. Each send is
        // individually caught so an unexpected sendPush rejection (e.g. VAPID
        // init error) does not abort the entire user's batch.
        const results = await Promise.all(
            userSubs.map((sub) =>
                sendPush(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload,
                )
                    .then((res) => ({ sub, res }))
                    .catch(() => ({ sub, res: { ok: false as const, statusCode: undefined } })),
            ),
        );

        for (const { sub, res } of results) {
            if (res.ok) {
                sent++;
            } else if (res.statusCode === 404 || res.statusCode === 410) {
                await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                pruned++;
            }
        }
    }

    return { sent, pruned };
}
