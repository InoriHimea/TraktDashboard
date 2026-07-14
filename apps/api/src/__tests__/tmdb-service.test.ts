import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const providerFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../lib/http.js", () => ({ providerFetch: providerFetchMock }));
vi.mock("../lib/rate-limit.js", () => ({ getProviderRateLimiter: vi.fn(() => ({})) }));

const {
    getProxyUrl,
    getTmdbShow,
    getTmdbMovie,
    getTmdbSeason,
    getTmdbImageUrl,
    getTmdbEpisodeDetail,
    METADATA_MAX_AGE_HOURS,
} = await import("../services/tmdb.js");

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

class InsertBuilder implements PromiseLike<undefined> {
    constructor(private readonly onValues: (v: Record<string, unknown>) => void) {}
    values(v: Record<string, unknown>) {
        this.onValues(v);
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    then<T1 = undefined, T2 = never>(
        ok?: ((value: undefined) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(undefined).then(ok, fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    const inserted: Array<Record<string, unknown>> = [];
    return {
        select: vi.fn(() => new SelectBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new InsertBuilder((v) => inserted.push(v))),
        __inserted: inserted,
    };
}

function jsonRes(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

function cacheRow(data: unknown, ageHours: number) {
    return { data, cachedAt: new Date(Date.now() - ageHours * 60 * 60 * 1000) };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.TMDB_API_KEY = "v3-short-key";
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    delete process.env.https_proxy;
    delete process.env.http_proxy;
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("getTmdbImageUrl", () => {
    it("returns null for a null path", () => {
        expect(getTmdbImageUrl(null)).toBeNull();
    });

    it("defaults to size w500", () => {
        expect(getTmdbImageUrl("/poster.jpg")).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
    });

    it("honors a custom size", () => {
        expect(getTmdbImageUrl("/poster.jpg", "original")).toBe(
            "https://image.tmdb.org/t/p/original/poster.jpg",
        );
    });
});

describe("METADATA_MAX_AGE_HOURS", () => {
    it("equals the longest TTL (30d shows/movies/seasons) plus the 14d stale grace window", () => {
        expect(METADATA_MAX_AGE_HOURS).toBe(24 * 30 + 24 * 14);
    });
});

describe("getProxyUrl", () => {
    it("falls straight to env vars when no userId is given", async () => {
        process.env.HTTPS_PROXY = "https://proxy.example.com";
        expect(await getProxyUrl()).toBe("https://proxy.example.com");
    });

    it("prioritizes HTTPS_PROXY over the other three env vars", async () => {
        process.env.HTTPS_PROXY = "https-proxy";
        process.env.HTTP_PROXY = "http-proxy";
        process.env.https_proxy = "https-proxy-lower";
        process.env.http_proxy = "http-proxy-lower";
        expect(await getProxyUrl()).toBe("https-proxy");
    });

    it("falls back through the priority chain when higher-priority vars are unset", async () => {
        process.env.https_proxy = "https-proxy-lower";
        process.env.http_proxy = "http-proxy-lower";
        expect(await getProxyUrl()).toBe("https-proxy-lower");
    });

    it("returns undefined when nothing is configured at all", async () => {
        expect(await getProxyUrl()).toBeUndefined();
    });

    it("uses the user's configured httpProxy when a userId is given", async () => {
        process.env.HTTPS_PROXY = "https://env-proxy.example.com";
        dbMockState.db = createMockDb([[{ httpProxy: "http://user-proxy.example.com" }]]);
        expect(await getProxyUrl(1)).toBe("http://user-proxy.example.com");
    });

    it("falls back to env vars when the user has no httpProxy configured", async () => {
        process.env.HTTPS_PROXY = "https://env-proxy.example.com";
        dbMockState.db = createMockDb([[{ httpProxy: null }]]);
        expect(await getProxyUrl(1)).toBe("https://env-proxy.example.com");
    });

    it("falls back to env vars when the DB lookup throws", async () => {
        process.env.HTTPS_PROXY = "https://env-proxy.example.com";
        dbMockState.db = {
            select: vi.fn(() => {
                throw new Error("db down");
            }),
        };
        expect(await getProxyUrl(1)).toBe("https://env-proxy.example.com");
    });
});

describe("tmdbFetch auth (via getTmdbShow)", () => {
    it("throws when TMDB_API_KEY is not set", async () => {
        delete process.env.TMDB_API_KEY;
        dbMockState.db = createMockDb([[]]);
        await expect(getTmdbShow(100)).rejects.toThrow("TMDB_API_KEY");
        expect(providerFetchMock).not.toHaveBeenCalled();
    });

    it("uses a Bearer Authorization header for a v4 JWT-style key (starts with eyJ)", async () => {
        process.env.TMDB_API_KEY = "eyJhbGciOiJIUzI1NiJ9.fake";
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockResolvedValue(jsonRes(200, { id: 100, name: "Show" }));

        await getTmdbShow(100);
        const call = providerFetchMock.mock.calls[0][0];
        expect(call.init.headers.Authorization).toBe("Bearer eyJhbGciOiJIUzI1NiJ9.fake");
        expect(call.url).not.toContain("api_key");
    });

    it("uses an api_key query param for a v3 short key", async () => {
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockResolvedValue(jsonRes(200, { id: 100, name: "Show" }));

        await getTmdbShow(100);
        const call = providerFetchMock.mock.calls[0][0];
        expect(call.url).toContain("api_key=v3-short-key");
        expect(call.init.headers.Authorization).toBeUndefined();
    });

    it("throws with the status and path when the response is not ok", async () => {
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockResolvedValue(jsonRes(404, {}));
        await expect(getTmdbShow(999)).rejects.toThrow("TMDB 404: /tv/999");
    });
});

describe("cachedProviderFetch (via getTmdbShow)", () => {
    it("returns fresh cached data without calling providerFetch", async () => {
        dbMockState.db = createMockDb([[cacheRow({ id: 100, name: "Cached Show" }, 1)]]);
        const result = await getTmdbShow(100);
        expect(result).toEqual({ id: 100, name: "Cached Show" });
        expect(providerFetchMock).not.toHaveBeenCalled();
    });

    it("fetches and writes the cache when there is no cached row", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        providerFetchMock.mockResolvedValue(jsonRes(200, { id: 100, name: "Fresh Show" }));

        const result = await getTmdbShow(100);
        expect(result).toEqual({ id: 100, name: "Fresh Show" });
        expect(db.__inserted).toHaveLength(1);
        expect(db.__inserted[0]).toMatchObject({ source: "tmdb_show", externalId: "100" });
    });

    it("re-fetches when the cached row is past its TTL (30d for shows)", async () => {
        dbMockState.db = createMockDb([[cacheRow({ id: 100, name: "Old Show" }, 24 * 31)]]);
        providerFetchMock.mockResolvedValue(jsonRes(200, { id: 100, name: "New Show" }));

        const result = await getTmdbShow(100);
        expect(result).toEqual({ id: 100, name: "New Show" });
        expect(providerFetchMock).toHaveBeenCalledTimes(1);
    });

    it("serves stale cache on fetch failure when still within the grace window", async () => {
        // 31 days old: past the 30d TTL but within the 30d+14d grace window.
        dbMockState.db = createMockDb([[cacheRow({ id: 100, name: "Stale Show" }, 24 * 31)]]);
        providerFetchMock.mockRejectedValue(new Error("network down"));
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await getTmdbShow(100);
        expect(result).toEqual({ id: 100, name: "Stale Show" });
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("throws on fetch failure when there is no cache to fall back to", async () => {
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockRejectedValue(new Error("network down"));
        await expect(getTmdbShow(100)).rejects.toThrow("network down");
    });

    it("throws on fetch failure when the stale cache is past the grace window", async () => {
        // 30 + 14 + 1 days old: past both the TTL and the grace window.
        dbMockState.db = createMockDb([[cacheRow({ id: 100, name: "Ancient Show" }, 24 * 45)]]);
        providerFetchMock.mockRejectedValue(new Error("network down"));
        await expect(getTmdbShow(100)).rejects.toThrow("network down");
    });

    it("forces a re-fetch even with a fresh cache when forceRefresh is set (getTmdbSeason)", async () => {
        const db = createMockDb([[cacheRow({ episodes: [] }, 1)]]);
        dbMockState.db = db;
        providerFetchMock.mockResolvedValue(jsonRes(200, { episodes: [{ id: 1 }] }));

        const result = await getTmdbSeason(100, 1, undefined, undefined, true);
        expect(result).toEqual({ episodes: [{ id: 1 }] });
        expect(providerFetchMock).toHaveBeenCalledTimes(1);
    });
});

describe("language-aware cache keys", () => {
    it("getTmdbShow: uses a bare id when no language, and id_language otherwise", async () => {
        const db1 = createMockDb([[]]);
        dbMockState.db = db1;
        // Each Response body can only be read once — construct a fresh one per call.
        providerFetchMock.mockImplementation(() => Promise.resolve(jsonRes(200, { id: 100 })));
        await getTmdbShow(100);
        expect(db1.__inserted[0].externalId).toBe("100");

        const db2 = createMockDb([[]]);
        dbMockState.db = db2;
        await getTmdbShow(100, "zh-CN");
        expect(db2.__inserted[0].externalId).toBe("100_zh-CN");
    });

    it("getTmdbMovie: always prefixes with tmdb_movie_ and includes 'base' when no language", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        providerFetchMock.mockResolvedValue(jsonRes(200, { id: 9 }));
        await getTmdbMovie(9);
        expect(db.__inserted[0].externalId).toBe("tmdb_movie_9_base");
    });

    it("getTmdbSeason: includes the season number and language in the key", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        providerFetchMock.mockResolvedValue(jsonRes(200, { episodes: [] }));
        await getTmdbSeason(100, 2, "ja");
        expect(db.__inserted[0].externalId).toBe("100_s2_ja");
    });
});

describe("getTmdbEpisodeDetail", () => {
    it("extracts directors from credits.crew, skipping non-Director/nameless entries", async () => {
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockResolvedValue(
            jsonRes(200, {
                credits: {
                    crew: [
                        { job: "Director", name: "Alice" },
                        { job: "Writer", name: "Bob" },
                        { job: "Director", name: undefined },
                    ],
                },
            }),
        );

        const result = await getTmdbEpisodeDetail(100, 1, 1);
        expect(result).toEqual({ directors: ["Alice"] });
    });

    it("degrades to an empty directors list on any failure (fetch error)", async () => {
        dbMockState.db = createMockDb([[]]);
        providerFetchMock.mockRejectedValue(new Error("network down"));
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await getTmdbEpisodeDetail(100, 1, 1);
        expect(result).toEqual({ directors: [] });
        warnSpy.mockRestore();
    });

    it("degrades to an empty directors list when TMDB_API_KEY is missing", async () => {
        delete process.env.TMDB_API_KEY;
        dbMockState.db = createMockDb([[]]);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await getTmdbEpisodeDetail(100, 1, 1);
        expect(result).toEqual({ directors: [] });
        warnSpy.mockRestore();
    });

    it("includes the language in the cache key when provided", async () => {
        const db = createMockDb([[]]);
        dbMockState.db = db;
        providerFetchMock.mockResolvedValue(jsonRes(200, { credits: { crew: [] } }));

        await getTmdbEpisodeDetail(100, 1, 2, "ko");
        expect(db.__inserted[0].externalId).toBe("tmdb_episode_100_s1e2_ko");
    });
});
