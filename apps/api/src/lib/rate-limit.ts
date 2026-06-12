// Per-provider token-bucket rate limiting.
//
// Full sync fans out many TMDB/Trakt requests (per-show, per-season, per-language).
// A shared token bucket per provider smooths those bursts into a sustained rate so we
// stay under provider limits and avoid 429 storms. The bucket is process-wide and shared
// across all concurrent sync work for a given provider.

export interface RateLimiter {
    acquire(): Promise<void>;
}

export interface TokenBucketOptions {
    /** Maximum number of tokens (burst size). */
    capacity: number;
    /** Sustained refill rate in tokens per second. */
    refillPerSecond: number;
    /** Injectable clock (ms). Defaults to Date.now. Used for deterministic tests. */
    now?: () => number;
    /** Injectable sleep. Defaults to setTimeout. Used for deterministic tests. */
    sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

export class TokenBucket implements RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillPerSecond: number;
    private readonly now: () => number;
    private readonly sleep: (ms: number) => Promise<void>;
    // Serializes waiters so concurrent acquire() calls drain the bucket fairly
    // instead of all observing the same refilled token.
    private queue: Promise<void> = Promise.resolve();

    constructor(opts: TokenBucketOptions) {
        this.capacity = Math.max(1, opts.capacity);
        this.refillPerSecond = Math.max(0.0001, opts.refillPerSecond);
        this.now = opts.now ?? Date.now;
        this.sleep = opts.sleep ?? defaultSleep;
        this.tokens = this.capacity;
        this.lastRefill = this.now();
    }

    private refill(): void {
        const now = this.now();
        const elapsedSec = (now - this.lastRefill) / 1000;
        if (elapsedSec > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSecond);
            this.lastRefill = now;
        }
    }

    async acquire(): Promise<void> {
        // Chain onto the queue so waiters are served in order and don't double-spend tokens.
        const run = this.queue.then(() => this.takeToken());
        // Swallow rejection on the chained promise so one failure doesn't poison the queue.
        this.queue = run.catch(() => {});
        return run;
    }

    private async takeToken(): Promise<void> {
        for (;;) {
            this.refill();
            if (this.tokens >= 1) {
                this.tokens -= 1;
                return;
            }
            const deficit = 1 - this.tokens;
            const waitMs = Math.max(1, Math.ceil((deficit / this.refillPerSecond) * 1000));
            await this.sleep(waitMs);
        }
    }
}

// ─── Per-provider registry ──────────────────────────────────────────────────────

export type ProviderName = "tmdb" | "trakt";

const registry = new Map<ProviderName, TokenBucket>();

function numFromEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Defaults are conservative relative to documented provider ceilings
// (TMDB ~50 req/s, Trakt ~1k/5min). Override via env in tight environments.
const PROVIDER_DEFAULTS: Record<
    ProviderName,
    { burstEnv: string; rateEnv: string; burst: number; rate: number }
> = {
    tmdb: {
        burstEnv: "TMDB_RATE_LIMIT_BURST",
        rateEnv: "TMDB_RATE_LIMIT_PER_SEC",
        burst: 20,
        rate: 20,
    },
    trakt: {
        burstEnv: "TRAKT_RATE_LIMIT_BURST",
        rateEnv: "TRAKT_RATE_LIMIT_PER_SEC",
        burst: 8,
        rate: 4,
    },
};

export function getProviderRateLimiter(provider: ProviderName): TokenBucket {
    let bucket = registry.get(provider);
    if (!bucket) {
        const cfg = PROVIDER_DEFAULTS[provider];
        bucket = new TokenBucket({
            capacity: numFromEnv(cfg.burstEnv, cfg.burst),
            refillPerSecond: numFromEnv(cfg.rateEnv, cfg.rate),
        });
        registry.set(provider, bucket);
    }
    return bucket;
}

/** Test helper: clears cached provider buckets so env overrides re-apply. */
export function __resetProviderRateLimiters(): void {
    registry.clear();
}
