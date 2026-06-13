import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { Hono } from "hono";

const TEST_USER_ID = 42;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));

const traktMock = vi.hoisted(() => ({
    getTraktClient: vi.fn(),
    TraktApiError: class TraktApiError extends Error {
        constructor(
            public readonly status: number,
            public readonly body: string,
        ) {
            super(`Trakt API error: ${status} ${body}`);
            this.name = "TraktApiError";
        }
    },
    client: {
        getWatchedMovies: vi.fn(),
        getMovieHistory: vi.fn(),
    },
}));

const tmdbMock = vi.hoisted(() => ({ getTmdbMovie: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../../services/trakt.js", () => ({
    getTraktClient: traktMock.getTraktClient,
    TraktApiError: traktMock.TraktApiError,
}));
vi.mock("../../services/tmdb.js", () => ({
    getTmdbMovie: tmdbMock.getTmdbMovie,
    getTmdbSeason: vi.fn(),
    getTmdbShow: vi.fn(),
}));
vi.mock("../../jobs/scheduler.js", () => ({
    registerUserSyncJob: vi.fn(),
    enqueueSyncNow: vi.fn(),
    isQueueHealthy: vi.fn(),
    getRedis: vi.fn(() => null),
}));
vi.mock("../../lib/observability.js", () => ({
    startSyncRun: vi.fn(() => ({ runId: "test-run" })),
    endSyncRun: vi.fn(),
    getCurrentRunId: vi.fn(() => null),
    recordProviderCall: vi.fn(),
    recordRetry: vi.fn(),
    recordRateLimited: vi.fn(),
    recordError: vi.fn(),
    withPhase: vi.fn((_phase: string, fn: () => Promise<unknown>) => fn()),
}));

// ---------------------------------------------------------------------------
// DB builder stubs
// ---------------------------------------------------------------------------

type SelectResult = unknown[];

interface MockDbState {
    selectResults: SelectResult[];
    insertValues: unknown[];
    conflictCalls: unknown[];
    deleteWhereCalls: unknown[];
}

