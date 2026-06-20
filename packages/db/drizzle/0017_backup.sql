-- F14: 云端 DB 备份
-- 扩展 user_settings，追加备份相关配置列
ALTER TABLE "user_settings"
    ADD COLUMN IF NOT EXISTS "gdrive_token"          TEXT,
    ADD COLUMN IF NOT EXISTS "webdav_url"            TEXT,
    ADD COLUMN IF NOT EXISTS "webdav_username"       TEXT,
    ADD COLUMN IF NOT EXISTS "webdav_password"       TEXT,
    ADD COLUMN IF NOT EXISTS "backup_auto_enabled"   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "backup_retention_days" INTEGER NOT NULL DEFAULT 30;

-- 备份运行历史表
CREATE TABLE IF NOT EXISTS "backup_runs" (
    "id"          SERIAL PRIMARY KEY,
    "user_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "provider"    TEXT NOT NULL,           -- 'gdrive' | 'webdav'
    "status"      TEXT NOT NULL,           -- 'success' | 'failed'
    "filename"    TEXT,
    "size_bytes"  BIGINT,
    "file_id"     TEXT,                    -- Google Drive file ID or WebDAV path
    "error"       TEXT,
    "started_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "finished_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "backup_runs_user_idx" ON "backup_runs"("user_id");
