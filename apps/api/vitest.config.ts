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
            // now at or near 100%); actuals: stmts 41.0 / branch 33.5 / funcs 38.2 /
            // lines 42.1 — raised again; keep raising as suites grow. Remaining big
            // gaps: services/backup.ts, jellyfin.ts (route+service), tmdb.ts.
            thresholds: {
                lines: 40,
                functions: 36,
                statements: 39,
                branches: 32,
            },
        },
    },
});
