import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => {
    // Local stand-in so routes' `instanceof TraktApiError` checks work against
    // instances thrown from tests without importing the real services module.
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
// DB builder stubs (select / insert / update / delete chains used by lists routes)
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
    values() {
        return this;
    }
    set() {
        return this;
    }
    onConflictDoNothing() {
        return this;
    }
    returning() {
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this._result).then(ok, fail);
    }
}

function createMockDb(queues: {
    selects?: RowsResult[];
    inserts?: RowsResult[];
    updates?: RowsResult[];
}) {
    const state = {
        selects: [...(queues.selects ?? [])],
        inserts: [...(queues.inserts ?? [])],
        updates: [...(queues.updates ?? [])],
    };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder(state.inserts.shift() ?? [])),
        update: vi.fn(() => new ChainBuilder(state.updates.shift() ?? [])),
        delete: vi.fn(() => new ChainBuilder([])),
        __state: state,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        createList: vi.fn().mockResolvedValue({ ids: { trakt: 555, slug: "my-list" } }),
        updateList: vi.fn().mockResolvedValue(undefined),
        deleteList: vi.fn().mockResolvedValue(undefined),
        addListItems: vi.fn().mockResolvedValue(undefined),
        removeListItems: vi.fn().mockResolvedValue(undefined),
        getLists: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { listsRoutes } = await import("../routes/lists.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/lists", listsRoutes);
    return a;
}

function postJson(path: string, payload: unknown, method = "POST") {
    return app().request(path, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
    });
}

const now = new Date("2026-06-01T00:00:00.000Z");

function makeListRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        userId: TEST_USER_ID,
        traktId: 555,
        traktSlug: "my-list",
        name: "My List",
        description: null,
        privacy: "private",
        sortBy: "rank",
        sortHow: "asc",
        itemCount: 0,
        updatedAt: now,
        createdAt: now,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    traktMockState.client = createMockTrakt();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /lists", () => {
    it("returns the user's lists with ISO timestamps", async () => {
        dbMockState.db = createMockDb({ selects: [[makeListRow()]] });

        const res = await app().request("/lists");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("My List");
        expect(body.data[0].updatedAt).toBe(now.toISOString());
    });
});

