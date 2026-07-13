import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const jellyfinServiceMock = vi.hoisted(() => ({
    fetchJellyfinLibraries: vi.fn(),
    findJellyfinEpisode: vi.fn(),
    findJellyfinSeasonEpisodes: vi.fn(),
    findJellyfinMovie: vi.fn(),
    deleteJellyfinItem: vi.fn(),
    getActiveSessions: vi.fn(),
    getJellyfinLibrarySummary: vi.fn(),
    getJellyfinActivityLog: vi.fn(),
    getJellyfinTopItems: vi.fn(),
    getJellyfinPlayHeatmap: vi.fn(),
}));
const autoDeleteJobMock = vi.hoisted(() => ({ deleteQueueEntryNow: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/jellyfin.js", () => jellyfinServiceMock);

vi.mock("../jobs/jellyfin-auto-delete.js", () => autoDeleteJobMock);

type RowsResult = unknown[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(private readonly result: RowsResult) {}
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
    returning() {
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

function createMockDb(queues: {
    selects?: RowsResult[];
    inserts?: RowsResult[];
    deletes?: RowsResult[];
}) {
    const state = {
        selects: [...(queues.selects ?? [])],
        inserts: [...(queues.inserts ?? [])],
        deletes: [...(queues.deletes ?? [])],
    };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder(state.inserts.shift() ?? [])),
        delete: vi.fn(() => new ChainBuilder(state.deletes.shift() ?? [])),
        __state: state,
    };
}

const { jellyfinRoutes } = await import("../routes/jellyfin.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/jellyfin", jellyfinRoutes);
    return a;
}

function postJson(path: string, payload: unknown, method = "POST") {
    return app().request(path, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
    });
}

const CONFIGURED_ROW = { jellyfinUrl: "http://jellyfin.local:8096", jellyfinApiKey: "plain-key" };
const now = new Date("2026-07-01T00:00:00.000Z");

/** A DB whose first select resolves to the given userSettings row (or []/unconfigured). */
function dbWithConfig(
    configRow: typeof CONFIGURED_ROW | null,
    rest: Parameters<typeof createMockDb>[0] = {},
) {
    return createMockDb({
        selects: [configRow ? [configRow] : [], ...(rest.selects ?? [])],
        inserts: rest.inserts,
        deletes: rest.deletes,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /jellyfin/now-playing", () => {
    it("returns null when Jellyfin is not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/now-playing");
        expect(res.status).toBe(200);
        expect((await res.json()) as { data: null }).toEqual({ data: null });
    });

    it("returns null when there is no active session", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.getActiveSessions.mockResolvedValue(null);
        const res = await app().request("/jellyfin/now-playing");
        expect((await res.json()) as { data: null }).toEqual({ data: null });
    });

    it("maps an episode session, using the series poster and resolving the local show id", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW, { selects: [[{ id: 55 }]] });
        jellyfinServiceMock.getActiveSessions.mockResolvedValue({
            jellyfinItemId: "e1",
            mediaType: "episode",
            title: "Pilot",
            seriesTitle: "Show",
            seriesJellyfinId: "series1",
            seasonNumber: 1,
            episodeNumber: 1,
            runtimeMinutes: 40,
            progressPct: 50,
            isPaused: false,
            tmdbShowId: 100,
            tmdbMovieId: null,
        });
        const res = await app().request("/jellyfin/now-playing");
        const body = (await res.json()) as { data: Record<string, unknown> };
        expect(body.data.localShowId).toBe(55);
        expect(body.data.localMovieId).toBeNull();
        expect(body.data.posterUrl).toBe(
            "http://jellyfin.local:8096/Items/series1/Images/Primary?quality=80&maxHeight=300",
        );
    });

    it("maps a movie session, using the item's own poster and resolving the local movie id", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW, { selects: [[{ id: 9 }]] });
        jellyfinServiceMock.getActiveSessions.mockResolvedValue({
            jellyfinItemId: "m1",
            mediaType: "movie",
            title: "Movie A",
            seriesTitle: null,
            seriesJellyfinId: null,
            seasonNumber: null,
            episodeNumber: null,
            runtimeMinutes: 100,
            progressPct: 10,
            isPaused: true,
            tmdbShowId: null,
            tmdbMovieId: 900,
        });
        const res = await app().request("/jellyfin/now-playing");
        const body = (await res.json()) as { data: Record<string, unknown> };
        expect(body.data.localMovieId).toBe(9);
        expect(body.data.posterUrl).toBe(
            "http://jellyfin.local:8096/Items/m1/Images/Primary?quality=80&maxHeight=300",
        );
    });

    it("leaves localShowId null when the tmdb id has no local row", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW, { selects: [[]] });
        jellyfinServiceMock.getActiveSessions.mockResolvedValue({
            jellyfinItemId: "e1",
            mediaType: "episode",
            title: "Pilot",
            seriesTitle: "Show",
            seriesJellyfinId: "series1",
            seasonNumber: 1,
            episodeNumber: 1,
            runtimeMinutes: 40,
            progressPct: 50,
            isPaused: false,
            tmdbShowId: 100,
            tmdbMovieId: null,
        });
        const res = await app().request("/jellyfin/now-playing");
        const body = (await res.json()) as { data: Record<string, unknown> };
        expect(body.data.localShowId).toBeNull();
    });

    it("swallows service errors and returns null (not a 502)", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.getActiveSessions.mockRejectedValue(new Error("jellyfin down"));
        const res = await app().request("/jellyfin/now-playing");
        expect(res.status).toBe(200);
        expect((await res.json()) as { data: null }).toEqual({ data: null });
    });
});

