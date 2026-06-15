import { describe, it, expect } from "vitest";
import { longestConsecutiveDays } from "../streak.js";

describe("longestConsecutiveDays", () => {
    it("returns 0 for empty input", () => {
        expect(longestConsecutiveDays([])).toBe(0);
    });

    it("returns 1 for a single day", () => {
        expect(longestConsecutiveDays(["2026-06-15"])).toBe(1);
    });

    it("counts a simple consecutive run", () => {
        expect(longestConsecutiveDays(["2026-06-13", "2026-06-14", "2026-06-15"])).toBe(3);
    });

    it("resets the streak on a gap and reports the longest run", () => {
        // run of 3 (01-03), gap, run of 2 (06-07)
        const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-06", "2026-01-07"];
        expect(longestConsecutiveDays(days)).toBe(3);
    });

    it("handles month boundaries", () => {
        expect(longestConsecutiveDays(["2026-01-31", "2026-02-01"])).toBe(2);
    });

    it("handles year boundaries", () => {
        expect(longestConsecutiveDays(["2025-12-31", "2026-01-01"])).toBe(2);
    });

    it("is order-independent (sorts internally)", () => {
        expect(longestConsecutiveDays(["2026-01-03", "2026-01-01", "2026-01-02"])).toBe(3);
    });

    it("dedupes repeated days (multiple watches on one day count once)", () => {
        expect(longestConsecutiveDays(["2026-01-01", "2026-01-01", "2026-01-02"])).toBe(2);
    });

    it("returns 1 when every watch is on the same day", () => {
        expect(longestConsecutiveDays(["2026-01-01", "2026-01-01", "2026-01-01"])).toBe(1);
    });

    it("picks the longest among several runs", () => {
        const days = [
            "2026-03-01",
            "2026-03-02", // run 2
            "2026-03-10",
            "2026-03-11",
            "2026-03-12",
            "2026-03-13", // run 4
            "2026-03-20", // run 1
        ];
        expect(longestConsecutiveDays(days)).toBe(4);
    });
});
