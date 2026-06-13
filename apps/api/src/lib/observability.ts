import { randomUUID } from "node:crypto";
import { getDb, syncRuns } from "@trakt-dashboard/db";
import { desc, eq, lt, sql } from "drizzle-orm";

// Structured sync observability (N4-T03).
//
// In-memory accumulator (unchanged from P2-T05) + DB persistence on finalization.
// Sync runs are serialized (BullMQ concurrency 1), so one process-wide "current run"
// accumulator is sufficient. On endSyncRun(), a summary row is written to sync_runs and
// older rows beyond the 100-row retention limit are pruned.

export interface SyncRunMetrics {
    runId: string;
    startedAt: string; // ISO
    finishedAt: string | null;
    durationMs: number | null;
    providerCalls: { tmdb: number; trakt: number; total: number };
    retries: number;
    rateLimited: number; // count of 429 responses observed
    phases: Record<string, number>; // phase name -> duration ms
    errors: number;
}

export interface SyncRunSummary {
    id: number;
    userId: number;
    startedAt: string;
    finishedAt: string | null;
    type: string;
    status: string;
    tmdbRequests: number;
    traktRequests: number;
    retryCount: number;
    errorCount: number;
    durationMs: number | null;
}

const RETENTION_LIMIT = 100;

let current: SyncRunMetrics | null = null;
let lastCompleted: SyncRunMetrics | null = null;

export function startSyncRun(): SyncRunMetrics {
    current = {
        runId: randomUUID(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        providerCalls: { tmdb: 0, trakt: 0, total: 0 },
        retries: 0,
        rateLimited: 0,
        phases: {},
        errors: 0,
    };
    return current;
}

export function endSyncRun(): SyncRunMetrics | null {
    if (!current) return null;
    current.finishedAt = new Date().toISOString();
    current.durationMs = Date.now() - Date.parse(current.startedAt);
    lastCompleted = current;
    current = null;
    return lastCompleted;
}

/**
 * Persist the completed run to the DB (fire-and-forget).
 * Called after endSyncRun(); pass the userId from the sync context.
 */
export async function finalizeSyncRun(
    userId: number,
    type: "full" | "incremental" = "full",
): Promise<void> {
    const run = lastCompleted;
    if (!run) return;
    try {
        const db = getDb();

        await db.insert(syncRuns).values({
            userId,
            startedAt: new Date(run.startedAt),
            finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
            type,
            status: run.errors > 0 ? "error" : "completed",
            tmdbRequests: run.providerCalls.tmdb,
            traktRequests: run.providerCalls.trakt,
            retryCount: run.retries,
            errorCount: run.errors,
            durationMs: run.durationMs,
        });

        // Prune rows beyond retention limit
        const countResult = await db
            .select({ cnt: sql<number>`count(*)::int` })
            .from(syncRuns)
            .where(eq(syncRuns.userId, userId));
        const cnt = countResult[0]?.cnt ?? 0;
        if (cnt > RETENTION_LIMIT) {
            const cutoff = await db
                .select({ id: syncRuns.id })
                .from(syncRuns)
                .where(eq(syncRuns.userId, userId))
                .orderBy(desc(syncRuns.startedAt))
                .limit(1)
                .offset(RETENTION_LIMIT - 1);
            if (cutoff[0]) {
                await db
                    .delete(syncRuns)
                    .where(
                        sql`${syncRuns.userId} = ${userId} AND ${syncRuns.id} < ${cutoff[0].id}`,
                    );
            }
        }
    } catch (err) {
        console.warn("[observability] Failed to persist sync run:", err);
    }
}

/** Return the most recent N sync run summaries for a user from the DB. */
export async function getRecentSyncRuns(userId: number, limit = 5): Promise<SyncRunSummary[]> {
    try {
        const db = getDb();
        const rows = await db
            .select()
            .from(syncRuns)
            .where(eq(syncRuns.userId, userId))
            .orderBy(desc(syncRuns.startedAt))
            .limit(limit);

        return rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            startedAt: r.startedAt.toISOString(),
            finishedAt: r.finishedAt?.toISOString() ?? null,
            type: r.type,
            status: r.status,
            tmdbRequests: r.tmdbRequests,
            traktRequests: r.traktRequests,
            retryCount: r.retryCount,
            errorCount: r.errorCount,
            durationMs: r.durationMs,
        }));
    } catch {
        return [];
    }
}

export function getCurrentRunId(): string | null {
    return current?.runId ?? null;
}

export function recordProviderCall(prefix: string | undefined): void {
    if (!current || !prefix) return;
    current.providerCalls.total += 1;
    if (prefix.startsWith("tmdb")) current.providerCalls.tmdb += 1;
    else if (prefix.startsWith("trakt")) current.providerCalls.trakt += 1;
}

export function recordRetry(): void {
    if (current) current.retries += 1;
}

export function recordRateLimited(): void {
    if (current) current.rateLimited += 1;
}

export function recordError(): void {
    if (current) current.errors += 1;
}

/** Run `fn`, recording its wall-clock duration under `phase` on the current run. */
export async function withPhase<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
        return await fn();
    } finally {
        if (current) {
            current.phases[phase] = (current.phases[phase] ?? 0) + (Date.now() - start);
        }
    }
}

export function getLastRunMetrics(): SyncRunMetrics | null {
    return lastCompleted;
}

export function getCurrentRunMetrics(): SyncRunMetrics | null {
    return current;
}
