import { describe, it, expect } from "vitest";
import { toIsoOrNull } from "../lib/datetime.js";

describe("toIsoOrNull (P2-T02 nullable timestamp serialization)", () => {
    it("returns null for null/undefined", () => {
        expect(toIsoOrNull(null)).toBeNull();
        expect(toIsoOrNull(undefined)).toBeNull();
    });

    it("serializes a Date to ISO 8601", () => {
        const d = new Date("2026-06-12T10:00:00.000Z");
        expect(toIsoOrNull(d)).toBe("2026-06-12T10:00:00.000Z");
    });

    it("accepts a parseable string", () => {
        expect(toIsoOrNull("2026-06-12T10:00:00.000Z")).toBe("2026-06-12T10:00:00.000Z");
    });

    it("returns null for an invalid date instead of throwing", () => {
        expect(toIsoOrNull("not-a-date")).toBeNull();
        expect(toIsoOrNull(new Date("garbage"))).toBeNull();
    });
});
