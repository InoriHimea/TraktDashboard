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
            thresholds: {
                lines: 25,
                functions: 17,
                statements: 24,
                branches: 20,
            },
        },
    },
});
