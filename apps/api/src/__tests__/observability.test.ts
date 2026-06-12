import { describe, it, expect, beforeEach } from "vitest";
import {
    startSyncRun,
    endSyncRun,
    recordProviderCall,
    recordRetry,
    recordRateLimited,
    recordError,
    getLastRunMetrics,
    getCurrentRunMetrics,
} from "../lib/observability.js";

describe("sync observability (P2-T05)", () => {
    beforeEach(() => {
        // Ensure no run is active from a previous test.
        endSyncRun();
    });

    it("accumulates provider/retry/429/error counters for the active run", () => {
        const run = startSyncRun();
        expect(run.runId).toMatch(/[0-9a-f-]{36}/);

        recordProviderCall("tmdb");
        recordProviderCall("tmdb");
        recordProviderCall("trakt:refresh");
        recordRetry();
        recordRateLimited();
        recordError();

        const current = getCurrentRunMetrics();
        expect(current?.providerCalls).toEqual({ tmdb: 2, trakt: 1, total: 3 });
        expect(current?.retries).toBe(1);
        expect(current?.rateLimited).toBe(1);
        expect(current?.errors).toBe(1);
    });

    it("ignores counter calls when no run is active (no throw)", () => {
        endSyncRun();
        expect(() => {
            recordProviderCall("tmdb");
            recordRetry();
        }).not.toThrow();
        expect(getCurrentRunMetrics()).toBeNull();
    });

    it("finalizes a run into lastRun with a duration", () => {
        startSyncRun();
        recordProviderCall("trakt");
        const finished = endSyncRun();
        expect(finished).not.toBeNull();
        expect(finished?.finishedAt).not.toBeNull();
        expect(finished?.durationMs).toBeGreaterThanOrEqual(0);
        expect(getLastRunMetrics()?.runId).toBe(finished?.runId);
        expect(getCurrentRunMetrics()).toBeNull();
    });
});
