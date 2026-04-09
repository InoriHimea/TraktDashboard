-- Task 2.1: user_settings table and shows multilingual fields

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "display_language" text NOT NULL DEFAULT 'zh-CN',
  "sync_interval_minutes" integer NOT NULL DEFAULT 60,
  "http_proxy" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "original_name" text;
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "translated_name" text;
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "display_language" text;
