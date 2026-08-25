import { describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

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
// DB builder stub — select() is a FIFO queue split by whether innerJoin() was
// called (findRestorableHistoryEntries joins episodes/shows/movies;
// restoreHistoryEntries's own selects never join). update() is a spy so tests
// can assert exactly which local rows got their trakt_play_id/source rewritten.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class SelectBuilder implements PromiseLike<Row[]> {
    private joined = false;
    constructor(private queues: { plain: Row[][]; joined: Row[][] }) {}
    from() {
        return this;
    }
    innerJoin() {
        this.joined = true;
        return this;
    }
    where() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        const queue = this.joined ? this.queues.joined : this.queues.plain;
        return Promise.resolve(queue.shift() ?? []).then(ok, fail);
    }
}

function createMockDb(opts: { plain?: Row[][]; joined?: Row[][] } = {}) {
    const queues = { plain: [...(opts.plain ?? [])], joined: [...(opts.joined ?? [])] };
    const setWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where: setWhere }));
    return {
        select: vi.fn(() => new SelectBuilder(queues)),
        update: vi.fn(() => ({ set })),
        __set: set,
        __setWhere: setWhere,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getHistory: vi.fn().mockResolvedValue([]),
        addToHistory: vi.fn().mockResolvedValue({
            added: { movies: 0, episodes: 0 },
            not_found: { movies: [], shows: [], episodes: [] },
        }),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { findRestorableHistoryEntries, restoreHistoryEntries } =
    await import("../services/history-restore.js");

describe("findRestorableHistoryEntries", () => {
    it("flags a trakt-sourced episode as restorable when its trakt_play_id is no longer on Trakt", async () => {
        traktMockState.client = createMockTrakt({
            getHistory: vi.fn().mockResolvedValue([{ id: 12345, type: "episode" }]), // unrelated id
        });
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        source: "trakt",
                        traktPlayId: "999", // not in remote history
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: null,
                        seasonNumber: 1,
                        episodeNumber: 2,
                        episodeTitle: "Pilot",
                        episodeTranslatedTitle: null,
                    },
                ], // episode rows
                [], // movie rows
            ],
        });

        const entries = await findRestorableHistoryEntries(TEST_USER_ID, false);

        expect(entries).toEqual([
            {
                id: 1,
                mediaType: "episode",
                source: "trakt",
                watchedAt: "2026-01-01T00:00:00.000Z",
                showId: 5,
                showTitle: "Test Show",
                showTranslatedName: null,
                seasonNumber: 1,
                episodeNumber: 2,
                episodeTitle: "Pilot",
                episodeTranslatedTitle: null,
                movieId: null,
                movieTitle: null,
            },
        ]);
    });

    it("excludes a trakt-sourced row whose trakt_play_id is still present on Trakt", async () => {
        traktMockState.client = createMockTrakt({
            getHistory: vi.fn().mockResolvedValue([{ id: 999, type: "episode" }]), // matches below
        });
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        source: "trakt",
                        traktPlayId: "999",
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: null,
                        seasonNumber: 1,
                        episodeNumber: 2,
                        episodeTitle: "Pilot",
                        episodeTranslatedTitle: null,
                    },
                ],
                [],
            ],
        });

        const entries = await findRestorableHistoryEntries(TEST_USER_ID, false);
        expect(entries).toEqual([]);
    });

    it("always includes a manual-sourced row regardless of trakt_play_id (it never had one)", async () => {
        traktMockState.client = createMockTrakt();
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 2,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        source: "manual",
                        traktPlayId: null,
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: null,
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: "Pilot",
                        episodeTranslatedTitle: null,
                    },
                ],
                [],
            ],
        });

        const entries = await findRestorableHistoryEntries(TEST_USER_ID, true);
        expect(entries).toHaveLength(1);
        expect(entries[0].source).toBe("manual");
    });

    it("returns episode and movie candidates together, sorted by watchedAt descending", async () => {
        traktMockState.client = createMockTrakt();
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        source: "trakt",
                        traktPlayId: "111",
                        showId: 5,
                        showTitle: "Show A",
                        showTranslatedName: null,
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: "Ep",
                        episodeTranslatedTitle: null,
                    },
                ], // episode rows
                [
                    {
                        id: 2,
                        watchedAt: new Date("2026-01-05T00:00:00.000Z"),
                        source: "trakt",
                        traktPlayId: "222",
                        movieId: 9,
                        movieTitle: "A Movie",
                    },
                ], // movie rows
            ],
        });

        const entries = await findRestorableHistoryEntries(TEST_USER_ID, false);

        expect(entries.map((e) => e.id)).toEqual([2, 1]); // movie (2026-01-05) before episode (2026-01-01)
        expect(entries[0].mediaType).toBe("movie");
        expect(entries[1].mediaType).toBe("episode");
    });
});

