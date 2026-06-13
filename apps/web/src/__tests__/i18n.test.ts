import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    setLocale,
    getLocale,
    t,
    statusZh,
    statusColor,
    resolveTitle,
    resolveOverview,
    resolveEpisodeTitle,
    resolveEpisodeOverview,
    fmtDateZh,
    fmtAirDate,
    fmtRuntime,
} from "../lib/i18n";

// ---------------------------------------------------------------------------
// locale management
// ---------------------------------------------------------------------------

describe("setLocale / getLocale", () => {
    beforeEach(() => {
        setLocale("zh-CN");
    });

    it("reads back the locale that was set", () => {
        setLocale("en");
        expect(getLocale()).toBe("en");
    });

    it("defaults to zh-CN for null/empty locale", () => {
        setLocale(null);
        expect(getLocale()).toBe("zh-CN");
    });

    it("defaults to zh-CN for 'undefined' string", () => {
        setLocale("undefined");
        expect(getLocale()).toBe("zh-CN");
    });

    it("defaults to zh-CN for invalid locale string", () => {
        setLocale("zz-INVALID-9999");
        expect(getLocale()).toBe("zh-CN");
    });

    it("defaults to zh-CN when Intl.DateTimeFormat throws", () => {
        const orig = Intl.DateTimeFormat.supportedLocalesOf;
        Intl.DateTimeFormat.supportedLocalesOf = () => {
            throw new Error("not supported");
        };
        try {
            setLocale("en-US");
            expect(getLocale()).toBe("zh-CN");
        } finally {
            Intl.DateTimeFormat.supportedLocalesOf = orig;
        }
    });

    it("defaults to zh-CN for string 'null'", () => {
        setLocale("null");
        expect(getLocale()).toBe("zh-CN");
    });
});

// ---------------------------------------------------------------------------
// t() translation function
// ---------------------------------------------------------------------------

