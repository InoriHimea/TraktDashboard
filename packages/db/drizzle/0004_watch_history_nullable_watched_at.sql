-- Make watched_at nullable to support "Unknown date" watch records
ALTER TABLE watch_history ALTER COLUMN watched_at DROP NOT NULL;

-- Add source column to track manual vs trakt-synced records
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Drop old dedup index that included watched_at (nullable columns in unique indexes behave differently)
DROP INDEX IF EXISTS watch_history_dedup_idx;

-- Create new watch_reset_cursors table for progress reset cursor mechanism
CREATE TABLE IF NOT EXISTS watch_reset_cursors (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_id     INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  reset_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wrc_user_show_idx ON watch_reset_cursors(user_id, show_id);
CREATE INDEX IF NOT EXISTS wrc_reset_at_idx  ON watch_reset_cursors(reset_at);
