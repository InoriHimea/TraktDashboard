import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

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
// DB builder stubs — plain queries plus a transaction that hands out a tx with
// its own queued select/update/insert (mirrors the advisory-lock upsert).
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
    set() {
        return this;
    }
    values() {
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

function createMockTx(queues: {
    selects?: RowsResult[];
    updates?: RowsResult[];
    inserts?: RowsResult[];
}) {
    const state = {
        selects: [...(queues.selects ?? [])],
        updates: [...(queues.updates ?? [])],
        inserts: [...(queues.inserts ?? [])],
    };
    return {
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        update: vi.fn(() => new ChainBuilder(state.updates.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder(state.inserts.shift() ?? [])),
    };
}

function createMockDb(opts: { selects?: RowsResult[]; tx?: ReturnType<typeof createMockTx> }) {
    const state = { selects: [...(opts.selects ?? [])] };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        delete: vi.fn(() => new ChainBuilder([])),
        transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(opts.tx)),
        __state: state,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { notesRoutes } = await import("../routes/notes.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/notes", notesRoutes);
    return a;
}

const now = new Date("2026-06-01T00:00:00.000Z");

function makeNoteRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        userId: TEST_USER_ID,
        mediaType: "episode",
        showId: 5,
        movieId: null,
        season: 1,
        episode: 2,
        content: "great ep",
        updatedAt: now,
        createdAt: now,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /notes", () => {
    it("returns an array when the query is not a single-note lookup", async () => {
        dbMockState.db = createMockDb({ selects: [[makeNoteRow(), makeNoteRow({ id: 2 })]] });

        const res = await app().request("/notes");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(2);
    });

    it("returns a single note object for an episode-precise lookup", async () => {
        dbMockState.db = createMockDb({ selects: [[makeNoteRow()]] });

        const res = await app().request("/notes?mediaType=episode&showId=5&season=1&episode=2");
        const body = (await res.json()) as { data: { content: string; updatedAt: string } };
        expect(body.data.content).toBe("great ep");
        expect(body.data.updatedAt).toBe(now.toISOString());
    });

    it("returns null for a single lookup with no note", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await app().request("/notes?mediaType=movie&movieId=9");
        const body = (await res.json()) as { data: unknown };
        expect(body.data).toBeNull();
    });

    it("treats a show-level lookup as single", async () => {
        dbMockState.db = createMockDb({
            selects: [[makeNoteRow({ mediaType: "show", season: null, episode: null })]],
        });

        const res = await app().request("/notes?mediaType=show&showId=5");
        const body = (await res.json()) as { data: { mediaType: string } };
        expect(body.data.mediaType).toBe("show");
    });
});

describe("PUT /notes", () => {
    const payload = {
        mediaType: "episode",
        showId: 5,
        season: 1,
        episode: 2,
        content: "great ep",
    };

    function putNote(body: unknown) {
        return app().request("/notes", {
            method: "PUT",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
    }

    it("inserts a new note (201) inside an advisory-locked transaction", async () => {
        const tx = createMockTx({ selects: [[]], inserts: [[makeNoteRow()]] });
        dbMockState.db = createMockDb({ tx });

        const res = await putNote(payload);
        expect(res.status).toBe(201);
        const body = (await res.json()) as { data: { content: string } };
        expect(body.data.content).toBe("great ep");
        expect(tx.execute).toHaveBeenCalledTimes(1);
        expect(tx.insert).toHaveBeenCalledTimes(1);
        expect(tx.update).not.toHaveBeenCalled();
    });

    it("updates an existing note in place (200)", async () => {
        const updated = makeNoteRow({ content: "edited" });
        const tx = createMockTx({ selects: [[makeNoteRow()]], updates: [[updated]] });
        dbMockState.db = createMockDb({ tx });

        const res = await putNote({ ...payload, content: "edited" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { content: string } };
        expect(body.data.content).toBe("edited");
        expect(tx.update).toHaveBeenCalledTimes(1);
        expect(tx.insert).not.toHaveBeenCalled();
    });

    it("accepts season 0 / episode 0 (Specials)", async () => {
        const special = makeNoteRow({ season: 0, episode: 0 });
        const tx = createMockTx({ selects: [[]], inserts: [[special]] });
        dbMockState.db = createMockDb({ tx });

        const res = await putNote({ ...payload, season: 0, episode: 0 });
        expect(res.status).toBe(201);
    });

    it("rejects content over 10000 chars with 400", async () => {
        dbMockState.db = createMockDb({});

        const res = await putNote({ ...payload, content: "x".repeat(10001) });
        expect(res.status).toBe(400);
    });

    it("rejects an unknown mediaType with 400", async () => {
        dbMockState.db = createMockDb({});

        const res = await putNote({ ...payload, mediaType: "book" });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /notes/:id", () => {
    it("deletes scoped to the user and returns ok", async () => {
        const db = createMockDb({});
        dbMockState.db = db;

        const res = await app().request("/notes/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("rejects a non-numeric id with 400", async () => {
        const db = createMockDb({});
        dbMockState.db = db;

        const res = await app().request("/notes/abc", { method: "DELETE" });
        expect(res.status).toBe(400);
        expect(db.delete).not.toHaveBeenCalled();
    });
});
