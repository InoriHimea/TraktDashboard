CREATE TABLE IF NOT EXISTS "user_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"show_id" integer,
	"movie_id" integer,
	"season" integer,
	"episode" integer,
	"content" text NOT NULL DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_notes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_notes_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_episode_idx"
    ON "user_notes" ("user_id","show_id","season","episode")
    WHERE (season IS NOT NULL AND episode IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_show_idx"
    ON "user_notes" ("user_id","show_id")
    WHERE (season IS NULL AND episode IS NULL AND show_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_movie_idx"
    ON "user_notes" ("user_id","movie_id")
    WHERE (movie_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS "user_notes_user_idx" ON "user_notes" ("user_id");
