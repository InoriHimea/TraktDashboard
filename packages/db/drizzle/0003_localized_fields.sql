-- Add translated overview to shows and localized title/overview to episodes

ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "translated_overview" text;

ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "translated_title" text;
ALTER TABLE "episodes" ADD COLUMN IF NOT EXISTS "translated_overview" text;
