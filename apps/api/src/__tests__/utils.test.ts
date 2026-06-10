import { describe, expect, it, vi } from "vitest";
import { parseBoundedInt } from "../lib/number.js";
import { withTimeout } from "../lib/timeout.js";

describe("parseBoundedInt", () => {
    it("falls back for missing or invalid values", () => {
        expect(parseBoundedInt(undefined, 25, 1, 100)).toBe(25);
        expect(parseBoundedInt("nope", 25, 1, 100)).toBe(25);
    });

    it("clamps parsed values to the configured range", () => {
        expect(parseBoundedInt("0", 25, 1, 100)).toBe(1);
        expect(parseBoundedInt("101", 25, 1, 100)).toBe(100);
        expect(parseBoundedInt("42", 25, 1, 100)).toBe(42);
    });
});

describe("withTimeout", () => {
    it("resolves the wrapped promise", async () => {
        await expect(withTimeout(Promise.resolve("ok"), 100, "fast")).resolves.toBe(
            "ok",
        );
    });

    it("rejects with an optional prefix when the timeout wins", async () => {
        vi.useFakeTimers();
        const promise = withTimeout(new Promise(() => {}), 100, "slow", {
            prefix: "tmdb",
        });
        const expectation = expect(promise).rejects.toThrow(
            "[tmdb] Timeout after 100ms: slow",
        );

        await vi.advanceTimersByTimeAsync(100);
        await expectation;
        vi.useRealTimers();
    });
});