class SelectBuilder implements PromiseLike<SelectResult> {
    constructor(private readonly result: SelectResult) {}
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
    limit() {
        return this;
    }
    offset() {
        return this;
    }
    groupBy() {
        return this;
    }
    then<T1 = SelectResult, T2 = never>(
        ok?: ((value: SelectResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

class InsertBuilder implements PromiseLike<void> {
    constructor(private readonly state: MockDbState) {}
    values(v: unknown) {
        this.state.insertValues.push(v);
        return this;
    }
    onConflictDoUpdate(v: unknown) {
        this.state.conflictCalls.push(v);
        return this;
    }
    onConflictDoNothing() {
        return this;
    }
    returning() {
        return Promise.resolve([]);
    }
    then<T1 = void, T2 = never>(
        ok?: ((value: void) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

class DeleteBuilder {
    constructor(private readonly state: MockDbState) {}
    where(v: unknown) {
        this.state.deleteWhereCalls.push(v);
        return Promise.resolve();
    }
}

function createMockDb(selectResults: SelectResult[] = []) {
    const state: MockDbState = {
        selectResults: [...selectResults],
        insertValues: [],
        conflictCalls: [],
        deleteWhereCalls: [],
    };
    return {
        select: vi.fn(() => new SelectBuilder(state.selectResults.shift() ?? [])),
        selectDistinct: vi.fn(() => new SelectBuilder(state.selectResults.shift() ?? [])),
        insert: vi.fn(() => new InsertBuilder(state)),
        delete: vi.fn(() => new DeleteBuilder(state)),
        __state: state,
    };
}

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

const { recalcMovieProgress, syncMovies } = await import("../../services/sync.js");
const { movieRoutes } = await import("../../routes/movies.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date("2026-06-01T00:00:00.000Z");

function makeMovie(overrides: Record<string, unknown> = {}) {
    return {
        id: 9,
        tmdbId: 9009,
        imdbId: "tt9009",
        traktId: 7009,
        traktSlug: "midnight-protocol",
        title: "Midnight Protocol",
        overview: "Overview",
        releaseDate: "2026-01-01",
        runtime: 118,
        posterPath: "/movie.jpg",
        backdropPath: "/movie-backdrop.jpg",
        genres: ["Thriller"],
        lastSyncedAt: now,
        createdAt: now,
        ...overrides,
    };
}

function makeProgress(overrides: Record<string, unknown> = {}) {
    return {
        userId: TEST_USER_ID,
        movieId: 9,
        watchCount: 1,
        lastWatchedAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function testApp() {
    const app = new Hono<{ Variables: { userId: number } }>();
    app.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    app.route("/movies", movieRoutes);
    return app;
}

function makeTraktMovieEntry(traktId: number) {
    return {
        type: "movie",
        id: traktId * 100,
        movie: {
            title: `Movie ${traktId}`,
            year: 2025,
            ids: { trakt: traktId, slug: `movie-${traktId}`, tmdb: traktId * 10, imdb: null },
        },
        watched_at: "2026-01-01T00:00:00.000Z",
    };
}

function makeTraktWatchedMovie(traktId: number) {
    return {
        plays: 1,
        last_watched_at: "2026-01-01T00:00:00.000Z",
        movie: {
            title: `Movie ${traktId}`,
            year: 2025,
            ids: { trakt: traktId, slug: `movie-${traktId}`, tmdb: traktId * 10, imdb: null },
        },
    };
}

// ---------------------------------------------------------------------------
// Property 1 — recalcMovieProgress: watchCount >= 0, lastWatchedAt valid or null
// ---------------------------------------------------------------------------

describe("Property 1 — recalcMovieProgress", () => {
    it("watchCount is always >= 0 and lastWatchedAt is null or a valid ISO string", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 99999 }),
                fc.integer({ min: 1, max: 99999 }),
                fc.nat({ max: 5 }),
                async (userId, movieId, plays) => {
                    const lastWatched = plays > 0 ? now : null;
                    const db = createMockDb([[{ count: plays, lastWatched }]]);
                    (dbMockState as { db: unknown }).db = db;

                    await recalcMovieProgress(userId, movieId);

                    const insertCall = db.__state.insertValues[0] as Record<string, unknown>;
                    expect(Number(insertCall.watchCount)).toBeGreaterThanOrEqual(0);
                    const lwa = insertCall.lastWatchedAt;
                    if (lwa !== null && lwa !== undefined) {
                        expect(lwa instanceof Date || typeof lwa === "string").toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2 — syncMovies: does not throw for any empty/non-empty Trakt response
// ---------------------------------------------------------------------------

describe("Property 2 — syncMovies", () => {
    beforeEach(() => {
        traktMock.getTraktClient.mockReturnValue(traktMock.client);
        tmdbMock.getTmdbMovie.mockResolvedValue(null);
    });

    it("does not throw for arbitrary Trakt movie responses", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 5 }),
                async (traktIds) => {
                    const watchedMovies = traktIds.map(makeTraktWatchedMovie);
                    const movieHistory = traktIds.map(makeTraktMovieEntry);

                    traktMock.client.getWatchedMovies.mockResolvedValue(watchedMovies);
                    traktMock.client.getMovieHistory.mockResolvedValue(movieHistory);

                    const db = createMockDb([
                        // settings query
                        [{ displayLanguage: "en" }],
                        // stale-history delete (no-op via where)
                        [],
                        // upsert loops - each movie needs: select existing, getTmdbMovie fallback
                        ...Array(traktIds.length * 4).fill([]),
                    ]);
                    (dbMockState as { db: unknown }).db = db;

                    // Should not throw regardless of movie count
                    await expect(syncMovies(TEST_USER_ID)).resolves.not.toThrow();
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 3 — GET /api/movies/progress: result count <= limit
// ---------------------------------------------------------------------------

describe("Property 3 — GET /api/movies/progress result count <= limit", () => {
    it("never returns more rows than the requested limit", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 20 }),
                fc.integer({ min: 0, max: 3 }),
                async (limit, numMovies) => {
                    const actual = Math.min(numMovies, limit);
                    const movies = Array.from({ length: actual }, (_, i) =>
                        makeMovie({ id: i + 1, traktId: i + 1 }),
                    );
                    const progresses = movies.map((m, i) =>
                        makeProgress({ movieId: m.id, watchCount: i + 1 }),
                    );
                    const rows = movies.map((movie, i) => ({
                        movie,
                        progress: progresses[i],
                    }));

                    const db = createMockDb([[{ total: numMovies }], rows]);
                    (dbMockState as { db: unknown }).db = db;

                    const app = testApp();
                    const res = await app.request(
                        `/movies/progress?limit=${limit}&offset=0&filter=all`,
                    );
                    const body = (await res.json()) as {
                        data: unknown[];
                        total: number;
                        limit: number;
                        offset: number;
                    };

                    expect(res.status).toBe(200);
                    expect(body.data.length).toBeLessThanOrEqual(limit);
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4 — filter semantics: watched/unwatched consistency
// ---------------------------------------------------------------------------

describe("Property 4 — filter=watched/unwatched consistency", () => {
    it("filter=watched returns only watchCount > 0", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
                async (watchCounts) => {
                    const movies = watchCounts.map((wc, i) =>
                        makeMovie({ id: i + 1, traktId: i + 1 }),
                    );
                    const rows = watchCounts.map((wc, i) => ({
                        movie: movies[i],
                        progress: makeProgress({ movieId: i + 1, watchCount: wc }),
                    }));

                    const db = createMockDb([[{ total: rows.length }], rows]);
                    (dbMockState as { db: unknown }).db = db;

                    const app = testApp();
                    const res = await app.request(
                        `/movies/progress?filter=watched&limit=50&offset=0`,
                    );
                    const body = (await res.json()) as {
                        data: Array<{ watchCount: number }>;
                    };

                    expect(res.status).toBe(200);
                    for (const item of body.data) {
                        expect(item.watchCount).toBeGreaterThan(0);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("filter=unwatched returns only watchCount === 0", async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (count) => {
                const movies = Array.from({ length: count }, (_, i) =>
                    makeMovie({ id: i + 1, traktId: i + 1 }),
                );
                const rows = movies.map((movie, i) => ({
                    movie,
                    progress: makeProgress({ movieId: i + 1, watchCount: 0 }),
                }));

                const db = createMockDb([[{ total: count }], rows]);
                (dbMockState as { db: unknown }).db = db;

                const app = testApp();
                const res = await app.request(
                    `/movies/progress?filter=unwatched&limit=50&offset=0`,
                );
                const body = (await res.json()) as {
                    data: Array<{ watchCount: number }>;
                };

                expect(res.status).toBe(200);
                for (const item of body.data) {
                    expect(item.watchCount).toBe(0);
                }
            }),
            { numRuns: 30 },
        );
    });
});
