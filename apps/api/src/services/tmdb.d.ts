export declare function getProxyUrl(userId?: number): Promise<string | undefined>;
export interface TmdbShow {
    id: number;
    name: string;
    original_name: string;
    overview: string;
    status: string;
    first_air_date: string;
    networks: Array<{
        name: string;
    }>;
    genres: Array<{
        id: number;
        name: string;
    }>;
    poster_path: string | null;
    backdrop_path: string | null;
    number_of_episodes: number;
    number_of_seasons: number;
    external_ids?: {
        imdb_id?: string;
        tvdb_id?: number;
    };
    seasons: Array<{
        id: number;
        season_number: number;
        episode_count: number;
        air_date: string;
        overview: string;
        poster_path: string | null;
    }>;
}
export interface TmdbSeason {
    id: number;
    season_number: number;
    episodes: Array<{
        id: number;
        episode_number: number;
        season_number: number;
        name: string;
        overview: string;
        runtime: number | null;
        air_date: string | null;
        still_path: string | null;
    }>;
}
export declare function getTmdbShow(tmdbId: number, language?: string, userId?: number): Promise<TmdbShow>;
export declare function getTmdbSeason(tmdbId: number, seasonNumber: number, language?: string, userId?: number): Promise<TmdbSeason>;
export declare function getTmdbImageUrl(path: string | null, size?: string): string | null;
export declare function getTmdbEpisodeDetail(tmdbShowId: number, seasonNumber: number, episodeNumber: number, language?: string, userId?: number): Promise<{
    directors: string[];
}>;
//# sourceMappingURL=tmdb.d.ts.map