import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
    if (!_db) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error("DATABASE_URL is not set");
        const client = postgres(connectionString, { max: 10 });
        _db = drizzle(client, { schema });
    }
    return _db;
}

export type Db = ReturnType<typeof getDb>;

export async function runMigrations() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const client = postgres(connectionString, { max: 1 });
    const db = drizzle(client, { schema });
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = resolve(__dirname, "../drizzle");
    console.log("[db] Running migrations from:", migrationsFolder);
    await migrate(db, { migrationsFolder });
    // Belt-and-suspenders: if a migration was previously recorded in
    // __drizzle_migrations without the DDL actually executing (e.g. via db:push
    // or manual SQL that wasn't tracked), apply the DDL explicitly here.
    // All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

    // 0011 — Jellyfin settings columns
    await db.execute(sql`
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "jellyfin_url" text,
        ADD COLUMN IF NOT EXISTS "jellyfin_api_key" text,
        ADD COLUMN IF NOT EXISTS "jellyfin_auto_delete_library_ids" text
    `);

    // 0013 — user_ratings
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_ratings" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "media_type" text NOT NULL,
            "show_id" integer REFERENCES "shows"("id") ON DELETE cascade,
            "movie_id" integer REFERENCES "movies"("id") ON DELETE cascade,
            "rating" integer NOT NULL,
            "rated_at" timestamp with time zone,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    `);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_ratings_show_idx" ON "user_ratings" ("user_id","show_id")`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_ratings_movie_idx" ON "user_ratings" ("user_id","movie_id")`,
    );
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_ratings_user_idx" ON "user_ratings" ("user_id")`,
    );

    // 0014 — user_notes
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_notes" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "media_type" text NOT NULL,
            "show_id" integer REFERENCES "shows"("id") ON DELETE cascade,
            "movie_id" integer REFERENCES "movies"("id") ON DELETE cascade,
            "season" integer,
            "episode" integer,
            "content" text NOT NULL DEFAULT '',
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    `);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_episode_idx" ON "user_notes" ("user_id","show_id","season","episode") WHERE (season IS NOT NULL AND episode IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_show_idx" ON "user_notes" ("user_id","show_id") WHERE (season IS NULL AND episode IS NULL AND show_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_notes_movie_idx" ON "user_notes" ("user_id","movie_id") WHERE (movie_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_notes_user_idx" ON "user_notes" ("user_id")`,
    );

    // 0015 — user_lists + user_list_items
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_lists" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "trakt_id" integer,
            "trakt_slug" text,
            "name" text NOT NULL,
            "description" text,
            "privacy" text DEFAULT 'private' NOT NULL,
            "sort_by" text DEFAULT 'rank' NOT NULL,
            "sort_how" text DEFAULT 'asc' NOT NULL,
            "item_count" integer DEFAULT 0 NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    `);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_lists_trakt_idx" ON "user_lists" ("user_id","trakt_id") WHERE (trakt_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_lists_user_idx" ON "user_lists" ("user_id")`,
    );
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_list_items" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "list_id" integer NOT NULL REFERENCES "user_lists"("id") ON DELETE cascade,
            "media_type" text NOT NULL,
            "show_id" integer REFERENCES "shows"("id") ON DELETE cascade,
            "movie_id" integer REFERENCES "movies"("id") ON DELETE cascade,
            "rank" integer,
            "notes" text,
            "listed_at" timestamp with time zone,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    `);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_list_items_show_idx" ON "user_list_items" ("list_id","show_id") WHERE (show_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_list_items_movie_idx" ON "user_list_items" ("list_id","movie_id") WHERE (movie_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_list_items_list_idx" ON "user_list_items" ("list_id")`,
    );

    // 0016 — user_collection
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_collection" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "media_type" text NOT NULL,
            "show_id" integer REFERENCES "shows"("id") ON DELETE cascade,
            "movie_id" integer REFERENCES "movies"("id") ON DELETE cascade,
            "season" integer,
            "episode" integer,
            "media_format" text,
            "resolution" text,
            "hdr" text,
            "audio" text,
            "audio_channels" text,
            "collected_at" timestamp with time zone,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        )
    `);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_collection_episode_idx" ON "user_collection" ("user_id","show_id","season","episode") WHERE (season IS NOT NULL AND episode IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_collection_show_idx" ON "user_collection" ("user_id","show_id") WHERE (season IS NULL AND episode IS NULL AND show_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "user_collection_movie_idx" ON "user_collection" ("user_id","movie_id") WHERE (movie_id IS NOT NULL)`,
    );
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "user_collection_user_idx" ON "user_collection" ("user_id")`,
    );

    // 0017 — backup settings + backup_runs
    await db.execute(sql`
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "gdrive_token" text,
        ADD COLUMN IF NOT EXISTS "webdav_url" text,
        ADD COLUMN IF NOT EXISTS "webdav_username" text,
        ADD COLUMN IF NOT EXISTS "webdav_password" text,
        ADD COLUMN IF NOT EXISTS "backup_auto_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "backup_retention_days" integer NOT NULL DEFAULT 30
    `);
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "backup_runs" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "provider" text NOT NULL,
            "status" text NOT NULL,
            "filename" text,
            "size_bytes" bigint,
            "file_id" text,
            "error" text,
            "started_at" timestamp with time zone NOT NULL DEFAULT now(),
            "finished_at" timestamp with time zone
        )
    `);
    await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "backup_runs_user_idx" ON "backup_runs" ("user_id")`,
    );

    // 0018 — OneDrive + S3 + 定时备份列
    await db.execute(sql`
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "onedrive_token" text,
        ADD COLUMN IF NOT EXISTS "s3_endpoint" text,
        ADD COLUMN IF NOT EXISTS "s3_region" text,
        ADD COLUMN IF NOT EXISTS "s3_bucket" text,
        ADD COLUMN IF NOT EXISTS "s3_access_key_id" text,
        ADD COLUMN IF NOT EXISTS "s3_secret_access_key" text,
        ADD COLUMN IF NOT EXISTS "backup_schedule_hours" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "backup_active_provider" text
    `);

    // 0019 — movies.tmdb_id 允许为空，为无 TMDB 链接的电影（如部分中文影片）保存 Trakt 记录
    await db.execute(sql`ALTER TABLE "movies" ALTER COLUMN "tmdb_id" DROP NOT NULL`);
    await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "movies_trakt_id_unique_idx" ON "movies"("trakt_id") WHERE "trakt_id" IS NOT NULL`,
    );

    await client.end();
    console.log("[db] Migrations complete");
}
