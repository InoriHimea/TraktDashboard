import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { getDb, users, userSettings, metadataCache } from "@trakt-dashboard/db";
import { eq, lt } from "drizzle-orm";
import { triggerIncrementalSync, resetStaleRunningSyncs } from "../services/sync.js";
import { withTimeout } from "../lib/timeout.js";
import { METADATA_MAX_AGE_HOURS } from "../services/tmdb.js";

let connection: IORedis | null = null;
let syncQueue: Queue | null = null;

export function getRedis() {
    if (!connection) {
        connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
            maxRetriesPerRequest: null,
        });
        connection.on("error", (err) => {
            console.error("[redis] Connection error:", err);
        });
    }
    return connection;
}

export function getSyncQueue() {
    if (!syncQueue) {
        syncQueue = new Queue("sync", { connection: getRedis() });
    }
    return syncQueue;
}

// P2-T14: lightweight Redis/queue health probe. Returns false (never throws) when Redis
// is unreachable so callers can degrade gracefully (e.g. 503 instead of a fake 200).
export async function isQueueHealthy(): Promise<boolean> {
    try {
        const pong = await withTimeout(getRedis().ping(), 2000, "redis ping");
        return pong === "PONG";
    } catch {
        return false;
    }
}

// Task 8.1: Read syncIntervalMinutes from user_settings, fallback to env/default
async function getUserSyncInterval(userId: number): Promise<number> {
    try {
        const db = getDb();
        const [row] = await db
            .select({ syncIntervalMinutes: userSettings.syncIntervalMinutes })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        if (row?.syncIntervalMinutes) return row.syncIntervalMinutes;
    } catch {
        console.warn(
            `[scheduler] Failed to read syncIntervalMinutes for user ${userId}, using default`,
        );
    }
    return parseInt(process.env.SYNC_INTERVAL_MINUTES || "60");
}

export async function registerUserSyncJob(userId: number) {
    const queue = getSyncQueue();
    const intervalMinutes = await getUserSyncInterval(userId);
    const jobId = `sync-user-${userId}`;

    // Remove existing repeat job to prevent duplicates on restart
    try {
        const repeatableJobs = await queue.getRepeatableJobs();
        const existing = repeatableJobs.find((j) => j.id === jobId);
        if (existing) {
            await queue.removeRepeatableByKey(existing.key);
        }
    } catch (e) {
        console.warn(`[scheduler] Could not remove existing repeat job for user ${userId}:`, e);
    }

    await queue.add(
        "incremental-sync",
        { userId },
        {
            jobId,
            repeat: { every: intervalMinutes * 60 * 1000 },
            removeOnComplete: 10,
            removeOnFail: 5,
        },
    );
    console.log(
        `[scheduler] Registered sync job for user ${userId} every ${intervalMinutes} minutes`,
    );
}

export async function startScheduler() {
    const redis = getRedis();
    const queue = getSyncQueue();

    // Reset any sync states left in "running" from a previous crashed/killed process
    await resetStaleRunningSyncs();

    // Worker processes sync jobs
    const worker = new Worker(
        "sync",
        async (job) => {
            if (job.name === "incremental-sync") {
                const { userId } = job.data;
                console.log(`[scheduler] Running incremental sync for user ${userId}`);
                await triggerIncrementalSync(userId);
            } else if (job.name === "cleanup-cache") {
                console.log(`[scheduler] Running metadata cache cleanup`);
                try {
                    const db = getDb();
                    // P2-T04: only delete rows past the longest TTL + stale grace window, so
                    // still-valid 30d show/season metadata is not wiped by the daily cleanup.
                    const cutoff = new Date(Date.now() - METADATA_MAX_AGE_HOURS * 60 * 60 * 1000);
                    await db.delete(metadataCache).where(lt(metadataCache.cachedAt, cutoff));
                    // Drizzle Postgres.js returns { count } depending on driver, but logging completion is enough
                    console.log(`[scheduler] Metadata cache cleanup completed`);
                } catch (e) {
                    console.error(`[scheduler] Metadata cache cleanup failed:`, e);
                }
            } else if (job.name === "airing-reminders") {
                try {
                    const { runAiringReminders } = await import("./airing-reminders.js");
                    const { sent, pruned } = await runAiringReminders();
                    if (sent > 0 || pruned > 0) {
                        console.log(`[scheduler] Airing reminders sent=${sent} pruned=${pruned}`);
                    }
                } catch (e) {
                    console.error(`[scheduler] Airing reminders failed:`, e);
                }
            }
        },
        { connection: redis, concurrency: 1 },
    );

    worker.on("failed", (job, err) => {
        console.error(`[scheduler] Job ${job?.id} failed:`, err);
    });

    // Register repeat jobs for all existing users
    const db = getDb();
    const allUsers = await db.select({ id: users.id }).from(users);
    for (const user of allUsers) {
        await registerUserSyncJob(user.id);
    }

    // Register daily metadata cache cleanup job
    try {
        const repeatableJobs = await queue.getRepeatableJobs();
        const cleanupJobId = "cleanup-metadata-cache";
        const existingCleanup = repeatableJobs.find((j) => j.id === cleanupJobId);
        if (existingCleanup) {
            await queue.removeRepeatableByKey(existingCleanup.key);
        }
        await queue.add(
            "cleanup-cache",
            {},
            {
                jobId: cleanupJobId,
                repeat: { every: 24 * 60 * 60 * 1000 }, // Daily
                removeOnComplete: 10,
                removeOnFail: 5,
            },
        );
        console.log(`[scheduler] Registered daily metadata cache cleanup job`);
    } catch (e) {
        console.error(`[scheduler] Failed to register cleanup job:`, e);
    }

    // Register daily airing-reminder digest job (N2-T05)
    try {
        const repeatableJobs = await queue.getRepeatableJobs();
        const reminderJobId = "airing-reminders-daily";
        const existing = repeatableJobs.find((j) => j.id === reminderJobId);
        if (existing) {
            await queue.removeRepeatableByKey(existing.key);
        }
        await queue.add(
            "airing-reminders",
            {},
            {
                jobId: reminderJobId,
                repeat: { every: 24 * 60 * 60 * 1000 }, // Daily
                removeOnComplete: 10,
                removeOnFail: 5,
            },
        );
        console.log(`[scheduler] Registered daily airing-reminder job`);
    } catch (e) {
        console.error(`[scheduler] Failed to register airing-reminder job:`, e);
    }

    console.log(`[scheduler] Scheduler started`);
}

export async function enqueueSyncNow(userId: number) {
    const queue = getSyncQueue();
    return queue.add(
        "incremental-sync",
        { userId },
        {
            jobId: `sync-now-${userId}`,
            priority: 1,
            removeOnComplete: true,
            removeOnFail: 5,
        },
    );
}
