import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    fetchJellyfinLibraries,
    fetchJellyfinSeriesTmdbMap,
    findJellyfinSeasonIdBySeriesId,
    findJellyfinSeasonEpisodes,
    findJellyfinEpisode,
    fetchJellyfinMoviesTmdbMap,
    findJellyfinMovie,
    deleteJellyfinItem,
    getActiveSessions,
    autoDeleteJellyfinEpisode,
    getJellyfinLibrarySummary,
    getJellyfinActivityLog,
    getJellyfinTopItems,
    getJellyfinPlayHeatmap,
} = await import("../services/jellyfin.js");

const cfg = { url: "http://jellyfin.local:8096", apiKey: "secret-key" };

function jsonRes(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

/**
 * Routes a stubbed global `fetch` by matching the request URL against a list of
 * (pattern, handler) pairs, in list order — order-independent w.r.t. call sequence,
 * which keeps tests robust against the exact fan-out order of Promise.all/loops.
 */
function routedFetch(routes: Array<[RegExp, (url: string) => Response]>) {
    const fn = vi.fn((url: string) => {
        for (const [pattern, handler] of routes) {
            if (pattern.test(url)) return Promise.resolve(handler(url));
        }
        throw new Error(`Unmocked fetch URL in test: ${url}`);
    });
    vi.stubGlobal("fetch", fn);
    return fn;
}

beforeEach(() => {
    delete process.env.JELLYFIN_USER;
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchJellyfinLibraries", () => {
    it("strips a trailing slash from the base URL and sends the API key header", async () => {
        const fetchMock = routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "himea" }])],
            [/\/Users\/u1\/Views$/, () => jsonRes(200, { Items: [] })],
        ]);
        await fetchJellyfinLibraries({ url: "http://jellyfin.local:8096/", apiKey: "secret-key" });
        expect(fetchMock).toHaveBeenCalledWith(
            "http://jellyfin.local:8096/Users",
            expect.objectContaining({
                headers: expect.objectContaining({ "X-Emby-Token": "secret-key" }),
            }),
        );
    });

    it("returns [] immediately when there are no users", async () => {
        routedFetch([[/\/Users$/, () => jsonRes(200, [])]]);
        expect(await fetchJellyfinLibraries(cfg)).toEqual([]);
    });

    it("throws when the users fetch fails", async () => {
        routedFetch([[/\/Users$/, () => jsonRes(500, {})]]);
        await expect(fetchJellyfinLibraries(cfg)).rejects.toThrow(
            "Jellyfin users fetch failed: 500",
        );
    });

    it("throws when the views fetch fails", async () => {
        routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "himea" }])],
            [/\/Views$/, () => jsonRes(404, {})],
        ]);
        await expect(fetchJellyfinLibraries(cfg)).rejects.toThrow(
            "Jellyfin views fetch failed: 404",
        );
    });

    it("selects the user matching JELLYFIN_USER (exact case) over the first user", async () => {
        process.env.JELLYFIN_USER = "second";
        const fetchMock = routedFetch([
            [
                /\/Users$/,
                () =>
                    jsonRes(200, [
                        { Id: "u1", Name: "first" },
                        { Id: "u2", Name: "second" },
                    ]),
            ],
            [/\/Views$/, () => jsonRes(200, { Items: [] })],
        ]);
        await fetchJellyfinLibraries(cfg);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://jellyfin.local:8096/Users/u2/Views",
            expect.anything(),
        );
    });

    it("falls back to the first user when JELLYFIN_USER matches nobody", async () => {
        process.env.JELLYFIN_USER = "nobody";
        const fetchMock = routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "first" }])],
            [/\/Views$/, () => jsonRes(200, { Items: [] })],
        ]);
        await fetchJellyfinLibraries(cfg);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://jellyfin.local:8096/Users/u1/Views",
            expect.anything(),
        );
    });

    it("maps library items, defaulting collectionType to an empty string", async () => {
        routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "himea" }])],
            [
                /\/Views$/,
                () =>
                    jsonRes(200, {
                        Items: [
                            { Id: "l1", Name: "Movies", CollectionType: "movies" },
                            { Id: "l2", Name: "Misc" },
                        ],
                    }),
            ],
        ]);
        const result = await fetchJellyfinLibraries(cfg);
        expect(result).toEqual([
            { id: "l1", name: "Movies", collectionType: "movies" },
            { id: "l2", name: "Misc", collectionType: "" },
        ]);
    });
});

