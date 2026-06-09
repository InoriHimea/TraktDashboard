import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 42;

type SelectResult = unknown[];

interface MockDbState {
    selectResults: SelectResult[];
    insertResults: SelectResult[];
    insertValues: unknown[];
    conflictCalls: unknown[];
    deleteWhereCalls: unknown[];
}

const dbMockState = vi.hoisted(() => ({
    db: null as unknown,
}));

const schedulerMock = vi.hoisted(() => ({
    registerUserSyncJob: vi.fn(),
    enqueueSyncNow: vi.fn(),
    getRedis: vi.fn(() => null),
}));

const traktMock = vi.hoisted(() => {
    class MockTraktApiError extends Error {
        constructor(
            public readonly status: number,
            public readonly body: string,
        ) {
            super(`Trakt API error: ${status} ${body}`);
            this.name = "TraktApiError";
        }
    }

    return {
        TraktApiError: MockTraktApiError,
        getTraktClient: vi.fn(),
        client: {
            addToWatchlist: vi.fn(),
            removeFromWatchlist: vi.fn(),
            getWatchlistShows: vi.fn(),
            getWatchlistMovies: vi.fn(),
            getWatchedMovies: vi.fn(),
            getMovieHistory: vi.fn(),
        },
    };
});

const tmdbMock = vi.hoisted(() => ({
    getTmdbMovie: vi.fn(),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>(
            "@trakt-dashboard/db",
        );
    return {
        ...actual,
        getDb: () => dbMockState.db,
    };
});

vi.mock("../jobs/scheduler.js", () => schedulerMock);
vi.mock("../services/trakt.js", () => ({
    getTraktClient: traktMock.getTraktClient,
    TraktApiError: traktMock.TraktApiError,
}));
vi.mock("../services/tmdb.js", () => ({
    getTmdbMovie: tmdbMock.getTmdbMovie,
    getTmdbSeason: vi.fn(),
    getTmdbShow: vi.fn(),
}));

const { settingsRoutes } = await import("../routes/settings.js");
const { watchlistRoutes } = await import("../routes/watchlist.js");
const { showRoutes } = await import("../routes/shows.js");
const { syncRoutes } = await import("../routes/sync.js");
const { syncMovies, syncWatchlist } = await import("../services/sync.js");

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

    then<TResult1 = SelectResult, TResult2 = never>(
        onfulfilled?:
            | ((value: SelectResult) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
}

class InsertBuilder implements PromiseLike<void> {
    constructor(private readonly state: MockDbState) {}

    values(value: unknown) {
        this.state.insertValues.push(value);
        return this;
    }

    onConflictDoUpdate(value: unknown) {
        this.state.conflictCalls.push(value);
        return this;
    }

    onConflictDoNothing() {
        return this;
    }

    returning() {
        return Promise.resolve(this.state.insertResults.shift() ?? []);
    }

    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return Promise.resolve(undefined).then(onfulfilled, onrejected);
    }
}

class DeleteBuilder {
    constructor(private readonly state: MockDbState) {}

    where(value: unknown) {
        this.state.deleteWhereCalls.push(value);
        return Promise.resolve();
    }
}

function createMockDb({
    selectResults = [],
    insertResults = [],
}: {
    selectResults?: SelectResult[];
    insertResults?: SelectResult[];
} = {}) {
    const state: MockDbState = {
        selectResults: [...selectResults],
        insertResults: [...insertResults],
        insertValues: [],
        conflictCalls: [],
        deleteWhereCalls: [],
    };

    const db = {
        select: vi.fn(() => new SelectBuilder(state.selectResults.shift() ?? [])),
        insert: vi.fn(() => new InsertBuilder(state)),
        delete: vi.fn(() => new DeleteBuilder(state)),
        __state: state,
    };

    return db;
}

function testApp(path: string, routes: Hono<{ Variables: { userId: number } }>) {
    const app = new Hono<{ Variables: { userId: number } }>();
    app.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    app.route(path, routes);
    return app;
}

function jsonRequest(method: string, body: unknown) {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

async function parseJson<T>(res: Response): Promise<T> {
    return (await res.json()) as T;
}

const now = new Date("2026-06-05T12:00:00.000Z");

function makeShow(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        tmdbId: 1001,
        tvdbId: null,
        imdbId: "tt1001",
        traktId: 5001,
        traktSlug: "neon-signal",
        title: "Neon Signal",
        overview: "Overview",
        status: "returning series",
        firstAired: "2026-01-01",
        network: "HBO",
        genres: ["Drama"],
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        totalEpisodes: 10,
        totalSeasons: 1,
        originalName: "Neon Signal",
        originalLanguage: "en",
        translatedName: "Neon Signal CN",
        translatedOverview: "Translated overview",
        displayLanguage: "zh-CN",
        lastSyncedAt: now,
        createdAt: now,
        ...overrides,
    };
}

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

function makeEpisode(overrides: Record<string, unknown> = {}) {
    return {
        id: 207,
        showId: 1,
        seasonId: 10,
        seasonNumber: 1,
        episodeNumber: 7,
        title: "Afterimage",
        overview: "Next episode",
        translatedTitle: "Afterimage CN",
        translatedOverview: "Next episode CN",
        runtime: 45,
        airDate: "2026-06-07",
        stillPath: "/still.jpg",
        traktId: 9207,
        tmdbId: 8207,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    traktMock.getTraktClient.mockReturnValue(traktMock.client);
    dbMockState.db = createMockDb();
});

describe("settings routes", () => {
    it("returns defaults when no user settings row exists", async () => {
        dbMockState.db = createMockDb({ selectResults: [[]] });
        const app = testApp("/settings", settingsRoutes);

        const res = await app.request("/settings");
        const body = await parseJson<{
            data: {
                userId: number;
                displayLanguage: string;
                syncIntervalMinutes: number;
                httpProxy: string | null;
            };
        }>(res);

        expect(res.status).toBe(200);
        expect(body).toEqual({
            data: {
                userId: TEST_USER_ID,
                displayLanguage: "zh-CN",
                syncIntervalMinutes: 60,
                httpProxy: null,
            },
        });
    });

    it("persists updates and re-registers sync when interval changes", async () => {
        const existing = {
            userId: TEST_USER_ID,
            displayLanguage: "zh-CN",
            syncIntervalMinutes: 60,
            httpProxy: null,
        };
        const db = createMockDb({ selectResults: [[existing]] });
        dbMockState.db = db;
        const app = testApp("/settings", settingsRoutes);

        const res = await app.request(
            "/settings",
            jsonRequest("PUT", {
                displayLanguage: "en-US",
                syncIntervalMinutes: 120,
                httpProxy: "http://127.0.0.1:7890",
            }),
        );
        const body = await parseJson<{
            data: {
                userId: number;
                displayLanguage: string;
                syncIntervalMinutes: number;
                httpProxy: string | null;
            };
        }>(res);

        expect(res.status).toBe(200);
        expect(body.data).toMatchObject({
            userId: TEST_USER_ID,
            displayLanguage: "en-US",
            syncIntervalMinutes: 120,
            httpProxy: "http://127.0.0.1:7890",
        });
        expect(db.__state.insertValues).toHaveLength(1);
        expect(schedulerMock.registerUserSyncJob).toHaveBeenCalledWith(
            TEST_USER_ID,
        );
    });
});

describe("watchlist routes", () => {
    it("adds to Trakt before writing the local watchlist row", async () => {
        const show = makeShow();
        const inserted = {
            id: 77,
            userId: TEST_USER_ID,
            showId: show.id,
            movieId: null,
            listedAt: now,
            notes: "queue",
        };
        const db = createMockDb({
            selectResults: [[show]],
            insertResults: [[inserted]],
        });
        dbMockState.db = db;
        traktMock.client.addToWatchlist.mockResolvedValue(undefined);
        const app = testApp("/watchlist", watchlistRoutes);

        const res = await app.request(
            "/watchlist",
            jsonRequest("POST", { type: "show", id: show.id, notes: "queue" }),
        );
        const body = await parseJson<{
            data: { id: number; showId: number | null };
        }>(res);

        expect(res.status).toBe(200);
        expect(body.data).toMatchObject({ id: 77, showId: show.id });
        expect(traktMock.client.addToWatchlist).toHaveBeenCalledWith(
            TEST_USER_ID,
            "shows",
            { trakt: 5001, tmdb: 1001, imdb: "tt1001" },
        );
        expect(db.__state.insertValues).toEqual([
            expect.objectContaining({
                userId: TEST_USER_ID,
                showId: show.id,
                movieId: null,
                notes: "queue",
            }),
        ]);
    });

    it("keeps delete idempotent when Trakt reports a missing item", async () => {
        const show = makeShow();
        const db = createMockDb({
            selectResults: [
                [
                    {
                        watchlist: {
                            id: 77,
                            userId: TEST_USER_ID,
                            showId: show.id,
                            movieId: null,
                        },
                        shows: show,
                        movies: null,
                    },
                ],
            ],
        });
        dbMockState.db = db;
        traktMock.client.removeFromWatchlist.mockRejectedValue(
            new traktMock.TraktApiError(404, "not found"),
        );
        const app = testApp("/watchlist", watchlistRoutes);

        const res = await app.request("/watchlist/77", { method: "DELETE" });
        const body = await parseJson<{ ok: boolean }>(res);

        expect(res.status).toBe(200);
        expect(body).toEqual({ ok: true });
        expect(traktMock.client.removeFromWatchlist).toHaveBeenCalledWith(
            TEST_USER_ID,
            "shows",
            { trakt: 5001, tmdb: 1001, imdb: "tt1001" },
        );
        expect(db.__state.deleteWhereCalls).toHaveLength(1);
    });
});

describe("show detail route", () => {
    it("returns nextEpisode from the progress cache nextEpisodeId", async () => {
        const show = makeShow();
        const nextEpisode = makeEpisode();
        const season = {
            id: 10,
            showId: show.id,
            seasonNumber: 1,
            episodeCount: 2,
            airDate: "2026-01-01",
            overview: null,
            posterPath: null,
        };
        const progress = {
            id: 501,
            userId: TEST_USER_ID,
            showId: show.id,
            airedEpisodes: 2,
            watchedEpisodes: 1,
            nextEpisodeId: nextEpisode.id,
            lastWatchedAt: now,
            completed: false,
            updatedAt: now,
        };
        const watchedEpisode = makeEpisode({
            id: 201,
            episodeNumber: 1,
            airDate: "2026-01-01",
        });
        const db = createMockDb({
            selectResults: [
                [show],
                [progress],
                [season],
                [watchedEpisode, nextEpisode],
                [{ episodeId: watchedEpisode.id, watchedAt: now }],
                [nextEpisode],
            ],
        });
        dbMockState.db = db;
        const app = testApp("/shows", showRoutes);

        const res = await app.request("/shows/1");
        const body = await parseJson<{
            data: {
                nextEpisode: {
                    id: number;
                    seasonNumber: number;
                    episodeNumber: number;
                    title: string;
                } | null;
                seasons: { episodes: unknown[] }[];
                percentage: number;
            };
        }>(res);

        expect(res.status).toBe(200);
        expect(body.data.nextEpisode).toMatchObject({
            id: nextEpisode.id,
            seasonNumber: 1,
            episodeNumber: 7,
            title: "Afterimage",
        });
        expect(body.data.seasons[0].episodes).toHaveLength(2);
        expect(body.data.percentage).toBe(50);
    });
});

describe("sync routes", () => {
    beforeEach(() => {
        schedulerMock.enqueueSyncNow.mockReset();
    });

    it("queues manual sync with per-user dedup when idle", async () => {
        const db = createMockDb({ selectResults: [[{ status: "idle" }]] });
        dbMockState.db = db;
        schedulerMock.enqueueSyncNow.mockResolvedValue({ id: "sync-now-42" });
        const app = testApp("/sync", syncRoutes);

        const res = await app.request("/sync/trigger", { method: "POST" });
        const body = await parseJson<{ ok: boolean; message: string }>(res);

        expect(res.status).toBe(202);
        expect(body).toEqual({ ok: true, message: "Sync queued" });
        expect(schedulerMock.enqueueSyncNow).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("rejects duplicate manual sync while a sync is running", async () => {
        const db = createMockDb({ selectResults: [[{ status: "running" }]] });
        dbMockState.db = db;
        const app = testApp("/sync", syncRoutes);

        const res = await app.request("/sync/trigger", { method: "POST" });
        const body = await parseJson<{ ok: boolean; message: string }>(res);

        expect(res.status).toBe(409);
        expect(body.ok).toBe(false);
        expect(body.message).toBe("Sync already running");
        expect(schedulerMock.enqueueSyncNow).not.toHaveBeenCalled();
    });
});

describe("syncWatchlist", () => {
    it("upserts remote items and protects cleanup when remote media is unresolved", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const show = makeShow({ id: 11, tmdbId: 1101 });
        const movie = makeMovie({ id: 22, tmdbId: 2202 });
        const db = createMockDb({
            selectResults: [
                [{ id: show.id }],
                [],
                [{ id: movie.id }],
                [],
            ],
        });
        dbMockState.db = db;
        traktMock.client.getWatchlistShows.mockResolvedValue([
            {
                listed_at: "2026-06-01T00:00:00.000Z",
                show: { title: "Remote Show", ids: { tmdb: show.tmdbId } },
            },
            {
                listed_at: "2026-06-01T00:00:00.000Z",
                show: { title: "No Tmdb Show", ids: {} },
            },
            {
                listed_at: "2026-06-01T00:00:00.000Z",
                show: { title: "Missing Local Show", ids: { tmdb: 9999 } },
            },
        ]);
        traktMock.client.getWatchlistMovies.mockResolvedValue([
            {
                listed_at: "2026-06-02T00:00:00.000Z",
                movie: { title: "Remote Movie", ids: { tmdb: movie.tmdbId } },
            },
            {
                listed_at: "2026-06-02T00:00:00.000Z",
                movie: { title: "Missing Local Movie", ids: { tmdb: 9998 } },
            },
        ]);

        await syncWatchlist(TEST_USER_ID);

        expect(db.__state.insertValues).toEqual([
            expect.objectContaining({
                userId: TEST_USER_ID,
                showId: show.id,
                movieId: null,
            }),
            expect.objectContaining({
                userId: TEST_USER_ID,
                showId: null,
                movieId: movie.id,
            }),
        ]);
        expect(db.__state.conflictCalls).toHaveLength(2);
        expect(db.__state.deleteWhereCalls).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Show "No Tmdb Show" could not be resolved'),
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Show "Missing Local Show" could not be resolved',
            ),
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Movie "Missing Local Movie" could not be resolved',
            ),
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Skipping show cleanup"),
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Skipping movie cleanup"),
        );

        warnSpy.mockRestore();
        logSpy.mockRestore();
    });

    it("falls back to Trakt and IMDb ids before running cleanup", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const show = makeShow({
            id: 33,
            tmdbId: 3303,
            traktId: 3333,
            imdbId: "tt3333",
        });
        const movie = makeMovie({
            id: 44,
            tmdbId: 4404,
            traktId: 4444,
            imdbId: "tt4444",
        });
        const db = createMockDb({
            selectResults: [[{ id: show.id }], [{ id: movie.id }]],
        });
        dbMockState.db = db;
        traktMock.client.getWatchlistShows.mockResolvedValue([
            {
                listed_at: "2026-06-03T00:00:00.000Z",
                show: {
                    title: "Fallback Show",
                    ids: { tmdb: null, trakt: show.traktId, imdb: show.imdbId },
                },
            },
        ]);
        traktMock.client.getWatchlistMovies.mockResolvedValue([
            {
                listed_at: "2026-06-04T00:00:00.000Z",
                movie: {
                    title: "Fallback Movie",
                    ids: { tmdb: null, trakt: null, imdb: movie.imdbId },
                },
            },
        ]);

        await syncWatchlist(TEST_USER_ID);

        expect(db.__state.insertValues).toEqual([
            expect.objectContaining({
                userId: TEST_USER_ID,
                showId: show.id,
                movieId: null,
            }),
            expect.objectContaining({
                userId: TEST_USER_ID,
                showId: null,
                movieId: movie.id,
            }),
        ]);
        expect(db.__state.conflictCalls).toHaveLength(2);
        expect(db.__state.deleteWhereCalls).toHaveLength(2);
        expect(warnSpy).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Matched show "Fallback Show" by trakt fallback',
            ),
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                'Matched movie "Fallback Movie" by imdb fallback',
            ),
        );

        warnSpy.mockRestore();
        logSpy.mockRestore();
    });
});

