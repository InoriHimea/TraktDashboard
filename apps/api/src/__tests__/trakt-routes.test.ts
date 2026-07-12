import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
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
        getUserSettings: vi.fn(),
        getTraktStats: vi.fn(),
        getWatching: vi.fn(),
        ...overrides,
    };
}

const { traktRoutes } = await import("../routes/trakt.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/trakt", traktRoutes);
    return a;
}

beforeEach(() => {
    vi.clearAllMocks();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    return () => errSpy.mockRestore();
});

describe("GET /trakt/profile", () => {
    it("returns vip status and limits", async () => {
        traktMockState.client = createMockTrakt({
            getUserSettings: vi.fn().mockResolvedValue({
                user: { vip: true, vip_ep: false, vip_years: 3 },
                limits: { collection: { item_count: 1000 } },
            }),
        });

        const res = await app().request("/trakt/profile");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { vip: boolean; vip_years: number };
        expect(body.vip).toBe(true);
        expect(body.vip_years).toBe(3);
    });

    it("returns 502 when the Trakt call fails", async () => {
        traktMockState.client = createMockTrakt({
            getUserSettings: vi.fn().mockRejectedValue(new Error("down")),
        });

        const res = await app().request("/trakt/profile");
        expect(res.status).toBe(502);
    });
});

describe("GET /trakt/stats", () => {
    it("returns Trakt's official counters", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockResolvedValue({
                movies: { watched: 10 },
                shows: { watched: 5 },
                episodes: { watched: 100 },
                ratings: { total: 20 },
            }),
        });

        const res = await app().request("/trakt/stats");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { movies: { watched: number } } };
        expect(body.data.movies.watched).toBe(10);
    });

    it("returns 502 when the Trakt call fails", async () => {
        traktMockState.client = createMockTrakt({
            getTraktStats: vi.fn().mockRejectedValue(new Error("down")),
        });

        const res = await app().request("/trakt/stats");
        expect(res.status).toBe(502);
    });
});

describe("GET /trakt/watching", () => {
    it("returns null when nothing is playing", async () => {
        traktMockState.client = createMockTrakt({ getWatching: vi.fn().mockResolvedValue(null) });
        dbMockState.db = createMockDb([]);

        const res = await app().request("/trakt/watching");
        const body = (await res.json()) as { data: null };
        expect(body.data).toBeNull();
    });

    it("returns null when the watching item is a movie, not an episode", async () => {
        traktMockState.client = createMockTrakt({
            getWatching: vi.fn().mockResolvedValue({ type: "movie" }),
        });
        dbMockState.db = createMockDb([]);

        const res = await app().request("/trakt/watching");
        const body = (await res.json()) as { data: null };
        expect(body.data).toBeNull();
    });

    it("looks up the local posterPath by traktSlug when a slug is present", async () => {
        traktMockState.client = createMockTrakt({
            getWatching: vi.fn().mockResolvedValue({
                type: "episode",
                show: { title: "My Show", ids: { slug: "my-show" } },
                episode: { season: 1, number: 3, title: "Ep 3", runtime: 42 },
                expires_at: "2026-06-01T00:00:00.000Z",
            }),
        });
        dbMockState.db = createMockDb([[{ posterPath: "/poster.jpg" }]]);

        const res = await app().request("/trakt/watching");
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { show: { posterPath: string | null; traktSlug: string | null } };
        };
        expect(body.data.show.posterPath).toBe("/poster.jpg");
        expect(body.data.show.traktSlug).toBe("my-show");
    });

    it("defaults posterPath to null when the show has no local row", async () => {
        traktMockState.client = createMockTrakt({
            getWatching: vi.fn().mockResolvedValue({
                type: "episode",
                show: { title: "My Show", ids: { slug: "my-show" } },
                episode: { season: 1, number: 3, title: "Ep 3", runtime: 42 },
                expires_at: "2026-06-01T00:00:00.000Z",
            }),
        });
        dbMockState.db = createMockDb([[]]);

        const res = await app().request("/trakt/watching");
        const body = (await res.json()) as { data: { show: { posterPath: string | null } } };
        expect(body.data.show.posterPath).toBeNull();
    });

    it("skips the DB lookup entirely when there is no slug", async () => {
        traktMockState.client = createMockTrakt({
            getWatching: vi.fn().mockResolvedValue({
                type: "episode",
                show: { title: "My Show", ids: {} },
                episode: { season: 1, number: 3, title: "Ep 3", runtime: 42 },
                expires_at: "2026-06-01T00:00:00.000Z",
            }),
        });
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await app().request("/trakt/watching");
        const body = (await res.json()) as { data: { show: { traktSlug: string | null } } };
        expect(body.data.show.traktSlug).toBeNull();
        expect(db.select).not.toHaveBeenCalled();
    });

    it("returns 502 when the Trakt call fails", async () => {
        traktMockState.client = createMockTrakt({
            getWatching: vi.fn().mockRejectedValue(new Error("down")),
        });

        const res = await app().request("/trakt/watching");
        expect(res.status).toBe(502);
    });
});
