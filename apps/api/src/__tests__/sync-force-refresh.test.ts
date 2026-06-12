import { describe, it, expect } from "vitest";
import { airedWithinForceRefreshWindow } from "../services/sync.js";

const NOW = Date.parse("2026-06-12T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("airedWithinForceRefreshWindow (P1-T04 fanout gating)", () => {
    it("refreshes episodes aired within the last 14 days", () => {
        const aired = new Date(NOW - 5 * DAY).toISOString();
        expect(airedWithinForceRefreshWindow(aired, NOW)).toBe(true);
    });

    it("does not refresh episodes aired long ago", () => {
        const aired = new Date(NOW - 60 * DAY).toISOString();
        expect(airedWithinForceRefreshWindow(aired, NOW)).toBe(false);
    });

    it("refreshes when the air date is unknown (possibly brand new)", () => {
        expect(airedWithinForceRefreshWindow(null, NOW)).toBe(true);
        expect(airedWithinForceRefreshWindow(undefined, NOW)).toBe(true);
    });

    it("refreshes when the air date is unparseable", () => {
        expect(airedWithinForceRefreshWindow("not-a-date", NOW)).toBe(true);
    });

    it("treats the boundary (exactly 14 days) as eligible", () => {
        const aired = new Date(NOW - 14 * DAY).toISOString();
        expect(airedWithinForceRefreshWindow(aired, NOW)).toBe(true);
    });
});
