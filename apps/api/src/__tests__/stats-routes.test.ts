import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

// ---------------------------------------------------------------------------
// DB builder stubs — select/selectDistinct share one result queue in call order.
// A queued Error rejects instead of resolving (exercises the 500 path).
// ---------------------------------------------------------------------------

type QueueItem = unknown[] | Error;

class SelectBuilder implements PromiseLike<unknown[]> {
    private _item: QueueItem;
    constructor(item: QueueItem) {
        this._item = item;
    }
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
    groupBy() {
        return this;
    }
    orderBy() {
        return this;
    }
    limit() {
        return this;
    }
    then<T1 = unknown[], T2 = never>(
        ok?: ((value: unknown[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        if (this._item instanceof Error) return Promise.reject(this._item).then(ok, fail);
        return Promise.resolve(this._item).then(ok, fail);
    }
}

function createMockDb(queue: QueueItem[] = []) {
    const state = { queue: [...queue] };
    const next = () => new SelectBuilder(state.queue.shift() ?? []);
    return {
        select: vi.fn(next),
        selectDistinct: vi.fn(next),
        __state: state,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { statsRoutes } = await import("../routes/stats.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/stats", statsRoutes);
    return a;
}

// ---------------------------------------------------------------------------
// GET /stats/overview
// ---------------------------------------------------------------------------

describe("GET /stats/overview", () => {
    /** Queue in exact call order of the route (10 sequential + 6 in Promise.all). */
    function overviewQueue(overrides: Partial<Record<number, QueueItem>> = {}): QueueItem[] {
        const watchedAt = new Date("2026-06-01T20:00:00.000Z");
        const base: QueueItem[] = [
            // 1 totals
            [{ totalWatched: 100, totalShows: 12 }],
            // 2 completedCount
            [{ count: 5 }],
            // 3 episodeRuntime
            [{ total: 4500 }],
            // 4 movieTotals
            [{ totalMoviesWatched: 20, totalMovieWatches: 25, totalMovieRuntimeMinutes: 3000 }],
            // 5 monthlyActivity
            [{ month: "2026-05", count: 10 }],
            // 6 allShowProgress (genres)
            [{ genres: ["Drama", "Sci-Fi"] }],
            // 7 allMovieProgress (genres)
            [{ genres: ["Drama"] }, { genres: null }],
            // 8 recentEpisodeRows — duplicate episodeId+watchedAt must be deduped
            [
                {
                    episodeId: 1,
                    showTitle: "Show A",
                    showId: 5,
                    posterPath: null,
                    stillPath: null,
                    episodeTitle: "E1",
                    seasonNumber: 1,
                    episodeNumber: 1,
                    watchedAt,
                },
                {
                    episodeId: 1,
                    showTitle: "Show A",
                    showId: 5,
                    posterPath: null,
                    stillPath: null,
                    episodeTitle: "E1",
                    seasonNumber: 1,
                    episodeNumber: 1,
                    watchedAt,
                },
                {
                    episodeId: 2,
                    showTitle: "Show A",
                    showId: 5,
                    posterPath: null,
                    stillPath: null,
                    episodeTitle: "E2",
                    seasonNumber: 1,
                    episodeNumber: 2,
                    watchedAt,
                },
            ],
            // 9 recentMovieRows
            [{ movieTitle: "Movie A", movieId: 9, posterPath: null, watchedAt }],
            // 10 yearCurrent
            [{ count: 30 }],
            // 11 yearLast
            [{ count: 40 }],
            // 12 watchDates (selectDistinct) — 2 consecutive days + 1 isolated
            [{ day: "2026-06-01" }, { day: "2026-06-02" }, { day: "2026-06-04" }],
            // 13 avg30
            [{ count: 60 }],
            // 14 heatmap
            [{ date: "2026-06-01", count: 3 }],
            // 15 weekday
            [{ weekday: 1, count: 5 }],
            // 16 ratingDistribution
            [{ rating: 8, count: 3 }],
        ];
        for (const [idx, item] of Object.entries(overrides)) {
            base[Number(idx)] = item as QueueItem;
        }
        return base;
    }

    it("aggregates totals, runtime, and trend metrics", async () => {
        dbMockState.db = createMockDb(overviewQueue());

        const res = await app().request("/stats/overview");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Record<string, unknown> };
        const d = body.data;
        expect(d.totalEpisodesWatched).toBe(100);
        expect(d.totalShowsWatched).toBe(12);
        expect(d.totalShowsCompleted).toBe(5);
        expect(d.totalMoviesWatched).toBe(20);
        expect(d.totalMovieWatches).toBe(25);
        expect(d.totalEpisodeRuntimeMinutes).toBe(4500);
        expect(d.totalMovieRuntimeMinutes).toBe(3000);
        expect(d.totalRuntimeMinutes).toBe(7500);
        expect(d.monthlyActivity).toEqual([{ month: "2026-05", count: 10 }]);
        expect(d.yearComparison).toEqual({ thisYear: 30, lastYear: 40 });
        expect(d.longestStreakDays).toBe(2);
        expect(d.avgDailyWatches30d).toBe(2);
        expect(d.heatmap).toEqual([{ date: "2026-06-01", count: 3 }]);
    });

    it("counts genres across shows and movies, ignoring null genre arrays", async () => {
        dbMockState.db = createMockDb(overviewQueue());

        const res = await app().request("/stats/overview");
        const body = (await res.json()) as {
            data: { topGenres: Array<{ name: string; count: number }> };
        };
        expect(body.data.topGenres).toEqual([
            { name: "Drama", count: 2 },
            { name: "Sci-Fi", count: 1 },
        ]);
    });

    it("dedupes recently-watched episodes by episodeId+watchedAt and strips episodeId", async () => {
        dbMockState.db = createMockDb(overviewQueue());

        const res = await app().request("/stats/overview");
        const body = (await res.json()) as {
            data: { recentlyWatched: Array<Record<string, unknown>> };
        };
        expect(body.data.recentlyWatched).toHaveLength(2);
        expect(body.data.recentlyWatched[0].episodeId).toBeUndefined();
        expect(body.data.recentlyWatched[0].episodeTitle).toBe("E1");
        expect(body.data.recentlyWatched[1].episodeTitle).toBe("E2");
    });

    it("fills weekday distribution to 7 buckets and rating distribution to 10", async () => {
        dbMockState.db = createMockDb(overviewQueue());

        const res = await app().request("/stats/overview");
        const body = (await res.json()) as {
            data: {
                weekdayDistribution: Array<{ weekday: number; count: number }>;
                ratingDistribution: Array<{ rating: number; count: number }>;
            };
        };
        expect(body.data.weekdayDistribution).toHaveLength(7);
        expect(body.data.weekdayDistribution[1]).toEqual({ weekday: 1, count: 5 });
        expect(body.data.weekdayDistribution[0]).toEqual({ weekday: 0, count: 0 });
        expect(body.data.ratingDistribution).toHaveLength(10);
        expect(body.data.ratingDistribution[7]).toEqual({ rating: 8, count: 3 });
        expect(body.data.ratingDistribution[0]).toEqual({ rating: 1, count: 0 });
    });

    it("zero-fills all totals for a brand-new user", async () => {
        const empty: QueueItem[] = Array.from({ length: 16 }, () => []);
        dbMockState.db = createMockDb(empty);

        const res = await app().request("/stats/overview");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Record<string, unknown> };
        expect(body.data.totalEpisodesWatched).toBe(0);
        expect(body.data.totalRuntimeMinutes).toBe(0);
        expect(body.data.longestStreakDays).toBe(0);
        expect(body.data.topGenres).toEqual([]);
        expect(body.data.recentlyWatched).toEqual([]);
    });

    it("returns 500 with the error message when a query fails", async () => {
        dbMockState.db = createMockDb(overviewQueue({ 0: new Error("connection refused") }));
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await app().request("/stats/overview");
        expect(res.status).toBe(500);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("connection refused");
        errSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// GET /stats/screen-time
// ---------------------------------------------------------------------------

describe("GET /stats/screen-time", () => {
    it("aggregates daily minutes, totals, averages, peaks, and awake percentage", async () => {
        dbMockState.db = createMockDb([
            // dailyRows — dates outside the pre-filled window get appended, which
            // keeps this assertion timezone-independent.
            [
                { date: "2026-01-01", mediaType: "episode", minutes: 120, plays: 3 },
                { date: "2026-01-02", mediaType: "movie", minutes: 90, plays: 1 },
            ],
            // peakRows — unknown buckets must be ignored
            [
                { bucket: "morning", mediaType: "episode", count: 5 },
                { bucket: "evening", mediaType: "movie", count: 2 },
                { bucket: "weird", mediaType: "episode", count: 99 },
            ],
        ]);

        const res = await app().request("/stats/screen-time?days=7");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: {
                days: number;
                totals: { all: number; episodes: number; movies: number };
                averages: { all: number; episodes: number; movies: number };
                peaks: Record<string, { all: number; episodes: number; movies: number }>;
                awake_pct: { all: number };
            };
        };
        const d = body.data;
        expect(d.days).toBe(7);
        expect(d.totals).toEqual({ all: 210, episodes: 120, movies: 90 });
        expect(d.averages).toEqual({ all: 30, episodes: 17, movies: 13 });
        expect(d.peaks.morning).toEqual({ all: 5, episodes: 5, movies: 0 });
        expect(d.peaks.evening).toEqual({ all: 2, episodes: 0, movies: 2 });
        expect(d.peaks.afternoon).toEqual({ all: 0, episodes: 0, movies: 0 });
        // 7 days × 16 waking hours × 60 min = 6720; 210/6720 ≈ 3%
        expect(d.awake_pct.all).toBe(3);
    });

    it("clamps days to the 1–90 range", async () => {
        dbMockState.db = createMockDb([[], []]);
        const resHigh = await app().request("/stats/screen-time?days=999");
        expect(((await resHigh.json()) as { data: { days: number } }).data.days).toBe(90);

        dbMockState.db = createMockDb([[], []]);
        const resLow = await app().request("/stats/screen-time?days=-5");
        expect(((await resLow.json()) as { data: { days: number } }).data.days).toBe(1);
    });

    it("defaults to 7 days and zero-fills the daily series when there is no history", async () => {
        dbMockState.db = createMockDb([[], []]);

        const res = await app().request("/stats/screen-time");
        const body = (await res.json()) as {
            data: { days: number; daily: Array<{ all: number }>; totals: { all: number } };
        };
        expect(body.data.days).toBe(7);
        expect(body.data.daily).toHaveLength(7);
        expect(body.data.daily.every((d) => d.all === 0)).toBe(true);
        expect(body.data.totals.all).toBe(0);
    });
});
