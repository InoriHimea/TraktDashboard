import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@trakt-dashboard/types";
import { SearchModal } from "../SearchModal";
import { api } from "../../lib/api";

vi.mock("../../lib/api", () => ({
    api: {
        search: { query: vi.fn(), watchlistAdd: vi.fn() },
        watchlist: { add: vi.fn() },
    },
}));

const mockApi = vi.mocked(api, { deep: true });

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
    return {
        type: "show",
        traktId: 1,
        slug: "some-show",
        title: "Some Show",
        year: 2020,
        tmdbId: 100,
        posterPath: "/poster.jpg",
        localId: null,
        inWatchlist: false,
        ...overrides,
    };
}

const PLACEHOLDER = "搜索剧集或电影…";

async function typeAndDebounce(value: string) {
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value } });
    await vi.advanceTimersByTimeAsync(300);
}

describe("SearchModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("focuses the input on mount", () => {
        render(<SearchModal onClose={vi.fn()} />);
        expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveFocus();
    });

    it("calls onClose when Escape is pressed", () => {
        const onClose = vi.fn();
        render(<SearchModal onClose={onClose} />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when the backdrop is clicked", () => {
        const onClose = vi.fn();
        const { container } = render(<SearchModal onClose={onClose} />);
        fireEvent.click(container.firstElementChild!);
        expect(onClose).toHaveBeenCalled();
    });

    it("shows the min-chars hint below 2 characters and does not search", () => {
        render(<SearchModal onClose={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "a" } });
        expect(screen.getByText("请输入至少 2 个字符")).toBeInTheDocument();
        expect(mockApi.search.query).not.toHaveBeenCalled();
    });

    it("shows a loading spinner while the debounced search is in flight, then renders the result", async () => {
        let resolveQuery: ((v: { data: SearchResult[] }) => void) | undefined;
        mockApi.search.query.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveQuery = resolve;
                }) as never,
        );
        const { container } = render(<SearchModal onClose={vi.fn()} />);

        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "batman" } });
        // still inside the 300ms debounce window -> no request fired yet.
        expect(mockApi.search.query).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(300);
        expect(mockApi.search.query).toHaveBeenCalledWith("batman");
        await waitFor(() =>
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull(),
        );

        resolveQuery?.({ data: [makeResult({ title: "Batman Begins" })] });
        await waitFor(() => expect(screen.getByText("Batman Begins")).toBeInTheDocument());
    });

    it("shows the error state when the search request fails", async () => {
        mockApi.search.query.mockRejectedValue(new Error("network"));
        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("batman");
        await waitFor(() => expect(screen.getByText("搜索失败，请重试")).toBeInTheDocument());
    });

    it("shows the no-results state when the search returns an empty array", async () => {
        mockApi.search.query.mockResolvedValue({ data: [] } as never);
        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("batman");
        await waitFor(() => expect(screen.getByText("没有找到匹配结果")).toBeInTheDocument());
    });

    it("renders each result's poster (or fallback icon), title, year, and type badge", async () => {
        mockApi.search.query.mockResolvedValue({
            data: [
                makeResult({ type: "show", title: "Some Show", year: 2020, posterPath: "/p.jpg" }),
                makeResult({
                    type: "movie",
                    title: "Some Movie",
                    year: 2021,
                    posterPath: null,
                    traktId: 2,
                }),
            ],
        } as never);
        const { container } = render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("some");
        await waitFor(() => expect(screen.getByText("Some Show")).toBeInTheDocument());

        expect(screen.getByText("剧集")).toBeInTheDocument();
        expect(screen.getByText("电影")).toBeInTheDocument();
        // year and the " · " separator share a <p> with the type badge span,
        // so the year isn't its own standalone text node - match by substring.
        expect(screen.getByText(/2020/)).toBeInTheDocument();
        expect(screen.getByText(/2021/)).toBeInTheDocument();
        expect(container.querySelector('img[src*="p.jpg"]')).not.toBeNull();
        // the posterless movie falls back to the Film icon.
        expect(container.querySelector(".lucide-film")).not.toBeNull();
    });

    it("adds a result with a localId via watchlist.add: shows 'adding' then 'added', and blocks a second click", async () => {
        let resolveAdd: (() => void) | undefined;
        mockApi.watchlist.add.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveAdd = () => resolve(undefined as never);
                }) as never,
        );
        mockApi.search.query.mockResolvedValue({
            data: [makeResult({ localId: 42, traktId: 7, type: "show" })],
        } as never);

        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("some");
        await waitFor(() => expect(screen.getByTitle("加入")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("加入"));
        expect(mockApi.watchlist.add).toHaveBeenCalledWith("show", 42);
        expect(screen.getByTitle("添加中")).toBeInTheDocument();
        expect(screen.getByTitle("添加中")).toBeDisabled();

        resolveAdd?.();
        await waitFor(() => expect(screen.getByTitle("已加入")).toBeInTheDocument());
        expect(screen.getByTitle("已加入")).toBeDisabled();

        fireEvent.click(screen.getByTitle("已加入"));
        expect(mockApi.watchlist.add).toHaveBeenCalledTimes(1);
    });

    it("adds a result without a localId via search.watchlistAdd", async () => {
        mockApi.search.watchlistAdd.mockResolvedValue({ ok: true } as never);
        mockApi.search.query.mockResolvedValue({
            data: [makeResult({ localId: null, traktId: 9, tmdbId: 555, type: "movie" })],
        } as never);

        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("some");
        await waitFor(() => expect(screen.getByTitle("加入")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("加入"));
        expect(mockApi.search.watchlistAdd).toHaveBeenCalledWith("movie", 9, 555);
        await waitFor(() => expect(screen.getByTitle("已加入")).toBeInTheDocument());
    });

    it("shows 'already added' immediately for a result already in the watchlist, and blocks re-adding", async () => {
        mockApi.search.query.mockResolvedValue({
            data: [makeResult({ inWatchlist: true })],
        } as never);
        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("some");
        await waitFor(() => expect(screen.getByTitle("已加入")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("已加入"));
        expect(mockApi.watchlist.add).not.toHaveBeenCalled();
        expect(mockApi.search.watchlistAdd).not.toHaveBeenCalled();
    });

    it("silently ignores a failed add and returns the button to its normal (clickable) state", async () => {
        mockApi.watchlist.add.mockRejectedValue(new Error("boom"));
        mockApi.search.query.mockResolvedValue({
            data: [makeResult({ localId: 1 })],
        } as never);
        render(<SearchModal onClose={vi.fn()} />);
        await typeAndDebounce("some");
        await waitFor(() => expect(screen.getByTitle("加入")).toBeInTheDocument());

        fireEvent.click(screen.getByTitle("加入"));
        await waitFor(() => expect(screen.getByTitle("加入")).not.toBeDisabled());
    });
});
