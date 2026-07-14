import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";

const SENTINEL = { sentinel: true };

function jsonRes(data: unknown, opts: { status?: number; statusText?: string } = {}) {
    const status = opts.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: opts.statusText ?? "OK",
        json: () => Promise.resolve(data),
    };
}

function lastFetchCall() {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const calls = mockFetch.mock.calls;
    return calls[calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(SENTINEL)));
});

// ---------------------------------------------------------------------------
// request() shared helper
// ---------------------------------------------------------------------------

describe("request() shared helper", () => {
    it("does not set Content-Type for a GET request", async () => {
        await api.auth.me();
        const [, init] = lastFetchCall();
        expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    });

    it("sets Content-Type: application/json for a non-GET request", async () => {
        await api.settings.update({ syncIntervalMinutes: 60 });
        const [, init] = lastFetchCall();
        expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("always sends credentials: include", async () => {
        await api.stats.overview();
        const [, init] = lastFetchCall();
        expect(init.credentials).toBe("include");
    });

    it("prefixes paths with /api by default, and uses an empty base for auth", async () => {
        await api.stats.overview();
        expect(lastFetchCall()[0]).toBe("/api/stats/overview");

        await api.auth.me();
        expect(lastFetchCall()[0]).toBe("/auth/me");
    });

    it("throws an Error with the parsed message and status on a non-ok response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonRes({ error: "Not authenticated" }, { status: 401 })),
        );
        await expect(api.auth.me()).rejects.toMatchObject({
            message: "Not authenticated",
            status: 401,
        });
    });

    it("falls back to statusText when the error body isn't valid JSON", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                json: () => Promise.reject(new Error("not json")),
            }),
        );
        await expect(api.auth.me()).rejects.toMatchObject({
            message: "Internal Server Error",
            status: 500,
        });
    });
});

// ---------------------------------------------------------------------------
// GET methods — table-driven pathname/query verification
// ---------------------------------------------------------------------------

type GetCase = {
    name: string;
    invoke: () => Promise<unknown>;
    pathname: string;
    search?: Record<string, string>;
};

