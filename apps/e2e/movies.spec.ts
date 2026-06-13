import { test, expect } from "@playwright/test";

// T04 — Movie path: list → detail → mark-watched dialog → confirm.

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

const MOVIE = {
    id: 9,
    tmdbId: 9009,
    imdbId: "tt9009",
    traktId: 7009,
    traktSlug: "midnight-protocol",
    title: "Midnight Protocol",
    overview: "A tense thriller.",
    releaseDate: "2026-01-01",
    runtime: 118,
    posterPath: null,
    backdropPath: null,
    genres: ["Thriller"],
    lastSyncedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
};

const MOVIE_PROGRESS = {
    movie: MOVIE,
    watchCount: 1,
    lastWatchedAt: "2026-05-15T00:00:00.000Z",
};

test.describe("T04 — Movie path", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/auth/me", (route) =>
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
                body: JSON.stringify({ data: [MOVIE_PROGRESS], total: 1, limit: 50, offset: 0 }),
            }),
        );
    });

    test("renders movie list with at least one card", async ({ page }) => {
        await page.goto("/movies");
        const movieCard = page.locator("a[href*='/movies/']").first();
        await expect(movieCard).toBeVisible({ timeout: 10_000 });
    });

    test("clicking movie navigates to detail page", async ({ page }) => {
        await page.route("**/api/movies/9**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: MOVIE_PROGRESS }),
            }),
        );
        await page.route("**/api/movies/9/history**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [] }),
            }),
        );

        await page.goto("/movies");
        const movieCard = page.locator("a[href*='/movies/']").first();
        await movieCard.click();
        await expect(page).toHaveURL(/\/movies\/\d+/);
    });

    test("movie detail page renders title", async ({ page }) => {
        await page.route("**/api/movies/9**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: MOVIE_PROGRESS }),
            }),
        );
        await page.route("**/api/movies/9/history**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [] }),
            }),
        );

        await page.goto("/movies/9");
        await expect(page.getByText(/Midnight Protocol/i).first()).toBeVisible({ timeout: 10_000 });
    });
});
