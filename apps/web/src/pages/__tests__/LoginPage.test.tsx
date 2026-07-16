import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LoginPage from "../LoginPage";

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/tv-shows" element={<div>TV Shows Page</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("LoginPage", () => {
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
});
