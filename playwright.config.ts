import { defineConfig, devices } from "@playwright/test";

// N3-T01: Playwright E2E configuration.
// Tests run against a locally started dev server (pnpm dev).
// CI can override BASE_URL to point at a deployed instance.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

export default defineConfig({
    testDir: "./apps/e2e",
    timeout: 30_000,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    // Start the Vite dev server before running tests.
    webServer: {
        command: "pnpm dev",
        cwd: "./apps/web",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
