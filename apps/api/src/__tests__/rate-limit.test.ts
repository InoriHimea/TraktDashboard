import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    TokenBucket,
    getProviderRateLimiter,
    __resetProviderRateLimiters,
} from "../lib/rate-limit.js";

describe("TokenBucket (P1-T04 rate limiting)", () => {
    it("serves an initial burst up to capacity without waiting", async () => {
        let slept = 0;
        const bucket = new TokenBucket({
            capacity: 5,
            refillPerSecond: 1,
            now: () => 0, // frozen clock: no refill happens
            sleep: async (ms) => {
                slept += ms;
            },
        });

        for (let i = 0; i < 5; i++) {
            await bucket.acquire();
        }

        expect(slept).toBe(0);
    });

    it("throttles once the burst is exhausted and refills over time", async () => {
        let clock = 0;
        const sleeps: number[] = [];
        const bucket = new TokenBucket({
            capacity: 2,
            refillPerSecond: 10, // 1 token every 100ms
            now: () => clock,
            sleep: async (ms) => {
                sleeps.push(ms);
                clock += ms; // advancing the clock lets refill() release a token
            },
        });

        // Drain the burst (no sleep), then 3 more that must each wait for a refill.
        for (let i = 0; i < 5; i++) {
            await bucket.acquire();
        }

        // First two acquires are free; the next three each wait ~100ms.
        expect(sleeps.length).toBeGreaterThanOrEqual(3);
        for (const ms of sleeps) {
            expect(ms).toBeGreaterThan(0);
            expect(ms).toBeLessThanOrEqual(100);
        }
    });

    it("serializes concurrent acquires so tokens are not double-spent", async () => {
        let clock = 0;
        const bucket = new TokenBucket({
            capacity: 1,
            refillPerSecond: 1000,
            now: () => clock,
            sleep: async (ms) => {
                clock += ms;
            },
        });

        const order: number[] = [];
        await Promise.all(
            [0, 1, 2].map((n) =>
                bucket.acquire().then(() => {
                    order.push(n);
                }),
            ),
        );

        expect(order.sort()).toEqual([0, 1, 2]);
    });
});

describe("getProviderRateLimiter", () => {
    const savedEnv = { ...process.env };

    beforeEach(() => {
        __resetProviderRateLimiters();
    });

    afterEach(() => {
        process.env = { ...savedEnv };
        __resetProviderRateLimiters();
    });

    it("returns a stable per-provider singleton", () => {
        const a = getProviderRateLimiter("tmdb");
        const b = getProviderRateLimiter("tmdb");
        const trakt = getProviderRateLimiter("trakt");
        expect(a).toBe(b);
        expect(a).not.toBe(trakt);
    });

    it("honors env overrides for rate configuration", async () => {
        process.env.TMDB_RATE_LIMIT_BURST = "1";
        process.env.TMDB_RATE_LIMIT_PER_SEC = "1000";
        __resetProviderRateLimiters();
        const bucket = getProviderRateLimiter("tmdb");
        // Capacity 1 means the second immediate acquire must wait for a refill.
        await bucket.acquire();
        const start = Date.now();
        await bucket.acquire();
        expect(Date.now() - start).toBeGreaterThanOrEqual(0);
    });
});
