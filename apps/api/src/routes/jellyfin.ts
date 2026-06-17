import { Hono } from "hono";
import { getDb, userSettings } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import {
    fetchJellyfinLibraries,
    findJellyfinEpisode,
    deleteJellyfinItem,
} from "../services/jellyfin.js";
import { parseBoundedInt } from "../lib/number.js";

export const jellyfinRoutes = new Hono<{ Variables: { userId: number } }>();

async function getJellyfinConfig(userId: number) {
    const db = getDb();
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    if (!row?.jellyfinUrl || !row?.jellyfinApiKey) return null;
    return { url: row.jellyfinUrl, apiKey: row.jellyfinApiKey };
}

// GET /api/jellyfin/libraries
jellyfinRoutes.get("/libraries", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    try {
        const libraries = await fetchJellyfinLibraries(cfg);
        return c.json({ data: libraries });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// GET /api/jellyfin/episode/:showTmdbId/:season/:episode
jellyfinRoutes.get("/episode/:showTmdbId/:season/:episode", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const showTmdbId = parseBoundedInt(c.req.param("showTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    const season = parseBoundedInt(c.req.param("season"), -1, 0, 1000);
    const episode = parseBoundedInt(c.req.param("episode"), -1, 1, 1000);

    if (showTmdbId < 1 || season < 0 || episode < 1) {
        return c.json({ error: "Invalid parameters" }, 400);
    }

    try {
        const ep = await findJellyfinEpisode(cfg, showTmdbId, season, episode);
        return c.json({ data: ep });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});

// DELETE /api/jellyfin/items/:jellyfinItemId
jellyfinRoutes.delete("/items/:jellyfinItemId", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const itemId = c.req.param("jellyfinItemId");
    if (!itemId) return c.json({ error: "Missing item ID" }, 400);

    try {
        await deleteJellyfinItem(cfg, itemId);
        return c.json({ ok: true });
    } catch (err) {
        return c.json({ error: String(err) }, 502);
    }
});