describe("syncMovies", () => {
    it("recalculates movie progress from current history instead of Trakt plays", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const movie = makeMovie({
            id: 378,
            tmdbId: 9009,
            traktId: 7009,
            traktSlug: "legend",
            title: "Legend",
        });
        const watchedAt = new Date("2026-06-06T08:58:00.000Z");
        const db = createMockDb({
            selectResults: [
                [{ displayLanguage: "zh-CN" }],
                [{ movieId: movie.id }],
                [{ count: 1, lastWatched: watchedAt }],
            ],
            insertResults: [[{ id: movie.id }]],
        });
        dbMockState.db = db;
        traktMock.client.getWatchedMovies.mockResolvedValue([
            {
                plays: 2,
                last_watched_at: watchedAt.toISOString(),
                last_updated_at: watchedAt.toISOString(),
                movie: {
                    title: movie.title,
                    year: 2024,
                    ids: {
                        trakt: movie.traktId,
                        slug: movie.traktSlug,
                        imdb: movie.imdbId,
                        tmdb: movie.tmdbId,
                    },
                },
            },
        ]);
        traktMock.client.getMovieHistory.mockResolvedValue([
            {
                id: 2642,
                watched_at: watchedAt.toISOString(),
                action: "watch",
                type: "movie",
                movie: {
                    title: movie.title,
                    year: 2024,
                    ids: {
                        trakt: movie.traktId,
                        slug: movie.traktSlug,
                        imdb: movie.imdbId,
                        tmdb: movie.tmdbId,
                    },
                },
            },
        ]);
        tmdbMock.getTmdbMovie.mockResolvedValue({
            title: movie.title,
            original_title: movie.title,
            original_language: "en",
            overview: movie.overview,
            release_date: movie.releaseDate,
            runtime: movie.runtime,
            poster_path: movie.posterPath,
            backdrop_path: movie.backdropPath,
            genres: movie.genres.map((name) => ({ name })),
            translations: { translations: [] },
        });

        await syncMovies(TEST_USER_ID);

        expect(db.__state.deleteWhereCalls).toHaveLength(1);
        expect(db.__state.insertValues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    movieId: movie.id,
                    source: "trakt",
                    traktPlayId: "2642",
                    watchedAt,
                }),
                expect.objectContaining({
                    userId: TEST_USER_ID,
                    movieId: movie.id,
                    watchCount: 1,
                    lastWatchedAt: watchedAt,
                }),
            ]),
        );
        expect(db.__state.insertValues).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    movieId: movie.id,
                    watchCount: 2,
                }),
            ]),
        );

        logSpy.mockRestore();
    });
});
