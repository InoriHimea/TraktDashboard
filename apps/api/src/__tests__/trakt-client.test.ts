import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const httpMockState = vi.hoisted(() => ({ providerFetch: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../lib/http.js", () => ({
    providerFetch: httpMockState.providerFetch,
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/rate-limit.js", () => ({
    getProviderRateLimiter: vi.fn(() => ({})),
}));

vi.mock("../jobs/scheduler.js", () => ({
    getRedis: vi.fn(() => ({ eval: vi.fn(), set: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// DB builder stubs — plain sequential FIFO queue. Every non-cached
// traktFetch(Raw) call issues exactly two db.select() calls (token lookup,
// then getProxyUrl's userSettings lookup); cached methods additionally issue
// one metadataCache lookup BEFORE those two (only reached on a cache miss).
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
        __state: state,
    };
}

function makeUserRow(overrides: Row = {}): Row {
    return {
        id: USER_ID,
        traktAccessToken: "plain-access-token",
        traktRefreshToken: "plain-refresh-token",
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
        ...overrides,
    };
}

// One user+proxy pair — the fixed cost of every non-cached API call.
const USER_AND_PROXY: RowsResult[] = [[makeUserRow()], []];

function jsonRes(data: unknown, opts: { status?: number; headers?: Record<string, string> } = {}) {
    const status = opts.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(opts.headers ?? {}),
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
    };
}

function lastFetchOptions() {
    const calls = httpMockState.providerFetch.mock.calls;
    return calls[calls.length - 1][0] as {
        url: string;
        init?: RequestInit;
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { getTraktClient } = await import("../services/trakt.js");

beforeEach(() => {
    process.env.TRAKT_CLIENT_ID = "test-client-id";
    httpMockState.providerFetch.mockReset();
    dbMockState.db = createMockDb();
});

const SENTINEL = { sentinel: true };

// ---------------------------------------------------------------------------
// Thin GET wrappers — table-driven: each just calls traktFetch(path, userId,
// params) and returns the parsed JSON verbatim.
// ---------------------------------------------------------------------------

type ThinCase = {
    name: string;
    invoke: (c: ReturnType<typeof getTraktClient>) => Promise<unknown>;
    pathname: string;
    search?: Record<string, string>;
};

const thinCases: ThinCase[] = [
    {
        name: "getWatchedShows",
        invoke: (c) => c.getWatchedShows(USER_ID),
        pathname: "/sync/watched/shows",
        search: { extended: "noseasons" },
    },
    {
        name: "getWatchedMovies",
        invoke: (c) => c.getWatchedMovies(USER_ID),
        pathname: "/sync/watched/movies",
    },
    {
        name: "getShowProgress",
        invoke: (c) => c.getShowProgress(USER_ID, 300),
        pathname: "/shows/300/progress/watched",
        search: { specials: "true" },
    },
    {
        name: "getWatchlistShows",
        invoke: (c) => c.getWatchlistShows(USER_ID),
        pathname: "/sync/watchlist/shows",
    },
    {
        name: "getWatchlistMovies",
        invoke: (c) => c.getWatchlistMovies(USER_ID),
        pathname: "/sync/watchlist/movies",
    },
    {
        name: "searchShows",
        invoke: (c) => c.searchShows(USER_ID, "breaking bad", 5),
        pathname: "/search/show",
        search: { query: "breaking bad", limit: "5" },
    },
    {
        name: "searchMovies (default limit)",
        invoke: (c) => c.searchMovies(USER_ID, "arrival"),
        pathname: "/search/movie",
        search: { query: "arrival", limit: "8" },
    },
    {
        name: "getTrendingShows (default limit)",
        invoke: (c) => c.getTrendingShows(USER_ID),
        pathname: "/shows/trending",
        search: { limit: "20" },
    },
    {
        name: "getPopularShows",
        invoke: (c) => c.getPopularShows(USER_ID, 10),
        pathname: "/shows/popular",
        search: { limit: "10" },
    },
    {
        name: "getTrendingMovies (default limit)",
        invoke: (c) => c.getTrendingMovies(USER_ID),
        pathname: "/movies/trending",
        search: { limit: "20" },
    },
    {
        name: "getPopularMovies (default limit)",
        invoke: (c) => c.getPopularMovies(USER_ID),
        pathname: "/movies/popular",
        search: { limit: "20" },
    },
    {
        name: "getRatingsShows",
        invoke: (c) => c.getRatingsShows(USER_ID),
        pathname: "/sync/ratings/shows",
    },
    {
        name: "getRatingsMovies",
        invoke: (c) => c.getRatingsMovies(USER_ID),
        pathname: "/sync/ratings/movies",
    },
    {
        name: "getLists",
        invoke: (c) => c.getLists(USER_ID),
        pathname: "/users/me/lists",
    },
    {
        name: "getListItems",
        invoke: (c) => c.getListItems(USER_ID, "my-slug"),
        pathname: "/users/me/lists/my-slug/items",
    },
    {
        name: "getTraktStats",
        invoke: (c) => c.getTraktStats(USER_ID),
        pathname: "/users/me/stats",
    },
    {
        name: "getUserSettings",
        invoke: (c) => c.getUserSettings(USER_ID),
        pathname: "/users/settings",
    },
    {
        name: "getCollectionShows",
        invoke: (c) => c.getCollectionShows(USER_ID),
        pathname: "/sync/collection/shows",
        search: { extended: "metadata" },
    },
    {
        name: "getCollectionMovies",
        invoke: (c) => c.getCollectionMovies(USER_ID),
        pathname: "/sync/collection/movies",
        search: { extended: "metadata" },
    },
];

describe("getTraktClient — thin GET wrappers", () => {
    it.each(thinCases)("$name builds the correct request and returns the response", async (tc) => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(SENTINEL));

        const result = await tc.invoke(getTraktClient());
        expect(result).toEqual(SENTINEL);

        const { url } = lastFetchOptions();
        const parsed = new URL(url);
        expect(parsed.pathname).toBe(tc.pathname);
        for (const [k, v] of Object.entries(tc.search ?? {})) {
            expect(parsed.searchParams.get(k)).toBe(v);
        }
    });
});

// ---------------------------------------------------------------------------
// getWatching — filters to episode-type only
// ---------------------------------------------------------------------------

describe("getWatching", () => {
    it("returns null on a 204 (nothing being watched)", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        const result = await getTraktClient().getWatching(USER_ID);
        expect(result).toBeNull();
    });

    it("returns null when the watching type is a movie", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes({ type: "movie" }));
        const result = await getTraktClient().getWatching(USER_ID);
        expect(result).toBeNull();
    });

    it("returns the payload when the watching type is an episode", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        const payload = { type: "episode", episode: { season: 1, number: 2 } };
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(payload));
        const result = await getTraktClient().getWatching(USER_ID);
        expect(result).toEqual(payload);
    });
});

