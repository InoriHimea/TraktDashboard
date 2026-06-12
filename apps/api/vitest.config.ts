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
            // Initial floor (P1-T05) set just below current coverage so CI fails on
            // regression. Ratchet upward as coverage grows (current ~29% lines).
            thresholds: {
                lines: 28,
                functions: 28,
                statements: 28,
                branches: 16,
            },
        },
    },
});
