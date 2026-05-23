CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"show_id" integer,
	"movie_id" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"listed_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_show_idx" ON "watchlist" USING btree ("user_id","show_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_movie_idx" ON "watchlist" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "watchlist_user_id_idx" ON "watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watchlist_added_at_idx" ON "watchlist" USING btree ("added_at");