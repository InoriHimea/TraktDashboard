import { describe, expect, it } from "vitest";
import zhCN from "../zh-CN.json";
import enUS from "../en-US.json";

// N6 batch 2: the locale files are hand-maintained and have drifted repeatedly
// (keys added to one file only, or orphaned after a feature was removed). This
// guard fails CI with the exact missing keys instead of silently falling back.

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === "object" && value !== null && !Array.isArray(value)
            ? flattenKeys(value as Record<string, unknown>, path)
            : [path];
    });
}

describe("locale key parity", () => {
    const zhKeys = new Set(flattenKeys(zhCN));
    const enKeys = new Set(flattenKeys(enUS));

    it("en-US has every zh-CN key", () => {
        const missing = [...zhKeys].filter((k) => !enKeys.has(k));
        expect(missing, `keys missing from en-US.json: ${missing.join(", ")}`).toEqual([]);
    });

    it("zh-CN has every en-US key", () => {
        const missing = [...enKeys].filter((k) => !zhKeys.has(k));
        expect(missing, `keys missing from zh-CN.json: ${missing.join(", ")}`).toEqual([]);
    });
});
