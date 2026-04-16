import { Hono } from 'hono';
import { getDb, userSettings } from '@trakt-dashboard/db';
import { eq } from 'drizzle-orm';
export const settingsRoutes = new Hono();
const DEFAULTS = {
    displayLanguage: 'zh-CN',
    syncIntervalMinutes: 60,
    httpProxy: null,
};
// GET /api/settings
settingsRoutes.get('/', async (c) => {
    const userId = c.get('userId');
    const db = getDb();
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return c.json({
        data: {
            userId,
            displayLanguage: row?.displayLanguage ?? DEFAULTS.displayLanguage,
            syncIntervalMinutes: row?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
            httpProxy: row?.httpProxy ?? DEFAULTS.httpProxy,
        },
    });
});
// PUT /api/settings
settingsRoutes.put('/', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({}));
    const { displayLanguage, syncIntervalMinutes, httpProxy } = body;
    // Validate syncIntervalMinutes
    if (syncIntervalMinutes !== undefined) {
        const n = Number(syncIntervalMinutes);
        if (!Number.isInteger(n) || n < 1 || n > 10080) {
            return c.json({ error: 'syncIntervalMinutes must be an integer between 1 and 10080' }, 400);
        }
    }
    // Validate httpProxy
    if (httpProxy !== undefined && httpProxy !== null && httpProxy !== '') {
        if (!/^https?:\/\//i.test(httpProxy)) {
            return c.json({ error: 'httpProxy must be a valid http:// or https:// URL' }, 400);
        }
    }
    const db = getDb();
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    const newValues = {
        userId,
        displayLanguage: displayLanguage ?? existing?.displayLanguage ?? DEFAULTS.displayLanguage,
        syncIntervalMinutes: syncIntervalMinutes ?? existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
        httpProxy: httpProxy !== undefined ? (httpProxy || null) : (existing?.httpProxy ?? DEFAULTS.httpProxy),
        updatedAt: new Date(),
    };
    await db.insert(userSettings).values(newValues).onConflictDoUpdate({
        target: [userSettings.userId],
        set: {
            displayLanguage: newValues.displayLanguage,
            syncIntervalMinutes: newValues.syncIntervalMinutes,
            httpProxy: newValues.httpProxy,
            updatedAt: newValues.updatedAt,
        },
    });
    return c.json({ data: { ...newValues } });
});
//# sourceMappingURL=settings.js.map