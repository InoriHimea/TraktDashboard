import type { RateLimiter } from "./rate-limit.js";
import { recordProviderCall, recordRateLimited, recordRetry } from "./observability.js";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503, 504];
const DEFAULT_RETRY_AFTER_SECONDS = 5;
const MAX_RETRY_AFTER_SECONDS = 60;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

export function parseRetryAfterSeconds(header: string | null): number {
    if (!header) {
        return DEFAULT_RETRY_AFTER_SECONDS;
    }

    const value = header.trim();
    if (!value) {
        return DEFAULT_RETRY_AFTER_SECONDS;
    }

    if (/^-?\d+$/.test(value)) {
        return clampRetryAfterSeconds(Number.parseInt(value, 10));
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return DEFAULT_RETRY_AFTER_SECONDS;
    }

    return clampRetryAfterSeconds(Math.ceil((timestamp - Date.now()) / 1000));
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildFetchOptions(proxyUrl?: string): RequestInit {
    return proxyUrl ? ({ proxy: proxyUrl } as RequestInit & { proxy: string }) : {};
}

export interface ProviderFetchOptions {
    url: string | URL;
    init?: RequestInit;
    timeoutMs?: number;
    maxRetries?: number;
    retryStatuses?: number[];
    proxyUrl?: string;
    prefix?: string;
    /** Optional per-provider rate limiter; awaited before each attempt. */
    rateLimiter?: RateLimiter;
}

export async function providerFetch(opts: ProviderFetchOptions): Promise<Response> {
    const {
        url,
        init,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxRetries = DEFAULT_MAX_RETRIES,
        retryStatuses = DEFAULT_RETRY_STATUSES,
        proxyUrl,
        prefix,
        rateLimiter,
    } = opts;
    const fetchOptions = { ...init, ...buildFetchOptions(proxyUrl) };
    const retryableStatuses = new Set(retryStatuses);
    const lastAttempt = Math.max(0, Math.floor(maxRetries));

    const urlStr = url.toString();

    for (let attempt = 0; attempt <= lastAttempt; attempt++) {
        // N1-T01: use AbortController so the underlying TCP connection is cancelled on
        // timeout, not just raced against a reject promise that leaves it dangling.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            if (rateLimiter) {
                await rateLimiter.acquire();
            }
            recordProviderCall(prefix); // P2-T05 observability
            const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!retryableStatuses.has(res.status) || attempt === lastAttempt) {
                return res;
            }

            if (res.status === 429) recordRateLimited();
            recordRetry();
            await discardResponseBody(res);
            await sleep(getRetryDelayMs(res, attempt));
        } catch (error) {
            clearTimeout(timeoutId);
            // AbortError = our timeout fired deliberately — never retry, surface as TimeoutError.
            if (error instanceof Error && error.name === "AbortError") {
                const p = prefix ? `[${prefix}] ` : "";
                const timeoutError = new Error(`${p}Timeout after ${timeoutMs}ms: fetch ${urlStr}`);
                timeoutError.name = "TimeoutError";
                throw timeoutError;
            }
            if (attempt === lastAttempt) {
                throw error;
            }

            await sleep(getBackoffDelayMs(attempt));
        }
    }

    throw new Error("providerFetch exhausted retry attempts");
}

function clampRetryAfterSeconds(seconds: number): number {
    if (!Number.isFinite(seconds)) {
        return DEFAULT_RETRY_AFTER_SECONDS;
    }

    return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(0, seconds));
}

function getRetryDelayMs(res: Response, attempt: number): number {
    if (res.status === 429) {
        return parseRetryAfterSeconds(res.headers.get("Retry-After")) * 1000;
    }

    return getBackoffDelayMs(attempt);
}

function getBackoffDelayMs(attempt: number): number {
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
    return backoff + Math.floor(Math.random() * backoff);
}

async function discardResponseBody(res: Response): Promise<void> {
    try {
        await res.body?.cancel();
    } catch {
        // Best effort: retry delays should not fail because body cleanup failed.
    }
}
