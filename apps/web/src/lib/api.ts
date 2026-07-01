import type {
    AuthStatus,
    ShowProgress,
    SyncState,
    SyncDebugState,
    StatsOverview,
    PaginatedResponse,
    ApiResponse,
    UserSettings,
    NowPlayingEpisode,
    EpisodeDetailData,
    WatchHistoryEntry,
    MovieProgress,
    MovieWatchHistoryEntry,
    CalendarEpisode,
    WatchlistItem,
    WatchlistItemWithMedia,
    HistoryPage,
    JellyfinLibrary,
    JellyfinEpisode,
    JellyfinMovie,
    JellyfinNowPlaying,
    JellyfinLibrarySummary,
    JellyfinActivityEntry,
    JellyfinStatsTopContent,
    JellyfinHeatmapCell,
    JellyfinDeleteQueueEntry,
    JellyfinDeleteHistoryEntry,
    SearchResult,
    DiscoverItem,
    UpNextItem,
    UserRating,
    UserNote,
    UserList,
    UserListItem,
    UserCollectionItem,
    CollectionShowEpisodes,
    BackupFile,
    BackupRun,
    DeviceAuthInfo,
    TraktOfficialStats,
    ScreenTimeData,
} from "@trakt-dashboard/types";

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit, base = API_BASE): Promise<T> {
    // Fix: only set Content-Type for requests that carry a body (not GET / HEAD)
    const method = options?.method?.toUpperCase() ?? "GET";
    const headers: Record<string, string> = {};
    if (method !== "GET" && method !== "HEAD") {
        headers["Content-Type"] = "application/json";
    }
    // Merge any caller-supplied headers (allow overrides)
    Object.assign(headers, options?.headers);

    const res = await fetch(`${base}${path}`, {
        credentials: "include",
        ...options,
        headers,
    });

    if (!res.ok) {
        // Fix: attach HTTP status code to the thrown error for callers to inspect
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const error = new Error(err.error || "Request failed") as Error & {
            status: number;
        };
        error.status = res.status;
        throw error;
    }

    return res.json();
}

