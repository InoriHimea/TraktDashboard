import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopNav from "../TopNav";
import { useNowPlaying, useJellyfinNowPlaying } from "../../hooks";

vi.mock("../../hooks", () => ({
    useNowPlaying: vi.fn(),
    useJellyfinNowPlaying: vi.fn(),
}));

vi.mock("../NowPlayingPopup", () => ({
    NowPlayingPopup: (props: { isOpen: boolean }) => (
        <div data-testid="now-playing-popup" data-open={String(props.isOpen)} />
    ),
}));

vi.mock("../SearchModal", () => ({
    SearchModal: (props: { onClose: () => void }) => (
        <button data-testid="search-modal" onClick={props.onClose} />
    ),
}));

const mockUseNowPlaying = vi.mocked(useNowPlaying);
const mockUseJellyfinNowPlaying = vi.mocked(useJellyfinNowPlaying);

function notWatching() {
    mockUseNowPlaying.mockReturnValue({
        data: null,
        isWatching: false,
        isLoading: false,
        error: null,
    });
    mockUseJellyfinNowPlaying.mockReturnValue({ data: null } as never);
}

function renderNav(path = "/", username: string | null = "alice") {
    const qc = new QueryClient();
    const result = render(
        <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={[path]}>
                <TopNav username={username} onLogout={vi.fn()} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
    return { ...result, qc };
}

describe("TopNav", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        notWatching();
    });

    it("renders the logo and every nav link's translated label", () => {
        const { container } = renderNav();
        expect(container.querySelector(".top-nav-logo")?.textContent).toBe("media·dash");
        for (const label of [
            "电视节目",
            "电影",
            "发现",
            "我的列表",
            "媒体库",
            "播出日历",
            "待看列表",
            "观看历史",
            "统计",
            "Jellyfin",
            "设置",
        ]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it("marks '/tv-shows' active for '/', a tv-shows path, and a show-detail path", () => {
        for (const path of ["/", "/tv-shows", "/shows/42"]) {
            const { unmount } = renderNav(path);
            expect(screen.getByRole("link", { name: /电视节目/ })).toHaveAttribute(
                "aria-current",
                "page",
            );
            unmount();
        }
    });

    it("marks '/movies' active for a nested movies path, not for '/tv-shows'", () => {
        renderNav("/movies/123");
        expect(screen.getByRole("link", { name: /电影/ })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: /电视节目/ })).not.toHaveAttribute(
            "aria-current",
            "page",
        );
    });

    it("marks a generic nav item active only for its own path or a nested path", () => {
        renderNav("/settings/general");
        expect(screen.getByRole("link", { name: /设置/ })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: /发现/ })).not.toHaveAttribute("aria-current");
    });

    it("shows the username in both places when provided, and hides it when null", () => {
        const { container } = renderNav("/", "alice");
        expect(container.querySelectorAll(".sm-show")).toHaveLength(1);
        expect(container.querySelector(".sm-show")?.textContent).toBe("@alice");
        expect(container.querySelector(".topnav-username")?.textContent).toBe("@alice");

        const { container: withoutUsername } = renderNav("/", null);
        expect(withoutUsername.querySelector(".sm-show")).toBeNull();
        expect(withoutUsername.querySelector(".topnav-username")).toBeNull();
    });

    it("opens the search modal on click and closes it via the modal's onClose", () => {
        renderNav();
        expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTitle("搜索"));
        expect(screen.getByTestId("search-modal")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("search-modal"));
        expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();
    });

    it("hides the now-playing trigger when nothing is playing", () => {
        renderNav();
        expect(screen.queryByTestId("now-playing-trigger")).not.toBeInTheDocument();
    });

    it("shows and toggles the now-playing popup when a Trakt episode is watching", () => {
        mockUseNowPlaying.mockReturnValue({
            data: null,
            isWatching: true,
            isLoading: false,
            error: null,
        });
        renderNav();
        const trigger = screen.getByTestId("now-playing-trigger");
        expect(screen.getByTestId("now-playing-popup")).toHaveAttribute("data-open", "false");
        fireEvent.click(trigger);
        expect(screen.getByTestId("now-playing-popup")).toHaveAttribute("data-open", "true");
        fireEvent.click(trigger);
        expect(screen.getByTestId("now-playing-popup")).toHaveAttribute("data-open", "false");
    });

    it("shows the now-playing trigger when only Jellyfin is playing", () => {
        mockUseJellyfinNowPlaying.mockReturnValue({ data: { jellyfinItemId: "x" } } as never);
        renderNav();
        expect(screen.getByTestId("now-playing-trigger")).toBeInTheDocument();
    });

    it("calls onLogout when the sign-out button is clicked", () => {
        const qc = new QueryClient();
        const onLogout = vi.fn();
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <TopNav username="alice" onLogout={onLogout} />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        fireEvent.click(screen.getByTitle("退出登录"));
        expect(onLogout).toHaveBeenCalled();
    });

    it("invalidates stats/progress queries when a watching session ends (true -> false)", () => {
        mockUseNowPlaying.mockReturnValue({
            data: null,
            isWatching: true,
            isLoading: false,
            error: null,
        });
        const qc = new QueryClient();
        const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
        const { rerender } = render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <TopNav username="alice" onLogout={vi.fn()} />
                </MemoryRouter>
            </QueryClientProvider>,
        );
        expect(invalidateSpy).not.toHaveBeenCalled();

        mockUseNowPlaying.mockReturnValue({
            data: null,
            isWatching: false,
            isLoading: false,
            error: null,
        });
        rerender(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <TopNav username="alice" onLogout={vi.fn()} />
                </MemoryRouter>
            </QueryClientProvider>,
        );

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["stats"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["shows-progress"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["movies-progress"] });
        expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });
});
