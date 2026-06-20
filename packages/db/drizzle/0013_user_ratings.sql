CREATE TABLE "user_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"show_id" integer,
	"movie_id" integer,
	"rating" integer NOT NULL,
	"rated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_ratings_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_ratings_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX "user_ratings_show_idx" ON "user_ratings" ("user_id","show_id");
CREATE UNIQUE INDEX "user_ratings_movie_idx" ON "user_ratings" ("user_id","movie_id");
CREATE INDEX "user_ratings_user_idx" ON "user_ratings" ("user_id");
