import { describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const syncMockState = vi.hoisted(() => ({
    recalcShowProgress: vi.fn().mockResolvedValue(undefined),
    recalcMovieProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/sync.js", () => ({
    recalcShowProgress: syncMockState.recalcShowProgress,
    recalcMovieProgress: syncMockState.recalcMovieProgress,
}));

// ---------------------------------------------------------------------------
// DB builder stub — select() is a FIFO queue split by whether innerJoin() was
// called (findPendingDeletions joins episodes/shows/movies; restoreFromDeletions's
// own selects never join). transaction() hands the callback a tx exposing
// insert/update that record their calls for assertions.
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
    const insertedValues: unknown[] = [];
    const updatedValues: unknown[] = [];
    const db = {
        select: vi.fn(() => new SelectBuilder(queues)),
        insert: vi.fn(() => ({
            values: vi.fn((v: unknown) => {
                insertedValues.push(v);
                return Promise.resolve(undefined);
            }),
        })),
        update: vi.fn(() => ({
            set: vi.fn((v: unknown) => {
                updatedValues.push(v);
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        })),
        __insertedValues: insertedValues,
        __updatedValues: updatedValues,
    };
    return {
        ...db,
        transaction: vi.fn((fn: (tx: typeof db) => unknown) => fn(db)),
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { findPendingDeletions, restoreFromDeletions } = await import("../services/history-audit.js");

describe("findPendingDeletions", () => {
    it("returns an episode audit entry with its enriched title fields", async () => {
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 1,
                        reason: "manual",
                        deletedAt: new Date("2026-01-02T00:00:00.000Z"),
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: null,
                        seasonNumber: 3,
                        episodeNumber: 67,
                        episodeTitle: "Some Episode",
                        episodeTranslatedTitle: null,
                    },
                ], // episode rows
                [], // movie rows
            ],
        });

        const entries = await findPendingDeletions(TEST_USER_ID);

        expect(entries).toEqual([
            {
                id: 1,
                mediaType: "episode",
                reason: "manual",
                deletedAt: "2026-01-02T00:00:00.000Z",
                watchedAt: "2026-01-01T00:00:00.000Z",
                showId: 5,
                showTitle: "Test Show",
                showTranslatedName: null,
                seasonNumber: 3,
                episodeNumber: 67,
                episodeTitle: "Some Episode",
                episodeTranslatedTitle: null,
                movieId: null,
                movieTitle: null,
            },
        ]);
    });

    it("returns a movie audit entry", async () => {
        dbMockState.db = createMockDb({
            joined: [
                [], // episode rows
                [
                    {
                        id: 2,
                        reason: "duplicate-cleanup",
                        deletedAt: new Date("2026-01-02T00:00:00.000Z"),
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                        movieId: 20,
                        movieTitle: "Some Movie",
                    },
                ], // movie rows
            ],
        });

        const entries = await findPendingDeletions(TEST_USER_ID);
        expect(entries).toEqual([
            {
                id: 2,
                mediaType: "movie",
                reason: "duplicate-cleanup",
                deletedAt: "2026-01-02T00:00:00.000Z",
                watchedAt: "2026-01-01T00:00:00.000Z",
                showId: null,
                showTitle: null,
                showTranslatedName: null,
                seasonNumber: null,
                episodeNumber: null,
                episodeTitle: null,
                episodeTranslatedTitle: null,
                movieId: 20,
                movieTitle: "Some Movie",
            },
        ]);
    });

    it("sorts entries by deletedAt descending", async () => {
        dbMockState.db = createMockDb({
            joined: [
                [
                    {
                        id: 1,
                        reason: "manual",
                        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
                        watchedAt: null,
                        showId: 5,
                        showTitle: "A",
                        showTranslatedName: null,
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: null,
                        episodeTranslatedTitle: null,
                    },
                ],
                [
                    {
                        id: 2,
                        reason: "manual",
                        deletedAt: new Date("2026-01-05T00:00:00.000Z"),
                        watchedAt: null,
                        movieId: 9,
                        movieTitle: "B",
                    },
                ],
            ],
        });

        const entries = await findPendingDeletions(TEST_USER_ID);
        expect(entries.map((e) => e.id)).toEqual([2, 1]);
    });
});

describe("restoreFromDeletions", () => {
    it("returns an all-zero result when none of the given ids match a pending row", async () => {
        dbMockState.db = createMockDb({ plain: [[]] });
        const result = await restoreFromDeletions(TEST_USER_ID, [1]);
        expect(result).toEqual({ ok: true, restored: 0 });
    });

    it("re-inserts an episode row locally, marks it restored, and recalcs the show", async () => {
        const db = createMockDb({
            plain: [
                [
                    {
                        id: 1,
                        mediaType: "episode",
                        episodeId: 100,
                        movieId: null,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                    },
                ], // pending audit rows
                [{ showId: 5 }], // episode -> show lookup
            ],
        });
        dbMockState.db = db;

        const result = await restoreFromDeletions(TEST_USER_ID, [1]);

        expect(db.__insertedValues[0]).toMatchObject({
            userId: TEST_USER_ID,
            episodeId: 100,
            movieId: null,
            mediaType: "episode",
            source: "manual",
            traktPlayId: null,
        });
        expect(db.__updatedValues[0]).toHaveProperty("restoredAt");
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
        expect(result).toEqual({ ok: true, restored: 1 });
    });

    it("re-inserts a movie row locally and recalcs the movie", async () => {
        const db = createMockDb({
            plain: [
                [
                    {
                        id: 2,
                        mediaType: "movie",
                        episodeId: null,
                        movieId: 20,
                        watchedAt: new Date("2026-01-01T00:00:00.000Z"),
                    },
                ],
            ],
        });
        dbMockState.db = db;

        const result = await restoreFromDeletions(TEST_USER_ID, [2]);

        expect(db.__insertedValues[0]).toMatchObject({ movieId: 20, mediaType: "movie" });
        expect(syncMockState.recalcMovieProgress).toHaveBeenCalledWith(TEST_USER_ID, 20);
        expect(result).toEqual({ ok: true, restored: 1 });
    });

    it("skips a row whose referenced episode no longer exists (episodeId is null)", async () => {
        const db = createMockDb({
            plain: [
                [{ id: 3, mediaType: "episode", episodeId: null, movieId: null, watchedAt: null }],
            ],
        });
        dbMockState.db = db;

        const result = await restoreFromDeletions(TEST_USER_ID, [3]);

        expect(db.insert).not.toHaveBeenCalled();
        expect(result).toEqual({ ok: true, restored: 0 });
    });
});