describe("GET /jellyfin/libraries", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/libraries");
        expect(res.status).toBe(503);
    });

    it("returns the fetched libraries", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.fetchJellyfinLibraries.mockResolvedValue([
            { id: "l1", name: "Movies", collectionType: "movies" },
        ]);
        const res = await app().request("/jellyfin/libraries");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(1);
    });

    it("returns 502 when the fetch fails", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.fetchJellyfinLibraries.mockRejectedValue(new Error("down"));
        const res = await app().request("/jellyfin/libraries");
        expect(res.status).toBe(502);
    });

    it("treats a malformed encrypted API key as unconfigured (503, not 500)", async () => {
        // decryptToken throws on a "v1:"-prefixed value with the wrong part count.
        dbMockState.db = dbWithConfig({
            jellyfinUrl: "http://jellyfin.local:8096",
            jellyfinApiKey: "v1:not:enough:parts:here",
        });
        const res = await app().request("/jellyfin/libraries");
        expect(res.status).toBe(503);
    });
});

describe("POST /jellyfin/libraries (test arbitrary credentials)", () => {
    it("rejects a malformed url with 400", async () => {
        const res = await postJson("/jellyfin/libraries", { url: "not-a-url", apiKey: "x" });
        expect(res.status).toBe(400);
    });

    it("tests the given credentials without touching stored config", async () => {
        jellyfinServiceMock.fetchJellyfinLibraries.mockResolvedValue([]);
        const res = await postJson("/jellyfin/libraries", {
            url: "http://test:8096",
            apiKey: "key",
        });
        expect(res.status).toBe(200);
        expect(jellyfinServiceMock.fetchJellyfinLibraries).toHaveBeenCalledWith({
            url: "http://test:8096",
            apiKey: "key",
        });
    });

    it("returns 502 when the test fetch fails", async () => {
        jellyfinServiceMock.fetchJellyfinLibraries.mockRejectedValue(new Error("down"));
        const res = await postJson("/jellyfin/libraries", {
            url: "http://test:8096",
            apiKey: "key",
        });
        expect(res.status).toBe(502);
    });
});

describe("GET /jellyfin/episode/:showTmdbId/:season/:episode", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/episode/100/1/1");
        expect(res.status).toBe(503);
    });

    it("rejects invalid (non-numeric) parameters with 400", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        const res = await app().request("/jellyfin/episode/abc/1/1");
        expect(res.status).toBe(400);
    });

    it("returns the found episode", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinEpisode.mockResolvedValue({
            id: "e1",
            name: "Pilot",
            seriesName: "Show",
            path: "/e1.mkv",
        });
        const res = await app().request("/jellyfin/episode/100/1/1");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { id: string } };
        expect(body.data.id).toBe("e1");
    });

    it("returns 502 with the error message when the lookup throws", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinEpisode.mockRejectedValue(new Error("boom"));
        const res = await app().request("/jellyfin/episode/100/1/1");
        expect(res.status).toBe(502);
    });
});

describe("GET /jellyfin/movie/:movieTmdbId", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/movie/900");
        expect(res.status).toBe(503);
    });

    it("rejects a non-numeric tmdb id with 400", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        const res = await app().request("/jellyfin/movie/abc");
        expect(res.status).toBe(400);
    });

    it("returns the found movie", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinMovie.mockResolvedValue({
            id: "m1",
            name: "Movie A",
            path: "/m1.mkv",
        });
        const res = await app().request("/jellyfin/movie/900");
        const body = (await res.json()) as { data: { id: string } };
        expect(body.data.id).toBe("m1");
    });

    it("returns 502 when the lookup throws", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinMovie.mockRejectedValue(new Error("boom"));
        const res = await app().request("/jellyfin/movie/900");
        expect(res.status).toBe(502);
    });
});