describe("POST /lists", () => {
    it("creates on Trakt first, then locally, and returns 201", async () => {
        const db = createMockDb({ inserts: [[makeListRow()]] });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists", { name: "My List" });
        expect(res.status).toBe(201);
        const body = (await res.json()) as { data: { traktSlug: string | null } };
        expect(body.data.traktSlug).toBe("my-list");
        expect(trakt.createList).toHaveBeenCalledWith(
            TEST_USER_ID,
            expect.objectContaining({ name: "My List", privacy: "private" }),
        );
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("stores locally with null trakt ids when Trakt create fails with TraktApiError", async () => {
        const localOnly = makeListRow({ traktId: null, traktSlug: null });
        dbMockState.db = createMockDb({ inserts: [[localOnly]] });
        traktMockState.client = createMockTrakt({
            createList: vi
                .fn()
                .mockRejectedValue(new traktMockState.TraktApiError("trakt down", 503)),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await postJson("/lists", { name: "My List" });
        expect(res.status).toBe(201);
        const body = (await res.json()) as { data: { traktId: number | null } };
        expect(body.data.traktId).toBeNull();
        warn.mockRestore();
    });

    it("rethrows non-Trakt errors (500)", async () => {
        dbMockState.db = createMockDb({});
        traktMockState.client = createMockTrakt({
            createList: vi.fn().mockRejectedValue(new Error("connection reset")),
        });

        const res = await postJson("/lists", { name: "My List" });
        expect(res.status).toBe(500);
    });

    it("rejects an empty name with 400", async () => {
        dbMockState.db = createMockDb({});

        const res = await postJson("/lists", { name: "" });
        expect(res.status).toBe(400);
    });
});

describe("PUT /lists/:id", () => {
    it("returns 404 when the list does not belong to the user", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await postJson("/lists/1", { name: "Renamed" }, "PUT");
        expect(res.status).toBe(404);
    });

    it("updates Trakt (when slug exists) and the local row", async () => {
        const updated = makeListRow({ name: "Renamed" });
        dbMockState.db = createMockDb({ selects: [[makeListRow()]], updates: [[updated]] });
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists/1", { name: "Renamed" }, "PUT");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { name: string } };
        expect(body.data.name).toBe("Renamed");
        expect(trakt.updateList).toHaveBeenCalledWith(
            TEST_USER_ID,
            "my-list",
            expect.objectContaining({ name: "Renamed" }),
        );
    });

    it("skips Trakt for local-only lists (no slug)", async () => {
        const localOnly = makeListRow({ traktSlug: null });
        dbMockState.db = createMockDb({ selects: [[localOnly]], updates: [[localOnly]] });
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists/1", { name: "Renamed" }, "PUT");
        expect(res.status).toBe(200);
        expect(trakt.updateList).not.toHaveBeenCalled();
    });

    it("still updates locally when Trakt update fails with TraktApiError", async () => {
        const updated = makeListRow({ name: "Renamed" });
        dbMockState.db = createMockDb({ selects: [[makeListRow()]], updates: [[updated]] });
        traktMockState.client = createMockTrakt({
            updateList: vi.fn().mockRejectedValue(new traktMockState.TraktApiError("boom", 500)),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await postJson("/lists/1", { name: "Renamed" }, "PUT");
        expect(res.status).toBe(200);
        warn.mockRestore();
    });
});

describe("DELETE /lists/:id", () => {
    it("returns 404 for a foreign list", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await app().request("/lists/1", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("deletes from Trakt and locally", async () => {
        const db = createMockDb({ selects: [[makeListRow()]] });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/lists/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.deleteList).toHaveBeenCalledWith(TEST_USER_ID, "my-list");
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("still deletes locally when Trakt delete fails with TraktApiError", async () => {
        const db = createMockDb({ selects: [[makeListRow()]] });
        dbMockState.db = db;
        traktMockState.client = createMockTrakt({
            deleteList: vi.fn().mockRejectedValue(new traktMockState.TraktApiError("gone", 404)),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await app().request("/lists/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(db.delete).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe("GET /lists/:id/items", () => {
    it("returns 404 when the list is missing", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await app().request("/lists/1/items");
        expect(res.status).toBe(404);
    });

    it("maps show and movie items with coalesced title/year/poster", async () => {
        const itemRows = [
            {
                id: 11,
                listId: 1,
                mediaType: "show",
                showId: 5,
                movieId: null,
                rank: 1,
                notes: null,
                listedAt: now,
                showTitle: "Test Show",
                showFirstAired: "2020-01-05",
                showPoster: "/show.jpg",
                movieTitle: null,
                movieReleaseDate: null,
                moviePoster: null,
            },
            {
                id: 12,
                listId: 1,
                mediaType: "movie",
                showId: null,
                movieId: 9,
                rank: 2,
                notes: "rewatch",
                listedAt: null,
                showTitle: null,
                showFirstAired: null,
                showPoster: null,
                movieTitle: "Test Movie",
                movieReleaseDate: "2023-11-20",
                moviePoster: "/movie.jpg",
            },
        ];
        dbMockState.db = createMockDb({ selects: [[makeListRow()], itemRows] });

        const res = await app().request("/lists/1/items");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data).toHaveLength(2);
        expect(body.data[0]).toMatchObject({
            title: "Test Show",
            year: 2020,
            posterPath: "/show.jpg",
            listedAt: now.toISOString(),
        });
        expect(body.data[1]).toMatchObject({
            title: "Test Movie",
            year: 2023,
            posterPath: "/movie.jpg",
            listedAt: null,
            notes: "rewatch",
        });
    });
});

describe("POST /lists/:id/items", () => {
    const payload = { mediaType: "show", localId: 5 };

    it("returns 404 when the list is missing", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await postJson("/lists/1/items", payload);
        expect(res.status).toBe(404);
    });

    it("returns 404 when the referenced show does not exist locally", async () => {
        dbMockState.db = createMockDb({ selects: [[makeListRow()], []] });

        const res = await postJson("/lists/1/items", payload);
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Show not found");
    });

    it("adds to Trakt, inserts locally, and bumps item_count", async () => {
        const db = createMockDb({
            selects: [[makeListRow()], [{ traktId: 100, tmdbId: 200 }]],
            inserts: [[{ id: 42 }]],
            updates: [[]],
        });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists/1/items", payload);
        expect(res.status).toBe(201);
        const body = (await res.json()) as { data: { id: number } };
        expect(body.data.id).toBe(42);
        expect(trakt.addListItems).toHaveBeenCalledWith(TEST_USER_ID, "my-list", [
            { type: "show", ids: { trakt: 100, tmdb: 200 } },
        ]);
        // item_count increment ran
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("is idempotent on duplicate adds (alreadyExists, no count bump)", async () => {
        const db = createMockDb({
            selects: [[makeListRow()], [{ traktId: 100, tmdbId: 200 }], [{ id: 42 }]],
            // onConflictDoNothing returns no row on conflict
            inserts: [[]],
        });
        dbMockState.db = db;

        const res = await postJson("/lists/1/items", payload);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { id: number; alreadyExists: boolean } };
        expect(body.data.alreadyExists).toBe(true);
        expect(body.data.id).toBe(42);
        expect(db.update).not.toHaveBeenCalled();
    });

    it("skips Trakt when the list is local-only", async () => {
        const db = createMockDb({
            selects: [[makeListRow({ traktSlug: null })], [{ traktId: 100, tmdbId: null }]],
            inserts: [[{ id: 43 }]],
            updates: [[]],
        });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists/1/items", payload);
        expect(res.status).toBe(201);
        expect(trakt.addListItems).not.toHaveBeenCalled();
    });

    it("resolves movies through the movies table", async () => {
        const db = createMockDb({
            selects: [[makeListRow()], [{ traktId: 300, tmdbId: null }]],
            inserts: [[{ id: 44 }]],
            updates: [[]],
        });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await postJson("/lists/1/items", { mediaType: "movie", localId: 9 });
        expect(res.status).toBe(201);
        expect(trakt.addListItems).toHaveBeenCalledWith(TEST_USER_ID, "my-list", [
            { type: "movie", ids: { trakt: 300 } },
        ]);
    });

    it("rejects invalid payloads with 400", async () => {
        dbMockState.db = createMockDb({});

        const res = await postJson("/lists/1/items", { mediaType: "book", localId: 1 });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /lists/:id/items/:itemId", () => {
    it("returns 404 when the list is missing", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await app().request("/lists/1/items/11", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("returns 404 when the item is missing", async () => {
        dbMockState.db = createMockDb({ selects: [[makeListRow()], []] });

        const res = await app().request("/lists/1/items/11", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("removes from Trakt, deletes locally, and decrements item_count", async () => {
        const item = { id: 11, listId: 1, mediaType: "show", showId: 5, movieId: null };
        const db = createMockDb({
            selects: [[makeListRow()], [item], [{ traktId: 100, tmdbId: 200 }]],
            updates: [[]],
        });
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/lists/1/items/11", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.removeListItems).toHaveBeenCalledWith(TEST_USER_ID, "my-list", [
            { type: "show", ids: { trakt: 100 } },
        ]);
        expect(db.delete).toHaveBeenCalledTimes(1);
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("still removes locally when Trakt remove fails with TraktApiError", async () => {
        const item = { id: 12, listId: 1, mediaType: "movie", showId: null, movieId: 9 };
        const db = createMockDb({
            selects: [[makeListRow()], [item], [{ traktId: 300, tmdbId: null }]],
            updates: [[]],
        });
        dbMockState.db = db;
        traktMockState.client = createMockTrakt({
            removeListItems: vi
                .fn()
                .mockRejectedValue(new traktMockState.TraktApiError("boom", 500)),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await app().request("/lists/1/items/12", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(db.delete).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe("POST /lists/sync", () => {
    it("updates existing lists and inserts new ones", async () => {
        const traktLists = [
            {
                name: "Existing",
                description: null,
                privacy: "private",
                sort_by: "rank",
                sort_how: "asc",
                item_count: 3,
                ids: { trakt: 555, slug: "existing" },
            },
            {
                name: "Brand New",
                description: "fresh",
                privacy: "public",
                sort_by: "added",
                sort_how: "desc",
                item_count: 0,
                ids: { trakt: 777, slug: "brand-new" },
            },
        ];
        traktMockState.client = createMockTrakt({
            getLists: vi.fn().mockResolvedValue(traktLists),
        });
        const db = createMockDb({
            // first lookup hits an existing row, second finds nothing
            selects: [[makeListRow()], []],
            updates: [[]],
            inserts: [[]],
        });
        dbMockState.db = db;

        const res = await app().request("/lists/sync", { method: "POST" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; synced: number };
        expect(body.ok).toBe(true);
        expect(body.synced).toBe(2);
        expect(db.update).toHaveBeenCalledTimes(1);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("returns synced 0 for an empty Trakt response", async () => {
        traktMockState.client = createMockTrakt();
        dbMockState.db = createMockDb({});

        const res = await app().request("/lists/sync", { method: "POST" });
        const body = (await res.json()) as { synced: number };
        expect(body.synced).toBe(0);
    });
});
