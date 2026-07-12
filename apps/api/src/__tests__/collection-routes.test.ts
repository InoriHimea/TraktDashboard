import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const syncMockState = vi.hoisted(() => ({
    syncUserCollection: vi.fn(),
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
    syncUserCollection: syncMockState.syncUserCollection,
}));

// ---------------------------------------------------------------------------
// DB builder stubs (minimal — only what collection routes call)
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
    innerJoin() {
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
    then<T1 = SelectResult, T2 = never>(
        ok?: ((value: SelectResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this._result).then(ok, fail);
    }
}

class DeleteBuilder implements PromiseLike<unknown> {
    where() {
        return this;
    }
    then<T1 = unknown, T2 = never>(
        ok?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

function createMockDb(selectResults: SelectResult[] = []) {
    const state = { selectResults: [...selectResults] };
    return {
        select: vi.fn(() => new SelectBuilder(state.selectResults.shift() ?? [])),
        delete: vi.fn(() => new DeleteBuilder()),
        __state: state,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        removeCollectionShows: vi.fn().mockResolvedValue(undefined),
        removeCollectionMovies: vi.fn().mockResolvedValue(undefined),
        getTraktStats: vi.fn().mockResolvedValue({
            shows: { collected: 0 },
            movies: { collected: 0 },
        }),
        getUserSettings: vi.fn().mockResolvedValue({ limits: { collection: null } }),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { collectionRoutes } = await import("../routes/collection.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/collection", collectionRoutes);
    return a;
}

const collectedAt = new Date("2026-05-01T00:00:00.000Z");
const updatedAt = new Date("2026-06-01T00:00:00.000Z");

function makeShowRow(overrides: Record<string, unknown> = {}) {
    return {
        col: {
            id: 1,
            mediaType: "show",
            showId: 5,
            movieId: null,
            season: null,
            episode: null,
            mediaFormat: "bluray",
            resolution: "hd_1080p",
            hdr: null,
            audio: "dts",
            audioChannels: "5.1",
            collectedAt,
            updatedAt,
        },
        showTitle: "Test Show",
        showFirstAired: "2020-01-05",
        showPoster: "/show.jpg",
        movieTitle: null,
        movieReleaseDate: null,
        moviePoster: null,
        ...overrides,
    };
}

function makeMovieRow(overrides: Record<string, unknown> = {}) {
    return {
        col: {
            id: 2,
            mediaType: "movie",
            showId: null,
            movieId: 9,
            season: null,
            episode: null,
            mediaFormat: "digital",
            resolution: "uhd_4k",
            hdr: "dolby_vision",
            audio: null,
            audioChannels: null,
            collectedAt: null,
            updatedAt,
        },
        showTitle: null,
        showFirstAired: null,
        showPoster: null,
        movieTitle: "Test Movie",
        movieReleaseDate: "2023-11-20",
        moviePoster: "/movie.jpg",
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

describe("GET /collection", () => {
    it("returns mapped items with title/poster/year coalesced from show", async () => {
        dbMockState.db = createMockDb([[makeShowRow()]]);

        const res = await app().request("/collection");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data).toHaveLength(1);
        const item = body.data[0];
        expect(item.title).toBe("Test Show");
        expect(item.posterPath).toBe("/show.jpg");
        expect(item.year).toBe(2020);
        expect(item.collectedAt).toBe(collectedAt.toISOString());
    });

    it("maps movie rows with year from releaseDate and null collectedAt", async () => {
        dbMockState.db = createMockDb([[makeMovieRow()]]);

        const res = await app().request("/collection?type=movie");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        const item = body.data[0];
        expect(item.title).toBe("Test Movie");
        expect(item.year).toBe(2023);
        expect(item.collectedAt).toBeNull();
    });

    it("returns empty list when collection is empty", async () => {
        dbMockState.db = createMockDb([[]]);

        const res = await app().request("/collection?type=show");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
    });

    it("yields null year for malformed firstAired", async () => {
        dbMockState.db = createMockDb([[makeShowRow({ showFirstAired: "unknown" })]]);

        const res = await app().request("/collection");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].year).toBeNull();
    });
});

describe("GET /collection/shows/:showId/episodes", () => {
    it("groups episode rows by season", async () => {
        dbMockState.db = createMockDb([
            [
                {
                    season: 1,
                    episode: 1,
                    mediaFormat: "bluray",
                    resolution: null,
                    hdr: null,
                    audio: null,
                    audioChannels: null,
                    collectedAt,
                },
                {
                    season: 1,
                    episode: 2,
                    mediaFormat: "bluray",
                    resolution: null,
                    hdr: null,
                    audio: null,
                    audioChannels: null,
                    collectedAt: null,
                },
                {
                    season: 2,
                    episode: 1,
                    mediaFormat: "digital",
                    resolution: null,
                    hdr: null,
                    audio: null,
                    audioChannels: null,
                    collectedAt: null,
                },
            ],
        ]);

        const res = await app().request("/collection/shows/5/episodes");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Record<string, unknown[]> };
        expect(Object.keys(body.data).sort()).toEqual(["1", "2"]);
        expect(body.data["1"]).toHaveLength(2);
        expect(body.data["2"]).toHaveLength(1);
        expect((body.data["1"][0] as { collectedAt: string | null }).collectedAt).toBe(
            collectedAt.toISOString(),
        );
    });

    it("rejects non-numeric showId with 400", async () => {
        dbMockState.db = createMockDb([]);

        const res = await app().request("/collection/shows/abc/episodes");
        expect(res.status).toBe(400);
    });
});

describe("GET /collection/check", () => {
    it("returns inCollection true when a show-level row exists", async () => {
        dbMockState.db = createMockDb([[{ id: 1 }]]);

        const res = await app().request("/collection/check?showId=5");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { inCollection: boolean };
        expect(body.inCollection).toBe(true);
    });

    it("returns inCollection false when no row exists", async () => {
        dbMockState.db = createMockDb([[]]);

        const res = await app().request("/collection/check?movieId=9");
        const body = (await res.json()) as { inCollection: boolean };
        expect(body.inCollection).toBe(false);
    });

    it("returns false without querying when neither id is provided", async () => {
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await app().request("/collection/check");
        const body = (await res.json()) as { inCollection: boolean };
        expect(body.inCollection).toBe(false);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("rejects both ids at once with 400", async () => {
        dbMockState.db = createMockDb([]);

        const res = await app().request("/collection/check?showId=5&movieId=9");
        expect(res.status).toBe(400);
    });

    it("rejects non-numeric ids with 400", async () => {
        dbMockState.db = createMockDb([]);

        const res = await app().request("/collection/check?showId=abc");
        expect(res.status).toBe(400);
    });
});

describe("POST /collection/sync", () => {
    it("returns synced count on success", async () => {
        syncMockState.syncUserCollection.mockResolvedValue(12);

        const res = await app().request("/collection/sync", { method: "POST" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; synced: number };
        expect(body.ok).toBe(true);
        expect(body.synced).toBe(12);
        expect(syncMockState.syncUserCollection).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("returns 500 with error message when sync throws", async () => {
        syncMockState.syncUserCollection.mockRejectedValue(new Error("trakt down"));

        const res = await app().request("/collection/sync", { method: "POST" });
        expect(res.status).toBe(500);
        const body = (await res.json()) as { ok: boolean; error: string };
        expect(body.ok).toBe(false);
        expect(body.error).toBe("trakt down");
    });
});

describe("POST /collection/clear-remote", () => {
    it("requires explicit confirm", async () => {
        dbMockState.db = createMockDb([]);

        const res = await app().request("/collection/clear-remote", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
        });
        expect(res.status).toBe(400);
    });

    it("removes remote shows and movies in bulk and reports count", async () => {
        dbMockState.db = createMockDb([
            [
                { traktId: 100, tmdbId: 200 },
                { traktId: null, tmdbId: 201 },
            ],
            [{ traktId: 300, tmdbId: null }],
        ]);
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/clear-remote", {
            method: "POST",
            body: JSON.stringify({ confirm: true }),
            headers: { "Content-Type": "application/json" },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; data: { removed: number } };
        expect(body.data.removed).toBe(3);
        expect(trakt.removeCollectionShows).toHaveBeenCalledTimes(1);
        expect(trakt.removeCollectionShows).toHaveBeenCalledWith(TEST_USER_ID, [
            { ids: { trakt: 100, tmdb: 200 } },
            { ids: { tmdb: 201 } },
        ]);
        expect(trakt.removeCollectionMovies).toHaveBeenCalledWith(TEST_USER_ID, [
            { ids: { trakt: 300 } },
        ]);
    });

    it("skips Trakt calls entirely when collection is empty", async () => {
        dbMockState.db = createMockDb([[], []]);
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/clear-remote", {
            method: "POST",
            body: JSON.stringify({ confirm: true }),
            headers: { "Content-Type": "application/json" },
        });
        const body = (await res.json()) as { data: { removed: number } };
        expect(body.data.removed).toBe(0);
        expect(trakt.removeCollectionShows).not.toHaveBeenCalled();
        expect(trakt.removeCollectionMovies).not.toHaveBeenCalled();
    });

    it("drops rows lacking both trakt and tmdb ids", async () => {
        dbMockState.db = createMockDb([[{ traktId: null, tmdbId: null }], []]);
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/clear-remote", {
            method: "POST",
            body: JSON.stringify({ confirm: true }),
            headers: { "Content-Type": "application/json" },
        });
        const body = (await res.json()) as { data: { removed: number } };
        expect(body.data.removed).toBe(0);
        expect(trakt.removeCollectionShows).not.toHaveBeenCalled();
    });
});

describe("GET /collection/capacity", () => {
    it("computes usage against the Trakt-reported limit", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 40 },
                movies: { collected: 55 },
            }),
            getUserSettings: vi.fn().mockResolvedValue({
                limits: { collection: { item_count: 100 } },
            }),
        });

        const res = await app().request("/collection/capacity");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: {
                used: number;
                limit: number;
                pct: number;
                nearLimit: boolean;
                limitIsDefault: boolean;
            };
        };
        expect(body.data.used).toBe(95);
        expect(body.data.limit).toBe(100);
        expect(body.data.pct).toBe(95);
        expect(body.data.nearLimit).toBe(true);
        expect(body.data.limitIsDefault).toBe(false);
    });

    it("falls back to the 1000 default limit when Trakt reports none", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 10 },
                movies: { collected: 10 },
            }),
        });

        const res = await app().request("/collection/capacity");
        const body = (await res.json()) as {
            data: { limit: number; pct: number; nearLimit: boolean; limitIsDefault: boolean };
        };
        expect(body.data.limit).toBe(1000);
        expect(body.data.pct).toBe(2);
        expect(body.data.nearLimit).toBe(false);
        expect(body.data.limitIsDefault).toBe(true);
    });
});

