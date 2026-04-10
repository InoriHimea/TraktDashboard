/**
 * Image resolution utilities.
 * Priority: local proxy (TMDB via API) → direct TMDB CDN → null
 * All callers should handle null by rendering a placeholder.
 */

export function tmdbImage(path: string | null | undefined, size = 'w500'): string | null {
  if (!path) return null
  // Route through local API proxy for caching & auth
  return `/api/img/${size}${path}`
}

export function tmdbImageDirect(path: string | null | undefined, size = 'w500'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * Returns the best available still image URL for an episode.
 * stillPath comes from the DB (populated during sync from TMDB).
 */
export function resolveEpisodeStill(stillPath: string | null | undefined): string | null {
  return tmdbImage(stillPath, 'w300')
}

/**
 * Returns the best available poster URL for a show.
 */
export function resolveShowPoster(posterPath: string | null | undefined, size: 'w342' | 'w500' | 'w780' = 'w500'): string | null {
  return tmdbImage(posterPath, size)
}

/**
 * Returns the best available backdrop URL.
 */
export function resolveBackdrop(backdropPath: string | null | undefined): string | null {
  return tmdbImage(backdropPath, 'original')
}
