import { describe, expect, it } from "vitest";
import { queryKeys } from "../queryKeys";

// Every factory in the central key registry — list keys must extend their
// group's `.all` prefix so family-level invalidation reaches them.

describe("queryKeys factories", () => {
    it("builds shows-progress list keys under the family prefix", () => {
        expect(queryKeys.showsProgress.list("watching", "term", 20, 40)).toEqual([
            "shows-progress",
            "watching",
            "term",
            20,
            40,
        ]);
        expect(queryKeys.showsProgress.list("all", "", 10, 0)[0]).toBe(
            queryKeys.showsProgress.all[0],
        );
    });

    it("builds show detail/history keys", () => {
        expect(queryKeys.showDetail(5)).toEqual(["show-detail", 5]);
        expect(queryKeys.showHistory("5")).toEqual(["show-history", "5"]);
    });

    it("builds calendar keys from the window", () => {
        expect(queryKeys.calendar(14, 30)).toEqual(["calendar", 14, 30]);
    });

    it("builds episode detail/history keys under their family prefixes", () => {
        expect(queryKeys.episodeDetail.byEp(5, 1, 2)).toEqual(["episode-detail", 5, 1, 2]);
        expect(queryKeys.episodeDetail.byEp(5, 1, 2)[0]).toBe(queryKeys.episodeDetail.all[0]);
        expect(queryKeys.episodeHistory.byEp(5, 1, 2)).toEqual(["episode-history", 5, 1, 2]);
        expect(queryKeys.episodeHistory.byEp(5, 1, 2)[0]).toBe(queryKeys.episodeHistory.all[0]);
    });

    it("builds movies-progress and movie detail/history keys", () => {
        expect(queryKeys.moviesProgress.list("watched", "q", 20, 0)).toEqual([
            "movies-progress",
            "watched",
            "q",
            20,
            0,
        ]);
        expect(queryKeys.movieDetail(9)).toEqual(["movie-detail", 9]);
        expect(queryKeys.movieHistory(9)).toEqual(["movie-history", 9]);
    });

    it("builds watchlist keys by type", () => {
        expect(queryKeys.watchlist.byType("show")).toEqual(["watchlist", "show"]);
        expect(queryKeys.watchlist.byType(undefined)).toEqual(["watchlist", undefined]);
        expect(queryKeys.watchlist.byType("show")[0]).toBe(queryKeys.watchlist.all[0]);
    });

    it("builds jellyfin delete-history keys with the limit", () => {
        expect(queryKeys.jellyfinDeleteHistory(50)).toEqual(["jellyfin-delete-history", 50]);
    });

    it("builds note keys carrying every locating dimension", () => {
        expect(queryKeys.notes.get("episode", 5, undefined, 1, 2)).toEqual([
            "notes",
            "episode",
            5,
            undefined,
            1,
            2,
        ]);
        expect(queryKeys.notes.get("movie", undefined, 9)[0]).toBe(queryKeys.notes.all[0]);
    });

    it("builds discover keys by media type and tab", () => {
        expect(queryKeys.discover.list("show", "trending")).toEqual([
            "discover",
            "show",
            "trending",
        ]);
        expect(queryKeys.discover.list("movie", "popular")[0]).toBe(queryKeys.discover.all[0]);
    });

    it("builds list item keys under the lists prefix", () => {
        expect(queryKeys.lists.items(3)).toEqual(["lists", 3, "items"]);
        expect(queryKeys.lists.items(3)[0]).toBe(queryKeys.lists.all[0]);
    });

    it("builds collection keys — list under 'collection', check under its own family", () => {
        expect(queryKeys.collection.byType("show")).toEqual(["collection", "show"]);
        expect(queryKeys.collection.byType("show")[0]).toBe(queryKeys.collection.all[0]);
        expect(queryKeys.collection.check(5, undefined)).toEqual([
            "collection-check",
            5,
            undefined,
        ]);
        expect(queryKeys.collection.check(5)[0]).toBe(queryKeys.collection.checkAll[0]);
        expect(queryKeys.collection.showEpisodes(5)).toEqual(["collection", "episodes", 5]);
        expect(queryKeys.collection.showEpisodes(5)[0]).toBe(queryKeys.collection.all[0]);
    });

    it("builds history list and infinite keys", () => {
        expect(queryKeys.history.list("all", "2026-01-01", "2026-12-31", 50, 0)).toEqual([
            "history",
            "all",
            "2026-01-01",
            "2026-12-31",
            50,
            0,
        ]);
        expect(queryKeys.history.list("all", undefined, undefined, 50, 0)[0]).toBe(
            queryKeys.history.all[0],
        );
        // Infinite scroll intentionally lives under its own prefix (different data shape).
        expect(queryKeys.history.infinite("movie", undefined, undefined)).toEqual([
            "history-infinite",
            "movie",
            undefined,
            undefined,
        ]);
    });

    it("builds historyDuplicates keys under their own family prefix (not history.*)", () => {
        expect(queryKeys.historyDuplicates.list(72)).toEqual(["history-duplicates", 72]);
        expect(queryKeys.historyDuplicates.list(undefined)).toEqual([
            "history-duplicates",
            undefined,
        ]);
        expect(queryKeys.historyDuplicates.list(72)[0]).toBe(queryKeys.historyDuplicates.all[0]);
        expect(queryKeys.historyDuplicates.all[0]).not.toBe(queryKeys.history.all[0]);
    });
});
