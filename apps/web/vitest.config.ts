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
            // N3-T02: ratcheted up from initial P1-T05 floor (~14% lines → 20%).
            thresholds: {
                lines: 28,
                functions: 17,
                statements: 27,
                branches: 22,
            },
        },
    },
});
