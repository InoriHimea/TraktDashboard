import { randomUUID } from "node:crypto";

// Structured sync observability (P2-T05).
//
// Sync runs are serialized (BullMQ worker concurrency 1), so a single process-wide "current
// run" accumulator is sufficient for this self-hosted app. Provider helpers increment the
// counters; the sync pipeline records phase durations. The last completed run is kept in
// memory and surfaced via GET /sync/health for production-safe diagnostics — no DB migration.

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
