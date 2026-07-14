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
const {
    shows: showsTable,
    movies: moviesTable,
    episodes: episodesTable,
    watchHistory: watchHistoryTable,
} = await import("@trakt-dashboard/db");

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

    it("prefixes formula-trigger show titles with a space (CSV injection defence)", async () => {
        // Plain triggers and leading-space-hidden triggers must all be neutralised.
        for (const trigger of ["=SUM(1)", "+cmd", "-1+1", "@SUM", " =formula"]) {
            const row = makeHistoryRow({ show: { id: 5, title: trigger } });
            const db = createMockDb([[row]]);
            (dbMockState as { db: unknown }).db = db;

            const res = await app().request("/history/export");
            const text = await res.text();
            const dataLine = text.split("\r\n")[1];
            // Cell must start with a space prefix, not the raw trigger character.
            expect(dataLine).toMatch(/" /);
            // The original value is preserved after the prefix (trimmed for detection
            // but the full original value including its leading whitespace is kept).
            expect(dataLine).toContain(trigger);
        }
    });

    it("replaces embedded newlines in titles to prevent row injection", async () => {
        const row = makeHistoryRow({ show: { id: 5, title: "Show\nWith\r\nNewline" } });
        const db = createMockDb([[row]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export");
        const text = await res.text();
        // Result must be a single header + single data line (no injected extra rows).
        expect(text.split("\r\n").length).toBe(2);
        // The newlines should be replaced with spaces.
        expect(text).toContain("Show With  Newline");
    });

    it("does not alter titles that are safe strings", async () => {
        const row = makeHistoryRow({ show: { id: 5, title: "Normal Show Title" } });
        const db = createMockDb([[row]]);
        (dbMockState as { db: unknown }).db = db;

        const res = await app().request("/history/export");
        const text = await res.text();
        expect(text).toContain('"Normal Show Title"');
    });
});

// ---------------------------------------------------------------------------
// POST /import — dispatches select() results by which table was queried
// (`.from(table)`), since the route issues an unpredictable number of calls
// per unique show/movie title plus one per entry (duplicate check).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class ImportSelectBuilder implements PromiseLike<Row[]> {
    private table: unknown;
    constructor(
        private queues: {
            shows: Row[][];
            movies: Row[][];
            episodes: Row[][];
            watchHistory: Row[][];
        },
    ) {}
    from(table: unknown) {
        this.table = table;
        return this;
    }
    where() {
        return this;
    }
    limit() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        let queue: Row[][] | undefined;
        if (this.table === showsTable) queue = this.queues.shows;
        else if (this.table === moviesTable) queue = this.queues.movies;
        else if (this.table === episodesTable) queue = this.queues.episodes;
        else if (this.table === watchHistoryTable) queue = this.queues.watchHistory;
        const next = queue?.shift();
        const marker = next?.[0] as { __reject?: unknown } | undefined;
        if (marker && Object.prototype.hasOwnProperty.call(marker, "__reject")) {
            return Promise.reject(marker.__reject).then(ok, fail);
        }
        return Promise.resolve(next ?? []).then(ok, fail);
    }
}

function rejectRow(err: unknown): Row {
    return { __reject: err } as unknown as Row;
}

function createImportMockDb(opts: {
    shows?: Row[][];
    movies?: Row[][];
    episodes?: Row[][];
    watchHistory?: Row[][];
}) {
    const queues = {
        shows: [...(opts.shows ?? [])],
        movies: [...(opts.movies ?? [])],
        episodes: [...(opts.episodes ?? [])],
        watchHistory: [...(opts.watchHistory ?? [])],
    };
    const insertedRows: Row[] = [];
    return {
        select: vi.fn(() => new ImportSelectBuilder(queues)),
        insert: vi.fn(() => ({
            values: vi.fn((v: Row) => {
                insertedRows.push(v);
                return Promise.resolve([]);
            }),
        })),
        __insertedRows: insertedRows,
    };
}

