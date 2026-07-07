import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    isSeasonEligible,
    isMovieEligible,
    buildExclusionIndex,
    parseJellyfinDeleteStatus,
    annotate500Error,
    SEASON_DELETE_BUFFER_DAYS,
    MOVIE_DELETE_BUFFER_DAYS,
    DEFER_AFTER_500_DAYS,
} from "../jellyfin-auto-delete-rules.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Pure rules ────────────────────────────────────────────────────────────────

describe("isSeasonEligible", () => {
    const now = Date.now();
    const finishedLongAgo = new Date(now - (SEASON_DELETE_BUFFER_DAYS + 1) * DAY_MS).toISOString();
    const base = { seasonTotal: 10, airedCount: 10, watched: 10, lastAirDate: finishedLongAgo };

    it("accepts a fully aired, fully watched season past the buffer", () => {
        expect(isSeasonEligible(base, now)).toBe(true);
    });

    it("rejects when the season has not fully aired (still airing weekly)", () => {
        expect(isSeasonEligible({ ...base, airedCount: 9 }, now)).toBe(false);
    });

    it("rejects when not all episodes are watched", () => {
        expect(isSeasonEligible({ ...base, watched: 9 }, now)).toBe(false);
    });

    it("rejects inside the 7-day buffer and accepts just past it", () => {
        const justInside = new Date(
            now - SEASON_DELETE_BUFFER_DAYS * DAY_MS + 60_000,
        ).toISOString();
        const justPast = new Date(now - SEASON_DELETE_BUFFER_DAYS * DAY_MS - 60_000).toISOString();
        expect(isSeasonEligible({ ...base, lastAirDate: justInside }, now)).toBe(false);
        expect(isSeasonEligible({ ...base, lastAirDate: justPast }, now)).toBe(true);
    });

    it("rejects unknown season totals and missing air dates", () => {
        expect(isSeasonEligible({ ...base, seasonTotal: 0 }, now)).toBe(false);
        expect(isSeasonEligible({ ...base, lastAirDate: null }, now)).toBe(false);
    });
});

describe("isMovieEligible", () => {
    const now = Date.now();

    it("accepts a watch older than the 30-day buffer", () => {
        const old = new Date(now - (MOVIE_DELETE_BUFFER_DAYS + 1) * DAY_MS).toISOString();
        expect(isMovieEligible(old, now)).toBe(true);
    });

    it("rejects a recent watch — a rewatch resets the clock", () => {
        const recent = new Date(now - 2 * DAY_MS).toISOString();
        expect(isMovieEligible(recent, now)).toBe(false);
    });

    it("rejects null (never watched)", () => {
        expect(isMovieEligible(null, now)).toBe(false);
    });
});

describe("buildExclusionIndex", () => {
    it("season exclusion blocks whole-show queueing, whole-show exclusion blocks its seasons", () => {
        const idx = buildExclusionIndex([
            { showId: 1, movieId: null, seasonNumber: 2 }, // season-level
            { showId: 9, movieId: null, seasonNumber: null }, // whole-show
            { showId: null, movieId: 42, seasonNumber: null }, // movie
        ]);
        // Any exclusion on the show blocks whole-show queueing (Phase 1a checks excludedShowIds).
        expect(idx.excludedShowIds.has(1)).toBe(true);
        expect(idx.excludedShowIds.has(9)).toBe(true);
        // Season checks: only the protected season of show 1; every season of show 9.
        expect(idx.isSeasonExcluded(1, 2)).toBe(true);
        expect(idx.isSeasonExcluded(1, 3)).toBe(false);
        expect(idx.isSeasonExcluded(9, 1)).toBe(true);
        expect(idx.excludedMovieIds.has(42)).toBe(true);
    });

    it("add() registers mid-run defers so the same run's Phase 1 sees them", () => {
        const idx = buildExclusionIndex([]);
        expect(idx.excludedShowIds.has(5)).toBe(false);
        idx.add({ showId: 5, movieId: null, seasonNumber: null });
        expect(idx.excludedShowIds.has(5)).toBe(true);
        expect(idx.isSeasonExcluded(5, 1)).toBe(true);
    });
});