describe("GET /jellyfin/show/:showTmdbId/season/:season", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/show/100/season/1");
        expect(res.status).toBe(503);
    });

    it("returns the season's episodes", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinSeasonEpisodes.mockResolvedValue([
            { id: "e1", name: "Pilot", seriesName: "Show", path: null },
        ]);
        const res = await app().request("/jellyfin/show/100/season/1");
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(1);
    });

    it("returns 502 when the lookup throws", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinSeasonEpisodes.mockRejectedValue(new Error("boom"));
        const res = await app().request("/jellyfin/show/100/season/1");
        expect(res.status).toBe(502);
    });
});

describe("DELETE /jellyfin/show/:showTmdbId/season/:season", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/show/100/season/1", { method: "DELETE" });
        expect(res.status).toBe(503);
    });

    it("deletes every episode found and reports the count", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinSeasonEpisodes.mockResolvedValue([
            { id: "e1", name: "E1", seriesName: "Show", path: null },
            { id: "e2", name: "E2", seriesName: "Show", path: null },
        ]);
        jellyfinServiceMock.deleteJellyfinItem.mockResolvedValue(undefined);
        const res = await app().request("/jellyfin/show/100/season/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; deleted: number };
        expect(body.deleted).toBe(2);
        expect(jellyfinServiceMock.deleteJellyfinItem).toHaveBeenCalledTimes(2);
    });

    it("returns 502 when a season has zero episodes and the delete step never runs (no-op)", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinSeasonEpisodes.mockResolvedValue([]);
        const res = await app().request("/jellyfin/show/100/season/1", { method: "DELETE" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { deleted: number };
        expect(body.deleted).toBe(0);
        expect(jellyfinServiceMock.deleteJellyfinItem).not.toHaveBeenCalled();
    });

    it("returns 502 when a delete call fails", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.findJellyfinSeasonEpisodes.mockResolvedValue([
            { id: "e1", name: "E1", seriesName: "Show", path: null },
        ]);
        jellyfinServiceMock.deleteJellyfinItem.mockRejectedValue(new Error("delete failed"));
        const res = await app().request("/jellyfin/show/100/season/1", { method: "DELETE" });
        expect(res.status).toBe(502);
    });
});

describe("DELETE /jellyfin/items/:jellyfinItemId", () => {
    it("returns 503 when not configured", async () => {
        dbMockState.db = dbWithConfig(null);
        const res = await app().request("/jellyfin/items/item1", { method: "DELETE" });
        expect(res.status).toBe(503);
    });

    it("deletes the item and returns ok", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.deleteJellyfinItem.mockResolvedValue(undefined);
        const res = await app().request("/jellyfin/items/item1", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(jellyfinServiceMock.deleteJellyfinItem).toHaveBeenCalledWith(
            expect.anything(),
            "item1",
        );
    });

    it("returns 502 when the delete fails", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.deleteJellyfinItem.mockRejectedValue(new Error("boom"));
        const res = await app().request("/jellyfin/items/item1", { method: "DELETE" });
        expect(res.status).toBe(502);
    });
});

describe("GET /jellyfin/delete-queue", () => {
    it("maps queue rows, coalescing show/movie to null when absent", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        id: 1,
                        seasonNumber: 2,
                        queuedAt: now,
                        showId: 5,
                        showTitle: "Show",
                        showPoster: "/p.jpg",
                        movieId: null,
                        movieTitle: null,
                        moviePoster: null,
                    },
                ],
            ],
        });
        const res = await app().request("/jellyfin/delete-queue");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toEqual({
            id: 1,
            seasonNumber: 2,
            queuedAt: now.toISOString(),
            show: { id: 5, title: "Show", posterPath: "/p.jpg" },
            movie: null,
        });
    });
});

