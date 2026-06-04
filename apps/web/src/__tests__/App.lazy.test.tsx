import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const mocks = vi.hoisted(() => ({
    useAuth: vi.fn(),
}));

vi.mock("../hooks", () => ({
    useAuth: mocks.useAuth,
}));

vi.mock("../components/Layout", () => ({
    default: ({ children }: { children: ReactNode }) => (
        <main data-testid="app-layout">{children}</main>
    ),
}));

vi.mock("../pages/TVShowsPage", () => ({
    default: () => <div>Lazy TV shows route</div>,
}));

describe("App lazy routes", () => {
    beforeEach(() => {
        mocks.useAuth.mockReturnValue({
            data: { authenticated: true, user: { id: 1 } },
            isLoading: false,
            error: null,
        });
    });

    it("renders the lazy TV shows route inside the existing layout", async () => {
        render(
            <MemoryRouter initialEntries={["/"]}>
                <App />
            </MemoryRouter>,
        );

        expect(await screen.findByText("Lazy TV shows route")).toBeInTheDocument();
        expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });
});