describe("fetchJellyfinSeriesTmdbMap", () => {
    it("fetches unscoped (no ParentId) when no libraryIds are given", async () => {
        const fetchMock = routedFetch([
            [
                /\/Items\?/,
                (url) => {
                    expect(url).not.toContain("ParentId");
                    return jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] });
                },
            ],
        ]);
        const map = await fetchJellyfinSeriesTmdbMap(cfg);
        expect(map.get("100")).toBe("s1");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fans out one request per library id and merges the results", async () => {
        const fetchMock = routedFetch([
            [
                /ParentId=lib1/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [
                /ParentId=lib2/,
                () => jsonRes(200, { Items: [{ Id: "s2", ProviderIds: { Tmdb: "200" } }] }),
            ],
        ]);
        const map = await fetchJellyfinSeriesTmdbMap(cfg, ["lib1", "lib2"]);
        expect(map.get("100")).toBe("s1");
        expect(map.get("200")).toBe("s2");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("keeps the first-seen mapping when the same tmdbId appears in multiple scopes", async () => {
        routedFetch([
            [
                /ParentId=lib1/,
                () => jsonRes(200, { Items: [{ Id: "s1-first", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [
                /ParentId=lib2/,
                () => jsonRes(200, { Items: [{ Id: "s1-dup", ProviderIds: { Tmdb: "100" } }] }),
            ],
        ]);
        const map = await fetchJellyfinSeriesTmdbMap(cfg, ["lib1", "lib2"]);
        expect(map.get("100")).toBe("s1-first");
    });

    it("skips items without a Tmdb provider id", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(200, { Items: [{ Id: "s1" }] })]]);
        const map = await fetchJellyfinSeriesTmdbMap(cfg);
        expect(map.size).toBe(0);
    });

    it("skips a failed scope (does not throw) and keeps results from the others", async () => {
        routedFetch([
            [/ParentId=lib1/, () => jsonRes(500, {})],
            [
                /ParentId=lib2/,
                () => jsonRes(200, { Items: [{ Id: "s2", ProviderIds: { Tmdb: "200" } }] }),
            ],
        ]);
        const map = await fetchJellyfinSeriesTmdbMap(cfg, ["lib1", "lib2"]);
        expect(map.size).toBe(1);
        expect(map.get("200")).toBe("s2");
    });
});

describe("findJellyfinSeasonIdBySeriesId", () => {
    it("finds the season item matching IndexNumber", async () => {
        routedFetch([
            [
                /\/Shows\/series1\/Seasons$/,
                () =>
                    jsonRes(200, {
                        Items: [
                            { Id: "season1", IndexNumber: 1 },
                            { Id: "season2", IndexNumber: 2 },
                        ],
                    }),
            ],
        ]);
        expect(await findJellyfinSeasonIdBySeriesId(cfg, "series1", 2)).toBe("season2");
    });

    it("returns null when no season matches", async () => {
        routedFetch([
            [/\/Seasons$/, () => jsonRes(200, { Items: [{ Id: "season1", IndexNumber: 1 }] })],
        ]);
        expect(await findJellyfinSeasonIdBySeriesId(cfg, "series1", 9)).toBeNull();
    });

    it("throws when the fetch fails", async () => {
        routedFetch([[/\/Seasons$/, () => jsonRes(500, {})]]);
        await expect(findJellyfinSeasonIdBySeriesId(cfg, "series1", 1)).rejects.toThrow(
            "Jellyfin seasons fetch failed: 500",
        );
    });
});

describe("findJellyfinSeasonEpisodes", () => {
    it("returns [] when the series cannot be resolved", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(200, { Items: [] })]]);
        expect(await findJellyfinSeasonEpisodes(cfg, 999, 1)).toEqual([]);
    });

    it("maps episodes for a resolved series", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [
                /\/Shows\/s1\/Episodes\?/,
                () =>
                    jsonRes(200, {
                        Items: [{ Id: "e1", Name: "Pilot", SeriesName: "Show", Path: "/e1.mkv" }],
                    }),
            ],
        ]);
        expect(await findJellyfinSeasonEpisodes(cfg, 100, 1)).toEqual([
            { id: "e1", name: "Pilot", seriesName: "Show", path: "/e1.mkv" },
        ]);
    });

    it("defaults a missing name/seriesName/path", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(200, { Items: [{ Id: "e1", Name: "" }] })],
        ]);
        const eps = await findJellyfinSeasonEpisodes(cfg, 100, 1);
        expect(eps[0]).toEqual({ id: "e1", name: "", seriesName: "", path: null });
    });

    it("throws when the episodes fetch fails", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(500, {})],
        ]);
        await expect(findJellyfinSeasonEpisodes(cfg, 100, 1)).rejects.toThrow(
            "Jellyfin season episodes fetch failed: 500",
        );
    });
});

