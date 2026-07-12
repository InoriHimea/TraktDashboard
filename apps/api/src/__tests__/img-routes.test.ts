import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const tmdbMockState = vi.hoisted(() => ({ getProxyUrl: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/tmdb.js", () => ({
    getProxyUrl: tmdbMockState.getProxyUrl,
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

class WriteBuilder implements PromiseLike<unknown> {
    values() {
        return this;
    }
    where() {
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    then<T1 = unknown, T2 = never>(
        ok?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    return {
        select: vi.fn(() => new SelectBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new WriteBuilder()),
        delete: vi.fn(() => new WriteBuilder()),
    };
}

const { imgRoutes } = await import("../routes/img.js");

function app() {
    const a = new Hono();
    a.route("/img", imgRoutes);
    return a;
}

beforeEach(() => {
    vi.clearAllMocks();
    tmdbMockState.getProxyUrl.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /img/:size/:filename", () => {
    it("rejects an unknown size with 400 before touching the DB", async () => {
        const db = createMockDb([]);
        dbMockState.db = db;

        const res = await app().request("/img/w9999/poster.jpg");
        expect(res.status).toBe(400);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("serves a fresh cache hit without calling fetch", async () => {
        const base64 = Buffer.from("hello").toString("base64");
        dbMockState.db = createMockDb([
            [{ data: { contentType: "image/png", base64 }, cachedAt: new Date() }],
        ]);
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const res = await app().request("/img/w342/poster.jpg");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/png");
        expect(res.headers.get("X-Cache")).toBe("HIT");
        const buf = Buffer.from(await res.arrayBuffer());
        expect(buf.toString()).toBe("hello");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("falls through to fetch when the cached entry is older than the TTL", async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        const base64 = Buffer.from("stale").toString("base64");
        dbMockState.db = createMockDb([
            [{ data: { contentType: "image/png", base64 }, cachedAt: eightDaysAgo }],
        ]);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new TextEncoder().encode("fresh"), {
                    status: 200,
                    headers: { "content-type": "image/jpeg" },
                }),
            ),
        );

        const res = await app().request("/img/w342/poster.jpg");
        expect(res.status).toBe(200);
        expect(res.headers.get("X-Cache")).toBe("MISS");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("deletes a corrupted cache row and falls through to fetch", async () => {
        // cached.data is null — destructuring it throws, exercising the catch branch.
        const db = createMockDb([[{ data: null, cachedAt: new Date() }]]);
        dbMockState.db = db;
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new TextEncoder().encode("fresh"), {
                    status: 200,
                    headers: { "content-type": "image/jpeg" },
                }),
            ),
        );

        const res = await app().request("/img/w342/poster.jpg");
        expect(res.status).toBe(200);
        expect(db.delete).toHaveBeenCalledTimes(1);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("fetches, caches, and returns MISS on a cold cache", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(new TextEncoder().encode("cold"), {
                    status: 200,
                    headers: { "content-type": "image/webp" },
                }),
            ),
        );

        const res = await app().request("/img/original/deep/nested/poster.jpg");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/webp");
        expect(res.headers.get("X-Cache")).toBe("MISS");
        expect(db.insert).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            "https://image.tmdb.org/t/p/original/deep/nested/poster.jpg",
            {},
        );
    });

    it("returns 502 when fetch throws", async () => {
        dbMockState.db = createMockDb([[]]);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

        const res = await app().request("/img/w342/poster.jpg");
        expect(res.status).toBe(502);
    });

    it("passes through the upstream status without caching on a non-ok response", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

        const res = await app().request("/img/w342/missing.jpg");
        expect(res.status).toBe(404);
        expect(db.insert).not.toHaveBeenCalled();
    });

    it("forwards the configured proxy URL to fetch", async () => {
        dbMockState.db = createMockDb([[]]);
        tmdbMockState.getProxyUrl.mockResolvedValue("http://proxy.local:8080");
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(new TextEncoder().encode("x"), {
                status: 200,
                headers: { "content-type": "image/jpeg" },
            }),
        );
        vi.stubGlobal("fetch", fetchSpy);

        await app().request("/img/w342/poster.jpg");
        expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), {
            proxy: "http://proxy.local:8080",
        });
    });
});
