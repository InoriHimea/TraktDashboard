import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoverItem, WatchlistItemWithMedia } from "@trakt-dashboard/types";
import DiscoverPage from "../DiscoverPage";
import { useDiscover, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "../../hooks";

vi.mock("../../hooks", () => ({
    useDiscover: vi.fn(),
    useWatchlist: vi.fn(),
    useAddToWatchlist: vi.fn(),
    useRemoveFromWatchlist: vi.fn(),
}));

const mockUseDiscover = vi.mocked(useDiscover);
const mockUseWatchlist = vi.mocked(useWatchlist);
const mockUseAddToWatchlist = vi.mocked(useAddToWatchlist);
const mockUseRemoveFromWatchlist = vi.mocked(useRemoveFromWatchlist);

function makeItem(overrides: Partial<DiscoverItem> = {}): DiscoverItem {
    return {
        type: "show",
        traktId: 1,
        traktSlug: "some-show",
        title: "Some Show",
        year: 2020,
        tmdbId: 100,
        imdbId: null,
        watchers: 500,
        localId: 10,
        posterPath: "/poster.jpg",
        inWatchlist: false,
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <DiscoverPage />
        </MemoryRouter>,
    );
}

describe("DiscoverPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseWatchlist.mockReturnValue({ data: [] } as never);
        mockUseAddToWatchlist.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseRemoveFromWatchlist.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    });

    it("shows the loading state", () => {
        mockUseDiscover.mockReturnValue({ data: undefined, isLoading: true, error: null } as never);
        renderPage();
        expect(screen.getByText("加载中…")).toBeInTheDocument();
    });

    it("shows the error state", () => {
        mockUseDiscover.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error("boom"),
        } as never);
        renderPage();
        expect(screen.getByText("加载失败，请重试")).toBeInTheDocument();
    });

    it("renders an item's title, year, poster, and the trending rank badge", () => {
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ watchers: 500 })],
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(screen.getByText("Some Show")).toBeInTheDocument();
        expect(screen.getByText("2020")).toBeInTheDocument();
        expect(container.querySelector('img[src*="poster.jpg"]')).not.toBeNull();
        expect(screen.getByText(/500.*人在看/)).toBeInTheDocument();
    });

    it("renders the poster placeholder (with the item's title) when posterPath is null", () => {
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ posterPath: null, title: "No Poster Show" })],
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector("img")).toBeNull();
        expect(screen.getAllByText("No Poster Show")).toHaveLength(2); // placeholder + card title
    });

    it("hides the rank badge once the 'popular' content tab is selected", () => {
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ watchers: 500 })],
            isLoading: false,
            error: null,
        } as never);
        renderPage();
        expect(screen.getByText(/人在看/)).toBeInTheDocument();
        fireEvent.click(screen.getByText("热门"));
        expect(screen.queryByText(/人在看/)).not.toBeInTheDocument();
    });

    it("re-queries useDiscover with the selected media type and content tab", () => {
        mockUseDiscover.mockReturnValue({ data: [], isLoading: false, error: null } as never);
        renderPage();
        expect(mockUseDiscover).toHaveBeenLastCalledWith("show", "trending");

        fireEvent.click(screen.getByText("电影"));
        expect(mockUseDiscover).toHaveBeenLastCalledWith("movie", "trending");

        fireEvent.click(screen.getByText("热门"));
        expect(mockUseDiscover).toHaveBeenLastCalledWith("movie", "popular");
    });

    it("wraps the poster/title in a Link when the item has a localId, and skips the Link otherwise", () => {
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: 10, type: "show" })],
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector('a[href="/shows/10"]')).not.toBeNull();

        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: null })],
            isLoading: false,
            error: null,
        } as never);
        const { container: noLink } = renderPage();
        expect(noLink.querySelector("a")).toBeNull();
        expect(within(noLink).getByText("Some Show")).toBeInTheDocument();
    });

    it("is in the watchlist when the local watchlist set contains its localId", () => {
        const watchlistItems: WatchlistItemWithMedia[] = [
            {
                id: 1,
                show: { id: 10 } as never,
                addedAt: "",
                listedAt: "",
                notes: null,
            },
        ];
        mockUseWatchlist.mockReturnValue({ data: watchlistItems } as never);
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: 10, inWatchlist: false })],
            isLoading: false,
            error: null,
        } as never);
        renderPage();
        expect(screen.getByTitle("移出待看")).toBeInTheDocument();
    });

    it("falls back to item.inWatchlist when the item has no localId", () => {
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: null, inWatchlist: true })],
            isLoading: false,
            error: null,
        } as never);
        renderPage();
        const button = screen.getByTitle("移出待看");
        expect(button).toBeDisabled();
    });

    it("adds to the watchlist when not yet added, and removes when already added", () => {
        const addMutate = vi.fn();
        const removeMutate = vi.fn();
        mockUseAddToWatchlist.mockReturnValue({ mutate: addMutate, isPending: false } as never);
        mockUseRemoveFromWatchlist.mockReturnValue({
            mutate: removeMutate,
            isPending: false,
        } as never);
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: 10, inWatchlist: false, type: "movie" })],
            isLoading: false,
            error: null,
        } as never);
        renderPage();

        fireEvent.click(screen.getByTitle("加入待看"));
        expect(addMutate).toHaveBeenCalledWith({ type: "movie", id: 10 });
        expect(removeMutate).not.toHaveBeenCalled();
    });

    it("does not trigger a mutation when a watchlist mutation is already pending", () => {
        const addMutate = vi.fn();
        mockUseAddToWatchlist.mockReturnValue({ mutate: addMutate, isPending: true } as never);
        mockUseDiscover.mockReturnValue({
            data: [makeItem({ localId: 10, inWatchlist: false })],
            isLoading: false,
            error: null,
        } as never);
        renderPage();
        fireEvent.click(screen.getByTitle("加入待看"));
        expect(addMutate).not.toHaveBeenCalled();
    });
});
