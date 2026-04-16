import type { AuthStatus, ShowProgress, SyncState, SyncDebugState, StatsOverview, UserSettings, NowPlayingEpisode, EpisodeDetailData, WatchHistoryEntry } from "@trakt-dashboard/types";
export declare function useAuth(): import("@tanstack/react-query").UseQueryResult<AuthStatus, Error>;
export declare function useLogout(): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
}, Error, void, unknown>;
export declare function useSyncStatus(): import("@tanstack/react-query").UseQueryResult<SyncState, Error>;
export declare function useTriggerSync(): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
}, Error, void, unknown>;
export declare function useTriggerFullSync(): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
}, Error, void, unknown>;
export declare function useSyncDebug(enabled: boolean): import("@tanstack/react-query").UseQueryResult<SyncDebugState, Error>;
export declare function useShowsProgress(filter: string, search: string, limit?: number, offset?: number): import("@tanstack/react-query").UseQueryResult<ShowProgress[], Error>;
export declare function useShowDetail(id: number): import("@tanstack/react-query").UseQueryResult<ShowProgress, Error>;
export declare function useStats(): import("@tanstack/react-query").UseQueryResult<StatsOverview, Error>;
export declare function useSettings(): import("@tanstack/react-query").UseQueryResult<UserSettings, Error>;
export declare function useUpdateSettings(): import("@tanstack/react-query").UseMutationResult<import("@trakt-dashboard/types").ApiResponse<UserSettings>, Error, Partial<Omit<UserSettings, "userId">>, unknown>;
export declare function useNowPlaying(): {
    data: NowPlayingEpisode | null;
    isWatching: boolean;
    isLoading: boolean;
    error: Error | null;
};
export declare function useEpisodeDetail(showId: number, season: number, episode: number): import("@tanstack/react-query").UseQueryResult<EpisodeDetailData, Error>;
export declare function useMarkWatched(showId: number, season: number, episode: number): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
    historyId: number;
}, Error, string | null, unknown>;
export declare function useEpisodeHistory(showId: number, season: number, episode: number): import("@tanstack/react-query").UseQueryResult<WatchHistoryEntry[], Error>;
export declare function useShowHistory(showId: number): import("@tanstack/react-query").UseQueryResult<WatchHistoryEntry[], Error>;
export declare function useDeleteHistory(showId: number, season?: number, episode?: number): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
}, Error, number, unknown>;
export declare function useResetProgress(showId: number): import("@tanstack/react-query").UseMutationResult<import("@trakt-dashboard/types").ApiResponse<ShowProgress>, Error, void, unknown>;
//# sourceMappingURL=index.d.ts.map