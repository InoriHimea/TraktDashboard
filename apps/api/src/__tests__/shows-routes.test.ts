import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const syncMockState = vi.hoisted(() => ({
    recalcShowProgress: vi.fn().mockResolvedValue(undefined),
    forceSyncShow: vi.fn().mockResolvedValue(undefined),
}));
const tmdbMockState = vi.hoisted(() => ({
    getTmdbEpisodeDetail: vi.fn().mockResolvedValue({ directors: [] }),
}));
const jellyfinMockState = vi.hoisted(() => ({
    autoDeleteJellyfinEpisode: vi.fn().mockResolvedValue(undefined),
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
    recalcShowProgress: syncMockState.recalcShowProgress,
    forceSyncShow: syncMockState.forceSyncShow,
}));

vi.mock("../services/tmdb.js", () => ({
    getTmdbEpisodeDetail: tmdbMockState.getTmdbEpisodeDetail,
}));

vi.mock("../services/jellyfin.js", () => ({
    autoDeleteJellyfinEpisode: jellyfinMockState.autoDeleteJellyfinEpisode,
}));

// ---------------------------------------------------------------------------
// DB builder stubs — plain sequential FIFO queues (one per db.select()/
// db.insert() call, in the exact order the route under test issues them).
// Every route in shows.ts has a fixed, input-independent call count per
// branch, so a simple queue (no table-based dispatch) is sufficient.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type RowsResult = Row[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(private _result: RowsResult) {}
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

function createMockDb(opts: { selects?: RowsResult[]; inserts?: RowsResult[] } = {}) {
    const state = {
        selects: [...(opts.selects ?? [])],
        inserts: [...(opts.inserts ?? [])],
    };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder(state.inserts.shift() ?? [])),
        delete: vi.fn(() => new ChainBuilder([])),
        __state: state,
    };
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getEpisodeRating: vi.fn().mockResolvedValue(null),
        ...overrides,
    };
}