const getCases: GetCase[] = [
    { name: "auth.me", invoke: () => api.auth.me(), pathname: "/auth/me" },
    {
        name: "shows.progress (defaults)",
        invoke: () => api.shows.progress(),
        pathname: "/api/shows/progress",
        search: { filter: "watching", q: "", limit: "50", offset: "0" },
    },
    { name: "shows.detail", invoke: () => api.shows.detail(5), pathname: "/api/shows/5" },
    { name: "shows.history", invoke: () => api.shows.history(5), pathname: "/api/shows/5/history" },
    { name: "shows.upNext", invoke: () => api.shows.upNext(), pathname: "/api/shows/up-next" },
    {
        name: "episodes.detail",
        invoke: () => api.episodes.detail(5, 1, 3),
        pathname: "/api/shows/5/episodes/1/3",
    },
    {
        name: "episodes.history",
        invoke: () => api.episodes.history(5, 1, 3),
        pathname: "/api/shows/5/episodes/1/3/history",
    },
    { name: "sync.status", invoke: () => api.sync.status(), pathname: "/api/sync/status" },
    { name: "sync.debug", invoke: () => api.sync.debug(), pathname: "/api/sync/debug" },
    { name: "stats.overview", invoke: () => api.stats.overview(), pathname: "/api/stats/overview" },
    {
        name: "stats.screenTime (default days)",
        invoke: () => api.stats.screenTime(),
        pathname: "/api/stats/screen-time",
        search: { days: "7" },
    },
    { name: "settings.get", invoke: () => api.settings.get(), pathname: "/api/settings" },
    { name: "trakt.watching", invoke: () => api.trakt.watching(), pathname: "/api/trakt/watching" },
    { name: "trakt.stats", invoke: () => api.trakt.stats(), pathname: "/api/trakt/stats" },
    { name: "trakt.profile", invoke: () => api.trakt.profile(), pathname: "/api/trakt/profile" },
    {
        name: "calendar.list (defaults)",
        invoke: () => api.calendar.list(),
        pathname: "/api/calendar",
        search: { before: "14", after: "30" },
    },
    {
        name: "movies.progress (defaults)",
        invoke: () => api.movies.progress(),
        pathname: "/api/movies/progress",
        search: { filter: "watched", q: "", limit: "50", offset: "0" },
    },
    { name: "movies.detail", invoke: () => api.movies.detail(9), pathname: "/api/movies/9" },
    {
        name: "movies.history",
        invoke: () => api.movies.history(9),
        pathname: "/api/movies/9/history",
    },
    {
        name: "history.list (defaults)",
        invoke: () => api.history.list(),
        pathname: "/api/history",
        search: { mediaType: "all", limit: "50", offset: "0" },
    },
    {
        name: "history.list (with date range)",
        invoke: () => api.history.list("episode", "2026-01-01", "2026-01-31"),
        pathname: "/api/history",
        search: { mediaType: "episode", startDate: "2026-01-01", endDate: "2026-01-31" },
    },
    {
        name: "watchlist.list (no type)",
        invoke: () => api.watchlist.list(),
        pathname: "/api/watchlist",
    },
    {
        name: "watchlist.list (typed)",
        invoke: () => api.watchlist.list("shows"),
        pathname: "/api/watchlist",
        search: { type: "shows" },
    },
    {
        name: "notifications.vapidPublicKey",
        invoke: () => api.notifications.vapidPublicKey(),
        pathname: "/api/notifications/vapid-public-key",
    },
    {
        name: "ratings.list (default)",
        invoke: () => api.ratings.list(),
        pathname: "/api/ratings",
        search: { type: "all" },
    },
    {
        name: "search.query",
        invoke: () => api.search.query("arrival", "movie", 10),
        pathname: "/api/search",
        search: { q: "arrival", type: "movie", limit: "10" },
    },
    {
        name: "jellyfin.libraries",
        invoke: () => api.jellyfin.libraries(),
        pathname: "/api/jellyfin/libraries",
    },
    {
        name: "jellyfin.episode",
        invoke: () => api.jellyfin.episode(100, 1, 3),
        pathname: "/api/jellyfin/episode/100/1/3",
    },
    {
        name: "jellyfin.movie",
        invoke: () => api.jellyfin.movie(200),
        pathname: "/api/jellyfin/movie/200",
    },
    {
        name: "jellyfin.seasonEpisodes",
        invoke: () => api.jellyfin.seasonEpisodes(100, 1),
        pathname: "/api/jellyfin/show/100/season/1",
    },
    {
        name: "jellyfin.nowPlaying",
        invoke: () => api.jellyfin.nowPlaying(),
        pathname: "/api/jellyfin/now-playing",
    },
    {
        name: "jellyfin.statsOverview",
        invoke: () => api.jellyfin.statsOverview(),
        pathname: "/api/jellyfin/stats/overview",
    },
    {
        name: "jellyfin.statsActivity (default limit)",
        invoke: () => api.jellyfin.statsActivity(),
        pathname: "/api/jellyfin/stats/activity",
        search: { limit: "50" },
    },
    {
        name: "jellyfin.statsTopContent",
        invoke: () => api.jellyfin.statsTopContent(),
        pathname: "/api/jellyfin/stats/top-content",
    },
    {
        name: "jellyfin.statsHeatmap",
        invoke: () => api.jellyfin.statsHeatmap(),
        pathname: "/api/jellyfin/stats/heatmap",
    },
    {
        name: "jellyfin.deleteQueue",
        invoke: () => api.jellyfin.deleteQueue(),
        pathname: "/api/jellyfin/delete-queue",
    },
    {
        name: "jellyfin.deleteHistory (default limit)",
        invoke: () => api.jellyfin.deleteHistory(),
        pathname: "/api/jellyfin/delete-history",
        search: { limit: "20" },
    },
    {
        name: "jellyfin.deleteExclusions",
        invoke: () => api.jellyfin.deleteExclusions(),
        pathname: "/api/jellyfin/delete-exclusions",
    },
    {
        name: "discover.list",
        invoke: () => api.discover.list("show", "trending", 5),
        pathname: "/api/discover",
        search: { mediaType: "show", tab: "trending", limit: "5" },
    },
    {
        name: "notes.get",
        invoke: () => api.notes.get({ mediaType: "episode", showId: 5, season: 1, episode: 2 }),
        pathname: "/api/notes",
        search: { mediaType: "episode", showId: "5", season: "1", episode: "2" },
    },
    { name: "lists.getAll", invoke: () => api.lists.getAll(), pathname: "/api/lists" },
    { name: "lists.getItems", invoke: () => api.lists.getItems(3), pathname: "/api/lists/3/items" },
    {
        name: "collection.getAll (default)",
        invoke: () => api.collection.getAll(),
        pathname: "/api/collection",
        search: { type: "all" },
    },
    {
        name: "collection.check",
        invoke: () => api.collection.check({ showId: 5 }),
        pathname: "/api/collection/check",
        search: { showId: "5" },
    },
    {
        name: "collection.capacity",
        invoke: () => api.collection.capacity(),
        pathname: "/api/collection/capacity",
    },
    {
        name: "collection.getShowEpisodes",
        invoke: () => api.collection.getShowEpisodes(5),
        pathname: "/api/collection/shows/5/episodes",
    },
    {
        name: "backup.gdriveStatus",
        invoke: () => api.backup.gdriveStatus(),
        pathname: "/api/backup/gdrive/status",
    },
    {
        name: "backup.onedriveStatus",
        invoke: () => api.backup.onedriveStatus(),
        pathname: "/api/backup/onedrive/status",
    },
    {
        name: "backup.webdavStatus",
        invoke: () => api.backup.webdavStatus(),
        pathname: "/api/backup/webdav/status",
    },
    {
        name: "backup.s3Status",
        invoke: () => api.backup.s3Status(),
        pathname: "/api/backup/s3/status",
    },
    {
        name: "backup.getSettings",
        invoke: () => api.backup.getSettings(),
        pathname: "/api/backup/settings",
    },
    {
        name: "backup.runs (default limit)",
        invoke: () => api.backup.runs(),
        pathname: "/api/backup/runs",
        search: { limit: "20" },
    },
    {
        name: "backup.files (no provider)",
        invoke: () => api.backup.files(),
        pathname: "/api/backup/files",
    },
    {
        name: "backup.files (with provider)",
        invoke: () => api.backup.files("gdrive"),
        pathname: "/api/backup/files",
        search: { provider: "gdrive" },
    },
    { name: "system.metrics", invoke: () => api.system.metrics(), pathname: "/api/system/metrics" },
];