// ---------------------------------------------------------------------------
// getHistory / getMovieHistory — pagination loop
// ---------------------------------------------------------------------------

describe("getHistory pagination", () => {
    it("returns a single page when X-Pagination-Page-Count is absent", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes([{ id: 1 }]));
        const result = await getTraktClient().getHistory(USER_ID);
        expect(result).toEqual([{ id: 1 }]);
        expect(httpMockState.providerFetch).toHaveBeenCalledTimes(1);
    });

    it("follows pagination across multiple pages and concatenates results", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY, ...USER_AND_PROXY]);
        httpMockState.providerFetch
            .mockResolvedValueOnce(
                jsonRes([{ id: 1 }], { headers: { "X-Pagination-Page-Count": "2" } }),
            )
            .mockResolvedValueOnce(
                jsonRes([{ id: 2 }], { headers: { "X-Pagination-Page-Count": "2" } }),
            );
        const result = await getTraktClient().getHistory(USER_ID);
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        expect(httpMockState.providerFetch).toHaveBeenCalledTimes(2);
    });

    it("defaults to a single page when the header is not a valid number", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(
            jsonRes([{ id: 1 }], { headers: { "X-Pagination-Page-Count": "not-a-number" } }),
        );
        const result = await getTraktClient().getHistory(USER_ID);
        expect(result).toEqual([{ id: 1 }]);
        expect(httpMockState.providerFetch).toHaveBeenCalledTimes(1);
    });

    it("passes startAt through as start_at", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes([]));
        await getTraktClient().getHistory(USER_ID, "2026-01-01T00:00:00.000Z");
        const { url } = lastFetchOptions();
        expect(new URL(url).searchParams.get("start_at")).toBe("2026-01-01T00:00:00.000Z");
    });
});

