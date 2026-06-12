import { Hono } from "hono";
import { getDb, syncState, shows, watchHistory, userShowProgress } from "@trakt-dashboard/db";
import { eq, sql } from "drizzle-orm";
import { getSyncStatus, triggerFullSync } from "../services/sync.js";
import { enqueueSyncNow, isQueueHealthy } from "../jobs/scheduler.js";
import { toIsoOrNull } from "../lib/datetime.js";
import { getLastRunMetrics, getCurrentRunMetrics } from "../lib/observability.js";

export const syncRoutes = new Hono<{ Variables: { userId: number } }>();

type FailedShow = {
    tmdbId: number;
    title: string;
    error: string;
    retryCount?: number;
    alert?: boolean;
    lastTriedAt?: string;
};

// GET /api/sync/status
syncRoutes.get("/status", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId));
    const failedShows = (state?.failedShows as FailedShow[] | undefined) || [];
    const alerts = failedShows.filter((f) => f.alert);
    const currentShowText = state?.currentShow || null;
    const currentIndexMatch = currentShowText?.match(/^\[(\d+)\/(\d+)\]/);
    const currentIndex = currentIndexMatch ? Number(currentIndexMatch[1]) : null;

    return c.json({
        data: {
            status: state?.status || "idle",
            lastSyncAt: toIsoOrNull(state?.lastSyncAt),
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

    const [state] = await db.select().from(syncState).where(eq(syncState.userId, userId));
    const [showCount] = await db.select({ count: sql<number>`count(*)` }).from(shows);
    const [historyCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(watchHistory)
        .where(eq(watchHistory.userId, userId));
    const [progressCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userShowProgress)
        .where(eq(userShowProgress.userId, userId));

    return c.json({
        data: {
            syncStatus: state?.status || "idle",
            currentShow: state?.currentShow || null,
            progress: state?.progress || 0,
            total: state?.total || 0,
            failedCount: (state?.failedShows as Array<unknown> | undefined)?.length || 0,
            dbCounts: {
                shows: Number(showCount?.count || 0),
                watchHistory: Number(historyCount?.count || 0),
                userShowProgress: Number(progressCount?.count || 0),
            },
            updatedAt: toIsoOrNull(state?.updatedAt),
        },
    });
});

// GET /api/sync/health — queue/Redis availability + last-run diagnostics (P2-T14, P2-T05)
syncRoutes.get("/health", async (c) => {
    const queueAvailable = await isQueueHealthy();
    return c.json(
        {
            data: {
                queueAvailable,
                currentRun: getCurrentRunMetrics(),
                lastRun: getLastRunMetrics(),
            },
        },
        queueAvailable ? 200 : 503,
    );
});

// POST /api/sync/trigger — manual incremental sync
syncRoutes.post("/trigger", async (c) => {
    const userId = c.get("userId");
    const state = await getSyncStatus(userId);
    if (state?.status === "running") {
        return c.json({ ok: false, message: "Sync already running", status: state }, 409);
    }

    // P2-T14: if the queue is down, surface 503 instead of a fake 200/202.
    try {
        await enqueueSyncNow(userId);
    } catch (e) {
        console.error("[sync] enqueue failed — queue unavailable:", e);
        return c.json(
            { ok: false, error: "queue_unavailable", message: "Sync queue is unavailable" },
            503,
        );
    }
    return c.json({ ok: true, message: "Sync queued" }, 202);
});

// POST /api/sync/full — full re-sync
syncRoutes.post("/full", async (c) => {
    const userId = c.get("userId");
    const state = await getSyncStatus(userId);
    if (state?.status === "running") {
        return c.json({ ok: false, message: "Sync already running", status: state }, 409);
    }

    triggerFullSync(userId).catch(console.error);
    return c.json({ ok: true, message: "Full sync started" }, 202);
});
