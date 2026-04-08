// Task 9.3: Update hooks with concrete return types
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ShowProgress, SyncState, StatsOverview } from '@trakt-dashboard/types'
import { api } from '../lib/api'

export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: () => fetch('/auth/me', { credentials: 'include' }).then(r => r.json()),
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetch('/auth/logout', { method: 'POST', credentials: 'include' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth'] }),
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