describe("getMovieHistory pagination", () => {
    it("follows pagination across multiple pages and concatenates results", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY, ...USER_AND_PROXY]);
        httpMockState.providerFetch
            .mockResolvedValueOnce(
                jsonRes([{ id: 1 }], { headers: { "X-Pagination-Page-Count": "2" } }),
            )
            .mockResolvedValueOnce(
                jsonRes([{ id: 2 }], { headers: { "X-Pagination-Page-Count": "2" } }),
            );
        const result = await getTraktClient().getMovieHistory(USER_ID);
        expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
});

// ---------------------------------------------------------------------------
// Mutation methods — verify HTTP method/path/body shape
// ---------------------------------------------------------------------------

describe("mutation methods", () => {
    it("addToWatchlist posts the correct body", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().addToWatchlist(USER_ID, "shows", { trakt: 1 });
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/watchlist");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(init?.body as string)).toEqual({ shows: [{ ids: { trakt: 1 } }] });
    });

    it("removeFromWatchlist posts to the /remove endpoint", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().removeFromWatchlist(USER_ID, "movies", { tmdb: 2 });
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/watchlist/remove");
        expect(JSON.parse(init?.body as string)).toEqual({ movies: [{ ids: { tmdb: 2 } }] });
    });

    it("addRating includes the rating value", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().addRating(USER_ID, "shows", { trakt: 1 }, 9);
        const { init } = lastFetchOptions();
        expect(JSON.parse(init?.body as string)).toEqual({
            shows: [{ ids: { trakt: 1 }, rating: 9 }],
        });
    });

    it("removeRating posts to the /remove endpoint without a rating", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().removeRating(USER_ID, "movies", { trakt: 2 });
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/ratings/remove");
        expect(JSON.parse(init?.body as string)).toEqual({ movies: [{ ids: { trakt: 2 } }] });
    });

    it("removeFromHistory posts raw history ids and returns the parsed result", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        const response = {
            deleted: { movies: 1, episodes: 2 },
            not_found: { movies: [], shows: [], episodes: [], ids: [999] },
        };
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(response));
        const result = await getTraktClient().removeFromHistory(USER_ID, [111, 222, 333]);
        expect(result).toEqual(response);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/history/remove");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(init?.body as string)).toEqual({ ids: [111, 222, 333] });
    });

    it("createList POSTs and returns the created list", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        const created = { name: "My List", ids: { trakt: 1, slug: "my-list" } };
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(created));
        const result = await getTraktClient().createList(USER_ID, { name: "My List" });
        expect(result).toEqual(created);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/users/me/lists");
        expect(init?.method).toBe("POST");
    });

    it("updateList PUTs to the list slug", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        const updated = { name: "Renamed" };
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(updated));
        const result = await getTraktClient().updateList(USER_ID, "my-slug", { name: "Renamed" });
        expect(result).toEqual(updated);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/users/me/lists/my-slug");
        expect(init?.method).toBe("PUT");
    });

    it("deleteList DELETEs the list slug", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().deleteList(USER_ID, "my-slug");
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/users/me/lists/my-slug");
        expect(init?.method).toBe("DELETE");
    });

    it("addListItems splits items into shows/movies buckets", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().addListItems(USER_ID, "my-slug", [
            { type: "show", ids: { trakt: 1 } },
            { type: "movie", ids: { tmdb: 2 } },
        ]);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/users/me/lists/my-slug/items");
        expect(JSON.parse(init?.body as string)).toEqual({
            shows: [{ ids: { trakt: 1 } }],
            movies: [{ ids: { tmdb: 2 } }],
        });
    });

    it("removeListItems posts to the /remove endpoint with the same bucketing", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().removeListItems(USER_ID, "my-slug", [
            { type: "show", ids: { trakt: 1 } },
        ]);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/users/me/lists/my-slug/items/remove");
        expect(JSON.parse(init?.body as string)).toEqual({
            shows: [{ ids: { trakt: 1 } }],
            movies: [],
        });
    });

    it("removeCollectionShows posts shows to /sync/collection/remove", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().removeCollectionShows(USER_ID, [{ ids: { trakt: 1 } }]);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/collection/remove");
        expect(JSON.parse(init?.body as string)).toEqual({ shows: [{ ids: { trakt: 1 } }] });
    });

    it("removeCollectionMovies posts movies to /sync/collection/remove", async () => {
        dbMockState.db = createMockDb([...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(null, { status: 204 }));
        await getTraktClient().removeCollectionMovies(USER_ID, [{ ids: { tmdb: 2 } }]);
        const { url, init } = lastFetchOptions();
        expect(new URL(url).pathname).toBe("/sync/collection/remove");
        expect(JSON.parse(init?.body as string)).toEqual({ movies: [{ ids: { tmdb: 2 } }] });
    });
});