describe("findJellyfinEpisode", () => {
    it("returns null when the series cannot be resolved", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(200, { Items: [] })]]);
        expect(await findJellyfinEpisode(cfg, 999, 1, 1)).toBeNull();
    });

    it("returns null when no episode matches the episode number", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(200, { Items: [{ Id: "e1", IndexNumber: 1 }] })],
        ]);
        expect(await findJellyfinEpisode(cfg, 100, 1, 2)).toBeNull();
    });

    it("returns the mapped episode when found", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [
                /\/Episodes\?/,
                () =>
                    jsonRes(200, {
                        Items: [
                            {
                                Id: "e1",
                                Name: "Pilot",
                                SeriesName: "Show",
                                Path: "/e1.mkv",
                                IndexNumber: 1,
                            },
                        ],
                    }),
            ],
        ]);
        expect(await findJellyfinEpisode(cfg, 100, 1, 1)).toEqual({
            id: "e1",
            name: "Pilot",
            seriesName: "Show",
            path: "/e1.mkv",
        });
    });

    it("throws when the episodes fetch fails", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(502, {})],
        ]);
        await expect(findJellyfinEpisode(cfg, 100, 1, 1)).rejects.toThrow(
            "Jellyfin episode lookup failed: 502",
        );
    });

    it("scopes the series lookup to the given library ids", async () => {
        const fetchMock = routedFetch([
            [
                /ParentId=lib1/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(200, { Items: [{ Id: "e1", IndexNumber: 1 }] })],
        ]);
        await findJellyfinEpisode(cfg, 100, 1, 1, ["lib1"]);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("ParentId=lib1"),
            expect.anything(),
        );
    });
});

describe("fetchJellyfinMoviesTmdbMap", () => {
    it("maps movies by tmdbId, scoped per library", async () => {
        const fetchMock = routedFetch([
            [
                /ParentId=lib1/,
                () => jsonRes(200, { Items: [{ Id: "m1", ProviderIds: { Tmdb: "900" } }] }),
            ],
        ]);
        const map = await fetchJellyfinMoviesTmdbMap(cfg, ["lib1"]);
        expect(map.get("900")).toBe("m1");
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("IncludeItemTypes=Movie"),
            expect.anything(),
        );
    });

    it("skips a failed scope without throwing", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(500, {})]]);
        expect((await fetchJellyfinMoviesTmdbMap(cfg)).size).toBe(0);
    });
});

describe("findJellyfinMovie", () => {
    it("finds a movie by exact tmdb id match", async () => {
        routedFetch([
            [
                /\/Items\?/,
                () =>
                    jsonRes(200, {
                        Items: [
                            {
                                Id: "m1",
                                Name: "Movie A",
                                Path: "/a.mkv",
                                ProviderIds: { Tmdb: "900" },
                            },
                            { Id: "m2", Name: "Movie B", ProviderIds: { Tmdb: "901" } },
                        ],
                    }),
            ],
        ]);
        expect(await findJellyfinMovie(cfg, 900)).toEqual({
            id: "m1",
            name: "Movie A",
            path: "/a.mkv",
        });
    });

    it("returns null when no movie matches", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(200, { Items: [] })]]);
        expect(await findJellyfinMovie(cfg, 999)).toBeNull();
    });

    it("throws when the fetch fails", async () => {
        routedFetch([[/\/Items\?/, () => jsonRes(500, {})]]);
        await expect(findJellyfinMovie(cfg, 900)).rejects.toThrow(
            "Jellyfin movie lookup failed: 500",
        );
    });
});

