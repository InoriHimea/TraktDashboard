// Task 9.2: Replace all `any` with concrete types from @trakt-dashboard/types
import type { AuthStatus, ShowProgress, SyncState, StatsOverview, PaginatedResponse, ApiResponse } from '@trakt-dashboard/types'

const BASE = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => apiFetch<AuthStatus>('/auth/me' as string),
    logout: () => apiFetch<{ ok: boolean }>('/auth/logout' as string, { method: 'POST' }),
  },
  shows: {
    // Task 4.2: Accept optional limit/offset pagination params
    progress: (filter = 'watching', q = '', limit = 50, offset = 0) =>
      apiFetch<PaginatedResponse<ShowProgress>>(
        `/shows/progress?filter=${filter}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`
      ),
    detail: (id: number) =>
      apiFetch<ApiResponse<ShowProgress>>(`/shows/${id}`),
  },
  sync: {
    status: () => apiFetch<ApiResponse<SyncState>>('/sync/status'),
    trigger: () => apiFetch<{ ok: boolean }>('/sync/trigger', { method: 'POST' }),
    full: () => apiFetch<{ ok: boolean }>('/sync/full', { method: 'POST' }),
  },
  stats: {
    overview: () => apiFetch<ApiResponse<StatsOverview>>('/stats/overview'),
  },
}
