// ─── Show ────────────────────────────────────────────────────────────────────

export type ShowStatus =
    | "returning series"
    | "ended"
    | "canceled"
    | "in production"
    | "planned"
    | "pilot"
    | "unknown";

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
    // Multilingual fields
    originalName: string | null;
    originalLanguage: string | null; // TMDB original_language, e.g. "ja", "en", "ko"
    translatedName: string | null;
    translatedOverview: string | null;
    displayLanguage: string | null;
}

// ─── Season ──────────────────────────────────────────────────────────────────

export interface Season {
    id: number;
    showId: number;
    seasonNumber: number;
    episodeCount: number;
    airDate: string | null;
    overview: string | null;
    posterPath: string | null;
}

// ─── Episode ─────────────────────────────────────────────────────────────────

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

// ─── Watch History ────────────────────────────────────────────────────────────

export interface WatchHistory {
    id: number;
    userId: number;
    episodeId: number;
    watchedAt: string;
    traktPlayId: string | null;
    source: string; // 'manual' | 'trakt' etc.
}

// ─── Progress ────────────────────────────────────────────────────────────────

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

export interface CalendarEpisode {
    id: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    overview: string | null;
    runtime: number | null;
    stillPath: string | null;
    airDate: string | null;
    /** Whether the current user has any watch-history entry for this episode (P1-T13). */
    watched: boolean;
    show: {
        id: number;
        title: string;
        originalName: string | null;
        translatedName: string | null;
        posterPath: string | null;
        backdropPath: string | null;
        network: string | null;
        status: string;
    };
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

// ─── Up Next ─────────────────────────────────────────────────────────────────

export interface UpNextItem {
    showId: number;
    showTitle: string;
    posterPath: string | null;
    lastWatchedAt: string | null;
    nextEpisode: {
        id: number;
        seasonNumber: number;
        episodeNumber: number;
        title: string | null;
        stillPath: string | null;
        airDate: string | null;
        runtime: number | null;
    };
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export interface UserRating {
    id: number;
    mediaType: "show" | "movie";
    showId: number | null;
    movieId: number | null;
    rating: number; // 1-10
    ratedAt: string | null;
}

export interface UserNote {
    id: number;
    mediaType: "episode" | "show" | "movie";
    showId: number | null;
    movieId: number | null;
    season: number | null;
    episode: number | null;
    content: string;
    updatedAt: string;
    createdAt: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

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

// ─── API Responses ────────────────────────────────────────────────────────────

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
    ok?: true;
    data: T;
    error?: string;
}

export interface PaginatedResponse<T> {
    ok?: true;
    data: T[];
    total: number;
    limit: number;
    offset: number;
}

/** Error envelope returned by the `apiError` helper (P1-T10). */
export interface ApiErrorResponse {
    ok: false;
    error: string;
    details?: unknown;
}

/**
 * Canonical discriminated union (P1-T10). Use for callers that handle both
 * outcomes explicitly; `ApiResponse<T>` remains the success-unwrap shape used by
 * the typed web client.
 */
export type ApiResult<T> = { ok: true; data: T } | ApiErrorResponse;

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface StatsOverview {
    totalEpisodesWatched: number;
    totalShowsWatched: number;
    totalShowsCompleted: number;
    totalMoviesWatched: number;
    totalMovieWatches: number;
    totalRuntimeMinutes: number;
    totalEpisodeRuntimeMinutes: number;
    totalMovieRuntimeMinutes: number;
    monthlyActivity: Array<{ month: string; count: number }>;
    topGenres: Array<{ name: string; count: number }>;
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
    recentlyWatchedMovies: Array<{
        movieId: number;
        movieTitle: string;
        posterPath: string | null;
        watchedAt: string;
    }>;
    yearComparison: { thisYear: number; lastYear: number };
    longestStreakDays: number;
    avgDailyWatches30d: number;
    heatmap: Array<{ date: string; count: number }>;
    weekdayDistribution: Array<{ weekday: number; count: number }>;
    ratingDistribution: Array<{ rating: number; count: number }>;
}

// ─── Discover ────────────────────────────────────────────────────────────────

export interface DiscoverItem {
    type: "show" | "movie";
    traktId: number;
    traktSlug: string;
    title: string;
    year: number | null;
    tmdbId: number | null;
    imdbId: string | null;
    watchers?: number;
    localId: number | null;
    posterPath: string | null;
    inWatchlist: boolean;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
    type: "show" | "movie";
    traktId: number;
    slug: string;
    title: string;
    year: number;
    tmdbId: number | null;
    posterPath: string | null;
    localId: number | null;
    inWatchlist: boolean;
}

// ─── Now Playing ─────────────────────────────────────────────────────────────

export interface JellyfinNowPlaying {
    jellyfinItemId: string;
    mediaType: "episode" | "movie";
    title: string;
    seriesTitle: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    posterUrl: string | null; // absolute Jellyfin image URL
    runtimeMinutes: number | null;
    progressPct: number; // 0-100
    isPaused: boolean;
    localShowId: number | null;
    localMovieId: number | null;
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
        title: string | null; // nullable: Trakt may not return a title for unaired episodes
    };
    expiresAt: string; // ISO 8601
    runtime: number | null; // minutes
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── User Settings ────────────────────────────────────────────────────────────

export interface UserSettings {
    userId: number;
    displayLanguage: string;
    syncIntervalMinutes: number;
    httpProxy: string | null;
    jellyfinUrl: string | null;
    jellyfinApiKey: string | null;
    jellyfinAutoDeleteLibraryIds: string[] | null;
    notificationEventTypes: string[];
}

// ─── Jellyfin ─────────────────────────────────────────────────────────────────

export interface JellyfinLibrary {
    id: string;
    name: string;
    collectionType: string;
}

export interface JellyfinEpisode {
    id: string;
    name: string;
    seriesName: string;
    path: string | null;
}

export interface JellyfinMovie {
    id: string;
    name: string;
    path: string | null;
}

// ─── Episode Detail ───────────────────────────────────────────────────────────

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
    traktRating: number | null; // 0–100 integer
    directors: string[];
    show: {
        id: number;
        title: string;
        translatedName: string | null;
        posterPath: string | null;
        backdropPath: string | null;
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
    watchedAt: string | null; // ISO 8601 or null (Unknown date)
    source: "trakt" | "manual";
}

export interface WatchResetCursor {
    id: number;
    userId: number;
    showId: number;
    resetAt: string; // ISO 8601
}

// ─── Movie ────────────────────────────────────────────────────────────────────

export interface Movie {
    id: number;
    tmdbId: number;
    imdbId: string | null;
    traktId: number | null;
    traktSlug: string | null;
    title: string;
    overview: string | null;
    releaseDate: string | null; // YYYY-MM-DD
    runtime: number | null; // minutes
    posterPath: string | null;
    backdropPath: string | null;
    genres: string[];
    lastSyncedAt: string;
    createdAt: string;
}

export interface MovieProgress {
    movie: Movie;
    watchCount: number;
    lastWatchedAt: string | null;
}

export interface MovieWatchHistoryEntry {
    id: number;
    movieId: number;
    watchedAt: string | null;
    source: string;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export interface WatchlistItem {
    id: number;
    userId: number;
    showId: number | null;
    movieId: number | null;
    addedAt: string;
    listedAt: string;
    notes: string | null;
}

export interface WatchlistShowItem {
    id: number;
    show: Show;
    addedAt: string;
    listedAt: string;
    notes: string | null;
}

export interface WatchlistMovieItem {
    id: number;
    movie: Movie;
    addedAt: string;
    listedAt: string;
    notes: string | null;
}

export type WatchlistItemWithMedia = WatchlistShowItem | WatchlistMovieItem;

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEpisodeRef {
    id: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
}

export interface HistoryShowRef {
    id: number;
    title: string;
    translatedName: string | null;
    posterPath: string | null;
}

export interface HistoryMovieRef {
    id: number;
    title: string;
    posterPath: string | null;
}

export interface HistoryEntry {
    id: number;
    mediaType: "episode" | "movie";
    watchedAt: string | null;
    source: string;
    episode?: HistoryEpisodeRef;
    show?: HistoryShowRef;
    movie?: HistoryMovieRef;
}

export interface HistoryPage {
    entries: HistoryEntry[];
    total: number;
}
