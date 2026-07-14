import { defineConfig } from "vitest/config";

// Explicit API test configuration (P1-T06). Node environment, no DOM.
export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["src/**/*.{test,spec}.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.{test,spec}.ts",
                "src/__tests__/**",
                "src/index.ts",
                "src/migrate.ts",
                "src/load-env.ts",
            ],
            // N3-T02 ratcheted the floor to 40%, but N4/N5 feature rounds (backup,
            // jellyfin, collection, lists routes) shipped largely untested and decayed
            // actuals to ~24% — the gate has been red (and unnoticed) since. Re-based
            // 2026-07-07 just below current actuals so the ratchet is honest again.
            // 2026-07-12: added collection/lists/stats/ratings/notes/auth-middleware/
            // system route suites (actuals: stmts 35.1 / branch 28.2 / funcs 32.0 /
            // lines 36.2) — raised the floor to match.
            // 2026-07-13: added trakt/discover/search/img/auth route suites (all four
            // now at or near 100%), then a second wave covering the two remaining
            // blast-radius-heavy files — jellyfin (service 99.4% + route 97.7%) and
            // backup (service 97.0% + route 74.9%, incl. the child_process-driven
            // dumpDatabase/restoreDatabase and the POST /restore endpoint itself).
            // 2026-07-14: added lib/push.ts (100%), services/tmdb.ts (98.8%), and
            // jobs/scheduler.ts (93.5%, incl. mocking bullmq's Queue/Worker + ioredis
            // and capturing the Worker processor callback to drive all 5 job.name
            // branches). Actuals: stmts 69.6 / branch 57.1 / funcs 71.0 / lines 70.5 —
            // raised again; keep raising as suites grow. Remaining gaps (all large,
            // deliberately deferred — see plan-20260714.md): services/sync.ts (2328
            // lines), services/trakt.ts (1058 lines), routes/shows.ts (808 lines),
            // routes/history.ts (409 lines).
            // 2026-07-15 (plan-20260715.md batch 1): added routes/history.ts's
            // POST /import (the file's only remaining gap — GET / and GET /export
            // were already covered) — 35.4%→98.1% stmts. Actuals: stmts 71.8 /
            // branch 59.0 / funcs 71.2 / lines 72.8 — raised again. Remaining
            // deferred large files, now decomposed into 9 more batches in
            // plan-20260715.md: services/sync.ts (2328 lines), services/trakt.ts
            // (1058 lines), routes/shows.ts (808 lines).
            // 2026-07-15 (plan-20260715.md batches 2+3): added routes/shows.ts's
            // 12 routes (read-heavy progress/up-next/:id/:id/seasons/episode-detail
            // + write-heavy watch incl. the fire-and-forget Jellyfin auto-delete
            // IIFE's 4 gating conditions/reset/mark-watched/force-sync) —
            // 23.1%→92.4% stmts. Actuals: stmts 75.2 / branch 63.0 / funcs 74.6 /
            // lines 76.3 — raised again. Remaining deferred: services/sync.ts
            // (2328 lines), services/trakt.ts (1058 lines).
            // 2026-07-15 (plan-20260715.md batches 4+5): added services/trakt.ts's
            // ~50 client methods (19 thin GET wrappers table-driven, pagination for
            // getHistory/getMovieHistory, getWatching's episode-type filter, 11
            // mutation methods' body/method shape, and the 4 stale-while-revalidate
            // cache methods incl. getEpisodeRating's 0-10→0-100 conversion and
            // stale/null degradation) — 35.5%→93.1% stmts. Actuals: stmts 77.8 /
            // branch 65.2 / funcs 80.5 / lines 79.0 — raised again. Remaining
            // deferred: services/sync.ts (2328 lines, batches 6-10).
            // 2026-07-15 (plan-20260715.md batch 6): added services/sync.ts's small
            // pure/DB-only helpers (getSyncStatus, getPostResetWatchedEpisodeIds,
            // computeWatchedEpisodes, recalcShowProgress incl. the ended/canceled +
            // fully-watched completed gate and the NOT EXISTS next-episode query,
            // recalcMovieProgress, resetStaleRunningSyncs) — services/sync.ts
            // 25.3%→28.6% stmts (small bump; the file's two largest functions,
            // forceSyncShow ~673 lines and syncMovies ~386 lines, are still in
            // batches 8-10). Actuals: stmts 78.4 / branch 65.8 / funcs 81.5 /
            // lines 79.6 — raised again.
            // 2026-07-15 (plan-20260715.md batch 7): added services/sync.ts's
            // syncWatchlist (tmdb/trakt/imdb fallback matching chain + unresolved-
            // count-gated cleanup deletes), syncRatings (batch inArray resolution),
            // and syncUserCollection (per-show + per-episode + per-movie
            // insert-vs-update branches, synced-once-per-show counting) —
            // services/sync.ts 28.6%→39.9% stmts. Actuals: stmts 80.2 / branch
            // 68.1 / funcs 83.4 / lines 81.5 — raised again. Remaining deferred:
            // syncMovies (~386 lines, batch 8), triggerFullSync/
            // triggerIncrementalSync (batch 9), forceSyncShow (~673 lines, the
            // repo's largest function, batch 10).
            // 2026-07-15 (plan-20260715.md batch 8): added services/sync.ts's
            // syncMovies (TMDB metadata resolution incl. language-fallback
            // translation lookup, tmdbId-present-vs-absent upsert paths, per-entry
            // watchHistory sync, watched-summary-only fallback that skips the
            // final recalc pass, and stale trakt-sourced history cleanup) —
            // services/sync.ts 39.9%→42.3% stmts. Actuals: stmts 80.5 / branch
            // 69.2 / funcs 83.6 / lines 81.9 — raised again. Remaining deferred:
            // triggerFullSync/triggerIncrementalSync (batch 9), forceSyncShow
            // (~673 lines, the repo's largest function, batch 10).
            // 2026-07-15 (plan-20260715.md batch 10, done ahead of batch 9 since
            // it's the simplest entry point into the shared syncSingleShow →
            // upsertShowFromTrakt → removeStaleShowMetadata → syncEpisodeProgress
            // → findOrCreateEpisode call graph that triggerFullSync/
            // triggerIncrementalSync also share): added forceSyncShow — table-
            // reference-dispatched DB mock (not a strict FIFO, given the call
            // graph's depth) covering the happy path, missing-show/missing-Trakt-id
            // guards, TMDB base-show-fetch failure degradation, stale-episode-
            // cleanup skip on a season fetch failure, title/overview localization,
            // and recording a completed episode from Trakt progress — services/
            // sync.ts 42.3%→58.1% stmts (a big jump since this call graph covers
            // most of the file's remaining surface). Actuals: stmts 83.0 / branch
            // 71.6 / funcs 85.0 / lines 84.5 — raised again. Remaining deferred:
            // triggerFullSync/triggerIncrementalSync's own orchestration (batch 9
            // — concurrency loop, retry-once, cursor rollback; the shared per-show
            // sync logic itself is already covered via forceSyncShow above).
            // 2026-07-15 (plan-20260715.md batch 9, FINAL batch of this plan):
            // added triggerFullSync/triggerIncrementalSync's own orchestration —
            // markSyncRunning concurrency gate, pLimit per-show loop, retry-once
            // pass (incl. the "no TMDB id" show still getting retried
            // unconditionally and ending up with the retry's own "Missing Trakt
            // id" error rather than the original), sync-state phase transitions,
            // and triggerIncrementalSync's cursor-rollback-to-earliest-failure
            // logic — all using trivial all-empty Trakt collections or an
            // immediate same-module "missing id" throw so the already-covered
            // deep per-show sync path isn't re-exercised. services/sync.ts
            // 58.1%→75.7% stmts. Actuals: stmts 85.8 / branch 72.9 / funcs 87.3 /
            // lines 87.6 — raised again. This closes out all 10 batches of
            // plan-20260715.md; see that file's 收尾小结 for the full summary.
            thresholds: {
                lines: 87,
                functions: 87,
                statements: 85,
                branches: 72,
            },
        },
    },
});
