import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const tmdbMockState = vi.hoisted(() => ({
    getTmdbShow: vi.fn(),
    getTmdbMovie: vi.fn(),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
}));

vi.mock("../services/tmdb.js", () => ({
    getTmdbShow: tmdbMockState.getTmdbShow,
    getTmdbMovie: tmdbMockState.getTmdbMovie,
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
        getTrendingShows: vi.fn().mockResolvedValue([]),
        getPopularShows: vi.fn().mockResolvedValue([]),
        getTrendingMovies: vi.fn().mockResolvedValue([]),
        getPopularMovies: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

const { discoverRoutes } = await import("../routes/discover.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/discover", discoverRoutes);
    return a;
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default resolved value so tests that don't care about the TMDB poster
    // fallback still exercise it safely (the route always calls it whenever a
    // draft item lacks a local posterPath but has a tmdbId).
    tmdbMockState.getTmdbShow.mockReset().mockResolvedValue({ poster_path: null });
    tmdbMockState.getTmdbMovie.mockReset().mockResolvedValue({ poster_path: null });
});

describe("GET /discover — shows", () => {
    const trendingShow = {
        show: {
            ids: { trakt: 1, slug: "show-a", tmdb: 100, imdb: "tt1" },
            title: "Show A",
            year: 2020,
        },
        watchers: 42,
    };

    it("returns [] immediately when Trakt has nothing trending (no DB calls)", async () => {
        traktMockState.client = createMockTrakt();
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await app().request("/discover?mediaType=show&tab=trending");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("joins local rows + watchlist and marks inWatchlist for trending shows", async () => {
        traktMockState.client = createMockTrakt({
            getTrendingShows: vi.fn().mockResolvedValue([trendingShow]),
        });
        dbMockState.db = createMockDb([
            [{ id: 50, traktId: 1, posterPath: "/local.jpg" }],
            [{ showId: 50 }],
        ]);

        const res = await app().request("/discover?mediaType=show&tab=trending");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toMatchObject({
            type: "show",
            traktId: 1,
            title: "Show A",
            localId: 50,
            posterPath: "/local.jpg",
            inWatchlist: true,
            watchers: 42,
        });
        expect(tmdbMockState.getTmdbShow).not.toHaveBeenCalled();
    });

    it("uses popular shows when tab=popular (no watchers field)", async () => {
        traktMockState.client = createMockTrakt({
            getPopularShows: vi.fn().mockResolvedValue([
                {
                    ids: { trakt: 2, slug: "show-b", tmdb: 200, imdb: null },
                    title: "Show B",
                    year: 2019,
                },
            ]),
        });
        dbMockState.db = createMockDb([[], []]);

        const res = await app().request("/discover?mediaType=show&tab=popular");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toMatchObject({ title: "Show B", inWatchlist: false, localId: null });
    });

    it("fetches a TMDB poster for shows missing a local posterPath", async () => {
        traktMockState.client = createMockTrakt({
            getTrendingShows: vi.fn().mockResolvedValue([trendingShow]),
        });
        // Local row exists but with a null posterPath so the TMDB fallback fires.
        dbMockState.db = createMockDb([[{ id: 50, traktId: 1, posterPath: null }], []]);
        tmdbMockState.getTmdbShow.mockResolvedValue({ poster_path: "/tmdb-poster.jpg" });

        const res = await app().request("/discover?mediaType=show&tab=trending");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].posterPath).toBe("/tmdb-poster.jpg");
        expect(tmdbMockState.getTmdbShow).toHaveBeenCalledWith(100, undefined, TEST_USER_ID);
    });

    it("keeps posterPath null when the TMDB fallback rejects", async () => {
        traktMockState.client = createMockTrakt({
            getTrendingShows: vi.fn().mockResolvedValue([trendingShow]),
        });
        dbMockState.db = createMockDb([[], []]);
        tmdbMockState.getTmdbShow.mockRejectedValue(new Error("tmdb down"));

        const res = await app().request("/discover?mediaType=show&tab=trending");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].posterPath).toBeNull();
    });

    it("clamps limit to 40 and forwards it to the Trakt client", async () => {
        const trending = vi.fn().mockResolvedValue([]);
        traktMockState.client = createMockTrakt({ getTrendingShows: trending });
        dbMockState.db = createMockDb([]);

        await app().request("/discover?mediaType=show&tab=trending&limit=999");
        expect(trending).toHaveBeenCalledWith(TEST_USER_ID, 40);
    });
});

describe("GET /discover — movies", () => {
    const trendingMovie = {
        movie: {
            ids: { trakt: 9, slug: "movie-a", tmdb: 900, imdb: "tt9" },
            title: "Movie A",
            year: 2022,
        },
        watchers: 7,
    };

    it("returns [] immediately when nothing is trending", async () => {
        traktMockState.client = createMockTrakt();
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await app().request("/discover?mediaType=movie&tab=trending");
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("joins local rows + watchlist for trending movies", async () => {
        traktMockState.client = createMockTrakt({
            getTrendingMovies: vi.fn().mockResolvedValue([trendingMovie]),
        });
        dbMockState.db = createMockDb([
            [{ id: 80, traktId: 9, posterPath: "/local-movie.jpg" }],
            [{ movieId: 80 }],
        ]);

        const res = await app().request("/discover?mediaType=movie&tab=trending");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toMatchObject({
            type: "movie",
            traktId: 9,
            posterPath: "/local-movie.jpg",
            inWatchlist: true,
        });
    });

    it("uses popular movies when tab=popular and fetches TMDB poster fallback", async () => {
        traktMockState.client = createMockTrakt({
            getPopularMovies: vi.fn().mockResolvedValue([
                {
                    ids: { trakt: 10, slug: "movie-b", tmdb: 910, imdb: null },
                    title: "Movie B",
                    year: 2021,
                },
            ]),
        });
        dbMockState.db = createMockDb([[], []]);
        tmdbMockState.getTmdbMovie.mockResolvedValue({ poster_path: "/tmdb-movie.jpg" });

        const res = await app().request("/discover?mediaType=movie&tab=popular");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].posterPath).toBe("/tmdb-movie.jpg");
        expect(tmdbMockState.getTmdbMovie).toHaveBeenCalledWith(910, TEST_USER_ID);
    });
});