describe("GET methods — URL/query construction", () => {
    it.each(getCases)("$name builds the correct request and returns the response", async (tc) => {
        const result = await tc.invoke();
        expect(result).toEqual(SENTINEL);

        const [url] = lastFetchCall();
        const parsed = new URL(url, "http://localhost");
        expect(parsed.pathname).toBe(tc.pathname.startsWith("/api") ? tc.pathname : tc.pathname);
        for (const [k, v] of Object.entries(tc.search ?? {})) {
            expect(parsed.searchParams.get(k)).toBe(v);
        }
    });
});

// ---------------------------------------------------------------------------
// Mutation methods — method + body construction
// ---------------------------------------------------------------------------

type MutationCase = {
    name: string;
    invoke: () => Promise<unknown>;
    pathname: string;
    method: string;
    body?: unknown;
};

const mutationCases: MutationCase[] = [
    {
        name: "auth.logout",
        invoke: () => api.auth.logout(),
        pathname: "/auth/logout",
        method: "POST",
    },
    {
        name: "shows.deleteHistory",
        invoke: () => api.shows.deleteHistory(5, 1),
        pathname: "/api/shows/5/history/1",
        method: "DELETE",
    },
    {
        name: "shows.reset",
        invoke: () => api.shows.reset(5),
        pathname: "/api/shows/5/reset",
        method: "POST",
    },
    {
        name: "shows.markSeasonWatched",
        invoke: () => api.shows.markSeasonWatched(5, 1, "2026-01-01T00:00:00.000Z"),
        pathname: "/api/shows/5/seasons/1/mark-watched",
        method: "POST",
        body: { watchedAt: "2026-01-01T00:00:00.000Z" },
    },
    {
        name: "shows.forceSync",
        invoke: () => api.shows.forceSync(5),
        pathname: "/api/shows/5/force-sync",
        method: "POST",
    },
    {
        name: "episodes.watch",
        invoke: () => api.episodes.watch(5, 1, 3, "2026-01-01T00:00:00.000Z"),
        pathname: "/api/shows/5/episodes/1/3/watch",
        method: "POST",
        body: { watchedAt: "2026-01-01T00:00:00.000Z" },
    },
    {
        name: "sync.trigger",
        invoke: () => api.sync.trigger(),
        pathname: "/api/sync/trigger",
        method: "POST",
    },
    {
        name: "sync.full",
        invoke: () => api.sync.full(),
        pathname: "/api/sync/full",
        method: "POST",
    },
    {
        name: "settings.update",
        invoke: () => api.settings.update({ syncIntervalMinutes: 30 }),
        pathname: "/api/settings",
        method: "PUT",
        body: { syncIntervalMinutes: 30 },
    },
    {
        name: "movies.watch",
        invoke: () => api.movies.watch(9, null),
        pathname: "/api/movies/9/watch",
        method: "POST",
        body: { watchedAt: null },
    },
    {
        name: "movies.deleteHistory",
        invoke: () => api.movies.deleteHistory(9, 2),
        pathname: "/api/movies/9/history/2",
        method: "DELETE",
    },
    {
        name: "history.import",
        invoke: () => api.history.import([{ id: 1 }]),
        pathname: "/api/history/import",
        method: "POST",
        body: [{ id: 1 }],
    },
    {
        name: "watchlist.add",
        invoke: () => api.watchlist.add("show", 5, "note"),
        pathname: "/api/watchlist",
        method: "POST",
        body: { type: "show", id: 5, notes: "note" },
    },
    {
        name: "watchlist.remove",
        invoke: () => api.watchlist.remove(5),
        pathname: "/api/watchlist/5",
        method: "DELETE",
    },
    {
        name: "notifications.subscribe",
        invoke: () => api.notifications.subscribe({ endpoint: "https://push" } as never),
        pathname: "/api/notifications/subscribe",
        method: "POST",
        body: { endpoint: "https://push" },
    },
    {
        name: "notifications.unsubscribe",
        invoke: () => api.notifications.unsubscribe("https://push"),
        pathname: "/api/notifications/unsubscribe",
        method: "POST",
        body: { endpoint: "https://push" },
    },
    {
        name: "ratings.set",
        invoke: () => api.ratings.set("show", 5, 9),
        pathname: "/api/ratings",
        method: "PUT",
        body: { type: "show", localId: 5, rating: 9 },
    },
    {
        name: "ratings.remove",
        invoke: () => api.ratings.remove("show", 5),
        pathname: "/api/ratings",
        method: "DELETE",
        body: { type: "show", localId: 5 },
    },
    {
        name: "search.watchlistAdd",
        invoke: () => api.search.watchlistAdd("movie", 300, 400),
        pathname: "/api/search/watchlist-add",
        method: "POST",
        body: { type: "movie", traktId: 300, tmdbId: 400 },
    },
    {
        name: "jellyfin.testLibraries",
        invoke: () => api.jellyfin.testLibraries("http://jf", "key"),
        pathname: "/api/jellyfin/libraries",
        method: "POST",
        body: { url: "http://jf", apiKey: "key" },
    },
    {
        name: "jellyfin.deleteSeasonEpisodes",
        invoke: () => api.jellyfin.deleteSeasonEpisodes(100, 1),
        pathname: "/api/jellyfin/show/100/season/1",
        method: "DELETE",
    },
    {
        name: "jellyfin.deleteItem",
        invoke: () => api.jellyfin.deleteItem("abc"),
        pathname: "/api/jellyfin/items/abc",
        method: "DELETE",
    },
    {
        name: "jellyfin.deferDeleteQueue",
        invoke: () => api.jellyfin.deferDeleteQueue(7),
        pathname: "/api/jellyfin/delete-queue/7/defer",
        method: "POST",
    },
    {
        name: "jellyfin.neverDeleteQueue",
        invoke: () => api.jellyfin.neverDeleteQueue(7),
        pathname: "/api/jellyfin/delete-queue/7/never",
        method: "POST",
    },
    {
        name: "jellyfin.deleteQueueNow",
        invoke: () => api.jellyfin.deleteQueueNow(7),
        pathname: "/api/jellyfin/delete-queue/7/now",
        method: "POST",
    },
    {
        name: "jellyfin.createDeleteExclusion",
        invoke: () => api.jellyfin.createDeleteExclusion({ showId: 5 }),
        pathname: "/api/jellyfin/delete-exclusions",
        method: "POST",
        body: { showId: 5 },
    },
    {
        name: "jellyfin.removeDeleteExclusion",
        invoke: () => api.jellyfin.removeDeleteExclusion(9),
        pathname: "/api/jellyfin/delete-exclusions/9",
        method: "DELETE",
    },
    {
        name: "notes.upsert",
        invoke: () => api.notes.upsert({ mediaType: "episode", showId: 5, content: "hi" }),
        pathname: "/api/notes",
        method: "PUT",
        body: { mediaType: "episode", showId: 5, content: "hi" },
    },
    {
        name: "notes.delete",
        invoke: () => api.notes.delete(1),
        pathname: "/api/notes/1",
        method: "DELETE",
    },
    {
        name: "lists.create",
        invoke: () => api.lists.create({ name: "My List" }),
        pathname: "/api/lists",
        method: "POST",
        body: { name: "My List" },
    },
    {
        name: "lists.update",
        invoke: () => api.lists.update(3, { name: "Renamed" }),
        pathname: "/api/lists/3",
        method: "PUT",
        body: { name: "Renamed" },
    },
    {
        name: "lists.delete",
        invoke: () => api.lists.delete(3),
        pathname: "/api/lists/3",
        method: "DELETE",
    },
    {
        name: "lists.addItem",
        invoke: () => api.lists.addItem(3, { mediaType: "show", localId: 5 }),
        pathname: "/api/lists/3/items",
        method: "POST",
        body: { mediaType: "show", localId: 5 },
    },
    {
        name: "lists.removeItem",
        invoke: () => api.lists.removeItem(3, 10),
        pathname: "/api/lists/3/items/10",
        method: "DELETE",
    },
    {
        name: "lists.sync",
        invoke: () => api.lists.sync(),
        pathname: "/api/lists/sync",
        method: "POST",
    },
    {
        name: "collection.sync",
        invoke: () => api.collection.sync(),
        pathname: "/api/collection/sync",
        method: "POST",
    },
    {
        name: "collection.clearRemote",
        invoke: () => api.collection.clearRemote(),
        pathname: "/api/collection/clear-remote",
        method: "POST",
        body: { confirm: true },
    },
    {
        name: "collection.remove",
        invoke: () => api.collection.remove(5),
        pathname: "/api/collection/5",
        method: "DELETE",
    },
    {
        name: "collection.pruneRemote (default targetPct)",
        invoke: () => api.collection.pruneRemote(),
        pathname: "/api/collection/prune-remote",
        method: "POST",
        body: { confirm: true, targetPct: 80 },
    },
    {
        name: "backup.gdriveStartAuth",
        invoke: () => api.backup.gdriveStartAuth(),
        pathname: "/api/backup/gdrive/auth",
        method: "POST",
    },
    {
        name: "backup.gdrivePoll",
        invoke: () => api.backup.gdrivePoll("device-1"),
        pathname: "/api/backup/gdrive/poll",
        method: "POST",
        body: { device_code: "device-1" },
    },
    {
        name: "backup.gdriveRevoke",
        invoke: () => api.backup.gdriveRevoke(),
        pathname: "/api/backup/gdrive/revoke",
        method: "DELETE",
    },
    {
        name: "backup.onedriveStartAuth",
        invoke: () => api.backup.onedriveStartAuth(),
        pathname: "/api/backup/onedrive/auth",
        method: "POST",
    },
    {
        name: "backup.onedrivePoll",
        invoke: () => api.backup.onedrivePoll("device-2"),
        pathname: "/api/backup/onedrive/poll",
        method: "POST",
        body: { device_code: "device-2" },
    },
    {
        name: "backup.onedriveRevoke",
        invoke: () => api.backup.onedriveRevoke(),
        pathname: "/api/backup/onedrive/revoke",
        method: "DELETE",
    },
    {
        name: "backup.webdavSave",
        invoke: () => api.backup.webdavSave({ url: "https://dav", username: "u", password: "p" }),
        pathname: "/api/backup/webdav",
        method: "PUT",
        body: { url: "https://dav", username: "u", password: "p" },
    },
    {
        name: "backup.webdavClear",
        invoke: () => api.backup.webdavClear(),
        pathname: "/api/backup/webdav",
        method: "PUT",
        body: {},
    },
    {
        name: "backup.s3Save",
        invoke: () =>
            api.backup.s3Save({
                endpoint: "https://s3",
                region: "us-east-1",
                bucket: "b",
                accessKeyId: "ak",
                secretAccessKey: "sk",
            }),
        pathname: "/api/backup/s3",
        method: "PUT",
        body: {
            endpoint: "https://s3",
            region: "us-east-1",
            bucket: "b",
            accessKeyId: "ak",
            secretAccessKey: "sk",
        },
    },
    {
        name: "backup.s3Clear",
        invoke: () => api.backup.s3Clear(),
        pathname: "/api/backup/s3",
        method: "PUT",
        body: {},
    },
    {
        name: "backup.saveSettings",
        invoke: () => api.backup.saveSettings({ autoEnabled: true }),
        pathname: "/api/backup/settings",
        method: "PUT",
        body: { autoEnabled: true },
    },
    {
        name: "backup.trigger (default provider)",
        invoke: () => api.backup.trigger(),
        pathname: "/api/backup/trigger",
        method: "POST",
        body: { provider: "all" },
    },
    {
        name: "backup.deleteFile",
        invoke: () => api.backup.deleteFile("gdrive", "file-1"),
        pathname: "/api/backup/files",
        method: "DELETE",
        body: { provider: "gdrive", fileId: "file-1" },
    },
    {
        name: "backup.restore",
        invoke: () => api.backup.restore("gdrive", "file-1"),
        pathname: "/api/backup/restore",
        method: "POST",
        body: { provider: "gdrive", fileId: "file-1" },
    },
];

describe("mutation methods — method/body construction", () => {
    it.each(mutationCases)("$name builds the correct request", async (tc) => {
        const result = await tc.invoke();
        expect(result).toEqual(SENTINEL);

        const [url, init] = lastFetchCall();
        const parsed = new URL(url, "http://localhost");
        expect(parsed.pathname).toBe(tc.pathname);
        expect(init.method).toBe(tc.method);
        if (tc.body !== undefined) {
            expect(JSON.parse(init.body as string)).toEqual(tc.body);
        }
    });
});

// ---------------------------------------------------------------------------
// history.export — special case: builds a URL string directly, no fetch call
// ---------------------------------------------------------------------------

describe("history.export", () => {
    it("returns a CSV export URL without calling fetch", () => {
        const url = api.history.export("episode", "csv", "2026-01-01", "2026-01-31");
        expect(url).toBe(
            "/api/history/export?mediaType=episode&format=csv&startDate=2026-01-01&endDate=2026-01-31",
        );
        expect(fetch).not.toHaveBeenCalled();
    });

    it("defaults to mediaType=all and format=csv", () => {
        const url = api.history.export();
        expect(url).toBe("/api/history/export?mediaType=all&format=csv");
    });
});
