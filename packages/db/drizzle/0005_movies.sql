-- 1. New movies table (must be created before watch_history references it)
CREATE TABLE movies (
  id            SERIAL PRIMARY KEY,
  tmdb_id       INTEGER NOT NULL UNIQUE,
  imdb_id       TEXT,
  trakt_id      INTEGER,
  trakt_slug    TEXT,
  title         TEXT NOT NULL,
  overview      TEXT,
  release_date  TEXT,
  runtime       INTEGER,
  poster_path   TEXT,
  backdrop_path TEXT,
  genres        JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX movies_trakt_id_idx ON movies(trakt_id);
CREATE INDEX movies_imdb_id_idx  ON movies(imdb_id);

-- 2. Add mediaType + movieId to watchHistory
ALTER TABLE watch_history
  ADD COLUMN media_type TEXT NOT NULL DEFAULT 'episode',
  ADD COLUMN movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE;

-- 3. Relax NOT NULL on episode_id (movies have no episode)
ALTER TABLE watch_history ALTER COLUMN episode_id DROP NOT NULL;

-- 4. userMovieProgress materialized cache
CREATE TABLE user_movie_progress (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  watch_count     INTEGER NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ump_user_movie_idx ON user_movie_progress(user_id, movie_id);
CREATE INDEX        ump_user_idx       ON user_movie_progress(user_id);

-- 5. Index for movie watch history lookups
CREATE INDEX watch_history_movie_idx ON watch_history(movie_id);
