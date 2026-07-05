import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "../HistoryPage";
import { api } from "../../lib/api";
import type { HistoryEntry } from "@trakt-dashboard/types";

const mocks = vi.hoisted(() => ({
    useInfiniteHistory: vi.fn(),
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useInfiniteHistory: mocks.useInfiniteHistory,
    useRatings: () => ({ data: [] }),
}));

vi.mock("../../lib/api", () => ({
    api: {
        history: {
            export: vi.fn(() => "/api/history/export?mediaType=all&format=csv"),
            import: vi.fn().mockResolvedValue({ ok: true, imported: 0, skipped: 0, errors: [] }),
        },
    },
}));

const episodeEntry: HistoryEntry = {
    id: 1,
    mediaType: "episode",
    watchedAt: "2026-06-14T20:00:00.000Z",
    source: "trakt",
    show: { id: 10, title: "Neon Signal", translatedName: "霓虹信号", posterPath: null },
    episode: { id: 101, seasonNumber: 1, episodeNumber: 5, title: "The Fifth Wave" },
};

const movieEntry: HistoryEntry = {
    id: 2,
    mediaType: "movie",
    watchedAt: "2026-06-14T18:00:00.000Z",
    source: "trakt",
    movie: { id: 20, title: "Inception", posterPath: null },
};

function mockReturn(over: Record<string, unknown> = {}) {
    return {
        data: { pages: [{ entries: [episodeEntry, movieEntry], total: 2 }] },
        isLoading: false,
        isFetchingNextPage: false,
        fetchNextPage: mocks.fetchNextPage,
        hasNextPage: false,
        error: null,
        refetch: mocks.refetch,
        ...over,
    };
}

function renderPage() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <MemoryRouter>
                <HistoryPage />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe("HistoryPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useInfiniteHistory.mockReturnValue(mockReturn());
    });

    it("renders episode and movie entries from the flattened pages", () => {
        renderPage();
        // Show prefers translatedName; episode code is data-derived (locale-independent)
        expect(screen.getByText("霓虹信号")).toBeInTheDocument();
        expect(screen.getByText("S01·E05")).toBeInTheDocument();
        expect(screen.getByText("Inception")).toBeInTheDocument();
        // Media-type badges
        expect(screen.getByText("EP")).toBeInTheDocument();
        expect(screen.getByText("FILM")).toBeInTheDocument();
    });

    it("builds the CSV export URL from the active filter and date range", () => {
        renderPage();
        expect(api.history.export).toHaveBeenCalledWith("all", "csv", undefined, undefined);
    });

    it("re-queries with the new media type when a filter is selected", () => {
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: /剧集/ }));
        expect(mocks.useInfiniteHistory).toHaveBeenLastCalledWith("episode", undefined, undefined);
    });

    it("shows the empty state when there are no entries", () => {
        mocks.useInfiniteHistory.mockReturnValue(
            mockReturn({ data: { pages: [{ entries: [], total: 0 }] } }),
        );
        renderPage();
        expect(screen.queryByText("霓虹信号")).not.toBeInTheDocument();
        expect(screen.queryByText("Inception")).not.toBeInTheDocument();
    });

    it("renders a retry control that refetches on error", () => {
        mocks.useInfiniteHistory.mockReturnValue(mockReturn({ error: new Error("boom") }));
        renderPage();
        const buttons = screen.getAllByRole("button");
        // Error block renders a retry button after the filter buttons
        fireEvent.click(buttons[buttons.length - 1]);
        expect(mocks.refetch).toHaveBeenCalled();
    });

    it("loads the next page when more is available", () => {
        mocks.useInfiniteHistory.mockReturnValue(mockReturn({ hasNextPage: true }));
        renderPage();
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[buttons.length - 1]); // load-more button
        expect(mocks.fetchNextPage).toHaveBeenCalled();
    });
});
