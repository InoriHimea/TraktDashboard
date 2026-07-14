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
            thresholds: {
                lines: 71,
                functions: 70,
                statements: 70,
                branches: 57,
            },
        },
    },
});
