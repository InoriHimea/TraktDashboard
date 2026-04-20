# Implementation Plan: TV Shows and Movies Separation

## Overview

Separate TV shows and movies into distinct pages. Rename ProgressPage to TVShowsPage (route /tv-shows), add a new MoviesPage at /movies, extend the database schema, backend API, sync service, and frontend to support movies as a first-class entity.

## Tasks

- [x] 1. Database schema changes
  - Create migration file `packages/db/drizzle/0004_movies.sql`
  - Add `media_type` (default `episode`) and `movie_id` columns to `watch_history`
  - Relax NOT NULL on `episode_id` in `watch_history`
  - Create `movies` table with all columns and indexes (trakt_id, imdb_id)
  - Create `user_movie_progress` table with unique index on (user_id, movie_id)
  - Add `watch_history_movie_idx` index on watch_history(movie_id)
  - Update Drizzle schema in `packages/db/src/schema.ts`: extend `watchHistory`, add `movies` and `userMovieProgress` tables
  - Export new tables from `packages/db/src/index.ts`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Type definitions
  - [x] 2.1 Add `Movie`, `MovieProgress`, and `MovieWatchHistoryEntry` interfaces to `packages/types/src/index.ts`
    - `Movie`: id, tmdbId, imdbId, traktId, traktSlug, title, overview, releaseDate, runtime, posterPath, backdropPath, genres, lastSyncedAt, createdAt
    - `MovieProgress`: movie, watchCount, lastWatchedAt
    - `MovieWatchHistoryEntry`: id, movieId, watchedAt, source
    - _Requirements: 4.3, 5.1, 10.1_

- [x] 3. Backend API — movies route
  - [x] 3.1 Create `apps/api/src/routes/movies.ts`
    - Implement `parseBoundedInt` helper (reuse pattern from shows.ts)
    - Implement `recalcMovieProgress(userId, movieId)` helper
    - Implement `GET /progress` with filter (watched/unwatched/all), q, limit, offset
    - Implement `GET /:id` returning MovieProgress
    - Implement `GET /:id/history` returning MovieWatchHistoryEntry array
    - Implement `POST /:id/watch` inserting into watchHistory with mediaType=movie
    - Implement `DELETE /:id/history/:historyId` with ownership check
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.1, 12.2, 12.3, 13.3, 14.1, 14.2, 14.3_
  - [x] 3.2 Mount movies route in `apps/api/src/index.ts`
    - Import movieRoutes and add `api.route('/movies', movieRoutes)`
    - _Requirements: 4.1_

- [x] 4. Trakt client extension
  - [x] 4.1 Add `getWatchedMovies(userId)` method to `getTraktClient()` in `apps/api/src/services/trakt.ts`
    - Calls `GET /sync/watched/movies`
    - Define `TraktWatchedMovie` interface: movie (title, ids), plays, last_watched_at
    - _Requirements: 9.1, 9.2_

- [x] 5. TMDB service extension
  - [x] 5.1 Add `getTmdbMovie(tmdbId, userId)` function to `apps/api/src/services/tmdb.ts`
    - Calls `GET /movie/:tmdbId` with cache (TTL 7 days, key `tmdb_movie_${tmdbId}`)
    - Define `TmdbMovie` interface: id, title, overview, release_date, runtime, genres, poster_path, backdrop_path
    - _Requirements: 4.8, 9.3_

- [x] 6. Sync service extension
  - [x] 6.1 Add `syncMovies(userId)` function to `apps/api/src/services/sync.ts`
    - Fetch watched movies via `trakt.getWatchedMovies(userId)`
    - For each movie: fetch TMDB images via `getTmdbMovie`, upsert `movies` row, upsert `userMovieProgress` row
    - Insert `watchHistory` rows with `mediaType = 'movie'` (dedup on userId+movieId+watchedAt)
    - Use `pLimit(SHOW_CONCURRENCY)` for concurrency control
    - Degrade gracefully when TMDB is unavailable (posterPath = null)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 6.2 Integrate `syncMovies` into `triggerFullSync` in `apps/api/src/services/sync.ts`
    - Call `await syncMovies(userId)` after the show sync loop completes
    - _Requirements: 9.1_

