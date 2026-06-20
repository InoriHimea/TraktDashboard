CREATE TABLE "user_collection" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "media_type" text NOT NULL,
    "show_id" integer,
    "movie_id" integer,
    "season" integer,
    "episode" integer,
    "media_format" text,
    "resolution" text,
    "hdr" text,
    "audio" text,
    "audio_channels" text,
    "collected_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_collection_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "user_collection_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "user_collection_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action
);

-- Unique: one episode entry per user
CREATE UNIQUE INDEX "user_collection_episode_idx"
    ON "user_collection" ("user_id", "show_id", "season", "episode")
    WHERE (season IS NOT NULL AND episode IS NOT NULL);

-- Unique: one show-level entry per user (season & episode NULL)
CREATE UNIQUE INDEX "user_collection_show_idx"
    ON "user_collection" ("user_id", "show_id")
    WHERE (season IS NULL AND episode IS NULL AND show_id IS NOT NULL);

-- Unique: one movie entry per user
CREATE UNIQUE INDEX "user_collection_movie_idx"
    ON "user_collection" ("user_id", "movie_id")
    WHERE (movie_id IS NOT NULL);

CREATE INDEX "user_collection_user_idx" ON "user_collection" ("user_id");
