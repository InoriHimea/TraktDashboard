export interface TraktShow {
    title: string;
    year: number;
    ids: {
        trakt: number;
        slug: string;
        tvdb: number;
        imdb: string;
        tmdb: number;
    };
}
export interface TraktWatchedShow {
    plays: number;
    last_watched_at: string;
    last_updated_at: string;
    reset_at: string | null;
    show: TraktShow;
    seasons: Array<{
        number: number;
        episodes: Array<{
            number: number;
            plays: number;
            last_watched_at: string;
        }>;
    }>;
}
export interface TraktHistoryEntry {
    id: number;
    watched_at: string;
    action: string;
    type: string;
    episode: {
        season: number;
        number: number;
        title: string;
        ids: {
            trakt: number;
            tvdb: number;
            imdb: string;
            tmdb: number;
            tvrage: number;
        };
    };
    show: TraktShow;
}
export interface TraktShowDetail {
    title: string;
    year: number | null;
    overview: string | null;
    status: string | null;
    first_aired: string | null;
    network: string | null;
    genres: string[];
    ids: {
        trakt: number;
        slug: string;
        tvdb: number | null;
        imdb: string | null;
        tmdb: number | null;
    };
}
export interface TraktSeasonDetail {
    number: number;
    episode_count: number;
    first_aired: string | null;
    overview: string | null;
    ids: {
        trakt: number;
        tvdb: number | null;
        tmdb: number | null;
    };
}
export interface TraktEpisodeDetail {
    number: number;
    season: number;
    title: string | null;
    overview: string | null;
    first_aired: string | null;
    runtime: number | null;
    ids: {
        trakt: number;
        tvdb: number | null;
        imdb: string | null;
        tmdb: number | null;
    };
}
export interface TraktShowProgress {
    aired: number;
    completed: number;
    last_watched_at: string | null;
    reset_at: string | null;
    seasons: Array<{
        number: number;
        title: string;
        aired: number;
        completed: number;
        episodes: Array<{
            number: number;
            completed: boolean;
            last_watched_at: string | null;
        }>;
    }>;
    next_episode: {
        season: number;
        number: number;
        title: string;
        ids: {
            trakt: number;
        };
    } | null;
}
interface TraktWatchingResponse {
    expires_at: string;
    started_at: string;
    action: "watch";
    type: "episode";
    episode: {
        season: number;
        number: number;
        title: string;
        runtime: number | null;
        ids: {
            trakt: number;
            tvdb: number;
            imdb: string;
            tmdb: number;
        };
    };
    show: {
        title: string;
        ids: {
            trakt: number;
            slug: string;
            tvdb: number;
            imdb: string;
            tmdb: number;
        };
    };
}
export declare function getTraktClient(): {
    getWatchedShows: (userId: number) => Promise<TraktWatchedShow[]>;
    getHistory: (userId: number, startAt?: string) => Promise<TraktHistoryEntry[]>;
    getShowProgress: (userId: number, traktId: number) => Promise<TraktShowProgress>;
    getWatching: (userId: number) => Promise<TraktWatchingResponse | null>;
    getShowDetail: (traktId: number, userId: number) => Promise<TraktShowDetail>;
    getSeasons: (traktId: number, userId: number) => Promise<TraktSeasonDetail[]>;
    getEpisodes: (traktId: number, seasonNumber: number, userId: number) => Promise<TraktEpisodeDetail[]>;
    getEpisodeRating: (traktId: number, season: number, episode: number, userId: number) => Promise<number | null>;
};
export {};
//# sourceMappingURL=trakt.d.ts.map