describe("restoreHistoryEntries", () => {
    it("returns an all-zero result when none of the given ids match a row", async () => {
        traktMockState.client = createMockTrakt();
        dbMockState.db = createMockDb({ plain: [[]] });

        const result = await restoreHistoryEntries(TEST_USER_ID, [1, 2]);
        expect(result).toEqual({ ok: true, restored: 0, unconfirmed: 0, failed: 0 });
    });

    it("restores an episode and confirms its new trakt_play_id via reconciliation", async () => {
        const addToHistory = vi.fn().mockResolvedValue({
            added: { movies: 0, episodes: 1 },
            not_found: { movies: [], shows: [], episodes: [] },
        });
        const getHistory = vi.fn().mockResolvedValue([
            {
                id: 5555, // the newly assigned trakt history id
                type: "episode",
                watched_at: "2026-01-01T00:00:00.000Z",
                episode: { ids: { trakt: 42 } },
            },
        ]);
        traktMockState.client = createMockTrakt({ addToHistory, getHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                    },
                ], // watch_history rows
                [{ id: 100, traktId: 42 }], // episodes lookup
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [1]);

        expect(addToHistory).toHaveBeenCalledWith(TEST_USER_ID, {
            movies: [],
            episodes: [{ watched_at: "2026-01-01T00:00:00.000Z", ids: { trakt: 42 } }],
        });
        expect(db.update).toHaveBeenCalledTimes(1);
        expect(db.__set).toHaveBeenCalledWith({ traktPlayId: "5555", source: "trakt" });
        expect(result).toEqual({ ok: true, restored: 1, unconfirmed: 0, failed: 0 });
    });

    it("restores a movie the same way as an episode", async () => {
        const addToHistory = vi.fn().mockResolvedValue({
            added: { movies: 1, episodes: 0 },
            not_found: { movies: [], shows: [], episodes: [] },
        });
        const getHistory = vi.fn().mockResolvedValue([
            {
                id: 7777,
                type: "movie",
                watched_at: "2026-02-01T00:00:00.000Z",
                movie: { ids: { trakt: 88 } },
            },
        ]);
        traktMockState.client = createMockTrakt({ addToHistory, getHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 2,
                        watchedAt: new Date("2026-02-01T00:00:00.000Z"),
                        mediaType: "movie",
                        episodeId: null,
                        movieId: 200,
                    },
                ],
                [{ id: 200, traktId: 88 }], // movies lookup
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [2]);

        expect(addToHistory).toHaveBeenCalledWith(TEST_USER_ID, {
            movies: [{ watched_at: "2026-02-01T00:00:00.000Z", ids: { trakt: 88 } }],
            episodes: [],
        });
        expect(result).toEqual({ ok: true, restored: 1, unconfirmed: 0, failed: 0 });
    });

    it("counts a row as unconfirmed when the reconciliation lookup finds no match", async () => {
        const addToHistory = vi.fn().mockResolvedValue({
            added: { movies: 0, episodes: 1 },
            not_found: { movies: [], shows: [], episodes: [] },
        });
        const getHistory = vi.fn().mockResolvedValue([]); // nothing matches back
        traktMockState.client = createMockTrakt({ addToHistory, getHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                    },
                ],
                [{ id: 100, traktId: 42 }],
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [1]);

        expect(db.update).not.toHaveBeenCalled();
        expect(result).toEqual({ ok: true, restored: 0, unconfirmed: 1, failed: 0 });
    });

    it("counts a row as failed when its episode has no known Trakt id", async () => {
        const addToHistory = vi.fn();
        traktMockState.client = createMockTrakt({ addToHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                    },
                ],
                [{ id: 100, traktId: null }], // no Trakt id for this episode
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [1]);

        expect(addToHistory).not.toHaveBeenCalled();
        expect(result).toEqual({ ok: true, restored: 0, unconfirmed: 0, failed: 1 });
    });

    it("counts the whole batch as failed when the Trakt add call itself rejects", async () => {
        const addToHistory = vi.fn().mockRejectedValue(new Error("network down"));
        traktMockState.client = createMockTrakt({ addToHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                    },
                ],
                [{ id: 100, traktId: 42 }],
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [1]);

        expect(db.update).not.toHaveBeenCalled();
        expect(result).toEqual({ ok: true, restored: 0, unconfirmed: 0, failed: 1 });
    });

    it("treats every pushed row as unconfirmed when the reconciliation re-fetch itself fails", async () => {
        const addToHistory = vi.fn().mockResolvedValue({
            added: { movies: 0, episodes: 1 },
            not_found: { movies: [], shows: [], episodes: [] },
        });
        const getHistory = vi.fn().mockRejectedValue(new Error("trakt down"));
        traktMockState.client = createMockTrakt({ addToHistory, getHistory });

        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                    },
                ],
                [{ id: 100, traktId: 42 }],
            ],
        });
        dbMockState.db = db;

        const result = await restoreHistoryEntries(TEST_USER_ID, [1]);

        expect(db.update).not.toHaveBeenCalled();
        expect(result).toEqual({ ok: true, restored: 0, unconfirmed: 1, failed: 0 });
    });
});
