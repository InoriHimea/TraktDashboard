# Requirements Document

## Introduction

This feature separates TV shows and movies into distinct pages within the Trakt Dashboard application. Currently, the application has a "Progress Page" (ProgressPage) that displays TV show watching progress. This feature will rename it to "TV Shows Page" and create a new "Movies Page" with similar functionality tailored for movies.

## Glossary

- **TV_Shows_Page**: The renamed page (formerly ProgressPage) that displays user's TV show watching progress
- **Movies_Page**: The new page that displays user's movie watching history and status
- **Navigation_Bar**: The top navigation component (TopNav) that provides links to different pages
- **Filter**: A UI control that allows users to filter content by status (watching/watched, completed, all)
- **Search_Box**: A text input that allows users to search content by title
- **Content_Card**: A visual component displaying a show or movie with poster, title, and progress information
- **API_Client**: The frontend service layer that communicates with backend endpoints
- **Backend_Route**: Server-side endpoint that handles data requests
- **Internationalization_Key**: Translation keys used in locale files (zh-CN.json, en-US.json)

## Requirements

### Requirement 1: Rename Progress Page to TV Shows Page

**User Story:** As a user, I want the "Progress" page to be renamed to "TV Shows", so that the page purpose is clearer and distinguishes TV content from movies.

#### Acceptance Criteria

1. THE System SHALL rename the ProgressPage component file to TVShowsPage
2. THE System SHALL update the route path from `/progress` to `/tv-shows`
3. THE System SHALL update the root redirect from `/progress` to `/tv-shows`
4. THE System SHALL preserve all existing TV show functionality including filters (watching, completed, all), search, and progress display
5. THE Navigation_Bar SHALL display "电视节目" (Chinese) and "TV Shows" (English) instead of "进度" / "Progress"
6. THE System SHALL update all internationalization keys from `nav.progress` to `nav.tvShows`

### Requirement 2: Create Movies Page

**User Story:** As a user, I want a dedicated Movies page, so that I can track my movie watching history separately from TV shows.

#### Acceptance Criteria

1. THE System SHALL create a new MoviesPage component
2. THE System SHALL provide a route at `/movies` for the Movies page
3. THE Movies_Page SHALL display movie cards in a grid layout consistent with TV Shows page
4. THE Movies_Page SHALL include filters: watched, unwatched, and all
5. THE Movies_Page SHALL include a search box for filtering movies by title
6. THE Movies_Page SHALL display watch count and watch history instead of episode progress percentage
7. THE Movies_Page SHALL use the same visual design patterns as TV Shows page (card layout, spacing, typography)

### Requirement 3: Update Navigation Structure

**User Story:** As a user, I want to see both "TV Shows" and "Movies" in the navigation bar, so that I can easily switch between the two content types.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL display navigation items in this order: TV Shows, Movies, Statistics, Sync, Settings
2. THE Navigation_Bar SHALL include an icon for the Movies navigation item
3. THE Navigation_Bar SHALL highlight the active page with visual feedback (accent color underline)
4. THE System SHALL add internationalization keys `nav.tvShows` and `nav.movies` to both zh-CN.json and en-US.json

### Requirement 4: Backend API for Movies

**User Story:** As a developer, I want backend API endpoints for movies, so that the frontend can fetch and display movie data.

#### Acceptance Criteria

1. THE System SHALL create a new backend route file for movies (similar to shows.ts)
2. THE Backend_Route SHALL provide a GET endpoint `/api/movies/progress` that accepts filter, search, limit, and offset parameters
3. THE Backend_Route SHALL provide a GET endpoint `/api/movies/:id` that returns detailed movie information
4. THE Backend_Route SHALL provide a GET endpoint `/api/movies/:id/history` that returns watch history for a specific movie
5. THE Backend_Route SHALL provide a POST endpoint `/api/movies/:id/watch` that records a movie watch event
6. THE Backend_Route SHALL provide a DELETE endpoint `/api/movies/:id/history/:historyId` that removes a watch history record
7. THE System SHALL fetch movie data from Trakt API as the primary data source
8. THE System SHALL fetch supplementary data (posters, backdrops) from TMDB, IMDB, and TVDB

### Requirement 5: Frontend API Client for Movies

**User Story:** As a developer, I want frontend API client methods for movies, so that components can easily fetch movie data.

#### Acceptance Criteria

1. THE API_Client SHALL add a `movies` namespace to the api object in lib/api.ts
2. THE API_Client SHALL provide a `movies.progress()` method that accepts filter, search, limit, and offset parameters
3. THE API_Client SHALL provide a `movies.detail(id)` method that fetches a single movie
4. THE API_Client SHALL provide a `movies.history(id)` method that fetches watch history
5. THE API_Client SHALL provide a `movies.watch(id, watchedAt)` method that records a watch event
6. THE API_Client SHALL provide a `movies.deleteHistory(id, historyId)` method that removes a history record

### Requirement 6: React Query Hooks for Movies

**User Story:** As a developer, I want React Query hooks for movies, so that components can manage movie data with caching and automatic refetching.

#### Acceptance Criteria

1. THE System SHALL create a `useMoviesProgress(filter, search, limit, offset)` hook in hooks/index.ts
2. THE System SHALL create a `useMovieDetail(id)` hook that fetches a single movie
3. THE System SHALL create a `useMovieHistory(id)` hook that fetches watch history
4. THE System SHALL create a `useMarkMovieWatched(id)` mutation hook that records a watch event
5. THE System SHALL create a `useDeleteMovieHistory(id)` mutation hook that removes a history record
6. THE System SHALL configure appropriate cache invalidation when mutations succeed

### Requirement 7: Database Schema for Movies

**User Story:** As a developer, I want a database schema for movies, so that movie data can be stored and queried efficiently.

