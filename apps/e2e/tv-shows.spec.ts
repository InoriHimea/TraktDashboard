import { test, expect } from "@playwright/test";

// T02 — TV Shows list: filter tabs, search, click through to detail.

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

function makeShow(overrides = {}) {
    return {
        show: {
            id: 1,
            tmdbId: 1001,
            traktId: 5001,
            traktSlug: "neon-signal",
            title: "Neon Signal",
            translatedName: "霓虹信号",
            originalName: "Neon Signal",
            overview: "A gripping drama.",
            status: "returning series",
            network: "HBO",
            genres: ["Drama"],
            posterPath: null,
            backdropPath: null,
            totalEpisodes: 20,
            totalSeasons: 2,
            lastSyncedAt: "2026-06-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
        },
        watchedEpisodes: 12,
        airedEpisodes: 15,
        totalEpisodes: 20,
        nextEpisode: null,
        lastWatchedAt: "2026-05-30T00:00:00.000Z",
        percentage: 60,
        completed: false,
        resetAt: null,
        ...overrides,
    };
}

test.describe("T02 — TV Shows list", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(AUTH_OK),
            }),
        );
        await page.route("**/api/shows/progress**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [makeShow()], total: 1, limit: 50, offset: 0 }),
            }),
        );
    });

    test("renders show list with at least one card", async ({ page }) => {
        await page.goto("/tv-shows");
        // Wait for the show card to appear
        const showCard = page.locator("a[href*='/shows/']").first();
        await expect(showCard).toBeVisible({ timeout: 10_000 });
    });

    test("filter tabs are rendered", async ({ page }) => {
        await page.goto("/tv-shows");
        // Look for filter buttons (全部, 追剧中, 已完结, etc.)
        const tabs = page.getByRole("button").or(page.locator("[role='tab']"));
        await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    });

    test("clicking a show card navigates to detail", async ({ page }) => {
        await page.route("**/api/shows/1**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: {
                        show: makeShow().show,
                        watchedEpisodes: 12,
                        airedEpisodes: 15,
                        totalEpisodes: 20,
                        nextEpisode: null,
                        lastWatchedAt: null,
                        percentage: 60,
                        completed: false,
                        resetAt: null,
                    },
                }),
            }),
        );
        await page.route("**/api/shows/1/seasons**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [] }),
            }),
        );

        await page.goto("/tv-shows");
        const showCard = page.locator("a[href*='/shows/']").first();
        await showCard.click();
        await expect(page).toHaveURL(/\/shows\/\d+/);
    });
});
