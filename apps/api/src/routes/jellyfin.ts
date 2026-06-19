import { Hono } from "hono";
import { getDb, userSettings } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
    fetchJellyfinLibraries,
    findJellyfinEpisode,
    findJellyfinMovie,
    deleteJellyfinItem,
} from "../services/jellyfin.js";
import { parseBoundedInt } from "../lib/number.js";
import { decryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";
import { validateBody } from "../lib/validate.js";

export const jellyfinRoutes = new Hono<{ Variables: { userId: number } }>();

async function getJellyfinConfig(userId: number) {
    const db = getDb();
    try {
        const [row] = await db
            .select({
                jellyfinUrl: userSettings.jellyfinUrl,
                jellyfinApiKey: userSettings.jellyfinApiKey,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        if (!row?.jellyfinUrl || !row?.jellyfinApiKey) return null;
        const apiKey = decryptToken(row.jellyfinApiKey, resolveApiSecret());
        return { url: row.jellyfinUrl, apiKey };
    } catch {
        return null;
    }
}

// GET /api/jellyfin/libraries — uses stored (encrypted) credentials
jellyfinRoutes.get("/libraries", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    try {
        const libraries = await fetchJellyfinLibraries(cfg);
        return c.json({ data: libraries });
    } catch (err) {
        return c.json({ error: "Failed to fetch Jellyfin libraries" }, 502);
    }
});

const testLibrariesSchema = z.object({
    url: z.string().regex(/^https?:\/\//i, "url must be a valid http:// or https:// URL"),
    apiKey: z.string().min(1),
});

// POST /api/jellyfin/libraries — test arbitrary credentials (before saving to DB)
jellyfinRoutes.post("/libraries", async (c) => {
    const parsed = await validateBody(c, testLibrariesSchema);
    if (parsed instanceof Response) return parsed;
    const { url, apiKey } = parsed.data;

    try {
        const libraries = await fetchJellyfinLibraries({ url, apiKey });
        return c.json({ data: libraries });
    } catch (err) {
        return c.json({ error: "Failed to fetch Jellyfin libraries" }, 502);
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

// GET /api/jellyfin/movie/:movieTmdbId
jellyfinRoutes.get("/movie/:movieTmdbId", async (c) => {
    const userId = c.get("userId");
    const cfg = await getJellyfinConfig(userId);
    if (!cfg) return c.json({ error: "Jellyfin not configured" }, 503);

    const movieTmdbId = parseBoundedInt(c.req.param("movieTmdbId"), -1, 1, Number.MAX_SAFE_INTEGER);
    if (movieTmdbId < 1) return c.json({ error: "Invalid parameters" }, 400);

    try {
        const movie = await findJellyfinMovie(cfg, movieTmdbId);
        return c.json({ data: movie });
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