describe("parseJellyfinDeleteStatus / annotate500Error", () => {
    it("extracts the HTTP status from deleteJellyfinItem's error message", () => {
        expect(parseJellyfinDeleteStatus("Jellyfin delete failed: 500")).toBe(500);
        expect(parseJellyfinDeleteStatus("Jellyfin delete failed: 401")).toBe(401);
        expect(parseJellyfinDeleteStatus("fetch failed")).toBeNull();
    });

    it("annotation names the upstream issue and the defer window", () => {
        const msg = annotate500Error(500);
        expect(msg).toContain("jellyfin#16975");
        expect(msg).toContain(`${DEFER_AFTER_500_DAYS} days`);
    });
});

// ─── Phase 2 auto-defer integration (N5-T10) ──────────────────────────────────

const dbMockState = vi.hoisted(() => ({ db: null as any }));
const jellyfinMock = vi.hoisted(() => ({
    seriesMap: new Map<string, string>(),
    movieMap: new Map<string, string>(),
    deleteItem: vi.fn(),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../../services/jellyfin.js", () => ({
    fetchJellyfinSeriesTmdbMap: () => Promise.resolve(jellyfinMock.seriesMap),
    fetchJellyfinMoviesTmdbMap: () => Promise.resolve(jellyfinMock.movieMap),
    findJellyfinSeasonIdBySeriesId: () => Promise.resolve(null),
    deleteJellyfinItem: jellyfinMock.deleteItem,
}));

vi.mock("../../lib/encrypt.js", () => ({ decryptToken: () => "api-key" }));
vi.mock("../../lib/secret.js", () => ({ resolveApiSecret: () => "secret" }));
vi.mock("../../lib/push.js", () => ({
    sendPush: vi.fn(),
    isPushConfigured: () => false,
}));

