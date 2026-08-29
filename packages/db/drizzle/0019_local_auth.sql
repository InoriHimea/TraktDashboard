-- 本地账号认证字段
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "local_username" TEXT,
    ADD COLUMN IF NOT EXISTS "local_password_hash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_local_username_idx"
    ON "users" ("local_username")
    WHERE "local_username" IS NOT NULL;

ALTER TABLE "users"
    ALTER COLUMN "trakt_access_token" DROP NOT NULL,
    ALTER COLUMN "trakt_refresh_token" DROP NOT NULL,
    ALTER COLUMN "token_expires_at" DROP NOT NULL;
