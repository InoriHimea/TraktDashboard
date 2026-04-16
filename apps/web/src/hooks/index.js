// Task 9.3: Update hooks with concrete return types
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
export function useAuth() {
    return useQuery({
        queryKey: ["auth"],
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
            qc.setQueryData(["auth"], {
                authenticated: false,
                user: null,
            });
            // Clear related query data
            qc.removeQueries({ queryKey: ["shows-progress"] });
            qc.removeQueries({ queryKey: ["stats"] });
        },
    });
}
export function useSyncStatus() {
    return useQuery({
        queryKey: ["sync-status"],
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
            qc.invalidateQueries({ queryKey: ["sync-status"] });
        },
    });
}
export function useTriggerFullSync() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.sync.full,
        onSuccess: () => {
            // Invalidate immediately; useSyncStatus has its own refetchInterval for polling
            qc.invalidateQueries({ queryKey: ["sync-status"] });
        },
    });
}
export function useSyncDebug(enabled) {
    return useQuery({
        queryKey: ["sync-debug"],
        queryFn: () => api.sync.debug().then((r) => r.data),
        enabled,
        refetchInterval: enabled ? 2000 : false,
    });
}
// Task 4.3: Accept pagination params, include in queryKey
export function useShowsProgress(filter, search, limit = 50, offset = 0) {
    return useQuery({
        queryKey: ["shows-progress", filter, search, limit, offset],
        queryFn: () => api.shows
            .progress(filter, search, limit, offset)
            .then((r) => r.data),
        staleTime: 1000 * 60,
    });
}
export function useShowDetail(id) {
    return useQuery({
        queryKey: ["show-detail", id],
        queryFn: () => api.shows.detail(id).then((r) => r.data),
        enabled: id > 0,
    });
}
export function useStats() {
    return useQuery({
        queryKey: ["stats"],
        queryFn: () => api.stats.overview().then((r) => r.data),
        staleTime: 1000 * 60 * 5,
    });
}
export function useSettings() {
    return useQuery({
        queryKey: ["settings"],
        queryFn: () => api.settings.get().then((r) => r.data),
        staleTime: 1000 * 60 * 5,
    });
}
export function useUpdateSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => api.settings.update(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    });
}
export function useNowPlaying() {
    const query = useQuery({
        queryKey: ["now-playing"],
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
export function useEpisodeDetail(showId, season, episode) {
    return useQuery({
        queryKey: ["episode-detail", showId, season, episode],
        queryFn: () => api.episodes.detail(showId, season, episode).then((r) => r.data),
        enabled: showId > 0 && season >= 0 && episode > 0,
        staleTime: 1000 * 60 * 5,
    });
}
export function useMarkWatched(showId, season, episode) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (watchedAt) => api.episodes.watch(showId, season, episode, watchedAt),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: ["episode-detail", showId, season, episode],
            });
            qc.invalidateQueries({ queryKey: ["show-detail", showId] });
        },
    });
}
export function useEpisodeHistory(showId, season, episode) {
    return useQuery({
        queryKey: ["episode-history", showId, season, episode],
        queryFn: () => api.episodes.history(showId, season, episode).then((r) => r.data),
        enabled: showId > 0 && season >= 0 && episode > 0,
    });
}
export function useShowHistory(showId) {
    return useQuery({
        queryKey: ["show-history", showId],
        queryFn: () => api.shows.history(showId).then((r) => r.data),
        enabled: showId > 0,
    });
}
export function useDeleteHistory(showId, season, episode) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (historyId) => api.shows.deleteHistory(showId, historyId),
        onSuccess: () => {
            // Narrow invalidation scope: only invalidate queries related to the affected show/episode
            if (season !== undefined && episode !== undefined) {
                qc.invalidateQueries({
                    queryKey: ["episode-history", showId, season, episode],
                });
                qc.invalidateQueries({
                    queryKey: ["episode-detail", showId, season, episode],
                });
            }
            else {
                // If no specific episode, invalidate all episode-related queries for this show
                qc.invalidateQueries({ queryKey: ["episode-history"] });
                qc.invalidateQueries({ queryKey: ["episode-detail"] });
            }
            // Always invalidate show-level queries
            qc.invalidateQueries({ queryKey: ["show-history", showId] });
            qc.invalidateQueries({ queryKey: ["show-detail", showId] });
        },
    });
}
export function useResetProgress(showId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => api.shows.reset(showId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["show-detail", showId] });
            qc.invalidateQueries({ queryKey: ["shows-progress"] });
        },
    });
}
//# sourceMappingURL=index.js.map