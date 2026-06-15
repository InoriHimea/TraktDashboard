import { test, expect } from "@playwright/test";

// T03 — Show detail: Hero section, external links, episode list, mark-watched toast.

const AUTH_OK = {
    authenticated: true,
    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
};

const SHOW = {
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
    totalEpisodes: 3,
    totalSeasons: 1,
    lastSyncedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
};

// Matches the real ShowProgress shape returned by GET /api/shows/:id, including
// the nested `seasons` array the detail page reads (no separate seasons fetch).
const SHOW_DETAIL = {
    data: {
        show: SHOW,
        watchedEpisodes: 1,
        airedEpisodes: 2,
        nextEpisode: {
            id: 102,
            seasonNumber: 1,
            episodeNumber: 2,
            title: "Episode 2",
            translatedTitle: null,
            airDate: "2026-06-01",
            stillPath: null,
        },
        lastWatchedAt: "2026-05-28T00:00:00.000Z",
        percentage: 33,
        completed: false,
        seasons: [
            {
                seasonNumber: 1,
                episodeCount: 3,
                airedCount: 2,
                watchedCount: 1,
                posterPath: null,
                episodes: [
                    {
                        episodeId: 101,
                        seasonNumber: 1,
                        episodeNumber: 1,
                        title: "Pilot",
                        translatedTitle: null,
                        overview: "First episode",
                        translatedOverview: null,
                        airDate: "2026-05-01",
                        watched: true,
                        watchedAt: "2026-05-28T00:00:00.000Z",
                        aired: true,
                        stillPath: null,
                        runtime: 45,
                    },
                    {
                        episodeId: 102,
                        seasonNumber: 1,
                        episodeNumber: 2,
                        title: "The Signal",
                        translatedTitle: null,
                        overview: "Second episode",
                        translatedOverview: null,
                        airDate: "2026-06-01",
                        watched: false,
                        watchedAt: null,
                        aired: true,
                        stillPath: null,
                        runtime: 45,
                    },
                ],
            },
        ],
    },
};

test.describe("T03 — Show detail page", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(AUTH_OK),
            }),
        );
        await page.route("**/api/shows/1**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(SHOW_DETAIL),
            }),
        );
    });

    test("renders show title in hero section", async ({ page }) => {
        await page.goto("/shows/1");
        // Title should appear somewhere on the page
        await expect(page.getByText(/霓虹信号|Neon Signal/i).first()).toBeVisible({
            timeout: 10_000,
        });
    });

    test("renders episode list", async ({ page }) => {
        await page.goto("/shows/1");
        await expect(page.getByText(/Pilot|Episode/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test("Trakt external link is present", async ({ page }) => {
        await page.goto("/shows/1");
        const traktLink = page.locator("a[href*='trakt.tv']").first();
        await expect(traktLink).toBeVisible({ timeout: 10_000 });
    });
});
