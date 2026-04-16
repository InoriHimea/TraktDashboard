import type { AuthStatus, ShowProgress, SyncState, SyncDebugState, StatsOverview, PaginatedResponse, ApiResponse, UserSettings, NowPlayingEpisode, EpisodeDetailData, WatchHistoryEntry } from "@trakt-dashboard/types";
export declare const api: {
    auth: {
        me: () => Promise<AuthStatus>;
        logout: () => Promise<{
            ok: boolean;
        }>;
    };
    shows: {
        progress: (filter?: string, q?: string, limit?: number, offset?: number) => Promise<PaginatedResponse<ShowProgress>>;
        detail: (id: number) => Promise<ApiResponse<ShowProgress>>;
        history: (showId: number) => Promise<ApiResponse<WatchHistoryEntry[]>>;
        deleteHistory: (showId: number, historyId: number) => Promise<{
            ok: boolean;
        }>;
        reset: (showId: number) => Promise<ApiResponse<ShowProgress>>;
    };
    episodes: {
        detail: (showId: number, season: number, episode: number) => Promise<ApiResponse<EpisodeDetailData>>;
        watch: (showId: number, season: number, episode: number, watchedAt: string | null) => Promise<{
            ok: boolean;
            historyId: number;
        }>;
        history: (showId: number, season: number, episode: number) => Promise<ApiResponse<WatchHistoryEntry[]>>;
    };
    sync: {
        status: () => Promise<ApiResponse<SyncState>>;
        debug: () => Promise<ApiResponse<SyncDebugState>>;
        trigger: () => Promise<{
            ok: boolean;
        }>;
        full: () => Promise<{
            ok: boolean;
        }>;
    };
    stats: {
        overview: () => Promise<ApiResponse<StatsOverview>>;
    };
    settings: {
        get: () => Promise<ApiResponse<UserSettings>>;
        update: (body: Partial<Omit<UserSettings, "userId">>) => Promise<ApiResponse<UserSettings>>;
    };
    trakt: {
        watching: () => Promise<ApiResponse<NowPlayingEpisode | null>>;
    };
};
//# sourceMappingURL=api.d.ts.map