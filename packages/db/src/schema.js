import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex, index, } from "drizzle-orm/pg-core";
// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    traktUsername: text("trakt_username"),
    traktAccessToken: text("trakt_access_token").notNull(),
    traktRefreshToken: text("trakt_refresh_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
        withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// ─── Shows ────────────────────────────────────────────────────────────────────
export const shows = pgTable("shows", {
    id: serial("id").primaryKey(),
    tmdbId: integer("tmdb_id").notNull().unique(),
    tvdbId: integer("tvdb_id"),
    imdbId: text("imdb_id"),
    traktId: integer("trakt_id"),
    traktSlug: text("trakt_slug"),
    title: text("title").notNull(),
    overview: text("overview"),
    status: text("status").notNull().default("unknown"),
    firstAired: text("first_aired"),
    network: text("network"),
    genres: jsonb("genres").$type().notNull().default([]),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    totalEpisodes: integer("total_episodes").notNull().default(0),
    totalSeasons: integer("total_seasons").notNull().default(0),
    // Task 1.2: Multilingual fields
    originalName: text("original_name"),
    translatedName: text("translated_name"),
    translatedOverview: text("translated_overview"),
    displayLanguage: text("display_language"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [
    index("shows_trakt_id_idx").on(t.traktId),
    index("shows_imdb_id_idx").on(t.imdbId),
]);
// ─── Seasons ─────────────────────────────────────────────────────────────────
export const seasons = pgTable("seasons", {
    id: serial("id").primaryKey(),
    showId: integer("show_id")
        .notNull()
        .references(() => shows.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull(),
    episodeCount: integer("episode_count").notNull().default(0),
    airDate: text("air_date"),
    overview: text("overview"),
    posterPath: text("poster_path"),
}, (t) => [
    uniqueIndex("seasons_show_season_idx").on(t.showId, t.seasonNumber),
]);
// ─── Episodes ─────────────────────────────────────────────────────────────────
export const episodes = pgTable("episodes", {
    id: serial("id").primaryKey(),
    showId: integer("show_id")
        .notNull()
        .references(() => shows.id, { onDelete: "cascade" }),
    seasonId: integer("season_id").references(() => seasons.id, {
        onDelete: "set null",
    }),
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number").notNull(),
    title: text("title"),
    overview: text("overview"),
    translatedTitle: text("translated_title"),
    translatedOverview: text("translated_overview"),
    runtime: integer("runtime"),
    airDate: text("air_date"),
    stillPath: text("still_path"),
    traktId: integer("trakt_id"),
    tmdbId: integer("tmdb_id"),
}, (t) => [
    uniqueIndex("episodes_show_s_e_idx").on(t.showId, t.seasonNumber, t.episodeNumber),
    index("episodes_show_id_idx").on(t.showId),
    index("episodes_trakt_id_idx").on(t.traktId),
]);
// ─── Watch History ─────────────────────────────────────────────────────────────
export const watchHistory = pgTable("watch_history", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    episodeId: integer("episode_id")
        .notNull()
        .references(() => episodes.id, { onDelete: "cascade" }),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
    source: text("source").notNull().default("manual"),
    traktPlayId: text("trakt_play_id").unique(),
}, (t) => [
    index("watch_history_user_idx").on(t.userId),
    index("watch_history_episode_idx").on(t.episodeId),
    index("watch_history_watched_at_idx").on(t.watchedAt),
]);
// ─── User Show Progress (materialized cache) ───────────────────────────────────
export const userShowProgress = pgTable("user_show_progress", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    showId: integer("show_id")
        .notNull()
        .references(() => shows.id, { onDelete: "cascade" }),
    airedEpisodes: integer("aired_episodes").notNull().default(0),
    watchedEpisodes: integer("watched_episodes").notNull().default(0),
    nextEpisodeId: integer("next_episode_id").references(() => episodes.id, { onDelete: "set null" }),
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [
    uniqueIndex("usp_user_show_idx").on(t.userId, t.showId),
    index("usp_user_idx").on(t.userId),
]);
// ─── Metadata Cache ────────────────────────────────────────────────────────────
export const metadataCache = pgTable("metadata_cache", {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    data: jsonb("data").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [
    uniqueIndex("metadata_cache_source_id_idx").on(t.source, t.externalId),
]);
// ─── Sync State ───────────────────────────────────────────────────────────────
export const syncState = pgTable("sync_state", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" })
        .unique(),
    status: text("status").notNull().default("idle"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    currentShow: text("current_show"),
    progress: integer("progress").notNull().default(0),
    total: integer("total").notNull().default(0),
    error: text("error"),
    // Task 7.1: Track per-show sync failures
    failedShows: jsonb("failed_shows")
        .$type()
        .notNull()
        .default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// ─── User Settings ────────────────────────────────────────────────────────────
export const userSettings = pgTable("user_settings", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" })
        .unique(),
    displayLanguage: text("display_language").notNull().default("zh-CN"),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    httpProxy: text("http_proxy"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
// ─── Watch Reset Cursors ───────────────────────────────────────────────────────
export const watchResetCursors = pgTable("watch_reset_cursors", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    showId: integer("show_id")
        .notNull()
        .references(() => shows.id, { onDelete: "cascade" }),
    resetAt: timestamp("reset_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [
    index("wrc_user_show_idx").on(t.userId, t.showId),
    index("wrc_reset_at_idx").on(t.resetAt),
]);
//# sourceMappingURL=schema.js.map