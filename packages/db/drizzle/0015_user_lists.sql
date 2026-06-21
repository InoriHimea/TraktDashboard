CREATE TABLE IF NOT EXISTS "user_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trakt_id" integer,
	"trakt_slug" text,
	"name" text NOT NULL,
	"description" text,
	"privacy" text DEFAULT 'private' NOT NULL,
	"sort_by" text DEFAULT 'rank' NOT NULL,
	"sort_how" text DEFAULT 'asc' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_lists_trakt_idx" ON "user_lists" ("user_id","trakt_id") WHERE (trakt_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS "user_lists_user_idx" ON "user_lists" ("user_id");

CREATE TABLE IF NOT EXISTS "user_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"list_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"show_id" integer,
	"movie_id" integer,
	"rank" integer,
	"notes" text,
	"listed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_list_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_list_items_list_id_user_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "user_lists"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_list_items_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_list_items_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_list_items_show_idx" ON "user_list_items" ("list_id","show_id") WHERE (show_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "user_list_items_movie_idx" ON "user_list_items" ("list_id","movie_id") WHERE (movie_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS "user_list_items_list_idx" ON "user_list_items" ("list_id");
