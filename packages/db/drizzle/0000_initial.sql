CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "trakt_username" text,
  "trakt_access_token" text NOT NULL,
  "trakt_refresh_token" text NOT NULL,
  "token_expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shows" (
  "id" serial PRIMARY KEY NOT NULL,
  "tmdb_id" integer NOT NULL UNIQUE,
  "tvdb_id" integer,
  "imdb_id" text,
  "trakt_id" integer,
  "trakt_slug" text,
  "title" text NOT NULL,
  "overview" text,
  "status" text DEFAULT 'unknown' NOT NULL,
  "first_aired" text,
  "network" text,
  "genres" jsonb DEFAULT '[]' NOT NULL,
  "poster_path" text,
  "backdrop_path" text,
  "total_episodes" integer DEFAULT 0 NOT NULL,
  "total_seasons" integer DEFAULT 0 NOT NULL,
  "last_synced_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seasons" (
  "id" serial PRIMARY KEY NOT NULL,
  "show_id" integer NOT NULL REFERENCES "shows"("id") ON DELETE CASCADE,
  "season_number" integer NOT NULL,
  "episode_count" integer DEFAULT 0 NOT NULL,
  "air_date" text,
  "overview" text,
  "poster_path" text,
  UNIQUE("show_id", "season_number")
);

CREATE TABLE IF NOT EXISTS "episodes" (
  "id" serial PRIMARY KEY NOT NULL,
  "show_id" integer NOT NULL REFERENCES "shows"("id") ON DELETE CASCADE,
  "season_id" integer REFERENCES "seasons"("id") ON DELETE SET NULL,
  "season_number" integer NOT NULL,
  "episode_number" integer NOT NULL,
  "title" text,
  "overview" text,
  "runtime" integer,
  "air_date" text,
  "still_path" text,
  "trakt_id" integer,
  "tmdb_id" integer,
  UNIQUE("show_id", "season_number", "episode_number")
);

CREATE TABLE IF NOT EXISTS "watch_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "episode_id" integer NOT NULL REFERENCES "episodes"("id") ON DELETE CASCADE,
  "watched_at" timestamp NOT NULL,
  "trakt_play_id" text UNIQUE
);

CREATE TABLE IF NOT EXISTS "user_show_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "show_id" integer NOT NULL REFERENCES "shows"("id") ON DELETE CASCADE,
  "aired_episodes" integer DEFAULT 0 NOT NULL,
  "watched_episodes" integer DEFAULT 0 NOT NULL,
  "next_episode_id" integer REFERENCES "episodes"("id") ON DELETE SET NULL,
  "last_watched_at" timestamp,
  "completed" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id", "show_id")
);

CREATE TABLE IF NOT EXISTS "metadata_cache" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "external_id" text NOT NULL,
  "data" jsonb NOT NULL,
  "cached_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("source", "external_id")
);

CREATE TABLE IF NOT EXISTS "sync_state" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
  "status" text DEFAULT 'idle' NOT NULL,
  "last_sync_at" timestamp,
  "current_show" text,
  "progress" integer DEFAULT 0 NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "error" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "shows_trakt_id_idx" ON "shows"("trakt_id");
CREATE INDEX IF NOT EXISTS "shows_imdb_id_idx" ON "shows"("imdb_id");
CREATE INDEX IF NOT EXISTS "episodes_show_id_idx" ON "episodes"("show_id");
CREATE INDEX IF NOT EXISTS "episodes_trakt_id_idx" ON "episodes"("trakt_id");
CREATE INDEX IF NOT EXISTS "watch_history_user_idx" ON "watch_history"("user_id");
CREATE INDEX IF NOT EXISTS "watch_history_episode_idx" ON "watch_history"("episode_id");
CREATE INDEX IF NOT EXISTS "watch_history_watched_at_idx" ON "watch_history"("watched_at");
CREATE INDEX IF NOT EXISTS "usp_user_idx" ON "user_show_progress"("user_id");
