import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseRetryAfterSeconds, providerFetch } from "../lib/http.js";

describe("parseRetryAfterSeconds", () => {
    it("returns 5 for null", () => {
        expect(parseRetryAfterSeconds(null)).toBe(5);
    });

    it("returns integer seconds", () => {
        expect(parseRetryAfterSeconds("30")).toBe(30);
    });

    it("returns 0 for '0'", () => {
        expect(parseRetryAfterSeconds("0")).toBe(0);
    });

    it("clamps to 60 for large values", () => {
        expect(parseRetryAfterSeconds("3600")).toBe(60);
    });

    it("returns 5 for garbage string", () => {
        expect(parseRetryAfterSeconds("garbage")).toBe(5);
    });

    it("parses HTTP-date returning positive seconds for future date", () => {
        const future = new globalThis.Date(globalThis.Date.now() + 30_000).toUTCString();
        const result = parseRetryAfterSeconds(future);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(60);
    });
});

describe("providerFetch", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns response on 200 without retry", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

        const res = await providerFetch({ url: "https://example.com/test" });

        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns 400 without retry", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 400 })));

        const res = await providerFetch({ url: "https://example.com/test" });

        expect(res.status).toBe(400);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("retries on 500 and succeeds on second attempt", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(new Response("error", { status: 500 }))
                .mockResolvedValue(new Response("{}", { status: 200 })),
        );

        const promise = providerFetch({
            url: "https://example.com/test",
            maxRetries: 2,
            retryStatuses: [500],
        });
        await vi.runAllTimersAsync();
        const res = await promise;

        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 429 and uses Retry-After header", async () => {
        const headers = new Headers({ "Retry-After": "1" });
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers }))
                .mockResolvedValue(new Response("{}", { status: 200 })),
        );

        const promise = providerFetch({
            url: "https://example.com/test",
            maxRetries: 2,
        });
        await vi.runAllTimersAsync();
        const res = await promise;

        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on network error then succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockRejectedValueOnce(new Error("ECONNREFUSED"))
                .mockResolvedValue(new Response("{}", { status: 200 })),
        );

        const promise = providerFetch({
            url: "https://example.com/test",
            maxRetries: 2,
        });
        await vi.runAllTimersAsync();
        const res = await promise;

        expect(res.status).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("throws on network error after all retries", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));

        const promise = providerFetch({
            url: "https://example.com/test",
            maxRetries: 1,
        });
        const expectation = expect(promise).rejects.toThrow("Network down");
        await vi.runAllTimersAsync();

        await expectation;
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("aborts the request and throws TimeoutError after timeoutMs", async () => {
        // Simulate a fetch that hangs indefinitely until aborted
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        init.signal?.addEventListener("abort", () => {
                            const err = new Error("The operation was aborted");
                            err.name = "AbortError";
                            reject(err);
                        });
                    }),
            ),
        );

        const promise = providerFetch({
            url: "https://example.com/slow",
            timeoutMs: 5000,
            maxRetries: 0,
        });
        // Attach handler before advancing timers to prevent unhandledRejection
        const caught = promise.then(
            () => null,
            (e: unknown) => e as Error,
        );

        await vi.advanceTimersByTimeAsync(5001);

        const err = await caught;
        expect(err?.name).toBe("TimeoutError");
        expect(err?.message).toContain("Timeout after 5000ms");
    });

    it("does not retry on timeout (AbortError)", async () => {
        let callCount = 0;
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        callCount++;
                        init.signal?.addEventListener("abort", () => {
                            const err = new Error("aborted");
                            err.name = "AbortError";
                            reject(err);
                        });
                    }),
            ),
        );

        const promise = providerFetch({
            url: "https://example.com/slow",
            timeoutMs: 1000,
            maxRetries: 3,
        });
        // Attach handler before advancing timers to prevent unhandledRejection
        const suppressed = promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(1001);
        await suppressed;

        // AbortError must not trigger retries
        expect(callCount).toBe(1);
    });
});
