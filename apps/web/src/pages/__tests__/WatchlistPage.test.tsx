import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WatchlistPage from "../WatchlistPage";
import { ToastProvider } from "../../lib/toast";
import { Toaster } from "../../components/ui/Toaster";

const mocks = vi.hoisted(() => ({
    useWatchlist: vi.fn(),
    useRemoveFromWatchlist: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useWatchlist: mocks.useWatchlist,
    useRemoveFromWatchlist: mocks.useRemoveFromWatchlist,
}));

// Default locale is zh-CN; these are the real translated strings `t()` produces.
const SEARCH_PLACEHOLDER = "搜索待看列表…";
const REMOVE_TITLE = "从待看列表移除";
const LOADING = "正在加载待看列表…";
const LOAD_FAILED = "加载待看列表失败。";
const EMPTY = "待看列表为空。";
const REMOVE_SUCCESS = "已从待看列表移除";
const REMOVE_FAILED = "移除失败，请重试";

const showItem = {
    id: 1,
    addedAt: "2026-01-01T00:00:00.000Z",
    show: { id: 10, title: "Breaking Bad", posterPath: null },
};
const movieItem = {
    id: 2,
    addedAt: "2026-01-02T00:00:00.000Z",
    movie: { id: 20, title: "Arrival", posterPath: null },
};

function renderPage() {
    return render(
        <MemoryRouter>
            <ToastProvider>
                <WatchlistPage />
                <Toaster />
            </ToastProvider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWatchlist.mockReturnValue({
        data: [showItem, movieItem],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
    });
    mocks.useRemoveFromWatchlist.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) });
});

describe("WatchlistPage", () => {
    it("renders both shows and movies from the watchlist", () => {
        renderPage();
        expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
        expect(screen.getByText("Arrival")).toBeInTheDocument();
    });

    it("filters client-side by title as the user types (after the debounce)", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderPage();
        fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
            target: { value: "arrival" },
        });
        await vi.advanceTimersByTimeAsync(300);
        vi.useRealTimers();
        await waitFor(() => expect(screen.queryByText("Breaking Bad")).not.toBeInTheDocument());
        expect(screen.getByText("Arrival")).toBeInTheDocument();
    });

    it("shows the loading state", () => {
        mocks.useWatchlist.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: vi.fn(),
        });
        renderPage();
        expect(screen.getByText(LOADING)).toBeInTheDocument();
    });

    it("shows the error state", () => {
        mocks.useWatchlist.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error("boom"),
            refetch: vi.fn(),
        });
        renderPage();
        expect(screen.getByText(LOAD_FAILED)).toBeInTheDocument();
    });

    it("shows the empty state when the watchlist has no items", () => {
        mocks.useWatchlist.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        });
        renderPage();
        expect(screen.getByText(EMPTY)).toBeInTheDocument();
    });

    it("removes an item and shows a success toast", async () => {
        const mutateAsync = vi.fn().mockResolvedValue({});
        mocks.useRemoveFromWatchlist.mockReturnValue({ mutateAsync });
        renderPage();
        fireEvent.click(screen.getAllByTitle(REMOVE_TITLE)[0]);
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(1));
        expect(await screen.findByText(REMOVE_SUCCESS)).toBeInTheDocument();
    });

    it("shows a retryable error toast when removal fails", async () => {
        const mutateAsync = vi.fn().mockRejectedValue(new Error("fail"));
        mocks.useRemoveFromWatchlist.mockReturnValue({ mutateAsync });
        renderPage();
        fireEvent.click(screen.getAllByTitle(REMOVE_TITLE)[0]);
        expect(await screen.findByText(REMOVE_FAILED)).toBeInTheDocument();
    });
});
