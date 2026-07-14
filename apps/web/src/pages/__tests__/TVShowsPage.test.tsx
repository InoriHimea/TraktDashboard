import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TVShowsPage from "../TVShowsPage";

const mocks = vi.hoisted(() => ({ useShowsProgress: vi.fn() }));

vi.mock("../../hooks", () => ({ useShowsProgress: mocks.useShowsProgress }));

vi.mock("../../components/ShowCard", () => ({
    ShowCard: ({ progress }: { progress: { show: { id: number; title: string } } }) => (
        <div>{progress.show.title}</div>
    ),
}));

vi.mock("../../components/UpNextBanner", () => ({
    UpNextBanner: () => <div>up-next-banner</div>,
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useShowsProgress.mockReturnValue({
        data: [{ show: { id: 1, title: "Breaking Bad" } }],
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
    });
});

function renderPage() {
    return render(
        <MemoryRouter>
            <TVShowsPage />
        </MemoryRouter>,
    );
}

describe("TVShowsPage", () => {
    it("renders shows from useShowsProgress via ShowCard", () => {
        renderPage();
        expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    it("shows the UpNextBanner header slot when not searching", () => {
        renderPage();
        expect(screen.getByText("up-next-banner")).toBeInTheDocument();
    });

    it("hides the UpNextBanner once a debounced search is active", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderPage();
        // "搜索剧集…" = "search shows…" (zh-CN default locale).
        fireEvent.change(screen.getByPlaceholderText("搜索剧集…"), {
            target: { value: "breaking" },
        });
        await vi.advanceTimersByTimeAsync(300);
        vi.useRealTimers();
        await waitFor(() => expect(screen.queryByText("up-next-banner")).not.toBeInTheDocument());
    });
});