export const api = {
    auth: {
        me: () => request<AuthStatus>("/auth/me", undefined, ""),
        logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }, ""),
    },
    shows: {
        // Task 4.2: Accept optional limit/offset pagination params
        // Fix: use URLSearchParams so filter/q values are always properly URL-encoded
        progress: (filter = "watching", q = "", limit = 50, offset = 0) => {
            const params = new URLSearchParams({
                filter,
                q,
                limit: String(limit),
                offset: String(offset),
            });
            return request<PaginatedResponse<ShowProgress>>(`/shows/progress?${params}`);
        },
        detail: (id: number) => request<ApiResponse<ShowProgress>>(`/shows/${id}`),
        history: (showId: number) =>
            request<ApiResponse<WatchHistoryEntry[]>>(`/shows/${showId}/history`),
        deleteHistory: (showId: number, historyId: number) =>
            request<{ ok: boolean }>(`/shows/${showId}/history/${historyId}`, {
                method: "DELETE",
            }),
        reset: (showId: number) =>
            request<ApiResponse<ShowProgress>>(`/shows/${showId}/reset`, {
                method: "POST",
            }),
        markSeasonWatched: (showId: number, season: number, watchedAt?: string | null) =>
            request<{ ok: boolean; marked: number; alreadyWatched: number }>(
                `/shows/${showId}/seasons/${season}/mark-watched`,
                {
                    method: "POST",
                    body: JSON.stringify({ watchedAt: watchedAt ?? null }),
                },
            ),
        forceSync: (showId: number) =>
            request<{ ok: boolean }>(`/shows/${showId}/force-sync`, {
                method: "POST",
            }),
        upNext: () => request<ApiResponse<UpNextItem[]>>("/shows/up-next"),
    },
    episodes: {
        detail: (showId: number, season: number, episode: number) =>
            request<ApiResponse<EpisodeDetailData>>(
                `/shows/${showId}/episodes/${season}/${episode}`,
            ),
        watch: (showId: number, season: number, episode: number, watchedAt: string | null) =>
            request<{ ok: boolean; historyId: number }>(
                `/shows/${showId}/episodes/${season}/${episode}/watch`,
                { method: "POST", body: JSON.stringify({ watchedAt }) },
            ),
        history: (showId: number, season: number, episode: number) =>
            request<ApiResponse<WatchHistoryEntry[]>>(
                `/shows/${showId}/episodes/${season}/${episode}/history`,
            ),
    },
    sync: {
        status: () => request<ApiResponse<SyncState>>("/sync/status"),
        debug: () => request<ApiResponse<SyncDebugState>>("/sync/debug"),
        trigger: () => request<{ ok: boolean }>("/sync/trigger", { method: "POST" }),
        full: () => request<{ ok: boolean }>("/sync/full", { method: "POST" }),
    },
    stats: {
        overview: () => request<ApiResponse<StatsOverview>>("/stats/overview"),
        screenTime: (days = 7) =>
            request<ApiResponse<ScreenTimeData>>(`/stats/screen-time?days=${days}`),
    },
    settings: {
        get: () => request<ApiResponse<UserSettings>>("/settings"),
        update: (body: Partial<Omit<UserSettings, "userId">>) =>
            request<ApiResponse<UserSettings>>("/settings", {
                method: "PUT",
                body: JSON.stringify(body),
            }),
    },
    trakt: {
        watching: () => request<ApiResponse<NowPlayingEpisode | null>>("/trakt/watching"),
        stats: () => request<ApiResponse<TraktOfficialStats>>("/trakt/stats"),
        profile: () =>
            request<{
                vip: boolean;
                vip_ep: boolean;
                vip_years: number;
                limits: {
                    collection: { item_count: number };
                    list: { count: number; item_count: number };
                };
            }>("/trakt/profile"),
    },
    calendar: {
        list: (before = 14, after = 30) => {
            const params = new URLSearchParams({
                before: String(before),
                after: String(after),
            });
            return request<ApiResponse<Record<string, CalendarEpisode[]>>>(`/calendar?${params}`);
        },
    },
    movies: {
        progress: (filter = "watched", q = "", limit = 50, offset = 0) => {
            const params = new URLSearchParams({
                filter,
                q,
                limit: String(limit),
                offset: String(offset),
            });
            return request<PaginatedResponse<MovieProgress>>(`/movies/progress?${params}`);
        },
        detail: (id: number) => request<ApiResponse<MovieProgress>>(`/movies/${id}`),
        history: (id: number) =>
            request<ApiResponse<MovieWatchHistoryEntry[]>>(`/movies/${id}/history`),
        watch: (id: number, watchedAt: string | null) =>
            request<{ ok: boolean; historyId: number }>(`/movies/${id}/watch`, {
                method: "POST",
                body: JSON.stringify({ watchedAt }),
            }),
        deleteHistory: (id: number, historyId: number) =>
            request<{ ok: boolean }>(`/movies/${id}/history/${historyId}`, {
                method: "DELETE",
            }),
    },
    history: {
        list: (
            mediaType: "all" | "episode" | "movie" = "all",
            startDate?: string,
            endDate?: string,
            limit = 50,
            offset = 0,
        ) => {
            const params = new URLSearchParams({
                mediaType,
                limit: String(limit),
                offset: String(offset),
            });
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            return request<ApiResponse<HistoryPage>>(`/history?${params}`);
        },
        export: (
            mediaType: "all" | "episode" | "movie" = "all",
            format: "csv" | "json" = "csv",
            startDate?: string,
            endDate?: string,
        ) => {
            const params = new URLSearchParams({ mediaType, format });
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            return `/api/history/export?${params}`;
        },
        import: (entries: unknown[]) =>
            request<{ ok: boolean; imported: number; skipped: number; errors: string[] }>(
                "/history/import",
                { method: "POST", body: JSON.stringify(entries) },
            ),
    },
    watchlist: {
        list: (type?: "shows" | "movies") => {
            const params = type ? `?type=${type}` : "";
            return request<ApiResponse<WatchlistItemWithMedia[]>>(`/watchlist${params}`);
        },
        add: (type: "show" | "movie", id: number, notes?: string) =>
            request<ApiResponse<WatchlistItem>>("/watchlist", {
                method: "POST",
                body: JSON.stringify({ type, id, notes }),
            }),
        remove: (id: number) =>
            request<{ ok: boolean }>(`/watchlist/${id}`, {
                method: "DELETE",
            }),
    },
    notifications: {
        vapidPublicKey: () =>
            request<ApiResponse<{ publicKey: string }>>("/notifications/vapid-public-key"),
        subscribe: (subscription: PushSubscriptionJSON) =>
            request<{ ok: boolean }>("/notifications/subscribe", {
                method: "POST",
                body: JSON.stringify(subscription),
            }),
        unsubscribe: (endpoint: string) =>
            request<{ ok: boolean }>("/notifications/unsubscribe", {
                method: "POST",
                body: JSON.stringify({ endpoint }),
            }),
    },
    ratings: {
        list: (type: "show" | "movie" | "all" = "all") =>
            request<ApiResponse<UserRating[]>>(`/ratings?type=${type}`),
        set: (type: "show" | "movie", localId: number, rating: number) =>
            request<{ ok: boolean; rating: number }>("/ratings", {
                method: "PUT",
                body: JSON.stringify({ type, localId, rating }),
            }),
        remove: (type: "show" | "movie", localId: number) =>
            request<{ ok: boolean }>("/ratings", {
                method: "DELETE",
                body: JSON.stringify({ type, localId }),
            }),
    },
    search: {
        query: (q: string, type: "show" | "movie" | "all" = "all", limit = 8) => {
            const params = new URLSearchParams({ q, type, limit: String(limit) });
            return request<ApiResponse<SearchResult[]>>(`/search?${params}`);
        },
        watchlistAdd: (type: "show" | "movie", traktId: number, tmdbId?: number) =>
            request<{ ok: boolean }>("/search/watchlist-add", {
                method: "POST",
                body: JSON.stringify({ type, traktId, ...(tmdbId ? { tmdbId } : {}) }),
            }),
    },
    jellyfin: {
        libraries: () => request<ApiResponse<JellyfinLibrary[]>>("/jellyfin/libraries"),
        testLibraries: (url: string, apiKey: string) =>
            request<ApiResponse<JellyfinLibrary[]>>("/jellyfin/libraries", {
                method: "POST",
                body: JSON.stringify({ url, apiKey }),
            }),
        episode: (showTmdbId: number, season: number, episode: number) =>
            request<ApiResponse<JellyfinEpisode | null>>(
                `/jellyfin/episode/${showTmdbId}/${season}/${episode}`,
            ),
        movie: (movieTmdbId: number) =>
            request<ApiResponse<JellyfinMovie | null>>(`/jellyfin/movie/${movieTmdbId}`),
        seasonEpisodes: (showTmdbId: number, season: number) =>
            request<ApiResponse<JellyfinEpisode[]>>(
                `/jellyfin/show/${showTmdbId}/season/${season}`,
            ),
        deleteSeasonEpisodes: (showTmdbId: number, season: number) =>
            request<{ ok: boolean; deleted: number }>(
                `/jellyfin/show/${showTmdbId}/season/${season}`,
                {
                    method: "DELETE",
                },
            ),
        deleteItem: (jellyfinItemId: string) =>
            request<{ ok: boolean }>(`/jellyfin/items/${jellyfinItemId}`, {
                method: "DELETE",
            }),
        nowPlaying: () => request<ApiResponse<JellyfinNowPlaying | null>>("/jellyfin/now-playing"),
        statsOverview: () =>
            request<ApiResponse<JellyfinLibrarySummary>>("/jellyfin/stats/overview"),
        statsActivity: (limit = 50) =>
            request<ApiResponse<JellyfinActivityEntry[]>>(
                `/jellyfin/stats/activity?limit=${limit}`,
            ),
        statsTopContent: () =>
            request<ApiResponse<JellyfinStatsTopContent>>("/jellyfin/stats/top-content"),
        statsHeatmap: () => request<ApiResponse<JellyfinHeatmapCell[]>>("/jellyfin/stats/heatmap"),
        deleteQueue: () =>
            request<ApiResponse<JellyfinDeleteQueueEntry[]>>("/jellyfin/delete-queue"),
        cancelDeleteQueue: (id: number) =>
            request<{ ok: boolean }>(`/jellyfin/delete-queue/${id}`, { method: "DELETE" }),
        deleteHistory: (limit = 20) =>
            request<ApiResponse<JellyfinDeleteHistoryEntry[]>>(
                `/jellyfin/delete-history?limit=${limit}`,
            ),
    },
    discover: {
        list: (mediaType: "show" | "movie", tab: "trending" | "popular", limit = 20) =>
            request<ApiResponse<DiscoverItem[]>>(
                `/discover?mediaType=${mediaType}&tab=${tab}&limit=${limit}`,
            ),
    },
    notes: {
        get: (params: {
            mediaType: "episode" | "show" | "movie";
            showId?: number;
            movieId?: number;
            season?: number;
            episode?: number;
        }) => {
            const p = new URLSearchParams({ mediaType: params.mediaType });
            if (params.showId != null) p.set("showId", String(params.showId));
            if (params.movieId != null) p.set("movieId", String(params.movieId));
            if (params.season != null) p.set("season", String(params.season));
            if (params.episode != null) p.set("episode", String(params.episode));
            return request<ApiResponse<UserNote | null>>(`/notes?${p}`);
        },
        upsert: (body: {
            mediaType: "episode" | "show" | "movie";
            showId?: number | null;
            movieId?: number | null;
            season?: number | null;
            episode?: number | null;
            content: string;
        }) =>
            request<ApiResponse<UserNote>>("/notes", {
                method: "PUT",
                body: JSON.stringify(body),
            }),
        delete: (id: number) => request<{ ok: boolean }>(`/notes/${id}`, { method: "DELETE" }),
    },
    lists: {
        getAll: () => request<ApiResponse<UserList[]>>("/lists"),
        create: (body: { name: string; description?: string; privacy?: string }) =>
            request<ApiResponse<UserList>>("/lists", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        update: (id: number, body: { name?: string; description?: string; privacy?: string }) =>
            request<ApiResponse<UserList>>(`/lists/${id}`, {
                method: "PUT",
                body: JSON.stringify(body),
            }),
        delete: (id: number) => request<{ ok: boolean }>(`/lists/${id}`, { method: "DELETE" }),
        getItems: (listId: number) =>
            request<ApiResponse<UserListItem[]>>(`/lists/${listId}/items`),
        addItem: (
            listId: number,
            body: { mediaType: "show" | "movie"; localId: number; notes?: string },
        ) =>
            request<ApiResponse<{ id: number }>>(`/lists/${listId}/items`, {
                method: "POST",
                body: JSON.stringify(body),
            }),
        removeItem: (listId: number, itemId: number) =>
            request<{ ok: boolean }>(`/lists/${listId}/items/${itemId}`, { method: "DELETE" }),
        sync: () => request<{ ok: boolean; synced: number }>("/lists/sync", { method: "POST" }),
    },
    collection: {
        getAll: (type: "all" | "show" | "movie" = "all") =>
            request<ApiResponse<UserCollectionItem[]>>(`/collection?type=${type}`),
        check: (params: { showId?: number; movieId?: number }) => {
            const p = new URLSearchParams();
            if (params.showId) p.set("showId", String(params.showId));
            if (params.movieId) p.set("movieId", String(params.movieId));
            return request<{ inCollection: boolean }>(`/collection/check?${p}`);
        },
        sync: () =>
            request<{ ok: boolean; synced: number }>("/collection/sync", { method: "POST" }),
        clearRemote: () =>
            request<ApiResponse<{ removed: number }>>("/collection/clear-remote", {
                method: "POST",
                body: JSON.stringify({ confirm: true }),
            }),
        remove: (id: number) => request<{ ok: boolean }>(`/collection/${id}`, { method: "DELETE" }),
        getShowEpisodes: (showId: number) =>
            request<{ data: CollectionShowEpisodes }>(`/collection/shows/${showId}/episodes`),
        capacity: () =>
            request<
                ApiResponse<{
                    used: number;
                    limit: number;
                    pct: number;
                    nearLimit: boolean;
                    limitIsDefault?: boolean;
                }>
            >("/collection/capacity"),
        pruneRemote: (targetPct = 80) =>
            request<
                ApiResponse<{
                    freed: number;
                    currentCount: number;
                    targetCount: number;
                    partialError?: string;
                }>
            >("/collection/prune-remote", {
                method: "POST",
                body: JSON.stringify({ confirm: true, targetPct }),
            }),
    },
    backup: {
        gdriveStartAuth: () =>
            request<{ ok: boolean; data: DeviceAuthInfo }>("/backup/gdrive/auth", {
                method: "POST",
            }),
        gdrivePoll: (device_code: string) =>
            request<{ ok: boolean; connected?: boolean; pending?: boolean }>(
                "/backup/gdrive/poll",
                {
                    method: "POST",
                    body: JSON.stringify({ device_code }),
                },
            ),
        gdriveRevoke: () => request<{ ok: boolean }>("/backup/gdrive/revoke", { method: "DELETE" }),
        gdriveStatus: () => request<{ connected: boolean }>("/backup/gdrive/status"),

        onedriveStartAuth: () =>
            request<{ ok: boolean; data: DeviceAuthInfo }>("/backup/onedrive/auth", {
                method: "POST",
            }),
        onedrivePoll: (device_code: string) =>
            request<{ ok: boolean; connected?: boolean; pending?: boolean }>(
                "/backup/onedrive/poll",
                {
                    method: "POST",
                    body: JSON.stringify({ device_code }),
                },
            ),
        onedriveRevoke: () =>
            request<{ ok: boolean }>("/backup/onedrive/revoke", { method: "DELETE" }),
        onedriveStatus: () => request<{ connected: boolean }>("/backup/onedrive/status"),

        webdavSave: (cfg: { url: string; username: string; password: string }) =>
            request<{ ok: boolean }>("/backup/webdav", {
                method: "PUT",
                body: JSON.stringify(cfg),
            }),
        webdavClear: () =>
            request<{ ok: boolean }>("/backup/webdav", { method: "PUT", body: JSON.stringify({}) }),
        webdavStatus: () =>
            request<{ connected: boolean; url: string | null }>("/backup/webdav/status"),

        s3Save: (cfg: {
            endpoint: string;
            region: string;
            bucket: string;
            accessKeyId: string;
            secretAccessKey: string;
        }) => request<{ ok: boolean }>("/backup/s3", { method: "PUT", body: JSON.stringify(cfg) }),
        s3Clear: () =>
            request<{ ok: boolean }>("/backup/s3", { method: "PUT", body: JSON.stringify({}) }),
        s3Status: () =>
            request<{ connected: boolean; endpoint: string | null; bucket: string | null }>(
                "/backup/s3/status",
            ),

        saveSettings: (s: {
            autoEnabled?: boolean;
            retentionDays?: number;
            scheduleHours?: number;
            activeProvider?: string | null;
        }) =>
            request<{ ok: boolean }>("/backup/settings", {
                method: "PUT",
                body: JSON.stringify(s),
            }),
        getSettings: () =>
            request<{
                scheduleHours: number;
                activeProvider: string | null;
                retentionDays: number;
                autoEnabled: boolean;
            }>("/backup/settings"),

        trigger: (provider: "gdrive" | "webdav" | "onedrive" | "s3" | "all" = "all") =>
            request<{
                ok: boolean;
                results: Array<{
                    provider: string;
                    ok: boolean;
                    error?: string;
                    filename?: string;
                }>;
            }>("/backup/trigger", { method: "POST", body: JSON.stringify({ provider }) }),
        runs: (limit = 20) => request<{ data: BackupRun[] }>(`/backup/runs?limit=${limit}`),
        files: (provider?: "gdrive" | "webdav" | "onedrive" | "s3") =>
            request<{ data: BackupFile[] }>(
                `/backup/files${provider ? `?provider=${provider}` : ""}`,
            ),
        deleteFile: (provider: "gdrive" | "webdav" | "onedrive" | "s3", fileId: string) =>
            request<{ ok: boolean }>("/backup/files", {
                method: "DELETE",
                body: JSON.stringify({ provider, fileId }),
            }),
    },
    system: {
        metrics: () =>
            request<{
                data: {
                    process: {
                        heapUsed: number;
                        heapTotal: number;
                        rss: number;
                        uptimeSeconds: number;
                        nodeVersion: string;
                        platform: string;
                    };
                    system: {
                        totalMem: number;
                        freeMem: number;
                        usedMem: number;
                        memPct: number;
                        loadAvg1: number;
                        cpuCount: number;
                    };
                };
            }>("/system/metrics"),
    },
};
