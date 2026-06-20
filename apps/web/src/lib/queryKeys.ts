// Centralized React Query key factory (P3-T05).
//
// Single source of truth for every query key so query/invalidate/remove calls can't drift
// out of sync via hand-typed string arrays. Group `.all` keys are prefixes used to
// invalidate a whole family; the functions produce specific keys.

export const queryKeys = {
    auth: ["auth"] as const,
    syncStatus: ["sync-status"] as const,
    syncDebug: ["sync-debug"] as const,
    stats: ["stats"] as const,
    settings: ["settings"] as const,
    nowPlaying: ["now-playing"] as const,

    showsProgress: {
        all: ["shows-progress"] as const,
        list: (filter: string, search: string, limit: number, offset: number) =>
            ["shows-progress", filter, search, limit, offset] as const,
    },
    showDetail: (id: number | string) => ["show-detail", id] as const,
    showHistory: (showId: number | string) => ["show-history", showId] as const,

    calendar: (before: number, after: number) => ["calendar", before, after] as const,

    episodeDetail: {
        all: ["episode-detail"] as const,
        byEp: (showId: number | string, season: number, episode: number) =>
            ["episode-detail", showId, season, episode] as const,
    },
    episodeHistory: {
        all: ["episode-history"] as const,
        byEp: (showId: number | string, season: number, episode: number) =>
            ["episode-history", showId, season, episode] as const,
    },

    moviesProgress: {
        all: ["movies-progress"] as const,
        list: (filter: string, search: string, limit: number, offset: number) =>
            ["movies-progress", filter, search, limit, offset] as const,
    },
    movieDetail: (id: number | string) => ["movie-detail", id] as const,
    movieHistory: (id: number | string) => ["movie-history", id] as const,

    watchlist: {
        all: ["watchlist"] as const,
        byType: (type: string | undefined) => ["watchlist", type] as const,
    },

    upNext: ["up-next"] as const,
    ratings: ["ratings"] as const,
    jellyfinNowPlaying: ["jellyfin-now-playing"] as const,
    notes: {
        all: ["notes"] as const,
        get: (
            mediaType: string,
            showId?: number,
            movieId?: number,
            season?: number,
            episode?: number,
        ) => ["notes", mediaType, showId, movieId, season, episode] as const,
    },
    discover: {
        all: ["discover"] as const,
        list: (mediaType: string, tab: string) => ["discover", mediaType, tab] as const,
    },
    lists: {
        all: ["lists"] as const,
        items: (listId: number) => ["lists", listId, "items"] as const,
    },
    collection: {
        all: ["collection"] as const,
        byType: (type: string) => ["collection", type] as const,
        check: (showId?: number, movieId?: number) =>
            ["collection-check", showId, movieId] as const,
    },

    history: {
        all: ["history"] as const,
        list: (
            mediaType: string,
            startDate: string | undefined,
            endDate: string | undefined,
            limit: number,
            offset: number,
        ) => ["history", mediaType, startDate, endDate, limit, offset] as const,
        infinite: (mediaType: string, startDate: string | undefined, endDate: string | undefined) =>
            ["history-infinite", mediaType, startDate, endDate] as const,
    },
} as const;
