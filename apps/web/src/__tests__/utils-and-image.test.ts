import { describe, it, expect } from "vitest";
import { formatRuntime, formatEpisode, pluralize, daysAgo } from "../lib/utils";
import {
    tmdbImage,
    resolveEpisodeStill,
    resolveEpisodeStillLarge,
    resolveShowPoster,
    resolveBackdrop,
    resolveBackdropFallback,
} from "../lib/image";
import { queryKeys } from "../lib/queryKeys";

// ---------------------------------------------------------------------------
// lib/utils — pure formatting helpers
// ---------------------------------------------------------------------------

describe("formatRuntime", () => {
    it("returns empty string for null/undefined/0", () => {
        expect(formatRuntime(null)).toBe("");
        expect(formatRuntime(undefined)).toBe("");
        expect(formatRuntime(0)).toBe("");
        expect(formatRuntime(-5)).toBe("");
    });

    it("returns only minutes when under 1 hour", () => {
        expect(formatRuntime(45)).toBe("45m");
        expect(formatRuntime(30)).toBe("30m");
    });

    it("returns only hours when minutes are zero", () => {
        expect(formatRuntime(120)).toBe("2h");
        expect(formatRuntime(60)).toBe("1h");
    });

    it("returns combined hours and minutes", () => {
        expect(formatRuntime(95)).toBe("1h 35m");
        expect(formatRuntime(150)).toBe("2h 30m");
    });
});

describe("formatEpisode", () => {
    it("pads season and episode numbers to 2 digits", () => {
        expect(formatEpisode(1, 3)).toBe("S01E03");
        expect(formatEpisode(10, 12)).toBe("S10E12");
    });
});

describe("pluralize", () => {
    it("uses singular for 1", () => {
        expect(pluralize(1, "episode")).toBe("1 episode");
    });

    it("uses plural for other numbers", () => {
        expect(pluralize(0, "episode")).toBe("0 episodes");
        expect(pluralize(5, "season")).toBe("5 seasons");
    });
});

describe("daysAgo", () => {
    it("returns 'Never' for null", () => {
        expect(daysAgo(null)).toBe("Never");
    });

    it("returns 'Today' for today", () => {
        expect(daysAgo(new Date().toISOString())).toBe("Today");
    });

    it("returns 'Yesterday' for 1 day ago", () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        expect(daysAgo(d.toISOString())).toBe("Yesterday");
    });

    it("returns days for < 7 days", () => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        expect(daysAgo(d.toISOString())).toBe("3 days ago");
    });

    it("returns weeks for 7–29 days", () => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        expect(daysAgo(d.toISOString())).toContain("weeks");
    });

    it("returns months for 30–364 days", () => {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        expect(daysAgo(d.toISOString())).toContain("months");
    });

    it("returns years for >= 365 days", () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 2);
        expect(daysAgo(d.toISOString())).toContain("y ago");
    });
});

// ---------------------------------------------------------------------------
// lib/image — TMDB image URL helpers
// ---------------------------------------------------------------------------

describe("tmdbImage", () => {
    it("returns null for falsy paths", () => {
        expect(tmdbImage(null)).toBeNull();
        expect(tmdbImage(undefined)).toBeNull();
        expect(tmdbImage("")).toBeNull();
    });

    it("returns proxied URL for valid path", () => {
        expect(tmdbImage("/poster.jpg")).toBe("/api/img/w500/poster.jpg");
        expect(tmdbImage("/poster.jpg", "w342")).toBe("/api/img/w342/poster.jpg");
    });
});

describe("resolveEpisodeStill", () => {
    it("returns null for no path", () => {
        expect(resolveEpisodeStill(null)).toBeNull();
    });

    it("returns w300 URL", () => {
        expect(resolveEpisodeStill("/still.jpg")).toBe("/api/img/w300/still.jpg");
    });
});

describe("resolveEpisodeStillLarge", () => {
    it("returns w1280 URL", () => {
        expect(resolveEpisodeStillLarge("/still.jpg")).toBe("/api/img/w1280/still.jpg");
    });
});

describe("resolveShowPoster", () => {
    it("returns null for no path", () => {
        expect(resolveShowPoster(null)).toBeNull();
    });

    it("defaults to w500", () => {
        expect(resolveShowPoster("/poster.jpg")).toBe("/api/img/w500/poster.jpg");
    });

    it("accepts custom sizes", () => {
        expect(resolveShowPoster("/poster.jpg", "w342")).toBe("/api/img/w342/poster.jpg");
        expect(resolveShowPoster("/poster.jpg", "w780")).toBe("/api/img/w780/poster.jpg");
    });
});

describe("resolveBackdrop", () => {
    it("returns original-size URL", () => {
        expect(resolveBackdrop("/back.jpg")).toBe("/api/img/original/back.jpg");
    });

    it("returns null for no path", () => {
        expect(resolveBackdrop(null)).toBeNull();
    });
});

describe("resolveBackdropFallback", () => {
    it("returns w1280 URL", () => {
        expect(resolveBackdropFallback("/back.jpg")).toBe("/api/img/w1280/back.jpg");
    });
});

// ---------------------------------------------------------------------------
// lib/queryKeys — key factory functions
// ---------------------------------------------------------------------------

describe("queryKeys", () => {
    it("auth and syncStatus are static arrays", () => {
        expect(queryKeys.auth).toEqual(["auth"]);
        expect(queryKeys.syncStatus).toEqual(["sync-status"]);
        expect(queryKeys.stats).toEqual(["stats"]);
        expect(queryKeys.settings).toEqual(["settings"]);
        expect(queryKeys.nowPlaying).toEqual(["now-playing"]);
    });

    it("showsProgress.list builds keyed array", () => {
        expect(queryKeys.showsProgress.list("all", "", 50, 0)).toEqual([
            "shows-progress",
            "all",
            "",
            50,
            0,
        ]);
    });

    it("showDetail and showHistory include id", () => {
        expect(queryKeys.showDetail(42)).toEqual(["show-detail", 42]);
        expect(queryKeys.showHistory(42)).toEqual(["show-history", 42]);
    });

    it("calendar includes before and after", () => {
        expect(queryKeys.calendar(7, 7)).toEqual(["calendar", 7, 7]);
    });

    it("episodeDetail.byEp includes full key", () => {
        expect(queryKeys.episodeDetail.byEp(1, 2, 3)).toEqual(["episode-detail", 1, 2, 3]);
    });

    it("moviesProgress.list builds keyed array", () => {
        expect(queryKeys.moviesProgress.list("watched", "", 50, 0)).toEqual([
            "movies-progress",
            "watched",
            "",
            50,
            0,
        ]);
    });

    it("watchlist.byType includes type", () => {
        expect(queryKeys.watchlist.byType("show")).toEqual(["watchlist", "show"]);
    });

    it("history.list includes all params", () => {
        expect(queryKeys.history.list("all", undefined, undefined, 50, 0)).toEqual([
            "history",
            "all",
            undefined,
            undefined,
            50,
            0,
        ]);
    });
});
