// Task 9.3: Update hooks with concrete return types
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthStatus, ShowProgress, SyncState, SyncDebugState, StatsOverview, UserSettings, NowPlayingEpisode } from '@trakt-dashboard/types'
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