describe("deleteJellyfinItem", () => {
    it("sends a DELETE with deleteFiles=true and resolves on success", async () => {
        const fetchMock = routedFetch([
            [/\/Items\/item1\?deleteFiles=true$/, () => jsonRes(200, {})],
        ]);
        await deleteJellyfinItem(cfg, "item1");
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/Items/item1?deleteFiles=true"),
            expect.objectContaining({ method: "DELETE" }),
        );
    });

    it("throws when the delete fails", async () => {
        routedFetch([[/\/Items\//, () => jsonRes(404, {})]]);
        await expect(deleteJellyfinItem(cfg, "item1")).rejects.toThrow(
            "Jellyfin delete failed: 404",
        );
    });
});

describe("getActiveSessions", () => {
    it("returns null when there are no sessions", async () => {
        routedFetch([[/\/Sessions\?/, () => jsonRes(200, [])]]);
        expect(await getActiveSessions(cfg)).toBeNull();
    });

    it("returns null when the session has no NowPlayingItem", async () => {
        routedFetch([[/\/Sessions\?/, () => jsonRes(200, [{}])]]);
        expect(await getActiveSessions(cfg)).toBeNull();
    });

    it("returns null for an unrecognized item Type", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () => jsonRes(200, [{ NowPlayingItem: { Id: "x", Name: "x", Type: "Audio" } }]),
            ],
        ]);
        expect(await getActiveSessions(cfg)).toBeNull();
    });

    it("filters sessions by username case-insensitively", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () =>
                    jsonRes(200, [
                        {
                            UserName: "OtherUser",
                            NowPlayingItem: { Id: "e1", Name: "Ep", Type: "Episode" },
                        },
                        {
                            UserName: "Himea",
                            NowPlayingItem: { Id: "e2", Name: "Ep2", Type: "Episode" },
                        },
                    ]),
            ],
        ]);
        const session = await getActiveSessions(cfg, "himea");
        expect(session?.jellyfinItemId).toBe("e2");
    });

    it("computes progress/runtime and defaults isPaused to false", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () =>
                    jsonRes(200, [
                        {
                            PlayState: { PositionTicks: 12_000_000_000 },
                            NowPlayingItem: {
                                Id: "e1",
                                Name: "Ep",
                                Type: "Episode",
                                RunTimeTicks: 24_000_000_000,
                            },
                        },
                    ]),
            ],
        ]);
        const session = await getActiveSessions(cfg);
        expect(session).toMatchObject({ runtimeMinutes: 40, progressPct: 50, isPaused: false });
    });

    it("bounds progressPct to 100 when position exceeds runtime", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () =>
                    jsonRes(200, [
                        {
                            PlayState: { PositionTicks: 999_999_999_999 },
                            NowPlayingItem: {
                                Id: "e1",
                                Name: "Ep",
                                Type: "Episode",
                                RunTimeTicks: 24_000_000_000,
                            },
                        },
                    ]),
            ],
        ]);
        const session = await getActiveSessions(cfg);
        expect(session?.progressPct).toBe(100);
    });

    it("defaults progressPct/runtimeMinutes to 0/null when RunTimeTicks is missing", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () => jsonRes(200, [{ NowPlayingItem: { Id: "e1", Name: "Ep", Type: "Movie" } }]),
            ],
        ]);
        const session = await getActiveSessions(cfg);
        expect(session).toMatchObject({ progressPct: 0, runtimeMinutes: null });
    });

    it("maps tmdbShowId for episodes and tmdbMovieId for movies, never both", async () => {
        routedFetch([
            [
                /\/Sessions\?/,
                () =>
                    jsonRes(200, [
                        {
                            NowPlayingItem: {
                                Id: "e1",
                                Name: "Ep",
                                Type: "Episode",
                                ProviderIds: { Tmdb: "100" },
                            },
                        },
                    ]),
            ],
        ]);
        const session = await getActiveSessions(cfg);
        expect(session).toMatchObject({ tmdbShowId: 100, tmdbMovieId: null });
    });

    it("throws when the sessions fetch fails", async () => {
        routedFetch([[/\/Sessions\?/, () => jsonRes(500, {})]]);
        await expect(getActiveSessions(cfg)).rejects.toThrow("Jellyfin sessions failed: 500");
    });
});

