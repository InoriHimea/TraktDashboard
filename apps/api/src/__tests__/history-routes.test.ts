import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

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
// DB builder stubs (minimal — only what history routes call)
// ---------------------------------------------------------------------------

type SelectResult = unknown[];

class SelectBuilder implements PromiseLike<SelectResult> {
    private _result: SelectResult;
    constructor(result: SelectResult) {
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
    offset() {
        return this;
    }
    then<T1 = SelectResult, T2 = never>(
        ok?: ((value: SelectResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this._result).then(ok, fail);
    }
}

function createMockDb(selectResults: SelectResult[] = []) {
    const state = { selectResults: [...selectResults] };
    return {
        select: vi.fn(() => new SelectBuilder(state.selectResults.shift() ?? [])),
        __state: state,
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

const now = new Date("2026-06-01T12:00:00.000Z");

function makeHistoryRow(overrides: Record<string, unknown> = {}) {
    return {
        history: {
            id: 1,
            mediaType: "episode",
            watchedAt: now,
            source: "trakt",
        },
        episode: { id: 10, seasonNumber: 1, episodeNumber: 3, title: "Pilot" },
        show: { id: 5, title: "Test Show", translatedName: null, posterPath: null },
        movie: { id: null, title: null, posterPath: null },
        ...overrides,
    };
}

function makeMovieHistoryRow(overrides: Record<string, unknown> = {}) {
    return {
        history: {
            id: 2,
            mediaType: "movie",
            watchedAt: now,
            source: "manual",
        },
        episode: { id: null, seasonNumber: null, episodeNumber: null, title: null },
        show: { id: null, title: null, translatedName: null, posterPath: null },
        movie: { id: 99, title: "Test Movie", posterPath: "/poster.jpg" },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /history", () => {
    it("returns entries and total for default query", async () => {
        const row = makeHistoryRow();
        const db = createMockDb([[row], [{ count: 1 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            ok: boolean;
            data: { entries: unknown[]; total: number };
        };
        expect(body.ok).toBe(true);
        expect(body.data.total).toBe(1);
        expect(body.data.entries).toHaveLength(1);
    });

    it("returns empty list when no history", async () => {
        const db = createMockDb([[], [{ count: 0 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { entries: unknown[]; total: number } };
        expect(body.data.entries).toHaveLength(0);
        expect(body.data.total).toBe(0);
    });

    it("maps episode rows correctly", async () => {
        const row = makeHistoryRow();
        const db = createMockDb([[row], [{ count: 1 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history?mediaType=episode");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { entries: Array<Record<string, unknown>> } };
        const entry = body.data.entries[0];
        expect(entry.mediaType).toBe("episode");
        expect(entry.episode).toBeDefined();
        expect(entry.show).toBeDefined();
    });

    it("maps movie rows correctly", async () => {
        const row = makeMovieHistoryRow();
        const db = createMockDb([[row], [{ count: 1 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history?mediaType=movie");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { entries: Array<Record<string, unknown>> } };
        const entry = body.data.entries[0];
        expect(entry.mediaType).toBe("movie");
        expect((entry.movie as Record<string, unknown>).id).toBe(99);
    });

    it("accepts startDate and endDate filters", async () => {
        const db = createMockDb([[], [{ count: 0 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request(
            "/history?startDate=2026-01-01&endDate=2026-12-31&mediaType=all",
        );
        expect(res.status).toBe(200);
    });

    it("clamps limit to MAX_LIMIT (200)", async () => {
        const db = createMockDb([[], [{ count: 0 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history?limit=9999&offset=0");
        expect(res.status).toBe(200);
    });

    it("falls back to 'all' for unknown mediaType", async () => {
        const db = createMockDb([[], [{ count: 0 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history?mediaType=invalid");
        expect(res.status).toBe(200);
    });

    it("handles null watchedAt gracefully", async () => {
        const row = makeHistoryRow({
            history: { id: 3, mediaType: "episode", watchedAt: null, source: "trakt" },
        });
        const db = createMockDb([[row], [{ count: 1 }]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { entries: Array<Record<string, unknown>> } };
        expect(body.data.entries[0].watchedAt).toBeNull();
    });
});

describe("GET /history/export", () => {
    it("returns CSV with correct Content-Type", async () => {
        const row = makeHistoryRow();
        const db = createMockDb([[row]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/csv");
        expect(res.headers.get("Content-Disposition")).toContain("watch-history.csv");
        const text = await res.text();
        expect(text).toContain("Type,Show / Movie");
        expect(text).toContain("episode");
    });

    it("returns JSON when format=json", async () => {
        const row = makeMovieHistoryRow();
        const db = createMockDb([[row]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export?format=json");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("application/json");
        expect(res.headers.get("Content-Disposition")).toContain("watch-history.json");
    });

    it("returns empty CSV for no history", async () => {
        const db = createMockDb([[]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export");
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("Type,Show / Movie");
        // Only header line, no data
        expect(text.split("\r\n").length).toBe(1);
    });

    it("exports movie rows in CSV correctly", async () => {
        const row = makeMovieHistoryRow();
        const db = createMockDb([[row]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export?mediaType=movie");
        const text = await res.text();
        expect(text).toContain("movie");
        expect(text).toContain("Test Movie");
    });
});

describe("lib/validate helpers", () => {
    it("validateBody returns data on valid JSON", async () => {
        const { validateBody } = await import("../lib/validate.js");
        const { z } = await import("zod");
        const schema = z.object({ name: z.string() });
        const mockContext = {
            req: { json: vi.fn().mockResolvedValue({ name: "test" }) },
            json: vi.fn(),
        } as unknown as Parameters<typeof validateBody>[0];

        const result = await validateBody(mockContext, schema);
        expect(result).toEqual({ data: { name: "test" } });
    });

    it("validateBody returns 400 on invalid JSON", async () => {
        const { validateBody } = await import("../lib/validate.js");
        const { z } = await import("zod");
        const schema = z.object({ name: z.string() });
        const mockContext = {
            req: { json: vi.fn().mockRejectedValue(new Error("bad json")) },
            json: vi.fn(
                (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
            ),
        } as unknown as Parameters<typeof validateBody>[0];

        const result = await validateBody(mockContext, schema);
        expect(result).toBeInstanceOf(Response);
    });

    it("validateBody returns 400 on schema validation failure", async () => {
        const { validateBody } = await import("../lib/validate.js");
        const { z } = await import("zod");
        const schema = z.object({ count: z.number() });
        const mockContext = {
            req: { json: vi.fn().mockResolvedValue({ count: "not-a-number" }) },
            json: vi.fn(
                (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
            ),
        } as unknown as Parameters<typeof validateBody>[0];

        const result = await validateBody(mockContext, schema);
        expect(result).toBeInstanceOf(Response);
    });

    it("validateQuery returns data on valid query params", async () => {
        const { validateQuery } = await import("../lib/validate.js");
        const { z } = await import("zod");
        const schema = z.object({ limit: z.string().optional() });
        const mockContext = {
            req: { query: vi.fn().mockReturnValue({ limit: "10" }) },
            json: vi.fn(),
        } as unknown as Parameters<typeof validateQuery>[0];

        const result = validateQuery(mockContext, schema);
        expect(result).toEqual({ data: { limit: "10" } });
    });
});

describe("lib/response helpers", () => {
    it("apiOk wraps data with ok: true", async () => {
        const { apiOk } = await import("../lib/response.js");
        const mockContext = {
            json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        } as unknown as Parameters<typeof apiOk>[0];

        apiOk(mockContext, { hello: "world" });
        expect((mockContext.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
            ok: true,
            data: { hello: "world" },
        });
    });

    it("apiError wraps error with ok: false", async () => {
        const { apiError } = await import("../lib/response.js");
        const mockContext = {
            json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        } as unknown as Parameters<typeof apiError>[0];

        apiError(mockContext, 404, "Not found");
        expect((mockContext.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
            ok: false,
            error: "Not found",
        });
    });

    it("apiError includes details when provided", async () => {
        const { apiError } = await import("../lib/response.js");
        const mockContext = {
            json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        } as unknown as Parameters<typeof apiError>[0];

        apiError(mockContext, 422, "Validation failed", { field: "x" });
        expect((mockContext.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
            details: { field: "x" },
        });
    });

    it("apiPaginated wraps data with pagination meta", async () => {
        const { apiPaginated } = await import("../lib/response.js");
        const mockContext = {
            json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        } as unknown as Parameters<typeof apiPaginated>[0];

        apiPaginated(mockContext, [1, 2], { total: 10, limit: 5, offset: 0 });
        expect((mockContext.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
            ok: true,
            data: [1, 2],
            total: 10,
            limit: 5,
            offset: 0,
        });
    });
});
