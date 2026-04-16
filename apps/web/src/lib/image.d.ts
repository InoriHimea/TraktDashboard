/**
 * Image resolution utilities.
 * Priority: local proxy (TMDB via API) → null
 * All callers should handle null by rendering a placeholder.
 */
export declare function tmdbImage(path: string | null | undefined, size?: string): string | null;
/**
 * Returns the best available still image URL for an episode.
 * stillPath comes from the DB (populated during sync from TMDB).
 */
export declare function resolveEpisodeStill(stillPath: string | null | undefined): string | null;
/**
 * Returns the best available poster URL for a show.
 */
export declare function resolveShowPoster(posterPath: string | null | undefined, size?: "w342" | "w500" | "w780"): string | null;
/**
 * Returns the best available backdrop URL.
 */
export declare function resolveBackdrop(backdropPath: string | null | undefined): string | null;
//# sourceMappingURL=image.d.ts.map