function importRequest(body: unknown, raw?: string) {
    return app().request("/history/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw ?? JSON.stringify(body),
    });
}

describe("POST /import", () => {
    it("returns 400 for invalid JSON body", async () => {
        (dbMockState as { db: unknown }).db = createImportMockDb({});
        const res = await importRequest(undefined, "{not valid json");
        expect(res.status).toBe(400);
        expect((await res.json()) as { error: string }).toEqual({ error: "Invalid JSON" });
    });

    it("returns 400 when entries is empty (bare array body)", async () => {
        (dbMockState as { db: unknown }).db = createImportMockDb({});
        const res = await importRequest([]);
        expect(res.status).toBe(400);
        expect((await res.json()) as { error: string }).toEqual({ error: "No entries found" });
    });

    it("returns 400 when body has no recognizable entries array", async () => {
        (dbMockState as { db: unknown }).db = createImportMockDb({});
        const res = await importRequest({ foo: "bar" });
        expect(res.status).toBe(400);
        expect((await res.json()) as { error: string }).toEqual({ error: "No entries found" });
    });

    it("returns 400 when entries exceed the 50000 cap", async () => {
        (dbMockState as { db: unknown }).db = createImportMockDb({});
        const entries = Array.from({ length: 50_001 }, () => ({}));
        const res = await importRequest({ entries });
        expect(res.status).toBe(400);
        expect((await res.json()) as { error: string }).toEqual({
            error: "Too many entries (max 50000)",
        });
    });

    it("accepts a bare array body (not wrapped in {entries})", async () => {
        (dbMockState as { db: unknown }).db = createImportMockDb({
            movies: [[{ id: 99 }]],
            watchHistory: [[]],
        });
        const res = await importRequest([
            { history: { mediaType: "movie" }, movie: { title: "Arrival" } },
        ]);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body.imported).toBe(1);
        expect(body.skipped).toBe(0);
    });

    it("imports an episode entry: show + episode resolved, not a duplicate", async () => {
        const db = createImportMockDb({
            shows: [[{ id: 5, title: "Breaking Bad", translatedName: null }]],
            episodes: [[{ id: 10, showId: 5, seasonNumber: 1, episodeNumber: 3 }]],
            watchHistory: [[]],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "episode", watchedAt: "2026-01-01T00:00:00.000Z" },
                    show: { title: "Breaking Bad" },
                    episode: { seasonNumber: 1, episodeNumber: 3 },
                },
            ],
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { imported: number; skipped: number; errors: string[] };
        expect(body).toMatchObject({ imported: 1, skipped: 0, errors: [] });
        expect(db.__insertedRows).toHaveLength(1);
        expect(db.__insertedRows[0]).toMatchObject({ mediaType: "episode", episodeId: 10 });
    });

    it("skips an episode entry when the show title has no match", async () => {
        const db = createImportMockDb({ shows: [[]] });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "episode" },
                    show: { title: "Unknown Show" },
                    episode: { seasonNumber: 1, episodeNumber: 1 },
                },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 1 });
        expect(db.__insertedRows).toHaveLength(0);
    });

    it("skips an episode entry when show resolves but the episode isn't in the preload cache", async () => {
        const db = createImportMockDb({
            shows: [[{ id: 5, title: "Breaking Bad", translatedName: null }]],
            episodes: [[]],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "episode" },
                    show: { title: "Breaking Bad" },
                    episode: { seasonNumber: 9, episodeNumber: 9 },
                },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 1 });
    });

    it("skips an episode entry missing showTitle/seasonNumber/episodeNumber", async () => {
        const db = createImportMockDb({});
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                { history: { mediaType: "episode" }, show: {}, episode: {} },
                { history: { mediaType: "episode" }, show: { title: "X" }, episode: {} },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 2 });
    });

    it("skips an episode entry that already exists (duplicate check hits)", async () => {
        const db = createImportMockDb({
            shows: [[{ id: 5, title: "Breaking Bad", translatedName: null }]],
            episodes: [[{ id: 10, showId: 5, seasonNumber: 1, episodeNumber: 3 }]],
            watchHistory: [[{ id: 777 }]],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "episode" },
                    show: { title: "Breaking Bad" },
                    episode: { seasonNumber: 1, episodeNumber: 3 },
                },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 1 });
        expect(db.__insertedRows).toHaveLength(0);
    });

    it("imports a movie entry: resolved and not a duplicate", async () => {
        const db = createImportMockDb({
            movies: [[{ id: 42 }]],
            watchHistory: [[]],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "movie", watchedAt: "2026-02-01T00:00:00.000Z" },
                    movie: { title: "Arrival" },
                },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 1, skipped: 0 });
        expect(db.__insertedRows[0]).toMatchObject({ mediaType: "movie", movieId: 42 });
    });

    it("skips a movie entry missing movieTitle", async () => {
        const db = createImportMockDb({});
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [{ history: { mediaType: "movie" }, movie: {} }],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 1 });
    });

    it("skips a movie entry whose title has no match", async () => {
        const db = createImportMockDb({ movies: [[]] });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [{ history: { mediaType: "movie" }, movie: { title: "Unknown Movie" } }],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 1 });
    });

    it("skips entries whose mediaType is neither episode nor movie", async () => {
        const db = createImportMockDb({});
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [{ history: { mediaType: "show" } }, { history: {} }],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 0, skipped: 2 });
    });

    it("treats a null watchedAt and a timestamped watchedAt for the same episode as independently deduplicated", async () => {
        const db = createImportMockDb({
            shows: [[{ id: 5, title: "Breaking Bad", translatedName: null }]],
            episodes: [[{ id: 10, showId: 5, seasonNumber: 1, episodeNumber: 3 }]],
            watchHistory: [[], []],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                {
                    history: { mediaType: "episode" },
                    show: { title: "Breaking Bad" },
                    episode: { seasonNumber: 1, episodeNumber: 3 },
                },
                {
                    history: { mediaType: "episode", watchedAt: "2026-03-01T00:00:00.000Z" },
                    show: { title: "Breaking Bad" },
                    episode: { seasonNumber: 1, episodeNumber: 3 },
                },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number };
        expect(body).toMatchObject({ imported: 2, skipped: 0 });
        expect(db.__insertedRows[0].watchedAt).toBeNull();
        expect(db.__insertedRows[1].watchedAt).toBeInstanceOf(Date);
    });

    it("catches a per-entry processing error, records it, and keeps processing later entries", async () => {
        const db = createImportMockDb({
            movies: [[{ id: 1 }], [{ id: 2 }]],
            watchHistory: [[rejectRow(new Error("boom"))], []],
        });
        (dbMockState as { db: unknown }).db = db;

        const res = await importRequest({
            entries: [
                { history: { mediaType: "movie" }, movie: { title: "First" } },
                { history: { mediaType: "movie" }, movie: { title: "Second" } },
            ],
        });
        const body = (await res.json()) as { imported: number; skipped: number; errors: string[] };
        expect(body.imported).toBe(1);
        expect(body.skipped).toBe(1);
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0]).toContain("boom");
    });

    it("caps recorded errors at 20 while still counting every failure as skipped", async () => {
        const movieRows = Array.from({ length: 25 }, (_, i) => [{ id: i + 1 }]);
        const dupRows = Array.from({ length: 25 }, (_, i) => [rejectRow(new Error(`fail-${i}`))]);
        const db = createImportMockDb({ movies: movieRows, watchHistory: dupRows });
        (dbMockState as { db: unknown }).db = db;

        const entries = Array.from({ length: 25 }, (_, i) => ({
            history: { mediaType: "movie" },
            movie: { title: `Movie ${i}` },
        }));
        const res = await importRequest({ entries });
        const body = (await res.json()) as { imported: number; skipped: number; errors: string[] };
        expect(body.imported).toBe(0);
        expect(body.skipped).toBe(25);
        expect(body.errors).toHaveLength(20);
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
