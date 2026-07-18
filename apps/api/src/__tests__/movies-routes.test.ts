import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 42;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({
    client: { removeFromHistory: vi.fn() } as unknown as {
        removeFromHistory: ReturnType<typeof vi.fn>;
    },
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
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
    insertReturning: unknown[];
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
        ok?: ((v: SelectResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
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
        return Promise.resolve(this.state.insertReturning.shift() ?? []);
    }
    then<T1 = void, T2 = never>(
        ok?: ((v: void) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
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

function createMockDb(selectResults: SelectResult[] = [], insertReturning: unknown[] = []) {
    const state: MockDbState = {
        selectResults: [...selectResults],
        insertValues: [],
        conflictCalls: [],
        deleteWhereCalls: [],
        insertReturning: [...insertReturning],
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
// Import under test
// ---------------------------------------------------------------------------

const { movieRoutes } = await import("../routes/movies.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/movies", movieRoutes);
    return a;
}

const now = new Date("2026-06-01T12:00:00.000Z");

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
        watchCount: 2,
        lastWatchedAt: now,
        updatedAt: now,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /movies/:id", () => {
    it("returns 400 for non-numeric id", async () => {
        const res = await app().request("/movies/abc");
        expect(res.status).toBe(400);
    });

    it("returns 404 when movie not in DB", async () => {
        const db = createMockDb([[]]); // empty select
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/99");
        expect(res.status).toBe(404);
    });

    it("returns 404 when no progress row", async () => {
        const movie = makeMovie();
        const db = createMockDb([[movie], []]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9");
        expect(res.status).toBe(404);
    });

    it("returns movie detail with progress", async () => {
        const movie = makeMovie();
        const progress = makeProgress();
        const db = createMockDb([[movie], [progress]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { movie: { id: number }; watchCount: number } };
        expect(body.data.movie.id).toBe(9);
        expect(body.data.watchCount).toBe(2);
    });
});

describe("GET /movies/:id/history", () => {
    it("returns empty history array", async () => {
        const db = createMockDb([[]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(0);
    });

    it("returns watch history entries", async () => {
        const histRow = {
            id: 1,
            movieId: 9,
            watchedAt: now,
            source: "manual",
        };
        const db = createMockDb([[histRow]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].movieId).toBe(9);
        expect(body.data[0].source).toBe("manual");
    });

    it("returns 400 for invalid id", async () => {
        const res = await app().request("/movies/abc/history");
        expect(res.status).toBe(400);
    });
});

describe("POST /movies/:id/watch", () => {
    it("returns 400 for non-numeric movie id", async () => {
        const res = await app().request("/movies/xyz/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    it("returns 404 when movie not found", async () => {
        const db = createMockDb([[]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/5/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(404);
    });

    it("creates watch record and returns 201", async () => {
        const movie = makeMovie();
        // DB call sequence: find movie, find existing history (none), recalc watchHistory select, recalc upsert
        const db = createMockDb(
            [[movie], [], [{ count: 1, lastWatched: now }]],
            [[{ id: 101 }]], // insert.returning() returns an array row
        );
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watchedAt: "2026-06-01T12:00:00.000Z" }),
        });
        expect(res.status).toBe(201);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    it("reuses existing history row when duplicate", async () => {
        const movie = makeMovie();
        const existing = { id: 55 };
        const db = createMockDb([[movie], [existing], [{ count: 1, lastWatched: now }]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watchedAt: null }),
        });
        expect(res.status).toBe(201);
    });
});

describe("DELETE /movies/:id/history/:historyId", () => {
    it("returns 400 for non-numeric ids", async () => {
        const res = await app().request("/movies/abc/history/xyz", { method: "DELETE" });
        expect(res.status).toBe(400);
    });

    it("returns 404 when history record not found", async () => {
        const db = createMockDb([[]]); // empty ownership check
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/history/99", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("deletes record and returns ok", async () => {
        const record = {
            id: 10,
            userId: TEST_USER_ID,
            movieId: 9,
            watchedAt: now,
            source: "manual",
        };
        const db = createMockDb([[record], [{ count: 0, lastWatched: null }]]);
        (dbMockState as { db: unknown }).db = db;
        const res = await app().request("/movies/9/history/10", { method: "DELETE" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    it("removes the entry from Trakt before deleting locally when it has a traktPlayId", async () => {
        const record = {
            id: 10,
            userId: TEST_USER_ID,
            movieId: 9,
            watchedAt: now,
            source: "trakt",
            traktPlayId: "555",
        };
        const db = createMockDb([[record], [{ count: 0, lastWatched: null }]]);
        (dbMockState as { db: unknown }).db = db;
        const removeFromHistory = vi.fn().mockResolvedValue({
            deleted: { movies: 1, episodes: 0 },
            not_found: { movies: [], shows: [], episodes: [], ids: [] },
        });
        traktMockState.client = { removeFromHistory };

        const res = await app().request("/movies/9/history/10", { method: "DELETE" });

        expect(removeFromHistory).toHaveBeenCalledWith(TEST_USER_ID, [555]);
        expect(res.status).toBe(200);
    });

    it("does not delete locally when the Trakt removal fails", async () => {
        const record = {
            id: 10,
            userId: TEST_USER_ID,
            movieId: 9,
            watchedAt: now,
            source: "trakt",
            traktPlayId: "555",
        };
        const db = createMockDb([[record]]);
        (dbMockState as { db: unknown }).db = db;
        const removeFromHistory = vi.fn().mockRejectedValue(new Error("network down"));
        traktMockState.client = { removeFromHistory };

        const res = await app().request("/movies/9/history/10", { method: "DELETE" });

        expect(res.status).toBe(502);
        expect(db.__state.deleteWhereCalls).toHaveLength(0);
    });
});
