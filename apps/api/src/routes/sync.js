import { Hono } from "hono";
import { getDb, syncState, shows, watchHistory, userShowProgress, } from "@trakt-dashboard/db";
import { eq, sql } from "drizzle-orm";
import { triggerFullSync } from "../services/sync.js";
import { enqueueSyncNow } from "../jobs/scheduler.js";
export const syncRoutes = new Hono();
// GET /api/sync/status
syncRoutes.get("/status", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const [state] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.userId, userId));
    const failedShows = state?.failedShows || [];
    const alerts = failedShows.filter((f) => f.alert);
    const currentShowText = state?.currentShow || null;
    const currentIndexMatch = currentShowText?.match(/^\[(\d+)\/(\d+)\]/);
    const currentIndex = currentIndexMatch
        ? Number(currentIndexMatch[1])
        : null;
    return c.json({
        data: {
            status: state?.status || "idle",
            lastSyncAt: state?.lastSyncAt?.toISOString() || null,
            currentShow: currentShowText,
            currentIndex,
            progress: state?.progress || 0,
            total: state?.total || 0,
            error: state?.error || null,
            failedShows,
            successCount: Math.max((state?.progress || 0) - failedShows.length, 0),
            failedCount: failedShows.length,
            alerts,
            alertCount: alerts.length,
        },
    });
});
// GET /api/sync/debug - live counters for troubleshooting slow syncs
syncRoutes.get("/debug", async (c) => {
    if (process.env.NODE_ENV === "production") {
        return c.json({ error: "Not available in production" }, 404);
    }
    const userId = c.get("userId");
    const db = getDb();
    const [state] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.userId, userId));
    const [showCount] = await db
        .select({ count: sql `count(*)` })
        .from(shows);
    const [historyCount] = await db
        .select({ count: sql `count(*)` })
        .from(watchHistory)
        .where(eq(watchHistory.userId, userId));
    const [progressCount] = await db
        .select({ count: sql `count(*)` })
        .from(userShowProgress)
        .where(eq(userShowProgress.userId, userId));
    return c.json({
        data: {
            syncStatus: state?.status || "idle",
            currentShow: state?.currentShow || null,
            progress: state?.progress || 0,
            total: state?.total || 0,
            failedCount: state?.failedShows?.length || 0,
            dbCounts: {
                shows: Number(showCount?.count || 0),
                watchHistory: Number(historyCount?.count || 0),
                userShowProgress: Number(progressCount?.count || 0),
            },
            updatedAt: state?.updatedAt?.toISOString() || null,
        },
    });
});
// POST /api/sync/trigger — manual incremental sync
syncRoutes.post("/trigger", async (c) => {
    const userId = c.get("userId");
    await enqueueSyncNow(userId);
    return c.json({ ok: true, message: "Sync queued" });
});
// POST /api/sync/full — full re-sync
syncRoutes.post("/full", async (c) => {
    const userId = c.get("userId");
    triggerFullSync(userId).catch(console.error);
    return c.json({ ok: true, message: "Full sync started" });
});
//# sourceMappingURL=sync.js.map