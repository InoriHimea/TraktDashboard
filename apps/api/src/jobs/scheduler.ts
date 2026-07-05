import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { getDb, users, userSettings, metadataCache } from "@trakt-dashboard/db";
import { eq, lt } from "drizzle-orm";
import { triggerIncrementalSync, resetStaleRunningSyncs } from "../services/sync.js";
import { runScheduledBackup } from "../routes/backup.js";
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

/**
 * Upsert a scheduled job via BullMQ's Job Scheduler API (upsertJobScheduler). Unlike the
 * old `queue.add(..., { repeat })` + manual dedup pattern, this is a single atomic
 * update-in-place keyed by `schedulerId` — no listing/matching required, so it can never
 * silently fail to dedup and accumulate duplicates across restarts (see
 * purgeLegacyRepeatableJobs for why that used to happen).
 */
async function upsertScheduledJob(
    queue: Queue,
    schedulerId: string,
    jobName: string,
    data: Record<string, unknown>,
    repeatOpts: { pattern?: string; every?: number },
): Promise<void> {
    await queue.upsertJobScheduler(schedulerId, repeatOpts, {
        name: jobName,
        data,
        opts: { removeOnComplete: 10, removeOnFail: 5 },
    });
}

/**
 * One-time migration cleanup: jobs registered before this fix used `queue.add(..., {
 * repeat })` directly, deduped by listing `getRepeatableJobs()` and matching on `.id` —
 * but that field doesn't exist on this BullMQ version's repeatable-job objects, so the
 * match always missed and every restart added a fresh duplicate (confirmed in production:
 * airing-reminders and cleanup-cache each had 2 copies). Since every job is immediately
 * re-registered via upsertScheduledJob right after this runs, wiping all legacy
 * repeatable-job metadata here is safe — nothing is left unregistered.
 */
async function purgeLegacyRepeatableJobs(queue: Queue): Promise<void> {
    try {
        const legacy = await queue.getRepeatableJobs();
        for (const job of legacy) {
            await queue.removeRepeatableByKey(job.key);
        }
        if (legacy.length > 0) {
            console.log(`[scheduler] Purged ${legacy.length} legacy repeatable job(s)`);
        }
    } catch (e) {
        console.warn(`[scheduler] Could not purge legacy repeatable jobs:`, e);
    }
}

export async function registerUserBackupJob(userId: number) {
    const db = getDb();
    const [row] = await db
        .select({ backupScheduleHours: userSettings.backupScheduleHours })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
    const hours = row?.backupScheduleHours ?? 0;
    const queue = getSyncQueue();
    const schedulerId = `backup-user-${userId}`;
    if (hours <= 0) {
        await queue.removeJobScheduler(schedulerId).catch(() => {
            // Best-effort removal — fine if there was nothing to remove.
        });
        return;
    }
    try {
        await upsertScheduledJob(
            queue,
            schedulerId,
            "scheduled-backup",
            { userId },
            {
                every: hours * 60 * 60 * 1000,
            },
        );
        console.log(`[scheduler] Registered backup job for user ${userId} every ${hours}h`);
    } catch (e) {
        console.warn(`[scheduler] Could not register backup job for user ${userId}:`, e);
    }
}

export async function registerUserSyncJob(userId: number) {
    const queue = getSyncQueue();
    const intervalMinutes = await getUserSyncInterval(userId);
    const schedulerId = `sync-user-${userId}`;
    try {
        await upsertScheduledJob(
            queue,
            schedulerId,
            "incremental-sync",
            { userId },
            {
                every: intervalMinutes * 60 * 1000,
            },
        );
    } catch (e) {
        console.warn(`[scheduler] Could not register sync job for user ${userId}:`, e);
        return;
    }
    console.log(
        `[scheduler] Registered sync job for user ${userId} every ${intervalMinutes} minutes`,
    );
}

export async function startScheduler() {
    const redis = getRedis();
    const queue = getSyncQueue();

    // Reset any sync states left in "running" from a previous crashed/killed process
    await resetStaleRunningSyncs();
    await purgeLegacyRepeatableJobs(queue);

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
                    throw e;
                }
            } else if (job.name === "scheduled-backup") {
                const { userId } = job.data as { userId: number };
                console.log(`[scheduler] Running scheduled backup for user ${userId}`);
                await runScheduledBackup(userId).catch((e) =>
                    console.error(`[scheduler] Scheduled backup failed for user ${userId}:`, e),
                );
            } else if (job.name === "jellyfin-auto-delete") {
                try {
                    const { runJellyfinAutoDelete } = await import("./jellyfin-auto-delete.js");
                    const { deleted, queued } = await runJellyfinAutoDelete();
                    console.log(
                        `[scheduler] Jellyfin auto-delete: deleted=${deleted} queued=${queued}`,
                    );
                } catch (e) {
                    console.error(`[scheduler] Jellyfin auto-delete failed:`, e);
                    throw e;
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
        await registerUserBackupJob(user.id);
    }

    // Register daily metadata cache cleanup job — cron anchors the time to
    // 03:00 UTC so it doesn't drift on every restart the way repeat.every would.
    try {
        await upsertScheduledJob(
            queue,
            "cleanup-metadata-cache",
            "cleanup-cache",
            {},
            {
                pattern: "0 3 * * *",
            },
        );
        console.log(`[scheduler] Registered daily metadata cache cleanup job`);
    } catch (e) {
        console.error(`[scheduler] Failed to register cleanup job:`, e);
    }

    // Register daily airing-reminder digest job (N2-T05) — 08:00 UTC daily.
    try {
        await upsertScheduledJob(
            queue,
            "airing-reminders-daily",
            "airing-reminders",
            {},
            {
                pattern: "0 8 * * *",
            },
        );
        console.log(`[scheduler] Registered daily airing-reminder job`);
    } catch (e) {
        console.error(`[scheduler] Failed to register airing-reminder job:`, e);
    }

    // Register daily Jellyfin auto-delete job — 04:00 UTC daily.
    try {
        await upsertScheduledJob(
            queue,
            "jellyfin-auto-delete-daily",
            "jellyfin-auto-delete",
            {},
            {
                pattern: "0 4 * * *",
            },
        );
        console.log(`[scheduler] Registered daily Jellyfin auto-delete job`);
    } catch (e) {
        console.error(`[scheduler] Failed to register Jellyfin auto-delete job:`, e);
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