// ---------------------------------------------------------------------------
// Cache methods — getShowDetail / getSeasons / getEpisodes share the same
// stale-while-revalidate shape already exercised for services/tmdb.ts.
// ---------------------------------------------------------------------------

function makeCacheRow(data: unknown, ageMs: number): Row {
    return { source: "trakt_show", externalId: "x", data, cachedAt: new Date(Date.now() - ageMs) };
}

describe("getShowDetail — cache", () => {
    it("returns cached data without fetching when fresh", async () => {
        const cached = { title: "Cached Show" };
        dbMockState.db = createMockDb([[makeCacheRow(cached, 1000)]]);
        const result = await getTraktClient().getShowDetail(300, USER_ID);
        expect(result).toEqual(cached);
        expect(httpMockState.providerFetch).not.toHaveBeenCalled();
    });

    it("fetches and writes the cache on a miss (no cached row)", async () => {
        const fresh = { title: "Fresh Show" };
        dbMockState.db = createMockDb([[], ...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(fresh));
        const result = await getTraktClient().getShowDetail(300, USER_ID);
        expect(result).toEqual(fresh);
        expect(httpMockState.providerFetch).toHaveBeenCalledTimes(1);
        expect((dbMockState.db as { insert: ReturnType<typeof vi.fn> }).insert).toHaveBeenCalled();
    });

    it("treats an expired cache entry (>7d) as a miss", async () => {
        const stale = { title: "Stale" };
        const fresh = { title: "Refetched" };
        dbMockState.db = createMockDb([
            [makeCacheRow(stale, 8 * 24 * 60 * 60 * 1000)],
            ...USER_AND_PROXY,
        ]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(fresh));
        const result = await getTraktClient().getShowDetail(300, USER_ID);
        expect(result).toEqual(fresh);
    });

    it("ignores freshness and refetches when forceRefresh is true", async () => {
        const cached = { title: "Cached" };
        const fresh = { title: "Forced Refresh" };
        dbMockState.db = createMockDb([[makeCacheRow(cached, 1000)], ...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(fresh));
        const result = await getTraktClient().getShowDetail(300, USER_ID, true);
        expect(result).toEqual(fresh);
        expect(httpMockState.providerFetch).toHaveBeenCalledTimes(1);
    });
});

describe("getSeasons — cache", () => {
    it("returns cached data without fetching when fresh", async () => {
        const cached = [{ number: 1 }];
        dbMockState.db = createMockDb([[makeCacheRow(cached, 1000)]]);
        const result = await getTraktClient().getSeasons(300, USER_ID);
        expect(result).toEqual(cached);
        expect(httpMockState.providerFetch).not.toHaveBeenCalled();
    });

    it("fetches on a cache miss", async () => {
        const fresh = [{ number: 1 }];
        dbMockState.db = createMockDb([[], ...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(fresh));
        const result = await getTraktClient().getSeasons(300, USER_ID);
        expect(result).toEqual(fresh);
    });
});

describe("getEpisodes — cache", () => {
    it("returns cached data without fetching when fresh (24h TTL)", async () => {
        const cached = [{ number: 1 }];
        dbMockState.db = createMockDb([[makeCacheRow(cached, 1000)]]);
        const result = await getTraktClient().getEpisodes(300, 1, USER_ID);
        expect(result).toEqual(cached);
        expect(httpMockState.providerFetch).not.toHaveBeenCalled();
    });

    it("treats an entry older than 24h as a miss", async () => {
        const fresh = [{ number: 2 }];
        dbMockState.db = createMockDb([
            [makeCacheRow([{ number: 1 }], 25 * 60 * 60 * 1000)],
            ...USER_AND_PROXY,
        ]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes(fresh));
        const result = await getTraktClient().getEpisodes(300, 1, USER_ID);
        expect(result).toEqual(fresh);
    });
});

// ---------------------------------------------------------------------------
// getEpisodeRating — 24h TTL, stale-or-null degradation on fetch failure,
// 0-10 float → 0-100 integer conversion.
// ---------------------------------------------------------------------------

describe("getEpisodeRating", () => {
    it("returns the cached rating without fetching when fresh", async () => {
        dbMockState.db = createMockDb([[makeCacheRow({ rating: 87 }, 1000)]]);
        const result = await getTraktClient().getEpisodeRating(300, 1, 3, USER_ID);
        expect(result).toBe(87);
        expect(httpMockState.providerFetch).not.toHaveBeenCalled();
    });

    it("fetches, converts the 0-10 float to a 0-100 integer, and caches it", async () => {
        dbMockState.db = createMockDb([[], ...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(jsonRes({ rating: 8.73, votes: 100 }));
        const result = await getTraktClient().getEpisodeRating(300, 1, 3, USER_ID);
        expect(result).toBe(87);
        expect((dbMockState.db as { insert: ReturnType<typeof vi.fn> }).insert).toHaveBeenCalled();
    });

    it("degrades to the stale cached rating when the live fetch fails", async () => {
        dbMockState.db = createMockDb([
            [makeCacheRow({ rating: 55 }, 25 * 60 * 60 * 1000)],
            ...USER_AND_PROXY,
        ]);
        httpMockState.providerFetch.mockResolvedValueOnce(
            jsonRes({ error: "nope" }, { status: 500 }),
        );
        const result = await getTraktClient().getEpisodeRating(300, 1, 3, USER_ID);
        expect(result).toBe(55);
    });

    it("degrades to null when the live fetch fails and there is no cache at all", async () => {
        dbMockState.db = createMockDb([[], ...USER_AND_PROXY]);
        httpMockState.providerFetch.mockResolvedValueOnce(
            jsonRes({ error: "nope" }, { status: 500 }),
        );
        const result = await getTraktClient().getEpisodeRating(300, 1, 3, USER_ID);
        expect(result).toBeNull();
    });
});
