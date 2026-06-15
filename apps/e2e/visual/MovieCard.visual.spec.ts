import { test, expect } from "@playwright/test";

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

const MOVIE_PROGRESS = {
    movie: {
        id: 9,
        tmdbId: 9009,
        imdbId: "tt9009",
        traktId: 7009,
        traktSlug: "midnight-protocol",
        title: "Midnight Protocol",
        overview: "A tense thriller set in the digital age.",
        releaseDate: "2026-01-01",
        runtime: 118,
        posterPath: null,
        backdropPath: null,
        genres: ["Thriller"],
        lastSyncedAt: "2026-06-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
    },
    watchCount: 1,
    lastWatchedAt: "2026-05-15T00:00:00.000Z",
};

test.describe("MovieCard visual regression", () => {
    // Visual baselines are platform-specific (font rendering differs across OSes), so this
    // is opt-in: run `RUN_VISUAL=1 pnpm test:e2e` after generating a baseline with
    // `--update-snapshots` on the target platform. Skipped by default to keep CI deterministic.
    test.skip(!process.env.RUN_VISUAL, "Set RUN_VISUAL=1 to run visual regression");

    test.beforeEach(async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(AUTH_OK),
            }),
        );
        await page.route("**/api/movies/progress**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: [MOVIE_PROGRESS],
                    total: 1,
                    limit: 50,
                    offset: 0,
                }),
            }),
        );
    });

    test("renders consistently", async ({ page }) => {
        await page.goto("/movies");
        const card = page.locator('[data-testid="movie-card"]').first();
        await expect(card).toBeVisible({ timeout: 10_000 });
        // Freeze animation by waiting for settle
        await page.waitForTimeout(500);
        await expect(card).toHaveScreenshot("movie-card.png", { maxDiffPixels: 50 });
    });
});
