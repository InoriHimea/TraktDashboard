import { test, expect } from "@playwright/test";

// T07 — Watchlist page: renders show + movie items with type badges.

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

const WATCHLIST = {
    data: [
        {
            id: 1,
            addedAt: "2026-06-01T00:00:00.000Z",
            listedAt: "2026-06-01T00:00:00.000Z",
            notes: null,
            show: { id: 10, title: "Neon Signal", posterPath: null },
        },
        {
            id: 2,
            addedAt: "2026-06-02T00:00:00.000Z",
            listedAt: "2026-06-02T00:00:00.000Z",
            notes: null,
            movie: { id: 20, title: "Inception", posterPath: null },
        },
    ],
};

test.describe("T07 — Watchlist page", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(AUTH_OK),
            }),
        );
        await page.route("**/api/watchlist**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(WATCHLIST),
            }),
        );
    });

    test("renders both a show and a movie watchlist item", async ({ page }) => {
        await page.goto("/watchlist");
        await expect(page.getByText("Neon Signal").first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("Inception").first()).toBeVisible();
    });
});
