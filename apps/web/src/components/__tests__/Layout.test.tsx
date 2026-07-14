import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Layout from "../Layout";

const mocks = vi.hoisted(() => ({
    useAuth: vi.fn(),
    useLogout: vi.fn(),
    useSettings: vi.fn(),
    setLocale: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useAuth: mocks.useAuth,
    useLogout: mocks.useLogout,
    useSettings: mocks.useSettings,
}));

vi.mock("../../lib/i18n", () => ({
    setLocale: mocks.setLocale,
}));

vi.mock("../TopNav", () => ({
    default: ({ username, onLogout }: { username: string | null; onLogout: () => void }) => (
        <nav>
            <span>{username ?? "guest"}</span>
            <button onClick={onLogout}>logout</button>
        </nav>
    ),
}));

function renderLayout() {
    return render(
        <MemoryRouter>
            <Layout>
                <p>page content</p>
            </Layout>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ data: { user: { traktUsername: "alice" } } });
    mocks.useLogout.mockReturnValue({ mutate: vi.fn() });
    mocks.useSettings.mockReturnValue({ data: undefined });
});

describe("Layout", () => {
    it("renders children and passes the username through to TopNav", () => {
        renderLayout();
        expect(screen.getByText("page content")).toBeInTheDocument();
        expect(screen.getByText("alice")).toBeInTheDocument();
    });

    it("passes null username to TopNav when unauthenticated", () => {
        mocks.useAuth.mockReturnValue({ data: undefined });
        renderLayout();
        expect(screen.getByText("guest")).toBeInTheDocument();
    });

    it("applies the user's display language via setLocale when settings load", () => {
        mocks.useSettings.mockReturnValue({ data: { displayLanguage: "en-US" } });
        renderLayout();
        expect(mocks.setLocale).toHaveBeenCalledWith("en-US");
    });

    it("does not call setLocale when settings have no displayLanguage", () => {
        mocks.useSettings.mockReturnValue({ data: { displayLanguage: null } });
        renderLayout();
        expect(mocks.setLocale).not.toHaveBeenCalled();
    });
});
