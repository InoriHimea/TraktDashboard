import { getDb, pushSubscriptions, episodes, shows, userShowProgress } from "@trakt-dashboard/db";
import { and, eq, asc } from "drizzle-orm";
import dayjs from "dayjs";
import { sendPush } from "../lib/push.js";

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
    const subs = await db.select().from(pushSubscriptions);
    if (subs.length === 0) return { sent: 0, pruned: 0 };

    const today = dayjs().format("YYYY-MM-DD");

    const byUser = new Map<number, typeof subs>();
    for (const s of subs) {
        const list = byUser.get(s.userId) ?? [];
        list.push(s);
        byUser.set(s.userId, list);
    }

    let sent = 0;
    let pruned = 0;

    for (const [userId, userSubs] of byUser) {
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
            .where(and(eq(userShowProgress.userId, userId), eq(episodes.airDate, today)))
            .orderBy(asc(shows.title));

        if (airing.length === 0) continue;

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
                : {
                      title: `${first.showTitle} +${airing.length - 1}`,
                      body: airing
                          .slice(0, 4)
                          .map(
                              (e) =>
                                  `${e.showTitle} S${pad(e.seasonNumber)}E${pad(e.episodeNumber)}`,
                          )
                          .join(" · "),
                      url: "/calendar",
                  };

        for (const sub of userSubs) {
            const res = await sendPush(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
            );
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
