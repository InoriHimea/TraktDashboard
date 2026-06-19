import {
    getDb,
    pushSubscriptions,
    episodes,
    shows,
    seasons,
    userShowProgress,
    userSettings,
    watchHistory,
} from "@trakt-dashboard/db";
import { and, eq, gte, lt, asc, sql } from "drizzle-orm";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { sendPush } from "../lib/push.js";

dayjs.extend(utc);

const pad = (n: number) => String(n).padStart(2, "0");

const ALL_EVENT_TYPES = ["series_premiere", "season_premiere", "finale", "regular"] as const;
type EventType = (typeof ALL_EVENT_TYPES)[number];

const DEFAULT_EVENT_TYPES: EventType[] = [
    "series_premiere",
    "season_premiere",
    "finale",
    "regular",
];

function parseEventTypes(raw: string | null | undefined): EventType[] {
    if (!raw) return DEFAULT_EVENT_TYPES;
    try {
        const parsed = JSON.parse(raw) as unknown[];
        const valid = parsed.filter(
            (v): v is EventType =>
                typeof v === "string" && (ALL_EVENT_TYPES as readonly string[]).includes(v),
        );
        return valid.length > 0 ? valid : DEFAULT_EVENT_TYPES;
    } catch {
        return DEFAULT_EVENT_TYPES;
    }
}

function classifyEpisode(
    seasonNumber: number,
    episodeNumber: number,
    seasonEpisodeCount: number | null,
): EventType {
    if (seasonNumber === 1 && episodeNumber === 1) return "series_premiere";
    if (episodeNumber === 1) return "season_premiere";
    if (seasonEpisodeCount != null && episodeNumber === seasonEpisodeCount) return "finale";
    return "regular";
}

/**
 * Daily airing-reminder digest (N2-T05 / F02). Finds episodes airing today,
 * classifies each as series_premiere / season_premiere / finale / regular,
 * and filters by the user's notificationEventTypes setting before sending.
 */
export async function runAiringReminders(): Promise<{ sent: number; pruned: number }> {
    const db = getDb();

    const userIdRows = await db
        .select({ userId: pushSubscriptions.userId })
        .from(pushSubscriptions);
    if (userIdRows.length === 0) return { sent: 0, pruned: 0 };

    const subscribedUserIds = [...new Set(userIdRows.map((r) => r.userId))];

    const today = dayjs.utc().format("YYYY-MM-DD");
    const tomorrow = dayjs.utc().add(1, "day").format("YYYY-MM-DD");

    let sent = 0;
    let pruned = 0;

    for (const userId of subscribedUserIds) {
        const [settingsRow] = await db
            .select({ notificationEventTypes: userSettings.notificationEventTypes })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        const enabledTypes = parseEventTypes(settingsRow?.notificationEventTypes);

        const airingRaw = await db
            .select({
                title: episodes.title,
                seasonNumber: episodes.seasonNumber,
                episodeNumber: episodes.episodeNumber,
                showTitle: shows.title,
                seasonEpisodeCount: seasons.episodeCount,
            })
            .from(episodes)
            .innerJoin(shows, eq(episodes.showId, shows.id))
            .innerJoin(userShowProgress, eq(shows.id, userShowProgress.showId))
            .leftJoin(
                seasons,
                and(eq(seasons.showId, shows.id), eq(seasons.seasonNumber, episodes.seasonNumber)),
            )
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

        const airing = airingRaw.filter((ep) => {
            const type = classifyEpisode(ep.seasonNumber, ep.episodeNumber, ep.seasonEpisodeCount);
            return enabledTypes.includes(type);
        });

        if (airing.length === 0) continue;

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
                      const distinctShows = new Set(airing.map((e) => e.showTitle));
                      const shown = airing.slice(0, 4);
                      const overflow = airing.length - shown.length;
                      const overflowSuffix = overflow > 0 ? ` +${overflow}` : "";
                      if (distinctShows.size === 1) {
                          return {
                              title: first.showTitle,
                              body:
                                  shown
                                      .map((e) => `S${pad(e.seasonNumber)}E${pad(e.episodeNumber)}`)
                                      .join(" · ") + overflowSuffix,
                              url: "/calendar",
                          };
                      }
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
