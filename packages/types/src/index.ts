// ─── Show ────────────────────────────────────────────────────────────────────

export type ShowStatus = 'returning series' | 'ended' | 'canceled' | 'in production' | 'planned' | 'pilot' | 'unknown'

export interface Show {
  id: number
  tmdbId: number
  tvdbId: number | null
  imdbId: string | null
  traktId: number | null
  traktSlug: string | null
  title: string
  overview: string | null
  status: ShowStatus
  firstAired: string | null
  network: string | null
  genres: string[]
  posterPath: string | null
  backdropPath: string | null
  totalEpisodes: number
  totalSeasons: number
  lastSyncedAt: string
  createdAt: string
}

// ─── Season ──────────────────────────────────────────────────────────────────

export interface Season {
  id: number
  showId: number
  seasonNumber: number
  episodeCount: number
  airDate: string | null
  overview: string | null
  posterPath: string | null
}

// ─── Episode ─────────────────────────────────────────────────────────────────

export interface Episode {
  id: number
  showId: number
  seasonId: number | null
  seasonNumber: number
  episodeNumber: number
  title: string | null
  overview: string | null
  runtime: number | null
  airDate: string | null
  stillPath: string | null
  traktId: number | null
  tmdbId: number | null
}

// ─── Watch History ────────────────────────────────────────────────────────────

export interface WatchHistory {
  id: number
  userId: number
  episodeId: number
  watchedAt: string
  traktPlayId: string | null
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface EpisodeProgress {
  episodeId: number
  seasonNumber: number
  episodeNumber: number
  title: string | null
  airDate: string | null
  watched: boolean
  watchedAt: string | null
  aired: boolean
}

export interface SeasonProgress {
  seasonNumber: number
  episodeCount: number
  watchedCount: number
  airedCount: number
  episodes: EpisodeProgress[]
}

export interface ShowProgress {
  show: Show
  airedEpisodes: number
  watchedEpisodes: number
  nextEpisode: Episode | null
  lastWatchedAt: string | null
  completed: boolean
  percentage: number
  seasons: SeasonProgress[]
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'running' | 'completed' | 'error'

export interface FailedShowSyncItem {
  tmdbId: number
  title: string
  error: string
  retryCount?: number
  alert?: boolean
  lastTriedAt?: string
}

export interface SyncState {
  status: SyncStatus
  lastSyncAt: string | null
  currentShow: string | null
  currentIndex?: number | null
  progress: number
  total: number
  error: string | null
  failedShows: FailedShowSyncItem[]
  successCount?: number
  failedCount?: number
  alerts?: FailedShowSyncItem[]
  alertCount?: number
}

export interface SyncDebugState {
  syncStatus: SyncStatus
  currentShow: string | null
  progress: number
  total: number
  failedCount: number
  dbCounts: {
    shows: number
    watchHistory: number
    userShowProgress: number
  }
  updatedAt: string | null
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface StatsOverview {
  totalEpisodesWatched: number
  totalShowsWatched: number
  totalShowsCompleted: number
  totalRuntimeMinutes: number
  monthlyActivity: Array<{ month: string; count: number }>
  topGenres: Array<{ name: string; count: number }>
  recentlyWatched: Array<{
    showId: number
    showTitle: string
    posterPath: string | null
    episodeTitle: string | null
    seasonNumber: number
    episodeNumber: number
    watchedAt: string
  }>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  traktUsername: string | null
  traktAccessToken: string
  traktRefreshToken: string
  tokenExpiresAt: string
  createdAt: string
}

export interface AuthStatus {
  authenticated: boolean
  user: Pick<User, 'id' | 'traktUsername'> | null
}
