import { Hono } from "hono";
import { getDb, shows } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import { getTraktClient } from "../services/trakt.js";
import type { NowPlayingEpisode } from "@trakt-dashboard/types";

export const traktRoutes = new Hono<{ Variables: { userId: number } }>();

// GET /api/trakt/watching
traktRoutes.get("/watching", async (c) => {
    const userId = c.get("userId");

    try {
        const trakt = getTraktClient();
        const watching = await trakt.getWatching(userId);

        if (!watching || watching.type !== "episode") {
            return c.json({ data: null });
        }

        // Look up posterPath from local DB by traktSlug (avoids extra TMDB call)
        const slug = watching.show.ids.slug;
        let posterPath: string | null = null;
        if (slug) {
            const db = getDb();
            const [row] = await db
                .select({ posterPath: shows.posterPath })
                .from(shows)
                .where(eq(shows.traktSlug, slug));
            posterPath = row?.posterPath ?? null;
        }

        const result: NowPlayingEpisode = {
            show: {
                title: watching.show.title,
                posterPath,
                traktSlug: slug ?? null,
            },
            episode: {
                seasonNumber: watching.episode.season,
                episodeNumber: watching.episode.number,
                title: watching.episode.title,
            },
            expiresAt: watching.expires_at,
            runtime: watching.episode.runtime,
        };

        return c.json({ data: result });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[trakt/watching]", message);
        return c.json({ error: "Failed to fetch now playing data" }, 502);
    }
});