describe("autoDeleteJellyfinEpisode", () => {
    it("is a no-op (zero fetch calls) when no auto-delete libraries are configured", async () => {
        const fetchMock = routedFetch([]);
        await autoDeleteJellyfinEpisode(cfg, [], 100, 1, 1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is a no-op (no delete call) when the episode cannot be resolved", async () => {
        const fetchMock = routedFetch([[/ParentId=lib1/, () => jsonRes(200, { Items: [] })]]);
        await autoDeleteJellyfinEpisode(cfg, ["lib1"], 999, 1, 1);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes("deleteFiles"))).toBe(
            false,
        );
    });

    it("deletes the resolved episode, scoped to the configured libraries", async () => {
        const fetchMock = routedFetch([
            [
                /ParentId=lib1/,
                () => jsonRes(200, { Items: [{ Id: "s1", ProviderIds: { Tmdb: "100" } }] }),
            ],
            [/\/Episodes\?/, () => jsonRes(200, { Items: [{ Id: "e1", IndexNumber: 1 }] })],
            [/\/Items\/e1\?deleteFiles=true$/, () => jsonRes(200, {})],
        ]);
        await autoDeleteJellyfinEpisode(cfg, ["lib1"], 100, 1, 1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/Items/e1?deleteFiles=true"),
            expect.objectContaining({ method: "DELETE" }),
        );
    });
});

describe("getJellyfinLibrarySummary", () => {
    it("aggregates counts across the movie/series/episode queries", async () => {
        routedFetch([
            [/IncludeItemTypes=Movie/, () => jsonRes(200, { TotalRecordCount: 12 })],
            [/IncludeItemTypes=Series/, () => jsonRes(200, { TotalRecordCount: 5 })],
            [/IncludeItemTypes=Episode/, () => jsonRes(200, { TotalRecordCount: 300 })],
        ]);
        expect(await getJellyfinLibrarySummary(cfg)).toEqual({
            movieCount: 12,
            seriesCount: 5,
            episodeCount: 300,
        });
    });

    it("treats a failed sub-query as zero instead of throwing", async () => {
        routedFetch([
            [/IncludeItemTypes=Movie/, () => jsonRes(500, {})],
            [/IncludeItemTypes=Series/, () => jsonRes(200, { TotalRecordCount: 5 })],
            [/IncludeItemTypes=Episode/, () => jsonRes(200, { TotalRecordCount: 300 })],
        ]);
        expect((await getJellyfinLibrarySummary(cfg)).movieCount).toBe(0);
    });
});

describe("getJellyfinActivityLog", () => {
    it("filters to playback-related entries and maps fields", async () => {
        routedFetch([
            [
                /\/ActivityLog\/Entries\?/,
                () =>
                    jsonRes(200, {
                        Items: [
                            {
                                Date: "2026-07-01T00:00:00Z",
                                Name: "played X",
                                Type: "VideoPlaybackStopped",
                                UserName: "himea",
                                ItemId: "i1",
                            },
                            {
                                Date: "2026-07-01T01:00:00Z",
                                Name: "logged in",
                                Type: "AuthenticationSucceeded",
                            },
                        ],
                    }),
            ],
        ]);
        expect(await getJellyfinActivityLog(cfg)).toEqual([
            {
                date: "2026-07-01T00:00:00Z",
                name: "played X",
                type: "VideoPlaybackStopped",
                userName: "himea",
                itemId: "i1",
            },
        ]);
    });

    it("returns [] when the fetch fails (does not throw)", async () => {
        routedFetch([[/\/ActivityLog\/Entries\?/, () => jsonRes(500, {})]]);
        expect(await getJellyfinActivityLog(cfg)).toEqual([]);
    });

    it("forwards a custom limit", async () => {
        const fetchMock = routedFetch([
            [/\/ActivityLog\/Entries\?/, () => jsonRes(200, { Items: [] })],
        ]);
        await getJellyfinActivityLog(cfg, 10);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("limit=10"),
            expect.anything(),
        );
    });
});

