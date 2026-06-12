// Task 9.3: Update hooks with concrete return types
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import type {
    AuthStatus,
    ShowProgress,
    SyncState,
    SyncDebugState,
    StatsOverview,
    UserSettings,
    NowPlayingEpisode,
    EpisodeDetailData,
    WatchHistoryEntry,
    MovieProgress,
    MovieWatchHistoryEntry,
    CalendarEpisode,
    HistoryPage,
} from "@trakt-dashboard/types";
import { api } from "../lib/api";

export function useAuth() {
    return useQuery<AuthStatus>({
        queryKey: queryKeys.auth,
        queryFn: api.auth.me,
        staleTime: 1000 * 60 * 5,
    });
}

export function useLogout() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.auth.logout,
        onSuccess: () => {
            // Set auth to false immediately (no invalidate to avoid race condition)
            qc.setQueryData<AuthStatus>(queryKeys.auth, {
                authenticated: false,
                user: null,
            });
            // Clear related query data
            qc.removeQueries({ queryKey: queryKeys.showsProgress.all });
            qc.removeQueries({ queryKey: queryKeys.stats });
        },
    });
}

export function useSyncStatus() {
    return useQuery<SyncState>({
        queryKey: queryKeys.syncStatus,
        queryFn: () => api.sync.status().then((r) => r.data),
        refetchInterval: (q) => {
            const status = q.state.data?.status;
            return status === "running" ? 1500 : 30000;
        },
    });
}

export function useTriggerSync() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.sync.trigger,
        onSuccess: () => {
            // Invalidate immediately; useSyncStatus has its own refetchInterval for polling
            qc.invalidateQueries({ queryKey: queryKeys.syncStatus });
        },
    });
}

export function useTriggerFullSync() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.sync.full,
        onSuccess: () => {
            // Invalidate immediately; useSyncStatus has its own refetchInterval for polling
            qc.invalidateQueries({ queryKey: queryKeys.syncStatus });
        },
    });
}

export function useSyncDebug(enabled: boolean) {
    return useQuery<SyncDebugState>({
        queryKey: queryKeys.syncDebug,
        queryFn: () => api.sync.debug().then((r) => r.data),
        enabled,
        refetchInterval: enabled ? 2000 : false,
    });
}

// Task 4.3: Accept pagination params, include in queryKey
export function useShowsProgress(filter: string, search: string, limit = 50, offset = 0) {
    return useQuery<ShowProgress[]>({
        queryKey: queryKeys.showsProgress.list(filter, search, limit, offset),
        queryFn: () => api.shows.progress(filter, search, limit, offset).then((r) => r.data),
        staleTime: 1000 * 60,
    });
}

export function useShowDetail(id: number) {
    return useQuery<ShowProgress>({
        queryKey: queryKeys.showDetail(id),
        queryFn: () => api.shows.detail(id).then((r) => r.data),
        enabled: id > 0,
    });
}

export function useForceSync(showId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => api.shows.forceSync(showId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.showDetail(showId) });
            qc.invalidateQueries({ queryKey: queryKeys.showsProgress.all });
            qc.invalidateQueries({ queryKey: queryKeys.syncStatus });
        },
    });
}

export function useStats() {
    return useQuery<StatsOverview>({
        queryKey: queryKeys.stats,
        queryFn: () => api.stats.overview().then((r) => r.data),
        staleTime: 1000 * 60 * 5,
    });
}

export function useCalendar(before = 14, after = 30) {
    return useQuery<Record<string, CalendarEpisode[]>>({
        queryKey: queryKeys.calendar(before, after),
        queryFn: () => api.calendar.list(before, after).then((r) => r.data),
        staleTime: 1000 * 60 * 5,
    });
}

export function useSettings() {
    return useQuery<UserSettings>({
        queryKey: queryKeys.settings,
        queryFn: () => api.settings.get().then((r) => r.data),
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpdateSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<Omit<UserSettings, "userId">>) => api.settings.update(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }),
    });
}

export function useNowPlaying(): {
    data: NowPlayingEpisode | null;
    isWatching: boolean;
    isLoading: boolean;
    error: Error | null;
} {
    const query = useQuery<NowPlayingEpisode | null, Error>({
        queryKey: queryKeys.nowPlaying,
        queryFn: () => api.trakt.watching().then((r) => r.data),
        refetchInterval: 30_000,
        staleTime: 25_000,
        // Retain last successful data on error (React Query default behaviour with placeholderData)
        placeholderData: (prev) => prev,
    });

    return {
        data: query.data ?? null,
        isWatching: query.data != null,
        isLoading: query.isLoading,
        error: query.error,
    };
}

// ─── Episode Detail Hooks ─────────────────────────────────────────────────────

export function useEpisodeDetail(showId: number, season: number, episode: number) {
    return useQuery<EpisodeDetailData>({
        queryKey: queryKeys.episodeDetail.byEp(showId, season, episode),
        queryFn: () => api.episodes.detail(showId, season, episode).then((r) => r.data),
        enabled: showId > 0 && season >= 0 && episode > 0,
        staleTime: 1000 * 60 * 5,
    });
}

