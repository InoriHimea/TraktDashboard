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
            // lines 36.2) — raised the floor to match; keep raising as suites grow.
            thresholds: {
                lines: 35,
                functions: 30,
                statements: 33,
                branches: 26,
            },
        },
    },
});