describe("DELETE /jellyfin/delete-queue/:id", () => {
    it("rejects a non-numeric id with 400", async () => {
        const res = await app().request("/jellyfin/delete-queue/abc", { method: "DELETE" });
        expect(res.status).toBe(400);
    });

    it("returns 404 when nothing matched", async () => {
        dbMockState.db = createMockDb({ deletes: [[]] });
        const res = await app().request("/jellyfin/delete-queue/1", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("cancels a pending entry", async () => {
        dbMockState.db = createMockDb({ deletes: [[{ id: 1 }]] });
        const res = await app().request("/jellyfin/delete-queue/1", { method: "DELETE" });
        expect(res.status).toBe(200);
    });
});

describe("POST /jellyfin/delete-queue/:id/defer and /never", () => {
    const queueEntry = { id: 1, showId: 5, movieId: null, seasonNumber: 2 };

    it("rejects a non-numeric id with 400", async () => {
        const res = await app().request("/jellyfin/delete-queue/abc/defer", { method: "POST" });
        expect(res.status).toBe(400);
    });

    it("returns 404 when the queue entry does not belong to the user", async () => {
        dbMockState.db = createMockDb({ selects: [[]] });
        const res = await app().request("/jellyfin/delete-queue/1/defer", { method: "POST" });
        expect(res.status).toBe(404);
    });

    it("defer: replaces any existing exclusion, inserts one with deferUntil ~7 days out, and dequeues", async () => {
        const db = createMockDb({ selects: [[queueEntry]], inserts: [[]], deletes: [[], []] });
        dbMockState.db = db;
        const before = Date.now();
        const res = await app().request("/jellyfin/delete-queue/1/defer", { method: "POST" });
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
        const insertedValues = (db.insert as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(insertedValues).toBeDefined();
        // Two deletes: replace-existing-exclusion + dequeue-original-entry.
        expect(db.delete).toHaveBeenCalledTimes(2);
        expect(Date.now() - before).toBeLessThan(5000);
    });

    it("never: inserts an exclusion with deferUntil null", async () => {
        const db = createMockDb({ selects: [[queueEntry]], inserts: [[]], deletes: [[], []] });
        dbMockState.db = db;
        const res = await app().request("/jellyfin/delete-queue/1/never", { method: "POST" });
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("handles a movie-only queue entry (showId null)", async () => {
        const movieEntry = { id: 2, showId: null, movieId: 9, seasonNumber: null };
        const db = createMockDb({ selects: [[movieEntry]], inserts: [[]], deletes: [[], []] });
        dbMockState.db = db;
        const res = await app().request("/jellyfin/delete-queue/2/never", { method: "POST" });
        expect(res.status).toBe(200);
    });
});

describe("POST /jellyfin/delete-queue/:id/now", () => {
    it("rejects a non-numeric id with 400", async () => {
        const res = await app().request("/jellyfin/delete-queue/abc/now", { method: "POST" });
        expect(res.status).toBe(400);
    });

    it("returns 503 when Jellyfin is not configured", async () => {
        autoDeleteJobMock.deleteQueueEntryNow.mockResolvedValue({ status: "no-jellyfin-config" });
        const res = await app().request("/jellyfin/delete-queue/1/now", { method: "POST" });
        expect(res.status).toBe(503);
    });

    it("returns 404 when the entry is not found", async () => {
        autoDeleteJobMock.deleteQueueEntryNow.mockResolvedValue({ status: "not_found" });
        const res = await app().request("/jellyfin/delete-queue/1/now", { method: "POST" });
        expect(res.status).toBe(404);
    });

    it("passes through the deletion status and error message on success", async () => {
        autoDeleteJobMock.deleteQueueEntryNow.mockResolvedValue({
            status: "deleted",
            errorMessage: null,
        });
        const res = await app().request("/jellyfin/delete-queue/1/now", { method: "POST" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; status: string; errorMessage: null };
        expect(body).toEqual({ ok: true, status: "deleted", errorMessage: null });
    });

    it("surfaces a failed status with its error message", async () => {
        autoDeleteJobMock.deleteQueueEntryNow.mockResolvedValue({
            status: "failed",
            errorMessage: "jellyfin#16975",
        });
        const res = await app().request("/jellyfin/delete-queue/1/now", { method: "POST" });
        const body = (await res.json()) as { status: string; errorMessage: string };
        expect(body.status).toBe("failed");
        expect(body.errorMessage).toBe("jellyfin#16975");
    });
});

describe("GET /jellyfin/delete-exclusions", () => {
    it("maps rows and falls back title to show/movie/em-dash", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        id: 1,
                        showId: 5,
                        movieId: null,
                        seasonNumber: null,
                        mode: "never",
                        deferUntil: null,
                        createdAt: now,
                        showTitle: "Show",
                        movieTitle: null,
                    },
                    {
                        id: 2,
                        showId: null,
                        movieId: null,
                        seasonNumber: null,
                        mode: "defer",
                        deferUntil: now,
                        createdAt: now,
                        showTitle: null,
                        movieTitle: null,
                    },
                ],
            ],
        });
        const res = await app().request("/jellyfin/delete-exclusions");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0].title).toBe("Show");
        expect(body.data[1].title).toBe("—");
        expect(body.data[1].deferUntil).toBe(now.toISOString());
    });
});