function flushMicrotasks() {
    return new Promise<void>((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { showRoutes } = await import("../routes/shows.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/shows", showRoutes);
    return a;
}

function request(path: string, init?: RequestInit) {
    return app().request(`/shows${path}`, init);
}

function postJson(path: string, body: unknown) {
    return request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const now = new Date("2026-06-01T12:00:00.000Z");

function makeShowRow(overrides: Row = {}): Row {
    return {
        id: 5,
        tmdbId: 100,
        tvdbId: 200,
        imdbId: "tt123",
        traktId: 300,
        traktSlug: "test-show",
        title: "Test Show",
        overview: "overview",
        status: "returning series",
        firstAired: "2020-01-01",
        network: "HBO",
        genres: ["drama"],
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        totalEpisodes: 10,
        totalSeasons: 1,
        lastSyncedAt: now,
        createdAt: now,
        originalName: null,
        originalLanguage: null,
        translatedName: null,
        translatedOverview: null,
        displayLanguage: null,
        ...overrides,
    };
}

function makeEpisodeRow(overrides: Row = {}): Row {
    return {
        id: 10,
        showId: 5,
        seasonId: 1,
        seasonNumber: 1,
        episodeNumber: 3,
        title: "Pilot",
        translatedTitle: null,
        overview: "ep overview",
        translatedOverview: null,
        runtime: 42,
        airDate: "2020-01-08",
        stillPath: "/still.jpg",
        traktId: 111,
        tmdbId: 222,
        ...overrides,
    };
}

function makeProgressRow(overrides: Row = {}): Row {
    return {
        userId: TEST_USER_ID,
        showId: 5,
        airedEpisodes: 10,
        watchedEpisodes: 5,
        lastWatchedAt: now,
        completed: false,
        nextEpisodeId: null,
        ...overrides,
    };
}

beforeEach(() => {
    dbMockState.db = createMockDb();
    traktMockState.client = createMockTrakt();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /progress
// ---------------------------------------------------------------------------

describe("GET /shows/progress", () => {
    it("returns mapped shows with computed percentage", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [{ total: 1 }],
                [{ progress: makeProgressRow(), show: makeShowRow(), nextEp: makeEpisodeRow() }],
            ],
        });

        const res = await request("/progress");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: Array<{ percentage: number; nextEpisode: unknown }>;
            total: number;
        };
        expect(body.total).toBe(1);
        expect(body.data[0].percentage).toBe(50);
        expect(body.data[0].nextEpisode).toMatchObject({ id: 10 });
    });

    it("computes percentage as 0 when airedEpisodes is 0", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [{ total: 1 }],
                [
                    {
                        progress: makeProgressRow({ airedEpisodes: 0, watchedEpisodes: 0 }),
                        show: makeShowRow(),
                        nextEp: null,
                    },
                ],
            ],
        });

        const res = await request("/progress");
        const body = (await res.json()) as { data: Array<{ percentage: number }> };
        expect(body.data[0].percentage).toBe(0);
    });

    it("accepts filter/search/pagination query params", async () => {
        dbMockState.db = createMockDb({ selects: [[{ total: 0 }], []] });

        const res = await request("/progress?filter=completed&q=breaking&limit=10&offset=5");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { limit: number; offset: number };
        expect(body.limit).toBe(10);
        expect(body.offset).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// GET /up-next
// ---------------------------------------------------------------------------

describe("GET /shows/up-next", () => {
    it("returns the next unwatched episode per show", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        showId: 5,
                        showTitle: "Test Show",
                        showPosterPath: "/poster.jpg",
                        lastWatchedAt: now,
                        epId: 10,
                        epSeasonNumber: 1,
                        epEpisodeNumber: 4,
                        epTitle: "Next Episode",
                        epStillPath: null,
                        epAirDate: "2020-01-15",
                        epRuntime: 42,
                    },
                ],
            ],
        });

        const res = await request("/up-next");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: Array<{ showId: number; nextEpisode: { episodeNumber: number } }>;
        };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].nextEpisode.episodeNumber).toBe(4);
    });

    it("returns an empty list when nothing is in progress", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await request("/up-next");
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------

describe("GET /shows/:id", () => {
    it("returns 404 when the show doesn't exist", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await request("/999");
        expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
        const res = await request("/abc");
        expect(res.status).toBe(400);
    });

    it("builds season/episode progress with a watched map and aired flags", async () => {
        const watchedEp = makeEpisodeRow({ id: 10, seasonNumber: 1, episodeNumber: 1 });
        const unwatchedFutureEp = makeEpisodeRow({
            id: 11,
            seasonNumber: 1,
            episodeNumber: 2,
            airDate: "2099-01-01",
        });
        dbMockState.db = createMockDb({
            selects: [
                [makeShowRow()],
                [makeProgressRow({ nextEpisodeId: null })],
                [{ id: 1, showId: 5, seasonNumber: 1, episodeCount: 2, posterPath: null }],
                [watchedEp, unwatchedFutureEp],
                [{ episodeId: 10, watchedAt: now }],
            ],
        });

        const res = await request("/5");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { seasons: Array<{ episodes: Array<{ watched: boolean; aired: boolean }> }> };
        };
        const eps = body.data.seasons[0].episodes;
        expect(eps.find((e) => e.watched)).toBeDefined();
        expect(eps.find((e) => !e.watched && !e.aired)).toBeDefined();
    });

    it("fetches the next episode row when progress.nextEpisodeId is set", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [makeShowRow()],
                [makeProgressRow({ nextEpisodeId: 10 })],
                [],
                [],
                [],
                [makeEpisodeRow({ id: 10 })],
            ],
        });

        const res = await request("/5");
        const body = (await res.json()) as { data: { nextEpisode: { id: number } | null } };
        expect(body.data.nextEpisode?.id).toBe(10);
    });
});

// ---------------------------------------------------------------------------
// GET /:id/seasons
// ---------------------------------------------------------------------------

