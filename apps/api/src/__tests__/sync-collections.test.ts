import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
}));

// ---------------------------------------------------------------------------
// DB builder stubs — plain sequential FIFO select queue (call order per
// scenario is fixed and spelled out per test); captured insert/update values
// so assertions can inspect what would have been persisted.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type RowsResult = Row[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(
        private _result: RowsResult,
        private onValues?: (v: unknown) => void,
        private onSet?: (v: unknown) => void,
    ) {}
    from() {
        return this;
    }
    where() {
        return this;
    }
    limit() {
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    values(v: unknown) {
        this.onValues?.(v);
        return this;
    }
    set(v: unknown) {
        this.onSet?.(v);
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this._result).then(ok, fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    const insertedValues: unknown[] = [];
    const updatedValues: unknown[] = [];
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder([], (v) => insertedValues.push(v))),
        update: vi.fn(() => new ChainBuilder([], undefined, (v) => updatedValues.push(v))),
        delete: vi.fn(() => new ChainBuilder([])),
        __state: state,
        __insertedValues: insertedValues,
        __updatedValues: updatedValues,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getWatchlistShows: vi.fn().mockResolvedValue([]),
        getWatchlistMovies: vi.fn().mockResolvedValue([]),
        getRatingsShows: vi.fn().mockResolvedValue([]),
        getRatingsMovies: vi.fn().mockResolvedValue([]),
        getCollectionShows: vi.fn().mockResolvedValue([]),
        getCollectionMovies: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { syncWatchlist, syncRatings, syncUserCollection } = await import("../services/sync.js");

const USER_ID = 7;

beforeEach(() => {
    dbMockState.db = createMockDb();
    traktMockState.client = createMockTrakt();
});

// ---------------------------------------------------------------------------
// syncWatchlist
// ---------------------------------------------------------------------------

describe("syncWatchlist", () => {
    it("matches a show by tmdb id, inserts it, and cleans up both watchlists", async () => {
        traktMockState.client = createMockTrakt({
            getWatchlistShows: vi.fn().mockResolvedValue([
                {
                    listed_at: "2026-01-01T00:00:00.000Z",
                    show: { title: "Show A", ids: { tmdb: 100 } },
                },
            ]),
        });
        const db = createMockDb([[{ id: 5 }]]);
        dbMockState.db = db;

        await syncWatchlist(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({ userId: USER_ID, showId: 5, movieId: null });
        expect(db.delete).toHaveBeenCalledTimes(2);
    });

    it("falls back to the trakt id when the tmdb id doesn't match locally", async () => {
        traktMockState.client = createMockTrakt({
            getWatchlistShows: vi.fn().mockResolvedValue([
                {
                    listed_at: "2026-01-01T00:00:00.000Z",
                    show: { title: "Show B", ids: { tmdb: 200, trakt: 300 } },
                },
            ]),
        });
        const db = createMockDb([[], [{ id: 6 }]]);
        dbMockState.db = db;

        await syncWatchlist(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({ showId: 6 });
    });

    it("counts an unresolved show and skips show cleanup but still cleans up movies", async () => {
        traktMockState.client = createMockTrakt({
            getWatchlistShows: vi
                .fn()
                .mockResolvedValue([
                    { listed_at: "2026-01-01T00:00:00.000Z", show: { title: "Unknown", ids: {} } },
                ]),
        });
        const db = createMockDb([]);
        dbMockState.db = db;

        await syncWatchlist(USER_ID);

        expect(db.insert).not.toHaveBeenCalled();
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("matches a movie by tmdb id and inserts it", async () => {
        traktMockState.client = createMockTrakt({
            getWatchlistMovies: vi.fn().mockResolvedValue([
                {
                    listed_at: "2026-01-01T00:00:00.000Z",
                    movie: { title: "Movie A", ids: { tmdb: 500 } },
                },
            ]),
        });
        const db = createMockDb([[{ id: 9 }]]);
        dbMockState.db = db;

        await syncWatchlist(USER_ID);

        expect(db.__insertedValues[0]).toMatchObject({ movieId: 9, showId: null });
    });

    it("catches an error from the Trakt fetch without throwing", async () => {
        traktMockState.client = createMockTrakt({
            getWatchlistShows: vi.fn().mockRejectedValue(new Error("trakt down")),
        });
        await expect(syncWatchlist(USER_ID)).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// syncRatings
// ---------------------------------------------------------------------------

describe("syncRatings", () => {
    it("resolves show and movie ratings by trakt id and upserts both", async () => {
        traktMockState.client = createMockTrakt({
            getRatingsShows: vi.fn().mockResolvedValue([
                {
                    rating: 8,
                    rated_at: "2026-01-01T00:00:00.000Z",
                    show: { ids: { trakt: 111 } },
                },
            ]),
            getRatingsMovies: vi
                .fn()
                .mockResolvedValue([{ rating: 9, rated_at: null, movie: { ids: { trakt: 222 } } }]),
        });
        const db = createMockDb([[{ id: 1, traktId: 111 }], [{ id: 2, traktId: 222 }]]);
        dbMockState.db = db;

        await syncRatings(USER_ID);

        expect(db.__insertedValues).toEqual([
            expect.objectContaining({ mediaType: "show", showId: 1, rating: 8 }),
            expect.objectContaining({ mediaType: "movie", movieId: 2, rating: 9, ratedAt: null }),
        ]);
    });

    it("skips a rating whose trakt id can't be resolved locally", async () => {
        traktMockState.client = createMockTrakt({
            getRatingsShows: vi
                .fn()
                .mockResolvedValue([{ rating: 5, rated_at: null, show: { ids: { trakt: 999 } } }]),
        });
        const db = createMockDb([[]]);
        dbMockState.db = db;

        await syncRatings(USER_ID);

        expect(db.insert).not.toHaveBeenCalled();
    });

    it("skips the batch lookup entirely when there are no ratings of a given type", async () => {
        const db = createMockDb([]);
        dbMockState.db = db;

        await syncRatings(USER_ID);

        expect(db.select).not.toHaveBeenCalled();
        expect(db.insert).not.toHaveBeenCalled();
    });

    it("catches an error from the Trakt fetch without throwing", async () => {
        traktMockState.client = createMockTrakt({
            getRatingsShows: vi.fn().mockRejectedValue(new Error("trakt down")),
        });
        await expect(syncRatings(USER_ID)).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// syncUserCollection
// ---------------------------------------------------------------------------

describe("syncUserCollection", () => {
    it("inserts a new show-level row plus a per-episode row, and counts synced once per show", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionShows: vi.fn().mockResolvedValue([
                {
                    last_collected_at: "2026-01-01T00:00:00.000Z",
                    show: { ids: { tmdb: 100 } },
                    seasons: [
                        {
                            number: 1,
                            episodes: [
                                {
                                    number: 1,
                                    collected_at: "2026-01-02T00:00:00.000Z",
                                    metadata: { media_type: "bluray", resolution: "1080p" },
                                },
                            ],
                        },
                    ],
                },
            ]),
        });
        const db = createMockDb([[{ id: 5, tmdbId: 100 }], [], []]);
        dbMockState.db = db;

        const synced = await syncUserCollection(USER_ID);

        expect(synced).toBe(1);
        expect(db.__insertedValues[0]).toMatchObject({
            mediaType: "show",
            showId: 5,
            mediaFormat: "bluray",
            resolution: "1080p",
        });
        expect(db.__insertedValues[1]).toMatchObject({
            mediaType: "episode",
            showId: 5,
            season: 1,
            episode: 1,
        });
    });

    it("updates an existing show-level row instead of inserting", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionShows: vi.fn().mockResolvedValue([{ show: { ids: { tmdb: 100 } } }]),
        });
        const db = createMockDb([[{ id: 5, tmdbId: 100 }], [{ id: 77 }]]);
        dbMockState.db = db;

        await syncUserCollection(USER_ID);

        expect(db.insert).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });

    it("skips a show whose tmdb id can't be resolved locally", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionShows: vi.fn().mockResolvedValue([{ show: { ids: { tmdb: 999 } } }]),
        });
        const db = createMockDb([[]]);
        dbMockState.db = db;

        const synced = await syncUserCollection(USER_ID);

        expect(synced).toBe(0);
        expect(db.insert).not.toHaveBeenCalled();
    });

    it("inserts a new movie collection row", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionMovies: vi.fn().mockResolvedValue([
                {
                    collected_at: "2026-01-01T00:00:00.000Z",
                    movie: { ids: { tmdb: 500 } },
                    metadata: { media_type: "web-dl" },
                },
            ]),
        });
        const db = createMockDb([[{ id: 9, tmdbId: 500 }], []]);
        dbMockState.db = db;

        const synced = await syncUserCollection(USER_ID);

        expect(synced).toBe(1);
        expect(db.__insertedValues[0]).toMatchObject({
            mediaType: "movie",
            movieId: 9,
            mediaFormat: "web-dl",
        });
    });

    it("updates an existing movie collection row instead of inserting", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionMovies: vi.fn().mockResolvedValue([{ movie: { ids: { tmdb: 500 } } }]),
        });
        const db = createMockDb([[{ id: 9, tmdbId: 500 }], [{ id: 88 }]]);
        dbMockState.db = db;

        await syncUserCollection(USER_ID);

        expect(db.insert).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });

    it("returns 0 and doesn't throw when both Trakt calls fail", async () => {
        traktMockState.client = createMockTrakt({
            getCollectionShows: vi.fn().mockRejectedValue(new Error("trakt down")),
            getCollectionMovies: vi.fn().mockRejectedValue(new Error("trakt down")),
        });
        const synced = await syncUserCollection(USER_ID);
        expect(synced).toBe(0);
    });
});