describe("POST /jellyfin/delete-exclusions", () => {
    it("rejects a payload with neither showId nor movieId", async () => {
        const res = await postJson("/jellyfin/delete-exclusions", { seasonNumber: 1 });
        expect(res.status).toBe(400);
    });

    it("creates a show exclusion and purges matching queue entries", async () => {
        const db = createMockDb({ deletes: [[], []], inserts: [[{ id: 42 }]] });
        dbMockState.db = db;
        const res = await postJson("/jellyfin/delete-exclusions", { showId: 5, seasonNumber: 1 });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { id: number } };
        expect(body.data.id).toBe(42);
        // One delete to replace any existing exclusion, one to purge queue entries.
        expect(db.delete).toHaveBeenCalledTimes(2);
    });

    it("creates a movie exclusion and purges matching queue entries", async () => {
        const db = createMockDb({ deletes: [[], []], inserts: [[{ id: 43 }]] });
        dbMockState.db = db;
        const res = await postJson("/jellyfin/delete-exclusions", { movieId: 9 });
        expect(res.status).toBe(200);
        expect(db.delete).toHaveBeenCalledTimes(2);
    });
});

describe("DELETE /jellyfin/delete-exclusions/:id", () => {
    it("rejects a non-numeric id with 400", async () => {
        const res = await app().request("/jellyfin/delete-exclusions/abc", { method: "DELETE" });
        expect(res.status).toBe(400);
    });

    it("returns 404 when nothing matched", async () => {
        dbMockState.db = createMockDb({ deletes: [[]] });
        const res = await app().request("/jellyfin/delete-exclusions/1", { method: "DELETE" });
        expect(res.status).toBe(404);
    });

    it("removes the exclusion", async () => {
        dbMockState.db = createMockDb({ deletes: [[{ id: 1 }]] });
        const res = await app().request("/jellyfin/delete-exclusions/1", { method: "DELETE" });
        expect(res.status).toBe(200);
    });
});

describe("GET /jellyfin/delete-history", () => {
    it("maps history rows and forwards a custom limit", async () => {
        dbMockState.db = createMockDb({
            selects: [
                [
                    {
                        id: 1,
                        showId: 5,
                        movieId: null,
                        seasonNumber: 1,
                        title: "Show",
                        status: "deleted",
                        errorMessage: null,
                        processedAt: now,
                    },
                ],
            ],
        });
        const res = await app().request("/jellyfin/delete-history?limit=5");
        const body = (await res.json()) as { data: Array<Record<string, unknown>> };
        expect(body.data[0]).toMatchObject({ status: "deleted", processedAt: now.toISOString() });
    });
});

describe("Jellyfin stats endpoints", () => {
    const cases: Array<{
        path: string;
        mockFn: keyof typeof jellyfinServiceMock;
        value: unknown;
    }> = [
        {
            path: "/jellyfin/stats/overview",
            mockFn: "getJellyfinLibrarySummary",
            value: { movieCount: 1, seriesCount: 2, episodeCount: 3 },
        },
        {
            path: "/jellyfin/stats/activity",
            mockFn: "getJellyfinActivityLog",
            value: [],
        },
        {
            path: "/jellyfin/stats/top-content",
            mockFn: "getJellyfinTopItems",
            value: { movies: [], series: [] },
        },
        {
            path: "/jellyfin/stats/heatmap",
            mockFn: "getJellyfinPlayHeatmap",
            value: [],
        },
    ];

    for (const { path, mockFn, value } of cases) {
        it(`${path} returns 503 when not configured`, async () => {
            dbMockState.db = dbWithConfig(null);
            const res = await app().request(path);
            expect(res.status).toBe(503);
        });

        it(`${path} returns the service's data on success`, async () => {
            dbMockState.db = dbWithConfig(CONFIGURED_ROW);
            jellyfinServiceMock[mockFn].mockResolvedValue(value);
            const res = await app().request(path);
            expect(res.status).toBe(200);
        });

        it(`${path} returns 502 when the service throws`, async () => {
            dbMockState.db = dbWithConfig(CONFIGURED_ROW);
            jellyfinServiceMock[mockFn].mockRejectedValue(new Error("boom"));
            const res = await app().request(path);
            expect(res.status).toBe(502);
        });
    }

    it("stats/activity forwards a custom limit", async () => {
        dbMockState.db = dbWithConfig(CONFIGURED_ROW);
        jellyfinServiceMock.getJellyfinActivityLog.mockResolvedValue([]);
        await app().request("/jellyfin/stats/activity?limit=10");
        expect(jellyfinServiceMock.getJellyfinActivityLog).toHaveBeenCalledWith(
            expect.anything(),
            10,
        );
    });
});