describe("GET /shows/:id/seasons", () => {
    it("returns the season list", async () => {
        dbMockState.db = createMockDb({
            selects: [[{ id: 1, showId: 5, seasonNumber: 1, episodeCount: 10 }]],
        });
        const res = await request("/5/seasons");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(1);
    });

    it("returns 400 for an invalid id", async () => {
        const res = await request("/abc/seasons");
        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// GET /:showId/episodes/:season/:episode
// ---------------------------------------------------------------------------

describe("GET /shows/:showId/episodes/:season/:episode", () => {
    it("returns 404 when the show doesn't exist", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await request("/5/episodes/1/3");
        expect(res.status).toBe(404);
    });

    it("returns 404 when the episode doesn't exist", async () => {
        dbMockState.db = createMockDb({ selects: [[makeShowRow()], []] });
        const res = await request("/5/episodes/1/3");
        expect(res.status).toBe(404);
    });

    it("returns TMDB directors and skips Trakt rating when show.traktId is null", async () => {
        tmdbMockState.getTmdbEpisodeDetail.mockResolvedValue({ directors: ["Vince Gilligan"] });
        const getEpisodeRating = vi.fn().mockResolvedValue(99);
        traktMockState.client = createMockTrakt({ getEpisodeRating });
        dbMockState.db = createMockDb({
            selects: [[makeShowRow({ traktId: null })], [makeEpisodeRow()], [], [], []],
        });

        const res = await request("/5/episodes/1/3");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { directors: string[]; traktRating: number | null };
        };
        expect(body.data.directors).toEqual(["Vince Gilligan"]);
        expect(body.data.traktRating).toBeNull();
        expect(getEpisodeRating).not.toHaveBeenCalled();
    });

    it("fetches the Trakt rating when show.traktId is present", async () => {
        const getEpisodeRating = vi.fn().mockResolvedValue(87);
        traktMockState.client = createMockTrakt({ getEpisodeRating });
        dbMockState.db = createMockDb({
            selects: [[makeShowRow({ traktId: 300 })], [makeEpisodeRow()], [], [], []],
        });

        const res = await request("/5/episodes/1/3");
        const body = (await res.json()) as { data: { traktRating: number | null } };
        expect(body.data.traktRating).toBe(87);
        expect(getEpisodeRating).toHaveBeenCalledWith(300, 1, 3, TEST_USER_ID);
    });

    it("degrades to empty directors when getTmdbEpisodeDetail fails upstream (already returns a fallback)", async () => {
        tmdbMockState.getTmdbEpisodeDetail.mockResolvedValue({ directors: [] });
        dbMockState.db = createMockDb({
            selects: [[makeShowRow({ traktId: null })], [makeEpisodeRow()], [], [], []],
        });
        const res = await request("/5/episodes/1/3");
        const body = (await res.json()) as { data: { directors: string[] } };
        expect(body.data.directors).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// POST /:showId/episodes/:season/:episode/watch
// ---------------------------------------------------------------------------

describe("POST /shows/:showId/episodes/:season/:episode/watch", () => {
    it("returns 404 when the episode doesn't exist", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await postJson("/5/episodes/1/3/watch", {});
        expect(res.status).toBe(404);
    });

    it("inserts a watch record, recalculates progress, and returns 201", async () => {
        dbMockState.db = createMockDb({
            selects: [[makeEpisodeRow()], []],
            inserts: [[{ id: 42 }]],
        });

        const res = await postJson("/5/episodes/1/3/watch", {});
        expect(res.status).toBe(201);
        const body = (await res.json()) as { ok: boolean; historyId: number };
        expect(body).toEqual({ ok: true, historyId: 42 });
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
        await flushMicrotasks();
    });

    it("accepts an explicit watchedAt timestamp", async () => {
        dbMockState.db = createMockDb({
            selects: [[makeEpisodeRow()], []],
            inserts: [[{ id: 43 }]],
        });
        const res = await postJson("/5/episodes/1/3/watch", {
            watchedAt: "2026-01-01T00:00:00.000Z",
        });
        expect(res.status).toBe(201);
        await flushMicrotasks();
    });

    it("does not call autoDeleteJellyfinEpisode when jellyfin isn't configured", async () => {
        dbMockState.db = createMockDb({
            selects: [[makeEpisodeRow()], []],
            inserts: [[{ id: 1 }]],
        });
        await postJson("/5/episodes/1/3/watch", {});
        await flushMicrotasks();
        expect(jellyfinMockState.autoDeleteJellyfinEpisode).not.toHaveBeenCalled();
    });

    it("does not call autoDeleteJellyfinEpisode when autoDeleteLibraryIds is empty", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [makeEpisodeRow()],
                [
                    {
                        jellyfinUrl: "http://jf.local",
                        jellyfinApiKey: "key",
                        jellyfinAutoDeleteLibraryIds: "[]",
                    },
                ],
            ],
            inserts: [[{ id: 1 }]],
        });
        await postJson("/5/episodes/1/3/watch", {});
        await flushMicrotasks();
        expect(jellyfinMockState.autoDeleteJellyfinEpisode).not.toHaveBeenCalled();
    });

    it("does not call autoDeleteJellyfinEpisode when the show isn't ended/canceled", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [makeEpisodeRow()],
                [
                    {
                        jellyfinUrl: "http://jf.local",
                        jellyfinApiKey: "key",
                        jellyfinAutoDeleteLibraryIds: '["lib1"]',
                    },
                ],
                [{ tmdbId: 100, status: "returning series" }],
            ],
            inserts: [[{ id: 1 }]],
        });
        await postJson("/5/episodes/1/3/watch", {});
        await flushMicrotasks();
        expect(jellyfinMockState.autoDeleteJellyfinEpisode).not.toHaveBeenCalled();
    });

    it("does not call autoDeleteJellyfinEpisode when progress isn't 100% completed", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [makeEpisodeRow()],
                [
                    {
                        jellyfinUrl: "http://jf.local",
                        jellyfinApiKey: "key",
                        jellyfinAutoDeleteLibraryIds: '["lib1"]',
                    },
                ],
                [{ tmdbId: 100, status: "ended" }],
                [{ completed: false }],
            ],
            inserts: [[{ id: 1 }]],
        });
        await postJson("/5/episodes/1/3/watch", {});
        await flushMicrotasks();
        expect(jellyfinMockState.autoDeleteJellyfinEpisode).not.toHaveBeenCalled();
    });

    it("calls autoDeleteJellyfinEpisode when all four gates pass", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [makeEpisodeRow({ seasonNumber: 1, episodeNumber: 3 })],
                [
                    {
                        jellyfinUrl: "http://jf.local",
                        jellyfinApiKey: "key",
                        jellyfinAutoDeleteLibraryIds: '["lib1","lib2"]',
                    },
                ],
                [{ tmdbId: 100, status: "Canceled" }],
                [{ completed: true }],
            ],
            inserts: [[{ id: 1 }]],
        });
        const res = await postJson("/5/episodes/1/3/watch", {});
        expect(res.status).toBe(201);
        await flushMicrotasks();
        expect(jellyfinMockState.autoDeleteJellyfinEpisode).toHaveBeenCalledWith(
            { url: "http://jf.local", apiKey: "key" },
            ["lib1", "lib2"],
            100,
            1,
            3,
        );
    });

    it("still returns 201 even if autoDeleteJellyfinEpisode rejects (fire-and-forget, errors swallowed)", async () => {
        jellyfinMockState.autoDeleteJellyfinEpisode.mockRejectedValueOnce(new Error("jf down"));
        dbMockState.db = createMockDb({
            selects: [
                [makeEpisodeRow()],
                [
                    {
                        jellyfinUrl: "http://jf.local",
                        jellyfinApiKey: "key",
                        jellyfinAutoDeleteLibraryIds: '["lib1"]',
                    },
                ],
                [{ tmdbId: 100, status: "ended" }],
                [{ completed: true }],
            ],
            inserts: [[{ id: 1 }]],
        });
        const res = await postJson("/5/episodes/1/3/watch", {});
        expect(res.status).toBe(201);
        await flushMicrotasks();
    });
});

