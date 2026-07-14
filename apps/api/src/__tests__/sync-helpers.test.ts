import { beforeEach, describe, expect, it, vi } from "vitest";

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
// DB builder stubs — plain sequential FIFO queue for select/selectDistinct
// (shared, since call order within each function is fixed and known), a
// separate queue for update()'s .returning(), and a captured-values array
// for every insert(...).values(v) call so tests can assert on what would
// have been persisted.
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
    innerJoin() {
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
    set() {
        return this;
    }
    onConflictDoNothing() {
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

function createMockDb(opts: { selects?: RowsResult[]; updates?: RowsResult[] } = {}) {
    const state = {
        selects: [...(opts.selects ?? [])],
        updates: [...(opts.updates ?? [])],
    };
    const insertedValues: unknown[] = [];
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        selectDistinct: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder([], (v) => insertedValues.push(v))),
        update: vi.fn(() => new ChainBuilder(state.updates.shift() ?? [])),
        __state: state,
        __insertedValues: insertedValues,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const {
    getSyncStatus,
    getPostResetWatchedEpisodeIds,
    computeWatchedEpisodes,
    recalcShowProgress,
    recalcMovieProgress,
    resetStaleRunningSyncs,
} = await import("../services/sync.js");

const USER_ID = 7;
const SHOW_ID = 5;
const MOVIE_ID = 9;

beforeEach(() => {
    dbMockState.db = createMockDb();
});

// ---------------------------------------------------------------------------
// getSyncStatus
// ---------------------------------------------------------------------------

describe("getSyncStatus", () => {
    it("ensures sync state exists (insert) then returns the row", async () => {
        const db = createMockDb({ selects: [[{ userId: USER_ID, status: "idle" }]] });
        dbMockState.db = db;
        const result = await getSyncStatus(USER_ID);
        expect(result).toEqual({ userId: USER_ID, status: "idle" });
        expect(db.insert).toHaveBeenCalled();
    });

    it("returns undefined if no state row is found", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const result = await getSyncStatus(USER_ID);
        expect(result).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// getPostResetWatchedEpisodeIds / computeWatchedEpisodes
// ---------------------------------------------------------------------------

describe("getPostResetWatchedEpisodeIds", () => {
    it("returns distinct watched episode ids, filtering out nulls, with no reset cursor", async () => {
        dbMockState.db = createMockDb({
            selects: [[], [{ id: 1 }, { id: 2 }, { id: null }]],
        });
        const result = await getPostResetWatchedEpisodeIds(USER_ID, SHOW_ID);
        expect(result).toEqual([1, 2]);
    });

    it("still resolves watched ids when a reset cursor exists", async () => {
        dbMockState.db = createMockDb({
            selects: [[{ resetAt: new Date("2026-01-01T00:00:00.000Z") }], [{ id: 3 }]],
        });
        const result = await getPostResetWatchedEpisodeIds(USER_ID, SHOW_ID);
        expect(result).toEqual([3]);
    });

    it("returns an empty array when nothing is watched", async () => {
        dbMockState.db = createMockDb({ selects: [[], []] });
        const result = await getPostResetWatchedEpisodeIds(USER_ID, SHOW_ID);
        expect(result).toEqual([]);
    });
});

describe("computeWatchedEpisodes", () => {
    it("returns the count of watched episode ids", async () => {
        dbMockState.db = createMockDb({ selects: [[], [{ id: 1 }, { id: 2 }]] });
        const result = await computeWatchedEpisodes(USER_ID, SHOW_ID);
        expect(result).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// recalcShowProgress
// ---------------------------------------------------------------------------

describe("recalcShowProgress", () => {
    it("marks not completed when nothing has been watched (skips the next-episode query)", async () => {
        const db = createMockDb({
            selects: [
                [{ count: 5 }], // airedEpisodes
                [], // resetAt
                [], // watchedIds
                [], // lastWatched
                [{ status: "ended" }], // show status
            ],
        });
        dbMockState.db = db;
        await recalcShowProgress(USER_ID, SHOW_ID);
        expect(db.__insertedValues[0]).toMatchObject({
            airedEpisodes: 5,
            watchedEpisodes: 0,
            nextEpisodeId: null,
            completed: false,
        });
    });

    it("marks completed when the show has ended and every aired episode is watched", async () => {
        const watched = new Date("2026-01-05T00:00:00.000Z");
        const db = createMockDb({
            selects: [
                [{ count: 2 }],
                [],
                [{ id: 1 }, { id: 2 }],
                [{ watchedAt: watched }],
                [], // no next episode (fully watched)
                [{ status: "ended" }],
            ],
        });
        dbMockState.db = db;
        await recalcShowProgress(USER_ID, SHOW_ID);
        expect(db.__insertedValues[0]).toMatchObject({
            airedEpisodes: 2,
            watchedEpisodes: 2,
            nextEpisodeId: null,
            lastWatchedAt: watched,
            completed: true,
        });
    });

    it("does not mark completed when the show is still airing, even if fully caught up", async () => {
        const db = createMockDb({
            selects: [
                [{ count: 2 }],
                [],
                [{ id: 1 }, { id: 2 }],
                [{ watchedAt: new Date() }],
                [],
                [{ status: "returning series" }],
            ],
        });
        dbMockState.db = db;
        await recalcShowProgress(USER_ID, SHOW_ID);
        expect(db.__insertedValues[0]).toMatchObject({ completed: false });
    });

    it("sets nextEpisodeId from the anti-join query when there's a partial watch", async () => {
        const db = createMockDb({
            selects: [
                [{ count: 5 }],
                [],
                [{ id: 1 }],
                [{ watchedAt: new Date() }],
                [{ id: 42 }],
                [{ status: "returning series" }],
            ],
        });
        dbMockState.db = db;
        await recalcShowProgress(USER_ID, SHOW_ID);
        expect(db.__insertedValues[0]).toMatchObject({ watchedEpisodes: 1, nextEpisodeId: 42 });
    });

    it("treats a missing show row as not completed", async () => {
        const db = createMockDb({
            selects: [[{ count: 0 }], [], [], [], []],
        });
        dbMockState.db = db;
        await recalcShowProgress(USER_ID, SHOW_ID);
        expect(db.__insertedValues[0]).toMatchObject({ completed: false });
    });
});

// ---------------------------------------------------------------------------
// recalcMovieProgress
// ---------------------------------------------------------------------------

describe("recalcMovieProgress", () => {
    it("upserts the watch count and last-watched date", async () => {
        const lastWatched = new Date("2026-02-01T00:00:00.000Z");
        const db = createMockDb({ selects: [[{ count: 3, lastWatched }]] });
        dbMockState.db = db;
        await recalcMovieProgress(USER_ID, MOVIE_ID);
        expect(db.__insertedValues[0]).toMatchObject({
            userId: USER_ID,
            movieId: MOVIE_ID,
            watchCount: 3,
            lastWatchedAt: lastWatched,
        });
    });

    it("coerces a string count (as Postgres may return for count(*)) to a number", async () => {
        const db = createMockDb({ selects: [[{ count: "0", lastWatched: null }]] });
        dbMockState.db = db;
        await recalcMovieProgress(USER_ID, MOVIE_ID);
        expect(db.__insertedValues[0]).toMatchObject({ watchCount: 0, lastWatchedAt: null });
    });
});

// ---------------------------------------------------------------------------
// resetStaleRunningSyncs
// ---------------------------------------------------------------------------

describe("resetStaleRunningSyncs", () => {
    it("does nothing further when no sync states were stuck running", async () => {
        const db = createMockDb({ updates: [[]] });
        dbMockState.db = db;
        await expect(resetStaleRunningSyncs()).resolves.toBeUndefined();
        expect(db.update).toHaveBeenCalled();
    });

    it("logs when one or more stale running states are reset", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const db = createMockDb({ updates: [[{ userId: 1 }, { userId: 2 }]] });
        dbMockState.db = db;
        await resetStaleRunningSyncs();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Reset 2 stale"));
        logSpy.mockRestore();
    });
});
