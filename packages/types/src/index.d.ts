export type ShowStatus = "returning series" | "ended" | "canceled" | "in production" | "planned" | "pilot" | "unknown";
export interface Show {
    id: number;
    tmdbId: number;
    tvdbId: number | null;
    imdbId: string | null;
    traktId: number | null;
    traktSlug: string | null;
    title: string;
    overview: string | null;
    status: ShowStatus;
    firstAired: string | null;
    network: string | null;
    genres: string[];
    posterPath: string | null;
    backdropPath: string | null;
    totalEpisodes: number;
    totalSeasons: number;
    lastSyncedAt: string;
    createdAt: string;
    originalName: string | null;
    translatedName: string | null;
    translatedOverview: string | null;
    displayLanguage: string | null;
}
export interface Season {
    id: number;
    showId: number;
    seasonNumber: number;
    episodeCount: number;
    airDate: string | null;
    overview: string | null;
    posterPath: string | null;
}
export interface Episode {
    id: number;
    showId: number;
    seasonId: number | null;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    overview: string | null;
    runtime: number | null;
    airDate: string | null;
    stillPath: string | null;
    traktId: number | null;
    tmdbId: number | null;
}
export interface WatchHistory {
    id: number;
    userId: number;
    episodeId: number;
    watchedAt: string;
    traktPlayId: string | null;
    source: string;
}
export interface EpisodeProgress {
    episodeId: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    translatedTitle: string | null;
    overview: string | null;
    translatedOverview: string | null;
    airDate: string | null;
    watched: boolean;
    watchedAt: string | null;
    aired: boolean;
    stillPath: string | null;
    runtime: number | null;
}
export interface SeasonProgress {
    seasonNumber: number;
    episodeCount: number;
    watchedCount: number;
    airedCount: number;
    posterPath: string | null;
    episodes: EpisodeProgress[];
}
export interface ShowProgress {
    show: Show;
    airedEpisodes: number;
    watchedEpisodes: number;
    nextEpisode: Episode | null;
    lastWatchedAt: string | null;
    completed: boolean;
    percentage: number;
    seasons: SeasonProgress[];
}
export type SyncStatus = "idle" | "running" | "completed" | "error";
export interface FailedShowSyncItem {
    tmdbId: number;
    title: string;
    error: string;
    retryCount?: number;
    alert?: boolean;
    lastTriedAt?: string;
}
export interface SyncState {
    status: SyncStatus;
    lastSyncAt: string | null;
    currentShow: string | null;
    currentIndex?: number | null;
    progress: number;
    total: number;
    error: string | null;
    failedShows: FailedShowSyncItem[];
    successCount?: number;
    failedCount?: number;
    alerts?: FailedShowSyncItem[];
    alertCount?: number;
}
export interface SyncDebugState {
    syncStatus: SyncStatus;
    currentShow: string | null;
    progress: number;
    total: number;
    failedCount: number;
    dbCounts: {
        shows: number;
        watchHistory: number;
        userShowProgress: number;
    };
    updatedAt: string | null;
}
/**
 * Generic API envelope returned by all backend routes.
 *
 * NOTE: This is intentionally NOT a discriminated union to avoid widespread
 * breaking changes across all callers. Treat as: data is present on success,
 * error is present on failure. A future refactor should convert this to:
 *   | { success: true; data: T; error?: never }
 *   | { success: false; error: string; data?: never }
 */
export interface ApiResponse<T> {
    data: T;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
}
export interface StatsOverview {
    totalEpisodesWatched: number;
    totalShowsWatched: number;
    totalShowsCompleted: number;
    totalRuntimeMinutes: number;
    monthlyActivity: Array<{
        month: string;
        count: number;
    }>;
    topGenres: Array<{
        name: string;
        count: number;
    }>;
    recentlyWatched: Array<{
        showId: number;
        showTitle: string;
        posterPath: string | null;
        stillPath: string | null;
        episodeTitle: string | null;
        seasonNumber: number;
        episodeNumber: number;
        watchedAt: string;
    }>;
}
export interface NowPlayingEpisode {
    show: {
        title: string;
        posterPath: string | null;
        traktSlug: string | null;
    };
    episode: {
        seasonNumber: number;
        episodeNumber: number;
        title: string | null;
    };
    expiresAt: string;
    runtime: number | null;
}
export interface User {
    id: number;
    traktUsername: string | null;
    traktAccessToken: string;
    traktRefreshToken: string;
    tokenExpiresAt: string;
    createdAt: string;
}
export interface AuthStatus {
    authenticated: boolean;
    user: Pick<User, "id" | "traktUsername"> | null;
}
export interface UserSettings {
    userId: number;
    displayLanguage: string;
    syncIntervalMinutes: number;
    httpProxy: string | null;
}
export interface EpisodeDetailData {
    episodeId: number;
    showId: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    translatedTitle: string | null;
    overview: string | null;
    translatedOverview: string | null;
    airDate: string | null;
    runtime: number | null;
    stillPath: string | null;
    watched: boolean;
    watchedAt: string | null;
    traktRating: number | null;
    directors: string[];
    show: {
        id: number;
        title: string;
        posterPath: string | null;
        genres: string[];
        traktId: number | null;
        traktSlug: string | null;
        tmdbId: number;
        imdbId: string | null;
        tvdbId: number | null;
    };
    seasonEpisodes: EpisodeProgress[];
}
export interface WatchHistoryEntry {
    id: number;
    episodeId: number;
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle: string | null;
    watchedAt: string | null;
    source: "trakt" | "manual";
}
export interface WatchResetCursor {
    id: number;
    userId: number;
    showId: number;
    resetAt: string;
}
//# sourceMappingURL=index.d.ts.map