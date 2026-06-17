ALTER TABLE "user_settings"
  ADD COLUMN "jellyfin_url" text,
  ADD COLUMN "jellyfin_api_key" text,
  ADD COLUMN "jellyfin_auto_delete_library_ids" text;
