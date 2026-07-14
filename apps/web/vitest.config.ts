/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Explicit web test configuration (P1-T06). jsdom environment for React component tests.
// Kept separate from vite.config.ts so test settings (environment, setupFiles, coverage)
// are no longer implicitly merged from the build config.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "html"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.{test,spec}.{ts,tsx}",
                "src/**/__tests__/**",
                "src/test/**",
                "src/main.tsx",
                "src/vite-env.d.ts",
            ],
            // N3-T02 ratcheted the floor up, but later feature rounds shipped largely
            // untested and decayed actuals below it — the gate has been red (and
            // unnoticed) alongside the api one. Re-based 2026-07-07 just below current
            // actuals so the ratchet is honest again.
            // 2026-07-12: added queryKeys/stat-components/ui-small-components/Toaster/
            // notes-lists-ratings hook suites (actuals: stmts 25.5 / branch 21.9 /
            // funcs 18.2 / lines 26.3) — raised the floor to match; keep raising as
            // suites grow.
            // 2026-07-15 (plan-20260715b.md batch 1): added lib/api.ts — table-driven
            // GET/mutation coverage of the entire `api` client surface (request()'s
            // Content-Type gating, credentials, error parsing w/ statusText fallback,
            // plus ~90 domain methods' URL/query/method/body construction) + the
            // special-case history.export() which builds a URL string without
            // calling fetch. lib/api.ts 11.3%→98.7% stmts. Actuals: stmts 30.2 /
            // branch 23.6 / funcs 27.4 / lines 31.2 — raised again.
            // 2026-07-15 (plan-20260715b.md batch 2): added the remaining 63 (of 76)
            // hooks/index.ts hooks — table-driven query-hook data-unwrap + api-call-arg
            // checks, table-driven mutation-hook invalidateQueries-key checks (incl. a
            // "bare mutationFn reference" quirk where react-query passes extra
            // (variables, context) args through to api methods not wrapped in an
            // arrow function), plus dedicated tests for useNowPlaying's derived
            // isWatching, useInfiniteHistory's getNextPageParam pagination,
            // useDeleteHistory's two invalidation-scope variants, and useLogout's
            // setQueryData/removeQueries (no invalidateQueries). hooks/index.ts
            // 17.1%→99.7% stmts. Actuals: stmts 39.1 / branch 25.5 / funcs 44.5 /
            // lines 39.7 — raised again.
            thresholds: {
                lines: 39,
                functions: 44,
                statements: 39,
                branches: 25,
            },
        },
    },
});