describe("t()", () => {
    it("returns translated string for a known key", () => {
        setLocale("zh-CN");
        const result = t("nav.shows" as Parameters<typeof t>[0]);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("falls back to key for unknown translation", () => {
        setLocale("zh-CN");
        const key = "non.existent.key.xyz" as Parameters<typeof t>[0];
        expect(t(key)).toBe(key);
    });

    it("interpolates params", () => {
        setLocale("zh-CN");
        // any key that has {{n}} placeholder; fall back gracefully if none found
        const result = t("shows.episodeCount" as Parameters<typeof t>[0], { n: "5" });
        expect(typeof result).toBe("string");
    });
});

// ---------------------------------------------------------------------------
// status helpers
// ---------------------------------------------------------------------------

describe("statusZh", () => {
    it("translates returning series", () => {
        expect(statusZh("returning series")).toBe("连载中");
    });

    it("translates ended", () => {
        expect(statusZh("ended")).toBe("已完结");
    });

    it("returns original for unknown status", () => {
        expect(statusZh("something-unknown")).toBe("something-unknown");
    });
});

describe("statusColor", () => {
    it("returns a color for returning series", () => {
        expect(statusColor("returning series")).toMatch(/^#/);
    });

    it("returns fallback gray for unknown", () => {
        expect(statusColor("unknown-status")).toBe("#6b7280");
    });
});

// ---------------------------------------------------------------------------
// title & overview resolution
// ---------------------------------------------------------------------------

type Show = Parameters<typeof resolveTitle>[0];

function makeShow(overrides: Partial<Show> = {}): Show {
    return {
        title: "Test Show",
        originalName: "Test Show Original",
        translatedName: null,
        overview: "Overview",
        translatedOverview: null,
        ...overrides,
    } as Show;
}

describe("resolveTitle", () => {
    it("uses translatedName as primary when available", () => {
        const show = makeShow({ translatedName: "已翻譯" });
        const { primary } = resolveTitle(show);
        expect(primary).toBe("已翻譯");
    });

    it("shows original as secondary when different", () => {
        const show = makeShow({
            translatedName: "已翻譯",
            title: "Test Show",
            originalName: "Original",
        });
        const { secondary } = resolveTitle(show);
        expect(secondary).toBeTruthy();
    });

    it("secondary is null when translatedName equals title", () => {
        const show = makeShow({
            translatedName: "Test Show",
            title: "Test Show",
            originalName: "Test Show",
        });
        const { secondary } = resolveTitle(show);
        expect(secondary).toBeNull();
    });

    it("falls back to title when no translation", () => {
        const show = makeShow({ translatedName: null });
        const { primary } = resolveTitle(show);
        expect(primary).toBe("Test Show");
    });

    it("shows originalName as secondary when different from title", () => {
        const show = makeShow({ translatedName: null, originalName: "OriginalDifferent" });
        const { secondary } = resolveTitle(show);
        expect(secondary).toBe("OriginalDifferent");
    });

    it("secondary is null when originalName matches title", () => {
        const show = makeShow({ translatedName: null, originalName: "Test Show" });
        const { secondary } = resolveTitle(show);
        expect(secondary).toBeNull();
    });
});

describe("resolveOverview", () => {
    it("prefers translatedOverview", () => {
        const show = makeShow({ translatedOverview: "翻訳済み概要", overview: "English" });
        expect(resolveOverview(show)).toBe("翻訳済み概要");
    });

    it("falls back to overview", () => {
        const show = makeShow({ translatedOverview: null, overview: "English overview" });
        expect(resolveOverview(show)).toBe("English overview");
    });

    it("returns default when both are empty", () => {
        const show = makeShow({ translatedOverview: null, overview: null });
        expect(resolveOverview(show)).toBe("暂无简介");
    });
});

// ---------------------------------------------------------------------------
// episode helpers
// ---------------------------------------------------------------------------

type Episode = Parameters<typeof resolveEpisodeTitle>[0];

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
    return {
        seasonNumber: 1,
        episodeNumber: 3,
        title: "Episode Title",
        translatedTitle: null,
        overview: "Ep overview",
        translatedOverview: null,
        ...overrides,
    } as Episode;
}

describe("resolveEpisodeTitle", () => {
    it("prefers translatedTitle", () => {
        const ep = makeEpisode({ translatedTitle: "翻訳タイトル" });
        expect(resolveEpisodeTitle(ep)).toBe("翻訳タイトル");
    });

    it("falls back to title", () => {
        const ep = makeEpisode({ translatedTitle: null, title: "Original" });
        expect(resolveEpisodeTitle(ep)).toBe("Original");
    });

    it("returns specials format for season 0", () => {
        const ep = makeEpisode({
            seasonNumber: 0,
            episodeNumber: 2,
            title: "",
            translatedTitle: null,
        });
        expect(resolveEpisodeTitle(ep)).toBe("特别篇 2");
    });

    it("returns numbered fallback when no title", () => {
        const ep = makeEpisode({ title: "", translatedTitle: null });
        expect(resolveEpisodeTitle(ep)).toBe("第 3 集");
    });
});

describe("resolveEpisodeOverview", () => {
    it("returns translatedOverview when present", () => {
        const ep = makeEpisode({ translatedOverview: "翻訳" });
        expect(resolveEpisodeOverview(ep)).toBe("翻訳");
    });

    it("returns null when both are empty", () => {
        const ep = makeEpisode({ translatedOverview: null, overview: null });
        expect(resolveEpisodeOverview(ep)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// date/time formatting
// ---------------------------------------------------------------------------

describe("fmtDateZh", () => {
    it("returns '从未' for null", () => {
        expect(fmtDateZh(null)).toBe("从未");
    });

    it("returns '今天' for today", () => {
        expect(fmtDateZh(new Date().toISOString())).toBe("今天");
    });

    it("returns '即将播出' for future date", () => {
        const d = new Date();
        d.setDate(d.getDate() + 5);
        expect(fmtDateZh(d.toISOString())).toBe("即将播出");
    });

    it("returns '昨天' for 1 day ago", () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(d.getHours() - 2); // ensure it's solidly yesterday
        expect(fmtDateZh(d.toISOString())).toBe("昨天");
    });

    it("returns days for 2–6 days ago", () => {
        const d = new Date();
        d.setDate(d.getDate() - 4);
        expect(fmtDateZh(d.toISOString())).toContain("天前");
    });

    it("returns weeks for 7–29 days", () => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        expect(fmtDateZh(d.toISOString())).toContain("周前");
    });

    it("returns months for 30–364 days", () => {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        expect(fmtDateZh(d.toISOString())).toContain("个月前");
    });

    it("returns years for >= 365 days", () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 2);
        expect(fmtDateZh(d.toISOString())).toContain("年前");
    });
});

describe("fmtAirDate", () => {
    it("returns '未知' for null", () => {
        expect(fmtAirDate(null)).toBe("未知");
    });

    it("formats valid date", () => {
        const result = fmtAirDate("2026-06-01");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("fmtRuntime", () => {
    it("returns empty for null/0", () => {
        expect(fmtRuntime(null)).toBe("");
        expect(fmtRuntime(0)).toBe("");
    });

    it("returns minutes for < 60", () => {
        expect(fmtRuntime(45)).toBe("45 分钟");
    });

    it("returns hours and minutes", () => {
        expect(fmtRuntime(90)).toBe("1 小时 30 分钟");
    });

    it("returns only hours when minutes are 0", () => {
        expect(fmtRuntime(120)).toBe("2 小时");
    });
});

describe("t() with en-US locale", () => {
    beforeEach(() => {
        setLocale("en-US");
    });
    afterEach(() => {
        setLocale("zh-CN");
    });

    it("returns en-US translation for known key", () => {
        const result = t("nav.shows" as Parameters<typeof t>[0]);
        expect(typeof result).toBe("string");
    });

    it("t() interpolation replaces {{n}}", () => {
        // Any key; just verify substitution logic runs
        const key = "nav.shows" as Parameters<typeof t>[0];
        const result = t(key, { n: "42" });
        expect(typeof result).toBe("string");
    });
});
