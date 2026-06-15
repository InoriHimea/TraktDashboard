import { test, expect } from "@playwright/test";

// T06 — Global watch-history timeline: renders episode + movie entries.

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

const HISTORY = {
    data: {
        entries: [
            {
                id: 1,
                mediaType: "episode",
                watchedAt: "2026-06-14T20:00:00.000Z",
                source: "trakt",
                show: {
                    id: 10,
                    title: "Neon Signal",
                    translatedName: "霓虹信号",
                    posterPath: null,
                },
                episode: { id: 101, seasonNumber: 1, episodeNumber: 5, title: "The Fifth Wave" },
            },
            {
                id: 2,
                mediaType: "movie",
                watchedAt: "2026-06-13T18:00:00.000Z",
                source: "trakt",
                movie: { id: 20, title: "Inception", posterPath: null },
            },
        ],
        total: 2,
    },
};

test.describe("T06 — History page", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(AUTH_OK),
            }),
        );
        await page.route("**/api/history**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(HISTORY),
            }),
        );
    });

    test("renders both episode and movie history entries", async ({ page }) => {
        await page.goto("/history");
        await expect(page.getByText(/霓虹信号|Neon Signal/i).first()).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByText("Inception").first()).toBeVisible();
        // Episode code is data-derived and locale-independent
        await expect(page.getByText("S01·E05").first()).toBeVisible();
    });
});
