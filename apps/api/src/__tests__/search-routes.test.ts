import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

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

type RowsResult = unknown[];

class SelectBuilder implements PromiseLike<RowsResult> {
    constructor(private readonly result: RowsResult) {}
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
        return Promise.resolve(this.result).then(ok, fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    return { select: vi.fn(() => new SelectBuilder(state.selects.shift() ?? [])) };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        searchShows: vi.fn().mockResolvedValue([]),
        searchMovies: vi.fn().mockResolvedValue([]),
        addToWatchlist: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

const { searchRoutes } = await import("../routes/search.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/search", searchRoutes);
    return a;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /search", () => {
    it("returns [] without calling Trakt for a query shorter than 2 chars", async () => {
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/search?q=a");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
        expect(trakt.searchShows).not.toHaveBeenCalled();
    });

    it("splits the limit between shows and movies for type=all (ceil/floor)", async () => {
        const trakt = createMockTrakt();
        traktMockState.client = trakt;
        dbMockState.db = createMockDb([[], [], [], []]);

        await app().request("/search?q=batman&type=all&limit=9");
        expect(trakt.searchShows).toHaveBeenCalledWith(TEST_USER_ID, "batman", 5);
        expect(trakt.searchMovies).toHaveBeenCalledWith(TEST_USER_ID, "batman", 4);
    });

    it("searches only shows when type=show", async () => {
        const trakt = createMockTrakt();
        traktMockState.client = trakt;
        dbMockState.db = createMockDb([[], []]);

        await app().request("/search?q=batman&type=show&limit=8");
        expect(trakt.searchShows).toHaveBeenCalledWith(TEST_USER_ID, "batman", 8);
        expect(trakt.searchMovies).not.toHaveBeenCalled();
    });

    it("maps show results with local id / poster / watchlist state", async () => {
        traktMockState.client = createMockTrakt({
            searchShows: vi.fn().mockResolvedValue([
                {
                    show: {
                        ids: { trakt: 1, slug: "show-a", tmdb: 100 },
                        title: "Show A",
                        year: 2020,
                    },
                },
                // entries without a `show` key must be skipped, not crash
                { show: null },
            ]),
        });
        dbMockState.db = createMockDb([
            [{ id: 50, traktId: 1, posterPath: "/p.jpg" }],
            [{ showId: 50 }],
        ]);

        const res = await app().request("/search?q=batman&type=show");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
            type: "show",
            localId: 50,
            posterPath: "/p.jpg",
            inWatchlist: true,
        });
    });

    it("maps movie results similarly when type=movie", async () => {
        traktMockState.client = createMockTrakt({
            searchMovies: vi.fn().mockResolvedValue([
                {
                    movie: {
                        ids: { trakt: 9, slug: "movie-a", tmdb: 900 },
                        title: "Movie A",
                        year: 2021,
                    },
                },
            ]),
        });
        dbMockState.db = createMockDb([[{ id: 80, traktId: 9, posterPath: null }], []]);

        const res = await app().request("/search?q=matrix&type=movie");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toMatchObject({ type: "movie", localId: 80, inWatchlist: false });
    });

    it("returns a 502 upstream_error when Trakt throws a TraktApiError", async () => {
        traktMockState.client = createMockTrakt({
            searchShows: vi
                .fn()
                .mockRejectedValue(new traktMockState.TraktApiError("rate limited")),
        });

        const res = await app().request("/search?q=batman&type=show");
        expect(res.status).toBe(502);
        const body = (await res.json()) as { error: string; data: unknown[] };
        expect(body.error).toBe("upstream_error");
        expect(body.data).toEqual([]);
    });

    it("rethrows non-Trakt errors (falls through to Hono's default 500)", async () => {
        traktMockState.client = createMockTrakt({
            searchShows: vi.fn().mockRejectedValue(new Error("boom")),
        });

        const res = await app().request("/search?q=batman&type=show");
        expect(res.status).toBe(500);
    });
});

describe("POST /search/watchlist-add", () => {
    function post(body: unknown) {
        return app().request("/search/watchlist-add", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
    }

    it("adds a show by trakt id, including tmdb id when provided", async () => {
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await post({ type: "show", traktId: 1, tmdbId: 100 });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
        expect(trakt.addToWatchlist).toHaveBeenCalledWith(TEST_USER_ID, "shows", {
            trakt: 1,
            tmdb: 100,
        });
    });

    it("omits tmdb from ids when not provided", async () => {
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        await post({ type: "movie", traktId: 9 });
        expect(trakt.addToWatchlist).toHaveBeenCalledWith(TEST_USER_ID, "movies", { trakt: 9 });
    });

    it("rejects an invalid payload with 400", async () => {
        const res = await post({ type: "book", traktId: 1 });
        expect(res.status).toBe(400);
    });
});
