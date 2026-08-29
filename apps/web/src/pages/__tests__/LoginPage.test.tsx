import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LoginPage from "../LoginPage";
import * as apiModule from "@/lib/api";

function renderAt(path: string) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/tv-shows" element={<div>TV Shows Page</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe("LoginPage", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the headline and the Trakt connect CTA link", () => {
        const { container } = renderAt("/login");
        // "media"/"dash" flank a nested <span>·</span>, so the h1's combined
        // text is "media·dash" rather than a standalone "media" text node.
        expect(container.querySelector("h1")?.textContent).toBe("media·dash");
        expect(screen.getByText("Connect with Trakt")).toBeInTheDocument();
        const link = screen.getByRole("link", { name: /Connect with Trakt/ });
        expect(link).toHaveAttribute("href", "/auth/trakt");
    });

    it("renders the feature list, metrics, and trust items", () => {
        renderAt("/login");
        expect(screen.getByText("Episode progress")).toBeInTheDocument();
        expect(screen.getByText("Movies library")).toBeInTheDocument();
        expect(screen.getByText("Auto-sync")).toBeInTheDocument();
        expect(screen.getByText("128")).toBeInTheDocument();
        expect(screen.getByText("Shows")).toBeInTheDocument();
        expect(screen.getByText("Free Trakt account required")).toBeInTheDocument();
    });

    it("does not redirect when there is no auth query param", () => {
        renderAt("/login");
        expect(screen.getByText("Connect with Trakt")).toBeInTheDocument();
        expect(screen.queryByText("TV Shows Page")).not.toBeInTheDocument();
    });

    it("redirects to /tv-shows when ?auth=success is present", () => {
        renderAt("/login?auth=success");
        expect(screen.getByText("TV Shows Page")).toBeInTheDocument();
    });

    it("does not redirect for an unrelated auth query value", () => {
        renderAt("/login?auth=failed");
        expect(screen.getByText("Connect with Trakt")).toBeInTheDocument();
    });

    it("renders the local auth form with username and password inputs and the 'or' divider", () => {
        renderAt("/login");
        expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
        expect(screen.getByText("— or —")).toBeInTheDocument();
    });

    it("calls the login API and redirects to /tv-shows on success", async () => {
        renderAt("/login");
        const mockLogin = vi.spyOn(apiModule.api.auth.local, "login").mockResolvedValue({
            ok: true,
            token: "fake-token",
            user: { id: 1, localUsername: "test", traktUsername: null },
        });

        fireEvent.change(screen.getByPlaceholderText("Username"), {
            target: { value: "testuser" },
        });
        fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "secret" } });
        fireEvent.click(screen.getByRole("button", { name: "Login" }));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith({ username: "testuser", password: "secret" });
        });
        await waitFor(() => {
            expect(screen.getByText("TV Shows Page")).toBeInTheDocument();
        });
    });

    it("calls the register API and redirects to /tv-shows on success", async () => {
        renderAt("/login");
        const mockRegister = vi.spyOn(apiModule.api.auth.local, "register").mockResolvedValue({
            ok: true,
            userId: 2,
            localUsername: "newuser",
        });

        // Switch to register mode
        fireEvent.click(screen.getByText("Register"));
        expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "newuser" } });
        fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "newpass" } });
        fireEvent.click(screen.getByRole("button", { name: "Register" }));

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith({ username: "newuser", password: "newpass" });
        });
        await waitFor(() => {
            expect(screen.getByText("TV Shows Page")).toBeInTheDocument();
        });
    });

    it("displays an error message when login API fails", async () => {
        renderAt("/login");
        vi.spyOn(apiModule.api.auth.local, "login").mockRejectedValue(
            new Error("Invalid credentials"),
        );

        fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "baduser" } });
        fireEvent.change(screen.getByPlaceholderText("Password"), {
            target: { value: "wrongpass" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Login" }));

        await waitFor(() => {
            expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
        });
    });
});
