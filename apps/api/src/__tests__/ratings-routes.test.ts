import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => {
    class TraktApiError extends Error {
        status: number;
        constructor(message: string, status = 500) {
            super(message);
            this.name = "TraktApiError";
            this.status = status;
        }
    }
    return { client: null as unknown, TraktApiError };
});

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
    TraktApiError: traktMockState.TraktApiError,
}));

// ---------------------------------------------------------------------------
// DB builder stubs
// ---------------------------------------------------------------------------

type RowsResult = unknown[];

class ChainBuilder implements PromiseLike<RowsResult> {
    private _result: RowsResult;
    constructor(result: RowsResult) {
        this._result = result;
    }
    from() {
        return this;
    }
    where() {
        return this;
    }
    values() {
        return this;
    }
    onConflictDoUpdate() {
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
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder([])),
        delete: vi.fn(() => new ChainBuilder([])),
        __state: state,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        addRating: vi.fn().mockResolvedValue(undefined),
        removeRating: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { ratingsRoutes } = await import("../routes/ratings.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/ratings", ratingsRoutes);
    return a;
}

function sendJson(path: string, payload: unknown, method: string) {
    return app().request(path, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
    });
}

const ratedAt = new Date("2026-06-01T00:00:00.000Z");

beforeEach(() => {
    vi.clearAllMocks();
    traktMockState.client = createMockTrakt();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /ratings", () => {
    const rows = [
        { id: 1, mediaType: "show", showId: 5, movieId: null, rating: 9, ratedAt },
        { id: 2, mediaType: "movie", showId: null, movieId: 9, rating: 7, ratedAt: null },
    ];

    it("returns all ratings with ISO timestamps by default", async () => {
        dbMockState.db = createMockDb([rows]);

        const res = await app().request("/ratings");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data).toHaveLength(2);
        expect(body.data[0].ratedAt).toBe(ratedAt.toISOString());
        expect(body.data[1].ratedAt).toBeNull();
    });

    it("filters by type=show / type=movie", async () => {
        dbMockState.db = createMockDb([rows]);
        const showRes = await app().request("/ratings?type=show");
        const showBody = (await showRes.json()) as { data: Array<{ mediaType: string }> };
        expect(showBody.data).toHaveLength(1);
        expect(showBody.data[0].mediaType).toBe("show");

        dbMockState.db = createMockDb([rows]);
        const movieRes = await app().request("/ratings?type=movie");
        const movieBody = (await movieRes.json()) as { data: Array<{ mediaType: string }> };
        expect(movieBody.data).toHaveLength(1);
        expect(movieBody.data[0].mediaType).toBe("movie");
    });
});

describe("PUT /ratings", () => {
    it("writes to Trakt and upserts locally", async () => {
        const db = createMockDb([[{ traktId: 100, tmdbId: 200 }]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await sendJson("/ratings", { type: "show", localId: 5, rating: 9 }, "PUT");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; rating: number };
        expect(body.ok).toBe(true);
        expect(body.rating).toBe(9);
        expect(trakt.addRating).toHaveBeenCalledWith(
            TEST_USER_ID,
            "shows",
            { trakt: 100, tmdb: 200 },
            9,
        );
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("maps movie ratings to the movies Trakt namespace", async () => {
        dbMockState.db = createMockDb([[{ traktId: 300, tmdbId: null }]]);
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await sendJson("/ratings", { type: "movie", localId: 9, rating: 7 }, "PUT");
        expect(res.status).toBe(200);
        expect(trakt.addRating).toHaveBeenCalledWith(TEST_USER_ID, "movies", { trakt: 300 }, 7);
    });

    it("returns 404 when the local title does not exist", async () => {
        dbMockState.db = createMockDb([[]]);

        const res = await sendJson("/ratings", { type: "show", localId: 5, rating: 9 }, "PUT");
        expect(res.status).toBe(404);
    });

    it("stores locally when Trakt fails with TraktApiError (best-effort)", async () => {
        const db = createMockDb([[{ traktId: 100, tmdbId: null }]]);
        dbMockState.db = db;
        traktMockState.client = createMockTrakt({
            addRating: vi.fn().mockRejectedValue(new traktMockState.TraktApiError("down", 503)),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await sendJson("/ratings", { type: "show", localId: 5, rating: 9 }, "PUT");
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("rejects out-of-range ratings with 400", async () => {
        dbMockState.db = createMockDb([]);

        const res = await sendJson("/ratings", { type: "show", localId: 5, rating: 11 }, "PUT");
        expect(res.status).toBe(400);
    });
});

describe("DELETE /ratings", () => {
    it("removes from Trakt and locally", async () => {
        const db = createMockDb([[{ traktId: 100, tmdbId: 200 }]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await sendJson("/ratings", { type: "show", localId: 5 }, "DELETE");
        expect(res.status).toBe(200);
        expect(trakt.removeRating).toHaveBeenCalledWith(TEST_USER_ID, "shows", {
            trakt: 100,
            tmdb: 200,
        });
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("still deletes locally when Trakt remove fails with TraktApiError", async () => {
        const db = createMockDb([[{ traktId: 300, tmdbId: null }]]);
        dbMockState.db = db;
        traktMockState.client = createMockTrakt({
            removeRating: vi.fn().mockRejectedValue(new traktMockState.TraktApiError("gone", 404)),
        });

        const res = await sendJson("/ratings", { type: "movie", localId: 9 }, "DELETE");
        expect(res.status).toBe(200);
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("proceeds with local delete even when the title row is missing (empty ids)", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await sendJson("/ratings", { type: "movie", localId: 9 }, "DELETE");
        expect(res.status).toBe(200);
        expect(trakt.removeRating).toHaveBeenCalledWith(TEST_USER_ID, "movies", {});
        expect(db.delete).toHaveBeenCalledTimes(1);
    });
});