describe("POST /collection/prune-remote", () => {
    function pruneRequest(payload: Record<string, unknown>) {
        return app().request("/collection/prune-remote", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
        });
    }

    it("requires explicit confirm", async () => {
        const res = await pruneRequest({});
        expect(res.status).toBe(400);
    });

    it("is a no-op when already at or below target", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 30 },
                movies: { collected: 30 },
            }),
            getUserSettings: vi.fn().mockResolvedValue({
                limits: { collection: { item_count: 100 } },
            }),
        });
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await pruneRequest({ confirm: true, targetPct: 80 });
        const body = (await res.json()) as {
            data: { freed: number; currentCount: number; targetCount: number };
        };
        expect(body.data.freed).toBe(0);
        expect(body.data.currentCount).toBe(60);
        expect(body.data.targetCount).toBe(80);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("deletes oldest shows first, then movies, until target reached", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 90 },
                movies: { collected: 10 },
            }),
            getUserSettings: vi.fn().mockResolvedValue({
                limits: { collection: { item_count: 100 } },
            }),
        });
        const trakt = traktMockState.client as ReturnType<typeof createMockTrakt>;
        // toFree = 100 - 80 = 20; provide 12 shows then 8 movies.
        const showItems = Array.from({ length: 12 }, (_, i) => ({
            showId: i + 1,
            collectedAt,
            traktId: 1000 + i,
            tmdbId: null,
        }));
        const movieItems = Array.from({ length: 8 }, (_, i) => ({
            movieId: i + 1,
            collectedAt,
            traktId: null,
            tmdbId: 2000 + i,
        }));
        dbMockState.db = createMockDb([showItems, movieItems]);

        const res = await pruneRequest({ confirm: true, targetPct: 80 });
        const body = (await res.json()) as {
            data: { freed: number; partialError?: string };
        };
        expect(body.data.freed).toBe(20);
        expect(body.data.partialError).toBeUndefined();
        expect(trakt.removeCollectionShows).toHaveBeenCalledTimes(12);
        expect(trakt.removeCollectionMovies).toHaveBeenCalledTimes(8);
    });

    it("stops with partialError when a remote delete fails and skips the movie phase", async () => {
        const removeShows = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("rate limited"));
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 90 },
                movies: { collected: 10 },
            }),
            getUserSettings: vi.fn().mockResolvedValue({
                limits: { collection: { item_count: 100 } },
            }),
            removeCollectionShows: removeShows,
        });
        const trakt = traktMockState.client as ReturnType<typeof createMockTrakt>;
        const showItems = Array.from({ length: 5 }, (_, i) => ({
            showId: i + 1,
            collectedAt,
            traktId: 1000 + i,
            tmdbId: null,
        }));
        const db = createMockDb([showItems]);
        dbMockState.db = db;

        const res = await pruneRequest({ confirm: true, targetPct: 80 });
        const body = (await res.json()) as {
            data: { freed: number; partialError?: string };
        };
        expect(body.data.freed).toBe(1);
        expect(body.data.partialError).toBe("rate limited");
        // Movie phase must be skipped after a partial failure: only the show query ran.
        expect(db.select).toHaveBeenCalledTimes(1);
        expect(trakt.removeCollectionMovies).not.toHaveBeenCalled();
    });

    it("clamps targetPct into the 10–95 range", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                shows: { collected: 9 },
                movies: { collected: 0 },
            }),
            getUserSettings: vi.fn().mockResolvedValue({
                limits: { collection: { item_count: 100 } },
            }),
        });
        dbMockState.db = createMockDb([]);

        // targetPct 1 → clamped to 10 → targetCount 10 ≥ current 9 → no-op
        const res = await pruneRequest({ confirm: true, targetPct: 1 });
        const body = (await res.json()) as { data: { freed: number; targetCount: number } };
        expect(body.data.targetCount).toBe(10);
        expect(body.data.freed).toBe(0);
    });
});