class SelectBuilder {
    constructor(private result: unknown[]) {}
    from() {
        return this;
    }
    innerJoin() {
        return this;
    }
    leftJoin() {
        return this;
    }
    where() {
        return this;
    }
    orderBy() {
        return this;
    }
    groupBy() {
        return this;
    }
    then<T1, T2 = never>(
        ok?: ((v: unknown[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

interface InsertRecord {
    table: unknown;
    values: Record<string, unknown>;
}

class InsertBuilder {
    constructor(
        private state: { inserts: InsertRecord[] },
        private table: unknown,
    ) {}
    values(v: Record<string, unknown>) {
        this.state.inserts.push({ table: this.table, values: v });
        return this;
    }
    onConflictDoNothing() {
        return this;
    }
    returning() {
        return Promise.resolve([{ id: 999 }]);
    }
    then<T1, T2 = never>(
        ok?: ((v: unknown) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

function createMockDb(selectResults: unknown[][]) {
    const state = { results: [...selectResults], inserts: [] as InsertRecord[], deleted: 0 };
    return {
        state,
        select: () => new SelectBuilder(state.results.shift() ?? []),
        insert: (table: unknown) => new InsertBuilder(state, table),
        delete: () => ({
            where: () => {
                state.deleted++;
                return Promise.resolve();
            },
        }),
    };
}

const { runJellyfinAutoDelete } = await import("../jellyfin-auto-delete.js");
const { jellyfinDeleteHistory, jellyfinDeleteExclusions, jellyfinDeleteQueue } =
    await import("@trakt-dashboard/db");

const userRow = {
    userId: 1,
    jellyfinUrl: "http://jf",
    jellyfinApiKey: "encrypted",
    jellyfinAutoDeleteLibraryIds: JSON.stringify(["lib1"]),
    displayLanguage: "zh-CN",
};
const showQueueEntry = { id: 10, showId: 5, seasonNumber: null, tmdbId: 100, title: "Test Show" };
const completedShow = { showId: 5, tmdbId: 100, title: "Test Show" };

// Select order inside one run (push disabled → no subscription queries):
// [eligibleUsers] [exclusions] [pendingShowEntries] [pendingMovieEntries]
// [completedEndedShows] [userShowIds] [watchedMovies]
function mockRun(selectOverrides: Partial<Record<number, unknown[]>> = {}) {
    const defaults: unknown[][] = [[userRow], [], [showQueueEntry], [], [completedShow], [], []];
    for (const [i, v] of Object.entries(selectOverrides)) defaults[Number(i)] = v as unknown[];
    dbMockState.db = createMockDb(defaults);
    return dbMockState.db.state as ReturnType<typeof createMockDb>["state"];
}

beforeEach(() => {
    jellyfinMock.deleteItem.mockReset();
    jellyfinMock.seriesMap = new Map([["100", "series-abc"]]);
    jellyfinMock.movieMap = new Map();
});

describe("runJellyfinAutoDelete — N5-T10 auto-defer on 500", () => {
    it("500 → history annotated, defer exclusion written, same-run Phase 1 skips re-queue", async () => {
        jellyfinMock.deleteItem.mockRejectedValue(new Error("Jellyfin delete failed: 500"));
        const state = mockRun();

        const result = await runJellyfinAutoDelete();
        expect(result).toEqual({ deleted: 0, queued: 0 });

        const historyInserts = state.inserts.filter((i) => i.table === jellyfinDeleteHistory);
        expect(historyInserts).toHaveLength(1);
        expect(historyInserts[0].values.status).toBe("failed");
        expect(String(historyInserts[0].values.errorMessage)).toContain("jellyfin#16975");

        const exclusionInserts = state.inserts.filter((i) => i.table === jellyfinDeleteExclusions);
        expect(exclusionInserts).toHaveLength(1);
        expect(exclusionInserts[0].values).toMatchObject({
            userId: 1,
            showId: 5,
            seasonNumber: null,
            mode: "defer",
        });
        const deferUntil = (exclusionInserts[0].values.deferUntil as Date).getTime();
        const expected = Date.now() + DEFER_AFTER_500_DAYS * DAY_MS;
        expect(Math.abs(deferUntil - expected)).toBeLessThan(60_000);

        // Phase 1a offered the same completed show, but the mid-run defer must block it.
        const queueInserts = state.inserts.filter((i) => i.table === jellyfinDeleteQueue);
        expect(queueInserts).toHaveLength(0);
    });

    it("non-500 failure keeps the raw error and does NOT defer (pre-T10 behavior)", async () => {
        jellyfinMock.deleteItem.mockRejectedValue(new Error("fetch failed"));
        const state = mockRun();

        const result = await runJellyfinAutoDelete();

        const historyInserts = state.inserts.filter((i) => i.table === jellyfinDeleteHistory);
        expect(historyInserts).toHaveLength(1);
        expect(historyInserts[0].values.errorMessage).toBe("fetch failed");

        expect(state.inserts.filter((i) => i.table === jellyfinDeleteExclusions)).toHaveLength(0);
        // Without an exclusion, Phase 1a re-queues the still-eligible show.
        expect(state.inserts.filter((i) => i.table === jellyfinDeleteQueue)).toHaveLength(1);
        expect(result.queued).toBe(1);
    });

    it("successful delete records history, touches no exclusions, and prunes the stale map entry", async () => {
        jellyfinMock.deleteItem.mockResolvedValue(undefined);
        const state = mockRun();

        const result = await runJellyfinAutoDelete();
        expect(result).toEqual({ deleted: 1, queued: 0 });

        const historyInserts = state.inserts.filter((i) => i.table === jellyfinDeleteHistory);
        expect(historyInserts).toHaveLength(1);
        expect(historyInserts[0].values.status).toBe("deleted");
        expect(state.inserts.filter((i) => i.table === jellyfinDeleteExclusions)).toHaveLength(0);
        // The series was removed from the run's map snapshot, so Phase 1a must NOT
        // re-queue the show it just deleted (would log "not_found" tomorrow otherwise).
        expect(state.inserts.filter((i) => i.table === jellyfinDeleteQueue)).toHaveLength(0);
    });
});