export function useMarkWatched(showId: number, season: number, episode: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (watchedAt: string | null) =>
            api.episodes.watch(showId, season, episode, watchedAt),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: queryKeys.episodeDetail.byEp(showId, season, episode),
            });
            qc.invalidateQueries({ queryKey: queryKeys.showDetail(showId) });
        },
    });
}

export function useEpisodeHistory(showId: number, season: number, episode: number) {
    return useQuery<WatchHistoryEntry[]>({
        queryKey: queryKeys.episodeHistory.byEp(showId, season, episode),
        queryFn: () => api.episodes.history(showId, season, episode).then((r) => r.data),
        enabled: showId > 0 && season >= 0 && episode > 0,
    });
}

export function useShowHistory(showId: number) {
    return useQuery<WatchHistoryEntry[]>({
        queryKey: queryKeys.showHistory(showId),
        queryFn: () => api.shows.history(showId).then((r) => r.data),
        enabled: showId > 0,
    });
}

export function useDeleteHistory(showId: number, season?: number, episode?: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (historyId: number) => api.shows.deleteHistory(showId, historyId),
        onSuccess: () => {
            // Narrow invalidation scope: only invalidate queries related to the affected show/episode
            if (season !== undefined && episode !== undefined) {
                qc.invalidateQueries({
                    queryKey: queryKeys.episodeHistory.byEp(showId, season, episode),
                });
                qc.invalidateQueries({
                    queryKey: queryKeys.episodeDetail.byEp(showId, season, episode),
                });
            } else {
                // If no specific episode, invalidate all episode-related queries for this show
                qc.invalidateQueries({ queryKey: queryKeys.episodeHistory.all });
                qc.invalidateQueries({ queryKey: queryKeys.episodeDetail.all });
            }
            // Always invalidate show-level queries
            qc.invalidateQueries({ queryKey: queryKeys.showHistory(showId) });
            qc.invalidateQueries({ queryKey: queryKeys.showDetail(showId) });
        },
    });
}

export function useResetProgress(showId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => api.shows.reset(showId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.showDetail(showId) });
            qc.invalidateQueries({ queryKey: queryKeys.showsProgress.all });
        },
    });
}

// ─── Movie Hooks ──────────────────────────────────────────────────────────────

export function useMoviesProgress(filter: string, search: string, limit = 50, offset = 0) {
    return useQuery<MovieProgress[]>({
        queryKey: queryKeys.moviesProgress.list(filter, search, limit, offset),
        queryFn: () => api.movies.progress(filter, search, limit, offset).then((r) => r.data),
        staleTime: 1000 * 60,
    });
}

export function useMovieDetail(id: number) {
    return useQuery<MovieProgress>({
        queryKey: queryKeys.movieDetail(id),
        queryFn: () => api.movies.detail(id).then((r) => r.data),
        enabled: id > 0,
    });
}

export function useMovieHistory(id: number) {
    return useQuery<MovieWatchHistoryEntry[]>({
        queryKey: queryKeys.movieHistory(id),
        queryFn: () => api.movies.history(id).then((r) => r.data),
        enabled: id > 0,
    });
}

export function useMarkMovieWatched(id: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (watchedAt: string | null) => api.movies.watch(id, watchedAt),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.movieDetail(id) });
            qc.invalidateQueries({ queryKey: queryKeys.movieHistory(id) });
            qc.invalidateQueries({ queryKey: queryKeys.moviesProgress.all });
        },
    });
}

export function useDeleteMovieHistory(id: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (historyId: number) => api.movies.deleteHistory(id, historyId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.movieHistory(id) });
            qc.invalidateQueries({ queryKey: queryKeys.movieDetail(id) });
            qc.invalidateQueries({ queryKey: queryKeys.moviesProgress.all });
        },
    });
}

export function useMarkSeasonWatched(showId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ season, watchedAt }: { season: number; watchedAt?: string | null }) =>
            api.shows.markSeasonWatched(showId, season, watchedAt),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.showDetail(showId) });
            qc.invalidateQueries({ queryKey: queryKeys.showsProgress.all });
        },
    });
}

// ─── History Hooks ────────────────────────────────────────────────────────────

export function useHistory(
    mediaType: "all" | "episode" | "movie" = "all",
    startDate?: string,
    endDate?: string,
    limit = 50,
    offset = 0,
) {
    return useQuery<HistoryPage>({
        queryKey: queryKeys.history.list(mediaType, startDate, endDate, limit, offset),
        queryFn: () =>
            api.history.list(mediaType, startDate, endDate, limit, offset).then((r) => r.data),
        staleTime: 1000 * 60,
    });
}

// ─── Watchlist Hooks ─────────────────────────────────────────────────────────
export function useWatchlist(type?: "shows" | "movies") {
    return useQuery({
        queryKey: queryKeys.watchlist.byType(type),
        queryFn: () => api.watchlist.list(type).then((r) => r.data),
        staleTime: 1000 * 60,
    });
}

export function useAddToWatchlist() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, id, notes }: { type: "show" | "movie"; id: number; notes?: string }) =>
            api.watchlist.add(type, id, notes),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.watchlist.all });
        },
    });
}

export function useRemoveFromWatchlist() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.watchlist.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.watchlist.all });
        },
    });
}
