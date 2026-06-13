-- N4-T03: Add sync_runs table for observability persistence.
-- Retains at most 100 rows per user; pruning happens in finalizeSyncRun().

CREATE TABLE "sync_runs" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "started_at" timestamp with time zone NOT NULL,
    "finished_at" timestamp with time zone,
    "type" text NOT NULL DEFAULT 'full',
    "status" text NOT NULL DEFAULT 'completed',
    "tmdb_requests" integer NOT NULL DEFAULT 0,
    "trakt_requests" integer NOT NULL DEFAULT 0,
    "retry_count" integer NOT NULL DEFAULT 0,
    "error_count" integer NOT NULL DEFAULT 0,
    "duration_ms" bigint,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "sync_runs_user_id_idx" ON "sync_runs" USING btree ("user_id");
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs" USING btree ("started_at");
