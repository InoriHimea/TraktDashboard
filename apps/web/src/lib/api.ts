// Task 9.2: Replace all `any` with concrete types from @trakt-dashboard/types
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
} from "@trakt-dashboard/types";

const API_BASE = "/api";

async function request<T>(
    path: string,
    options?: RequestInit,
    base = API_BASE,
): Promise<T> {
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
        logout: () =>
            request<{ ok: boolean }>("/auth/logout", { method: "POST" }, ""),
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
            return request<PaginatedResponse<ShowProgress>>(
                `/shows/progress?${params}`,
            );
        },
        detail: (id: number) =>
            request<ApiResponse<ShowProgress>>(`/shows/${id}`),
        history: (showId: number) =>
            request<ApiResponse<WatchHistoryEntry[]>>(
                `/shows/${showId}/history`,
            ),
        deleteHistory: (showId: number, historyId: number) =>
            request<{ ok: boolean }>(`/shows/${showId}/history/${historyId}`, {
                method: "DELETE",
            }),
        reset: (showId: number) =>
            request<ApiResponse<ShowProgress>>(`/shows/${showId}/reset`, {
                method: "POST",
            }),
    },
    episodes: {
        detail: (showId: number, season: number, episode: number) =>
            request<ApiResponse<EpisodeDetailData>>(
                `/shows/${showId}/episodes/${season}/${episode}`,
            ),
        watch: (
            showId: number,
            season: number,
            episode: number,
            watchedAt: string | null,
        ) =>
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
        trigger: () =>
            request<{ ok: boolean }>("/sync/trigger", { method: "POST" }),
        full: () => request<{ ok: boolean }>("/sync/full", { method: "POST" }),
    },
    stats: {
        overview: () => request<ApiResponse<StatsOverview>>("/stats/overview"),
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
        watching: () =>
            request<ApiResponse<NowPlayingEpisode | null>>("/trakt/watching"),
    },
};