describe("DELETE /collection/:id", () => {
    it("rejects non-numeric id with 400", async () => {
        dbMockState.db = createMockDb([]);

        const res = await app().request("/collection/abc", { method: "DELETE" });
        expect(res.status).toBe(400);
    });

    it("returns 404 when the item does not belong to the user", async () => {
        dbMockState.db = createMockDb([[]]);

        const res = await app().request("/collection/1", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("propagates show-level deletes to Trakt and removes locally", async () => {
        const item = {
            id: 1,
            userId: TEST_USER_ID,
            showId: 5,
            movieId: null,
            season: null,
            episode: null,
        };
        const db = createMockDb([[item], [{ traktId: 100, tmdbId: 200 }]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.removeCollectionShows).toHaveBeenCalledWith(TEST_USER_ID, [
            { ids: { trakt: 100, tmdb: 200 } },
        ]);
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("does NOT propagate episode-level rows to Trakt (would delete the whole show)", async () => {
        const item = {
            id: 3,
            userId: TEST_USER_ID,
            showId: 5,
            movieId: null,
            season: 1,
            episode: 2,
        };
        const db = createMockDb([[item]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/3", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.removeCollectionShows).not.toHaveBeenCalled();
        expect(trakt.removeCollectionMovies).not.toHaveBeenCalled();
        expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("propagates movie deletes to Trakt", async () => {
        const item = {
            id: 2,
            userId: TEST_USER_ID,
            showId: null,
            movieId: 9,
            season: null,
            episode: null,
        };
        const db = createMockDb([[item], [{ traktId: 300, tmdbId: null }]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/2", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.removeCollectionMovies).toHaveBeenCalledWith(TEST_USER_ID, [
            { ids: { trakt: 300 } },
        ]);
    });

    it("still deletes locally when the Trakt propagation fails (best-effort)", async () => {
        const item = {
            id: 1,
            userId: TEST_USER_ID,
            showId: 5,
            movieId: null,
            season: null,
            episode: null,
        };
        const db = createMockDb([[item], [{ traktId: 100, tmdbId: null }]]);
        dbMockState.db = db;
        traktMockState.client = createMockTrakt({
            removeCollectionShows: vi.fn().mockRejectedValue(new Error("network")),
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const res = await app().request("/collection/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
        expect(db.delete).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("skips Trakt propagation when the show has no external ids", async () => {
        const item = {
            id: 1,
            userId: TEST_USER_ID,
            showId: 5,
            movieId: null,
            season: null,
            episode: null,
        };
        const db = createMockDb([[item], [{ traktId: null, tmdbId: null }]]);
        dbMockState.db = db;
        const trakt = createMockTrakt();
        traktMockState.client = trakt;

        const res = await app().request("/collection/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(trakt.removeCollectionShows).not.toHaveBeenCalled();
        expect(db.delete).toHaveBeenCalledTimes(1);
    });
});
