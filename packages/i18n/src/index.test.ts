import { describe, it, expect } from "vitest";
import { buildLanguageFallbackChain, getLanguageFamily } from "./index.js";

describe("getLanguageFamily", () => {
    it("extracts the base language code", () => {
        expect(getLanguageFamily("zh-TW")).toBe("zh");
        expect(getLanguageFamily("en-US")).toBe("en");
        expect(getLanguageFamily("ja")).toBe("ja");
    });
});

describe("buildLanguageFallbackChain (P2-T12)", () => {
    it("puts the user locale first, then zh variants and en-US", () => {
        const chain = buildLanguageFallbackChain("zh-CN", "en");
        expect(chain[0]).toBe("zh-CN");
        expect(chain).toContain("en-US");
    });

    it("appends the original-language family variants", () => {
        const chain = buildLanguageFallbackChain("zh-CN", "ja");
        expect(chain).toContain("ja-JP");
        expect(chain).toContain("ja");
    });

    it("synthesizes variants for an unknown original language", () => {
        const chain = buildLanguageFallbackChain(null, "xx");
        expect(chain).toContain("xx-XX");
        expect(chain).toContain("xx");
    });

    it("deduplicates entries", () => {
        const chain = buildLanguageFallbackChain("en-US", "en");
        expect(new Set(chain).size).toBe(chain.length);
    });

    it("handles null inputs without throwing", () => {
        expect(buildLanguageFallbackChain(null, null)).toContain("en-US");
    });
});