- [ ] 7. Checkpoint — backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend API client
  - [x] 8.1 Add `movies` namespace to `api` object in `apps/web/src/lib/api.ts`
    - `movies.progress(filter, q, limit, offset)` returning PaginatedResponse<MovieProgress>
    - `movies.detail(id)` returning ApiResponse<MovieProgress>
    - `movies.history(id)` returning ApiResponse<MovieWatchHistoryEntry[]>
    - `movies.watch(id, watchedAt)` returning `{ ok: boolean; historyId: number }`
    - `movies.deleteHistory(id, historyId)` returning `{ ok: boolean }`
    - Import `MovieProgress` and `MovieWatchHistoryEntry` from `@trakt-dashboard/types`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9. Frontend React Query hooks
  - [x] 9.1 Add movie hooks to `apps/web/src/hooks/index.ts`
    - `useMoviesProgress(filter, search, limit, offset)` — queryKey includes all params, staleTime 60s
    - `useMovieDetail(id)` — enabled when id > 0
    - `useMovieHistory(id)` — enabled when id > 0
    - `useMarkMovieWatched(id)` — invalidates ['movie-detail', id], ['movie-history', id], ['movies-progress']
    - `useDeleteMovieHistory(id)` — invalidates ['movie-history', id], ['movie-detail', id], ['movies-progress']
    - Import `MovieProgress` and `MovieWatchHistoryEntry` from `@trakt-dashboard/types`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Rename ProgressPage to TVShowsPage
  - [x] 10.1 Rename file `apps/web/src/pages/ProgressPage.tsx` to `TVShowsPage.tsx` using smartRelocate
    - _Requirements: 1.1_
  - [x] 10.2 Update route in `apps/web/src/App.tsx`
    - Change `/progress` route to `/tv-shows` with TVShowsPage
    - Change root redirect from `/progress` to `/tv-shows`
    - Add backward-compat redirect: `/progress` to `/tv-shows`
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 11. Navigation bar update
  - [x] 11.1 Update `apps/web/src/components/TopNav.tsx`
    - Import `Film` from lucide-react
    - Replace `nav.progress` entry with `{ to: '/tv-shows', icon: Tv2, labelKey: 'nav.tvShows' }`
    - Add `{ to: '/movies', icon: Film, labelKey: 'nav.movies' }` after TV Shows entry
    - Update logo link href from `/progress` to `/tv-shows`
    - _Requirements: 1.5, 3.1, 3.2, 3.3_

- [x] 12. Internationalization
  - [x] 12.1 Update `apps/web/src/locales/zh-CN.json`
    - Add `nav.tvShows: '电视节目'` and `nav.movies: '电影'`
    - Add `movies` section: watched, unwatched, watchCount, watchedNTimes, notWatched, lastWatched
    - _Requirements: 1.6, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 12.2 Update `apps/web/src/locales/en-US.json`
    - Add `nav.tvShows: 'TV Shows'` and `nav.movies: 'Movies'`
    - Add `movies` section: Watched, Unwatched, Watch Count, Watched {{count}} times, Not watched, Last watched
    - _Requirements: 1.6, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. MovieCard component
  - [x] 13.1 Create `apps/web/src/components/MovieCard.tsx`
    - Props: `movie: MovieProgress`, `index: number`
    - Display: poster image, title, watch count badge ('Watched N times' / 'Not watched'), last watched date
    - Link to `/movies/:id`
    - Use identical hover/transition styles as ShowCard
    - Staggered animation delay based on index
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.1_
  - [ ]* 13.2 Write property test for MovieCard
    - Create `apps/web/src/components/__tests__/MovieCard.property.test.tsx`
    - **Property 9: MovieCard renders all required fields for any movie**
    - Generate random `MovieProgress` objects with fast-check arbitraries
    - Assert: title text present, watch count indicator present, link href equals `/movies/{movie.id}`
    - Tag: `// Feature: tv-shows-and-movies-separation, Property 9`
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5, 10.6**

- [x] 14. MoviesPage component
  - [x] 14.1 Create `apps/web/src/pages/MoviesPage.tsx`
    - Filter tabs: watched (Eye icon), unwatched (EyeOff icon), all (LayoutGrid icon)
    - Search box with 280ms debounce — same pattern as TVShowsPage
    - Use `useMoviesProgress(filter, debouncedSearch)` hook
    - Grid layout: `repeat(auto-fill, minmax(150px, 1fr))`, 16px gap
    - Sticky controls bar at top: 56px, same as TVShowsPage
    - Loading, error (with retry button), and empty states matching TVShowsPage patterns
    - Empty state: 'No movies here yet. Go to Sync to import your Trakt history.'
    - Total count display (e.g., '150 部电影')
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 14.5_

- [x] 15. MovieDetailPage component
  - [x] 15.1 Create `apps/web/src/pages/MovieDetailPage.tsx`
    - Route param: `:id` (parsed as integer)
    - Use `useMovieDetail(id)` and `useMovieHistory(id)` hooks
    - Display: backdrop hero, poster, title, overview, release date, runtime, genres
    - Watch history list with timestamps
    - 'Mark as watched' button using `useMarkMovieWatched`
    - Delete history record button using `useDeleteMovieHistory`
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6_

- [x] 16. App.tsx routing update
  - [x] 16.1 Update `apps/web/src/App.tsx` to add movie routes
    - Import `MoviesPage` and `MovieDetailPage`
    - Add route `/movies` with MoviesPage
    - Add route `/movies/:id` with MovieDetailPage
    - _Requirements: 2.2, 15.2_

- [x] 17. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property 9 validates MovieCard rendering universally across all valid MovieProgress inputs
- Backend property tests (Properties 1-8) are defined in `apps/api/src/services/__tests__/movies.property.test.ts` and are separate from this frontend task list
- Task 10 (rename) should be done before Task 16 (routing update) to avoid import conflicts
