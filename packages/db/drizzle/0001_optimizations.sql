-- Task 6.1/6.2: Add composite unique index on watch_history for deduplication
-- (traktPlayId can be null so it cannot be relied on as the sole unique key)
CREATE UNIQUE INDEX IF NOT EXISTS "watch_history_dedup_idx"
  ON "watch_history" ("user_id", "episode_id", "watched_at");

-- Task 7.1/7.2: Add failed_shows column to sync_state
ALTER TABLE "sync_state"
  ADD COLUMN IF NOT EXISTS "failed_shows" jsonb NOT NULL DEFAULT '[]';
