import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const tmdbMockState = vi.hoisted(() => ({ getTmdbMovie: vi.fn() }));
const i18nMockState = vi.hoisted(() => ({
    buildLanguageFallbackChain: vi.fn(() => [] as string[]),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
}));

vi.mock("../services/tmdb.js", () => ({
    getTmdbMovie: tmdbMockState.getTmdbMovie,
}));

vi.mock("@trakt-dashboard/i18n", () => ({
    buildLanguageFallbackChain: i18nMockState.buildLanguageFallbackChain,
}));

// ---------------------------------------------------------------------------
// DB builder stubs — plain sequential FIFO queues (selects and inserts each
// consumed in the exact order syncMovies + the recalcMovieProgress calls it
// triggers would issue them).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type RowsResult = Row[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(
        private _result: RowsResult,
        private onValues?: (v: unknown) => void,
    ) {}
    from() {
        return this;
    }
    where() {
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    returning() {
        return this;
    }
    values(v: unknown) {
        this.onValues?.(v);
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this._result).then(ok, fail);
    }
}

function createMockDb(opts: { selects?: RowsResult[]; inserts?: RowsResult[] } = {}) {
    const state = {
        selects: [...(opts.selects ?? [])],
        inserts: [...(opts.inserts ?? [])],
    };
    const insertedValues: unknown[] = [];
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => {
            const result = state.inserts.shift() ?? [];
            return new ChainBuilder(result, (v) => insertedValues.push(v));
        }),
        delete: vi.fn(() => new ChainBuilder([])),
        __insertedValues: insertedValues,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getWatchedMovies: vi.fn().mockResolvedValue([]),
        getMovieHistory: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function makeTmdbMovie(overrides: Record<string, unknown> = {}) {
    return {
        title: "Arrival",
        original_title: "Arrival",
        original_language: "en",
        poster_path: null,
        backdrop_path: null,
        overview: "A linguist deciphers an alien language.",
        release_date: "2016-11-11",
        runtime: 116,
        genres: [],
        translations: { translations: [] },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { syncMovies } = await import("../services/sync.js");

const USER_ID = 7;

beforeEach(() => {
    dbMockState.db = createMockDb();
    traktMockState.client = createMockTrakt();
    tmdbMockState.getTmdbMovie.mockReset().mockResolvedValue(makeTmdbMovie());
    i18nMockState.buildLanguageFallbackChain.mockReset().mockReturnValue([]);
});

describe("syncMovies", () => {
    it("returns early (no further DB calls) when the Trakt fetch fails", async () => {
        traktMockState.client = createMockTrakt({
            getWatchedMovies: vi.fn().mockRejectedValue(new Error("trakt down")),
        });
        const db = createMockDb({ selects: [[{ displayLanguage: null }]] });
        dbMockState.db = db;

        await expect(syncMovies(USER_ID)).resolves.toBeUndefined();

        expect(db.select).toHaveBeenCalledTimes(1);
        expect(db.insert).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
    });

    it("resolves TMDB metadata, upserts the movie, syncs history, and recalculates progress", async () => {
        traktMockState.client = createMockTrakt({
            getMovieHistory: vi.fn().mockResolvedValue([
                {
                    id: 555,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "movie",
                    movie: {
                        title: "Arrival",
                        year: 2016,
                        ids: { trakt: 10, slug: "arrival", imdb: "tt123", tmdb: 200 },
                    },
                },
            ]),
        });
        const db = createMockDb({
            selects: [
                [{ displayLanguage: null }], // getProxyUrl-style settings lookup
                [], // stale trakt history rows — none
                [{ count: 1, lastWatched: new Date("2026-01-01T00:00:00.000Z") }], // recalc aggregate
            ],
            inserts: [
                [{ id: 300 }], // movies upsert .returning()
                [], // watchHistory upsert
                [], // userMovieProgress upsert (from recalcMovieProgress)
            ],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({
            tmdbId: 200,
            traktId: 10,
            title: "Arrival",
        });
        expect(db.__insertedValues[1]).toMatchObject({
            movieId: 300,
            mediaType: "movie",
            traktPlayId: "555",
        });
    });

    it("localizes the title/overview when a matching translation exists", async () => {
        i18nMockState.buildLanguageFallbackChain.mockReturnValue(["zh-CN"]);
        tmdbMockState.getTmdbMovie.mockResolvedValue(
            makeTmdbMovie({
                translations: {
                    translations: [
                        {
                            iso_639_1: "zh",
                            iso_3166_1: "CN",
                            data: { title: "降临", overview: "降临概述" },
                        },
                    ],
                },
            }),
        );
        traktMockState.client = createMockTrakt({
            getMovieHistory: vi.fn().mockResolvedValue([
                {
                    id: 555,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "movie",
                    movie: { title: "Arrival", year: 2016, ids: { trakt: 10, tmdb: 200 } },
                },
            ]),
        });
        const db = createMockDb({
            selects: [[{ displayLanguage: "zh-CN" }], [], [{ count: 1, lastWatched: null }]],
            inserts: [[{ id: 301 }], [], []],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({
            title: "降临",
            overview: "降临概述",
        });
    });

    it("keeps Trakt-provided defaults when the TMDB fetch fails", async () => {
        tmdbMockState.getTmdbMovie.mockRejectedValue(new Error("tmdb down"));
        traktMockState.client = createMockTrakt({
            getMovieHistory: vi.fn().mockResolvedValue([
                {
                    id: 555,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "movie",
                    movie: { title: "Arrival", year: 2016, ids: { trakt: 10, tmdb: 200 } },
                },
            ]),
        });
        const db = createMockDb({
            selects: [[{ displayLanguage: null }], [], [{ count: 1, lastWatched: null }]],
            inserts: [[{ id: 302 }], [], []],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({
            title: "Arrival",
            overview: null,
            genres: [],
        });
    });

    it("reuses an existing local movie found by traktId when there's no tmdbId", async () => {
        traktMockState.client = createMockTrakt({
            getMovieHistory: vi.fn().mockResolvedValue([
                {
                    id: 555,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "movie",
                    movie: { title: "Local Film", year: 2020, ids: { trakt: 20, imdb: null } },
                },
            ]),
        });
        const db = createMockDb({
            selects: [
                [{ displayLanguage: null }],
                [], // stale rows
                [{ id: 88 }], // existing movie found by traktId
                [{ count: 1, lastWatched: null }], // recalc aggregate
            ],
            inserts: [[], []], // watchHistory upsert, userMovieProgress upsert — no movies insert
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues).toHaveLength(2);
        expect(db.__insertedValues[0]).toMatchObject({ movieId: 88, mediaType: "movie" });
        expect(tmdbMockState.getTmdbMovie).not.toHaveBeenCalled();
    });

    it("inserts a new movie row without TMDB metadata when there's no tmdbId and no existing match", async () => {
        traktMockState.client = createMockTrakt({
            getMovieHistory: vi.fn().mockResolvedValue([
                {
                    id: 556,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "movie",
                    movie: { title: "New Local Film", year: 2020, ids: { trakt: 21, imdb: null } },
                },
            ]),
        });
        const db = createMockDb({
            selects: [
                [{ displayLanguage: null }],
                [],
                [], // no existing movie found
                [{ count: 1, lastWatched: null }],
            ],
            inserts: [[{ id: 99 }], [], []],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({ tmdbId: null, traktId: 21, genres: [] });
    });

    it("writes progress directly from the watched summary (no history) and skips the recalc pass", async () => {
        traktMockState.client = createMockTrakt({
            getWatchedMovies: vi.fn().mockResolvedValue([
                {
                    movie: { title: "Old Movie", year: 2015, ids: { trakt: 30, tmdb: 400 } },
                    plays: 5,
                    last_watched_at: "2026-01-01T00:00:00.000Z",
                    last_updated_at: "2026-01-01T00:00:00.000Z",
                },
            ]),
        });
        const db = createMockDb({
            selects: [[{ displayLanguage: null }], []],
            inserts: [[{ id: 500 }], []],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.__insertedValues).toHaveLength(2);
        expect(db.__insertedValues[1]).toMatchObject({
            userId: USER_ID,
            movieId: 500,
            watchCount: 5,
        });
    });

    it("deletes stale trakt-sourced watch history and still recalculates the affected movie", async () => {
        const db = createMockDb({
            selects: [
                [{ displayLanguage: null }],
                [{ movieId: 77 }], // stale row found
                [{ count: 0, lastWatched: null }], // recalc aggregate for movie 77
            ],
            inserts: [[]],
        });
        dbMockState.db = db;

        await syncMovies(USER_ID);

        expect(db.delete).toHaveBeenCalledTimes(1);
    });
});
