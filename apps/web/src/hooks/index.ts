// Task 9.3: Update hooks with concrete return types
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthStatus, ShowProgress, SyncState, SyncDebugState, StatsOverview, UserSettings, NowPlayingEpisode, EpisodeDetailData, WatchHistoryEntry } from '@trakt-dashboard/types'
import { api } from '../lib/api'

export function useAuth() {
  return useQuery<AuthStatus>({
    queryKey: ['auth'],
    queryFn: api.auth.me,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      qc.setQueryData<AuthStatus>(['auth'], { authenticated: false, user: null })
      qc.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useSyncStatus() {
  return useQuery<SyncState>({
    queryKey: ['sync-status'],
    queryFn: () => api.sync.status().then(r => r.data),
    refetchInterval: (q) => {
      const status = q.state.data?.status
      return status === 'running' ? 1500 : 30000
    },
  })
}

export function useTriggerSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.sync.trigger,
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sync-status'] }), 500)
    },
  })
}

export function useTriggerFullSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.sync.full,
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['sync-status'] }), 500)
    },
  })
}

export function useSyncDebug(enabled: boolean) {
  return useQuery<SyncDebugState>({
    queryKey: ['sync-debug'],
    queryFn: () => api.sync.debug().then(r => r.data),
    enabled,
    refetchInterval: enabled ? 2000 : false,
  })
}

// Task 4.3: Accept pagination params, include in queryKey
export function useShowsProgress(filter: string, search: string, limit = 50, offset = 0) {
  return useQuery<ShowProgress[]>({
    queryKey: ['shows-progress', filter, search, limit, offset],
    queryFn: () => api.shows.progress(filter, search, limit, offset).then(r => r.data),
    staleTime: 1000 * 60,
  })
}

export function useShowDetail(id: number) {
  return useQuery<ShowProgress>({
    queryKey: ['show-detail', id],
    queryFn: () => api.shows.detail(id).then(r => r.data),
    enabled: id > 0,
  })
}

export function useStats() {
  return useQuery<StatsOverview>({
    queryKey: ['stats'],
    queryFn: () => api.stats.overview().then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
}

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: () => api.settings.get().then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Omit<UserSettings, 'userId'>>) => api.settings.update(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useNowPlaying(): {
  data: NowPlayingEpisode | null
  isWatching: boolean
  isLoading: boolean
  error: Error | null
} {
  const query = useQuery<NowPlayingEpisode | null, Error>({
    queryKey: ['now-playing'],
    queryFn: () => api.trakt.watching().then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 25_000,
    // Retain last successful data on error (React Query default behaviour with placeholderData)
    placeholderData: (prev) => prev,
  })

  return {
    data: query.data ?? null,
    isWatching: query.data != null,
    isLoading: query.isLoading,
    error: query.error,
  }
}

// ─── Episode Detail Hooks ─────────────────────────────────────────────────────

export function useEpisodeDetail(showId: number, season: number, episode: number) {
  return useQuery<EpisodeDetailData>({
    queryKey: ['episode-detail', showId, season, episode],
    queryFn: () => api.episodes.detail(showId, season, episode).then(r => r.data),
    enabled: showId > 0 && season >= 0 && episode > 0,
    staleTime: 1000 * 60 * 5,
  })
}

export function useMarkWatched(showId: number, season: number, episode: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (watchedAt: string | null) =>
      api.episodes.watch(showId, season, episode, watchedAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['episode-detail', showId, season, episode] })
      qc.invalidateQueries({ queryKey: ['show-detail', showId] })
    },
  })
}

export function useEpisodeHistory(showId: number, season: number, episode: number) {
  return useQuery<WatchHistoryEntry[]>({
    queryKey: ['episode-history', showId, season, episode],
    queryFn: () => api.episodes.history(showId, season, episode).then(r => r.data),
    enabled: showId > 0 && season >= 0 && episode > 0,
  })
}

export function useShowHistory(showId: number) {
  return useQuery<WatchHistoryEntry[]>({
    queryKey: ['show-history', showId],
    queryFn: () => api.shows.history(showId).then(r => r.data),
    enabled: showId > 0,
  })
}

export function useDeleteHistory(showId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (historyId: number) => api.shows.deleteHistory(showId, historyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['episode-history'] })
      qc.invalidateQueries({ queryKey: ['show-history', showId] })
      qc.invalidateQueries({ queryKey: ['episode-detail'] })
      qc.invalidateQueries({ queryKey: ['show-detail', showId] })
    },
  })
}

export function useResetProgress(showId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.shows.reset(showId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['show-detail', showId] })
      qc.invalidateQueries({ queryKey: ['shows-progress'] })
    },
  })
}
