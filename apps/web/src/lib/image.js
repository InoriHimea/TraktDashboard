/**
 * Image resolution utilities.
 * Priority: local proxy (TMDB via API) → null
 * All callers should handle null by rendering a placeholder.
 */
export function tmdbImage(path, size = "w500") {
    if (!path)
        return null;
    // Route through local API proxy for caching & auth
    return `/api/img/${size}${path}`;
}
/**
 * Returns the best available still image URL for an episode.
 * stillPath comes from the DB (populated during sync from TMDB).
 */
export function resolveEpisodeStill(stillPath) {
    return tmdbImage(stillPath, "w300");
}
/**
 * Returns the best available poster URL for a show.
 */
export function resolveShowPoster(posterPath, size = "w500") {
    return tmdbImage(posterPath, size);
}
/**
 * Returns the best available backdrop URL.
 */
export function resolveBackdrop(backdropPath) {
    return tmdbImage(backdropPath, "original");
}
//# sourceMappingURL=image.js.map