describe("getJellyfinTopItems", () => {
    it("returns empty lists when there are no Jellyfin users", async () => {
        routedFetch([[/\/Users$/, () => jsonRes(200, [])]]);
        expect(await getJellyfinTopItems(cfg)).toEqual({ movies: [], series: [] });
    });

    it("returns top movies/series filtered to playCount > 0", async () => {
        routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "himea" }])],
            [
                /\/Users\/u1\/Items\?.*IncludeItemTypes=Movie/,
                () =>
                    jsonRes(200, {
                        Items: [
                            { Id: "m1", Name: "Movie A", UserData: { PlayCount: 3 } },
                            { Id: "m2", Name: "Movie B", UserData: { PlayCount: 0 } },
                        ],
                    }),
            ],
            [
                /\/Users\/u1\/Items\?.*IncludeItemTypes=Series/,
                () =>
                    jsonRes(200, {
                        Items: [{ Id: "s1", Name: "Show A", UserData: { PlayCount: 10 } }],
                    }),
            ],
        ]);
        const top = await getJellyfinTopItems(cfg);
        expect(top.movies).toEqual([{ id: "m1", name: "Movie A", playCount: 3, type: "Movie" }]);
        expect(top.series).toEqual([{ id: "s1", name: "Show A", playCount: 10, type: "Series" }]);
    });

    it("returns [] for a sub-query that fails", async () => {
        routedFetch([
            [/\/Users$/, () => jsonRes(200, [{ Id: "u1", Name: "himea" }])],
            [/IncludeItemTypes=Movie/, () => jsonRes(500, {})],
            [/IncludeItemTypes=Series/, () => jsonRes(200, { Items: [] })],
        ]);
        expect((await getJellyfinTopItems(cfg)).movies).toEqual([]);
    });

    it("selects the JELLYFIN_USER match case-insensitively", async () => {
        process.env.JELLYFIN_USER = "HIMEA";
        const fetchMock = routedFetch([
            [
                /\/Users$/,
                () =>
                    jsonRes(200, [
                        { Id: "u1", Name: "someone" },
                        { Id: "u2", Name: "himea" },
                    ]),
            ],
            [/\/Users\/u2\/Items/, () => jsonRes(200, { Items: [] })],
        ]);
        await getJellyfinTopItems(cfg);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("/Users/u2/Items"),
            expect.anything(),
        );
    });
});

describe("getJellyfinPlayHeatmap", () => {
    it("buckets playback events by day-of-week and hour (UTC)", async () => {
        routedFetch([
            [
                /\/ActivityLog\/Entries\?/,
                () =>
                    jsonRes(200, {
                        Items: [
                            { Date: "2026-07-06T14:30:00.000Z", Type: "VideoPlaybackStopped" },
                            { Date: "2026-07-06T14:45:00.000Z", Type: "VideoPlayback" },
                            { Date: "2026-07-06T09:00:00.000Z", Type: "AuthenticationSucceeded" },
                        ],
                    }),
            ],
        ]);
        const day = new Date("2026-07-06T14:30:00.000Z").getUTCDay();
        expect(await getJellyfinPlayHeatmap(cfg)).toEqual([{ dayOfWeek: day, hour: 14, count: 2 }]);
    });

    it("returns [] when the fetch fails", async () => {
        routedFetch([[/\/ActivityLog\/Entries\?/, () => jsonRes(500, {})]]);
        expect(await getJellyfinPlayHeatmap(cfg)).toEqual([]);
    });
});