// ---------------------------------------------------------------------------
// GET .../episodes/:season/:episode/history and GET /:showId/history
// ---------------------------------------------------------------------------

describe("GET /shows/:showId/episodes/:season/:episode/history", () => {
    it("returns the watch history for a single episode", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        id: 1,
                        episodeId: 10,
                        seasonNumber: 1,
                        episodeNumber: 3,
                        episodeTitle: "Pilot",
                        watchedAt: now,
                        source: "manual",
                    },
                ],
            ],
        });
        const res = await request("/5/episodes/1/3/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<{ watchedAt: string }> };
        expect(body.data[0].watchedAt).toBe(now.toISOString());
    });
});

describe("GET /shows/:showId/history", () => {
    it("returns the full watch history for a show", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        id: 1,
                        episodeId: 10,
                        seasonNumber: 1,
                        episodeNumber: 3,
                        episodeTitle: "Pilot",
                        watchedAt: null,
                        source: "trakt",
                    },
                ],
            ],
        });
        const res = await request("/5/history");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Array<{ watchedAt: string | null }> };
        expect(body.data[0].watchedAt).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// DELETE /:showId/history/:historyId
// ---------------------------------------------------------------------------

describe("DELETE /shows/:showId/history/:historyId", () => {
    it("returns 404 when the record doesn't belong to the user/show", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await request("/5/history/999", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("deletes the record and recalculates progress", async () => {
        dbMockState.db = createMockDb({ selects: [[{ id: 1 }]] });
        const res = await request("/5/history/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect((await res.json()) as { ok: boolean }).toEqual({ ok: true });
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
    });

    it("removes the entry from Trakt before deleting locally when it has a traktPlayId", async () => {
        dbMockState.db = createMockDb({ selects: [[{ id: 1, traktPlayId: "999" }]] });
        const removeFromHistory = vi.fn().mockResolvedValue({
            deleted: { movies: 0, episodes: 1 },
            not_found: { movies: [], shows: [], episodes: [], ids: [] },
        });
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await request("/5/history/1", { method: "DELETE" });

        expect(removeFromHistory).toHaveBeenCalledWith(TEST_USER_ID, [999]);
        expect(res.status).toBe(200);
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
    });

    it("does not delete locally when the Trakt removal fails", async () => {
        dbMockState.db = createMockDb({ selects: [[{ id: 1, traktPlayId: "999" }]] });
        const removeFromHistory = vi.fn().mockRejectedValue(new Error("network down"));
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await request("/5/history/1", { method: "DELETE" });

        expect(res.status).toBe(502);
        expect(syncMockState.recalcShowProgress).not.toHaveBeenCalled();
    });

    it("skips the Trakt call entirely for a manually-entered record (no traktPlayId)", async () => {
        dbMockState.db = createMockDb({ selects: [[{ id: 1, traktPlayId: null }]] });
        const removeFromHistory = vi.fn();
        traktMockState.client = createMockTrakt({ removeFromHistory });

        const res = await request("/5/history/1", { method: "DELETE" });

        expect(removeFromHistory).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// POST /:showId/reset
// ---------------------------------------------------------------------------

describe("POST /shows/:showId/reset", () => {
    it("returns 404 when the show doesn't exist", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await postJson("/999/reset", {});
        expect(res.status).toBe(404);
    });

    it("inserts a reset cursor and recalculates progress", async () => {
        dbMockState.db = createMockDb({
            selects: [[makeShowRow()], [makeProgressRow({ airedEpisodes: 0, watchedEpisodes: 0 })]],
        });
        const res = await postJson("/5/reset", {});
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { percentage: number } };
        expect(body.data.percentage).toBe(0);
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
    });
});

// ---------------------------------------------------------------------------
// POST /:showId/seasons/:season/mark-watched
// ---------------------------------------------------------------------------

describe("POST /shows/:showId/seasons/:season/mark-watched", () => {
    it("returns 404 when the season has no episodes", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await postJson("/5/seasons/1/mark-watched", {});
        expect(res.status).toBe(404);
    });

    it("marks only unwatched episodes, scoping alreadyWatched to the target season", async () => {
        dbMockState.db = createMockDb({
            selects: [[{ id: 10 }, { id: 11 }, { id: 12 }], [{ episodeId: 10 }]],
            inserts: [[]],
        });
        const res = await postJson("/5/seasons/1/mark-watched", {});
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; marked: number; alreadyWatched: number };
        expect(body).toEqual({ ok: true, marked: 2, alreadyWatched: 1 });
        expect(syncMockState.recalcShowProgress).toHaveBeenCalledWith(TEST_USER_ID, 5);
    });

    it("skips the insert when every episode in the season is already watched", async () => {
        dbMockState.db = createMockDb({
            selects: [[{ id: 10 }], [{ episodeId: 10 }]],
        });
        const res = await postJson("/5/seasons/1/mark-watched", {});
        const body = (await res.json()) as { marked: number; alreadyWatched: number };
        expect(body).toEqual({ ok: true, marked: 0, alreadyWatched: 1 });
    });
});

// ---------------------------------------------------------------------------
// POST /:showId/force-sync
// ---------------------------------------------------------------------------

describe("POST /shows/:showId/force-sync", () => {
    it("returns ok:true on success", async () => {
        const res = await postJson("/5/force-sync", {});
        expect(res.status).toBe(200);
        expect((await res.json()) as { ok: boolean }).toEqual({ ok: true });
        expect(syncMockState.forceSyncShow).toHaveBeenCalledWith(TEST_USER_ID, 5);
    });

    it("returns 500 with the error message when forceSyncShow throws", async () => {
        syncMockState.forceSyncShow.mockRejectedValueOnce(new Error("upstream unavailable"));
        const res = await postJson("/5/force-sync", {});
        expect(res.status).toBe(500);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("upstream unavailable");
    });
});
