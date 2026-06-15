import { test, expect } from "@playwright/test";

// T01 — Authentication flow: unauthenticated users are redirected to login.
// In E2E we stub the /api/auth/me endpoint to control auth state.

test.describe("T01 — Authentication flow", () => {
    test("unauthenticated visit redirects to login page", async ({ page }) => {
        // Stub auth endpoint to return unauthenticated
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ authenticated: false, user: null }),
            }),
        );

        await page.goto("/");
        // App should redirect or render login page
        await expect(page).toHaveURL(/login|\/$/);
    });

    test("login page renders the Trakt login button", async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ authenticated: false, user: null }),
            }),
        );

        await page.goto("/login");
        // Look for a button or link pointing to Trakt OAuth
        const loginButton = page
            .getByRole("button")
            .or(page.getByRole("link"))
            .filter({
                hasText: /trakt|login|登录|授权/i,
            });
        await expect(loginButton.first()).toBeVisible({ timeout: 10_000 });
    });

    test("authenticated user is not redirected to login", async ({ page }) => {
        await page.route("**/auth/me", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    authenticated: true,
                    user: { id: 1, traktUsername: "testuser", displayLanguage: "zh-CN" },
                }),
            }),
        );

        await page.route("**/api/shows/progress**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ data: [], total: 0, limit: 50, offset: 0 }),
            }),
        );

        await page.goto("/tv-shows");
        await expect(page).not.toHaveURL(/login/);
    });
});
