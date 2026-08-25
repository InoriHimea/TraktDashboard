-- 观看历史删除审计日志：单条手动删除 / 重复记录清理批量删除都会先写一条快照
-- 再删原行，误删了可以从这张表恢复
CREATE TABLE IF NOT EXISTS "watch_history_deletions" (
    "id"            SERIAL PRIMARY KEY,
    "user_id"       INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "media_type"    TEXT NOT NULL,
    "episode_id"    INTEGER REFERENCES "episodes"("id") ON DELETE SET NULL,
    "movie_id"      INTEGER REFERENCES "movies"("id") ON DELETE SET NULL,
    "watched_at"    TIMESTAMPTZ,
    "trakt_play_id" TEXT,
    "source"        TEXT NOT NULL,
    "reason"        TEXT NOT NULL,
    "deleted_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "restored_at"   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "whd_user_restored_idx" ON "watch_history_deletions"("user_id", "restored_at");