#### Acceptance Criteria

1. THE System SHALL create a `movies` table with columns: id, tmdbId, imdbId, traktId, title, overview, releaseDate, runtime, posterPath, backdropPath, genres, lastSyncedAt, createdAt
2. THE System SHALL create a `userMovieProgress` table with columns: userId, movieId, watchCount, lastWatchedAt
3. THE System SHALL create indexes on userId and movieId for efficient querying
4. THE System SHALL reuse the existing `watchHistory` table structure for movie watch records
5. THE System SHALL add a `mediaType` column to `watchHistory` to distinguish between show episodes and movies

### Requirement 8: Internationalization Support

**User Story:** As a user, I want all movie-related text to be available in both Chinese and English, so that I can use the application in my preferred language.

#### Acceptance Criteria

1. THE System SHALL add `nav.movies` key with values "电影" (zh-CN) and "Movies" (en-US)
2. THE System SHALL add `nav.tvShows` key with values "电视节目" (zh-CN) and "TV Shows" (en-US)
3. THE System SHALL add `movies.watched` key with values "已观看" (zh-CN) and "Watched" (en-US)
4. THE System SHALL add `movies.unwatched` key with values "未观看" (zh-CN) and "Unwatched" (en-US)
5. THE System SHALL add `movies.watchCount` key with values "观看次数" (zh-CN) and "Watch Count" (en-US)

### Requirement 9: Data Synchronization for Movies

**User Story:** As a user, I want my movie watch history to sync from Trakt, so that my movie data is up-to-date across devices.

#### Acceptance Criteria

1. THE System SHALL extend the sync service to fetch movie watch history from Trakt API
2. WHEN a sync is triggered, THE System SHALL fetch watched movies from Trakt `/sync/watched/movies` endpoint
3. THE System SHALL store movie metadata in the movies table
4. THE System SHALL store watch events in the watchHistory table with mediaType='movie'
5. THE System SHALL update userMovieProgress with watch count and last watched timestamp

### Requirement 10: Movie Card Component

**User Story:** As a user, I want movie cards to display relevant information, so that I can quickly see my watch status and history.

#### Acceptance Criteria

1. THE System SHALL create a MovieCard component (or reuse ShowCard with conditional rendering)
2. THE Movie_Card SHALL display the movie poster image
3. THE Movie_Card SHALL display the movie title
4. THE Movie_Card SHALL display watch count (e.g., "Watched 3 times")
5. THE Movie_Card SHALL display last watched date
6. THE Movie_Card SHALL link to a movie detail page at `/movies/:id`
7. THE Movie_Card SHALL use the same hover effects and transitions as TV show cards

### Requirement 11: Consistent Visual Design

**User Story:** As a user, I want the Movies page to look consistent with the TV Shows page, so that the application feels cohesive.

#### Acceptance Criteria

1. THE Movies_Page SHALL use the same layout structure as TV Shows page (sticky controls bar, grid layout)
2. THE Movies_Page SHALL use the same color scheme and typography
3. THE Movies_Page SHALL use the same filter button styles
4. THE Movies_Page SHALL use the same search box design
5. THE Movies_Page SHALL use the same loading and error states
6. THE Movies_Page SHALL use the same card grid spacing (16px gap, auto-fill minmax(150px, 1fr))

### Requirement 12: Filter Behavior for Movies

**User Story:** As a user, I want to filter movies by watch status, so that I can focus on movies I haven't seen or revisit watched movies.

#### Acceptance Criteria

1. WHEN the "watched" filter is active, THE Movies_Page SHALL display only movies with watchCount > 0
2. WHEN the "unwatched" filter is active, THE Movies_Page SHALL display only movies with watchCount = 0
3. WHEN the "all" filter is active, THE Movies_Page SHALL display all movies
4. THE System SHALL persist the selected filter in component state
5. THE System SHALL update the URL query parameter to reflect the active filter

### Requirement 13: Search Functionality for Movies

**User Story:** As a user, I want to search movies by title, so that I can quickly find specific movies.

#### Acceptance Criteria

1. WHEN a user types in the search box, THE System SHALL debounce input by 280ms
2. THE System SHALL send the search query to the backend `/api/movies/progress` endpoint
3. THE Backend_Route SHALL filter movies using SQL LIKE with wildcards (e.g., `%search%`)
4. THE Movies_Page SHALL display matching results in the grid
5. WHEN no results are found, THE Movies_Page SHALL display "No results for '{search}'" message

### Requirement 14: Pagination Support for Movies

**User Story:** As a user, I want movies to load efficiently, so that the page remains responsive even with large libraries.

#### Acceptance Criteria

1. THE Backend_Route SHALL accept `limit` parameter (default: 50, min: 1, max: 200)
2. THE Backend_Route SHALL accept `offset` parameter (default: 0, min: 0)
3. THE Backend_Route SHALL return total count of matching movies
4. THE System SHALL include limit and offset in React Query cache keys
5. THE Movies_Page SHALL display total count (e.g., "150 部电影")

### Requirement 15: Movie Detail Page (Future Consideration)

**User Story:** As a user, I want to view detailed information about a movie, so that I can see full metadata and manage watch history.

#### Acceptance Criteria

1. THE System SHALL create a MovieDetailPage component (similar to ShowDetailPage)
2. THE System SHALL provide a route at `/movies/:id`
3. THE Movie_Detail_Page SHALL display movie poster, backdrop, title, overview, release date, runtime, and genres
4. THE Movie_Detail_Page SHALL display watch history with timestamps
5. THE Movie_Detail_Page SHALL provide a button to mark as watched
6. THE Movie_Detail_Page SHALL provide a button to delete watch history records
7. THE Movie_Detail_Page SHALL display Trakt rating and TMDB rating

