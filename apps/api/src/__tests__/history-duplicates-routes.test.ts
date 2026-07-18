import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const syncMockState = vi.hoisted(() => ({
    recalcShowProgress: vi.fn().mockResolvedValue(undefined),
    recalcMovieProgress: vi.fn().mockResolvedValue(undefined),
}));
const duplicatesMockState = vi.hoisted(() => ({
    findDuplicateHistoryGroups: vi.fn().mockResolvedValue([]),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
}));

vi.mock("../services/sync.js", () => ({
    recalcShowProgress: syncMockState.recalcShowProgress,
    recalcMovieProgress: syncMockState.recalcMovieProgress,
}));

vi.mock("../services/history-duplicates.js", () => ({
    findDuplicateHistoryGroups: duplicatesMockState.findDuplicateHistoryGroups,
}));

// ---------------------------------------------------------------------------
// DB builder stub — a plain sequential FIFO queue of select() results, plus a
// spy-able delete(). Neither route under test issues a join.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type RowsResult = Row[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(private _result: RowsResult) {}
    from() {
        return this;
    }
    where() {
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
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        delete: vi.fn(() => ({ where: deleteWhere })),
        __deleteWhere: deleteWhere,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        removeFromHistory: vi.fn(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { historyRoutes } = await import("../routes/history.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/history", historyRoutes);
    return a;
}

function postRemove(ids: unknown) {
    return app().request("/history/duplicates/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    duplicatesMockState.findDuplicateHistoryGroups.mockResolvedValue([]);
    syncMockState.recalcShowProgress.mockResolvedValue(undefined);
    syncMockState.recalcMovieProgress.mockResolvedValue(undefined);
});

describe("GET /history/duplicates", () => {
    it("uses the default window and wraps the service result", async () => {
        const groups = [{ mediaType: "episode" }];
        duplicatesMockState.findDuplicateHistoryGroups.mockResolvedValue(groups);

        const res = await app().request("/history/duplicates");
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(duplicatesMockState.findDuplicateHistoryGroups).toHaveBeenCalledWith(
            TEST_USER_ID,
            72,
        );
        expect(body).toEqual({ ok: true, data: { groups, windowHours: 72 } });
    });

    it("passes through a valid windowHours query param", async () => {
        await app().request("/history/duplicates?windowHours=24");
        expect(duplicatesMockState.findDuplicateHistoryGroups).toHaveBeenCalledWith(
            TEST_USER_ID,
            24,
        );
    });

    it("clamps an out-of-range windowHours to the max", async () => {
        await app().request("/history/duplicates?windowHours=999999");
        expect(duplicatesMockState.findDuplicateHistoryGroups).toHaveBeenCalledWith(
            TEST_USER_ID,
            24 * 30,
        );
    });

    it("falls back to the default for a non-numeric windowHours", async () => {
        await app().request("/history/duplicates?windowHours=abc");
        expect(duplicatesMockState.findDuplicateHistoryGroups).toHaveBeenCalledWith(
            TEST_USER_ID,
            72,
        );
    });
});

describe("POST /history/duplicates/remove", () => {
    it("rejects invalid JSON", async () => {
        const res = await app().request("/history/duplicates/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        });
        expect(res.status).toBe(400);
    });

    it("rejects a body with no valid ids", async () => {
        (dbMockState as { db: unknown }).db = createMockDb([]);
        const res = await postRemove("not-an-array");
        expect(res.status).toBe(400);
    });

    it("returns zero counts without calling Trakt when nothing matches ownership/trakt_play_id", async () => {
        const db = createMockDb([[]]); // ownership select returns no rows
        (dbMockState as { db: unknown }).db = db;
        const removeFromHistory = vi.fn();
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await postRemove([1, 2, 3]);
        const body = await res.json();

        expect(body).toEqual({ ok: true, deleted: 0, notFound: 0 });
        expect(removeFromHistory).not.toHaveBeenCalled();
        expect(db.__deleteWhere).not.toHaveBeenCalled();
    });

    it("removes confirmed episode and movie rows, deletes locally, and recalcs affected progress", async () => {
        const db = createMockDb([
            [
                { id: 10, traktPlayId: "111", mediaType: "episode", episodeId: 55, movieId: null },
                { id: 11, traktPlayId: "222", mediaType: "movie", episodeId: null, movieId: 66 },
            ], // ownership select
            [{ showId: 5 }], // episode -> show lookup for id 10
        ]);
        (dbMockState as { db: unknown }).db = db;

        const removeFromHistory = vi.fn().mockResolvedValue({
            deleted: { movies: 1, episodes: 1 },
            not_found: { movies: [], shows: [], episodes: [], ids: [] },
        });
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await postRemove([10, 11]);
        const body = await res.json();

        expect(removeFromHistory).toHaveBeenCalledWith(TEST_USER_ID, [111, 222]);
        expect(db.__deleteWhere).toHaveBeenCalledTimes(1);
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
        expect(syncMockState.recalcMovieProgress).toHaveBeenCalledWith(TEST_USER_ID, 66);
        expect(body).toEqual({ ok: true, deleted: 2, notFound: 0 });
    });

    it("counts not_found ids as removed locally too (treated as already gone)", async () => {
        const db = createMockDb([
            [{ id: 10, traktPlayId: "111", mediaType: "movie", episodeId: null, movieId: 66 }],
        ]);
        (dbMockState as { db: unknown }).db = db;

        const removeFromHistory = vi.fn().mockResolvedValue({
            deleted: { movies: 0, episodes: 0 },
            not_found: { movies: [], shows: [], episodes: [], ids: [111] },
        });
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await postRemove([10]);
        const body = await res.json();

        expect(db.__deleteWhere).toHaveBeenCalledTimes(1);
        expect(syncMockState.recalcMovieProgress).toHaveBeenCalledWith(TEST_USER_ID, 66);
        expect(body).toEqual({ ok: true, deleted: 0, notFound: 1 });
    });

    it("leaves local rows untouched when the Trakt call itself fails", async () => {
        const db = createMockDb([
            [{ id: 10, traktPlayId: "111", mediaType: "movie", episodeId: null, movieId: 66 }],
        ]);
        (dbMockState as { db: unknown }).db = db;

        const removeFromHistory = vi.fn().mockRejectedValue(new Error("network down"));
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await postRemove([10]);
        const body = await res.json();

        expect(db.__deleteWhere).not.toHaveBeenCalled();
        expect(syncMockState.recalcMovieProgress).not.toHaveBeenCalled();
        expect(body).toEqual({ ok: true, deleted: 0, notFound: 0 });
    });
});
