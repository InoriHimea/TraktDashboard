import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Movie, MovieProgress, MovieWatchHistoryEntry } from "@trakt-dashboard/types";
import MovieDetailPage from "../MovieDetailPage";
import {
    useMovieDetail,
    useMovieHistory,
    useMarkMovieWatched,
    useDeleteMovieHistory,
    useWatchlist,
    useAddToWatchlist,
    useRemoveFromWatchlist,
    useSettings,
    useJellyfinMovie,
    useDeleteJellyfinItem,
    useCollectionCheck,
    useRatings,
    useSetRating,
    useRemoveRating,
    useNote,
    useUpsertNote,
    useDeleteNote,
} from "../../hooks";
import { useToast } from "../../lib/toast";

// AnimatePresence's `mode="wait"` holds off mounting the next tab panel until
// the previous one's exit animation completes — which never happens in
// jsdom, so the history tab's content would never actually mount. Mock
// framer-motion to a passthrough so tab switches render synchronously. A
// Proxy covers every `motion.<tag>` this page's whole child tree might use
// (Button uses motion.button, HeroSection-style cards use motion.div, etc.)
// without having to enumerate each one.
const MOTION_ONLY_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "layoutId",
]);

vi.mock("framer-motion", () => ({
    motion: new Proxy(
        {},
        {
            get:
                (_target, tag: string) =>
                (props: Record<string, unknown> & { children?: ReactNode }) => {
                    const { children, ...rest } = props;
                    const domProps = Object.fromEntries(
                        Object.entries(rest).filter(([key]) => !MOTION_ONLY_PROPS.has(key)),
                    );
                    return createElement(tag, domProps, children);
                },
        },
    ),
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../../hooks", () => ({
    useMovieDetail: vi.fn(),
    useMovieHistory: vi.fn(),
    useMarkMovieWatched: vi.fn(),
    useDeleteMovieHistory: vi.fn(),
    useWatchlist: vi.fn(),
    useAddToWatchlist: vi.fn(),
    useRemoveFromWatchlist: vi.fn(),
    useSettings: vi.fn(),
    useJellyfinMovie: vi.fn(),
    useDeleteJellyfinItem: vi.fn(),
    useCollectionCheck: vi.fn(),
    // StarRating/NoteEditor (rendered as children) pull these directly.
    useRatings: vi.fn(),
    useSetRating: vi.fn(),
    useRemoveRating: vi.fn(),
    useNote: vi.fn(),
    useUpsertNote: vi.fn(),
    useDeleteNote: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseMovieDetail = vi.mocked(useMovieDetail);
const mockUseMovieHistory = vi.mocked(useMovieHistory);
const mockUseMarkMovieWatched = vi.mocked(useMarkMovieWatched);
const mockUseDeleteMovieHistory = vi.mocked(useDeleteMovieHistory);
const mockUseWatchlist = vi.mocked(useWatchlist);
const mockUseAddToWatchlist = vi.mocked(useAddToWatchlist);
const mockUseRemoveFromWatchlist = vi.mocked(useRemoveFromWatchlist);
const mockUseSettings = vi.mocked(useSettings);
const mockUseJellyfinMovie = vi.mocked(useJellyfinMovie);
const mockUseDeleteJellyfinItem = vi.mocked(useDeleteJellyfinItem);
const mockUseCollectionCheck = vi.mocked(useCollectionCheck);
const mockUseToast = vi.mocked(useToast);

function makeMovie(overrides: Partial<Movie> = {}): Movie {
    return {
        id: 1,
        tmdbId: 999,
        imdbId: "tt123",
        traktId: 5,
        traktSlug: "some-movie",
        title: "Some Movie",
        overview: "Overview text",
        releaseDate: "2020-05-01",
        runtime: 120,
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        genres: ["Drama", "Action"],
        lastSyncedAt: "2026-07-01T00:00:00.000Z",
        createdAt: "2020-01-01T00:00:00.000Z",
        ...overrides,
    };
}

type ProgressOverrides = Partial<Omit<MovieProgress, "movie">> & { movie?: Partial<Movie> };

function makeProgress(overrides: ProgressOverrides = {}): MovieProgress {
    const { movie: movieOverrides, ...rest } = overrides;
    return {
        movie: makeMovie(movieOverrides),
        watchCount: 2,
        lastWatchedAt: "2026-07-10T14:30:00.000Z",
        ...rest,
    };
}

function renderAt(id: number | string = 1) {
    return render(
        <MemoryRouter initialEntries={[`/movies/${id}`]}>
            <Routes>
                <Route path="/movies/:id" element={<MovieDetailPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe("MovieDetailPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

        mockUseMovieHistory.mockReturnValue({ data: [], isLoading: false } as never);
        mockUseMarkMovieWatched.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
        mockUseDeleteMovieHistory.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
        mockUseWatchlist.mockReturnValue({ data: [] } as never);
        mockUseAddToWatchlist.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseRemoveFromWatchlist.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseSettings.mockReturnValue({ data: { jellyfinUrl: null } } as never);
        mockUseJellyfinMovie.mockReturnValue({ data: null } as never);
        mockUseDeleteJellyfinItem.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
        mockUseCollectionCheck.mockReturnValue({ data: { inCollection: false } } as never);
        mockUseToast.mockReturnValue({ toast: vi.fn(), toasts: [], dismiss: vi.fn() } as never);

        vi.mocked(useRatings).mockReturnValue({ data: [] } as never);
        vi.mocked(useSetRating).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        vi.mocked(useRemoveRating).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        vi.mocked(useNote).mockReturnValue({ data: null, isLoading: false } as never);
        vi.mocked(useUpsertNote).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        vi.mocked(useDeleteNote).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the skeleton while loading", () => {
        mockUseMovieDetail.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: vi.fn(),
        } as never);
        renderAt();
        expect(screen.queryByText("Some Movie")).not.toBeInTheDocument();
    });

    it("shows the error state and calls refetch on retry", () => {
        const refetch = vi.fn();
        mockUseMovieDetail.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error("boom"),
            refetch,
        } as never);
        renderAt();
        expect(screen.getByText("加载失败，请重试")).toBeInTheDocument();
        fireEvent.click(screen.getByText("重新加载"));
        expect(refetch).toHaveBeenCalled();
    });

    it("shows the not-found state when there is no error but no progress data", () => {
        mockUseMovieDetail.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as never);
        renderAt();
        expect(screen.getByText("未找到内容")).toBeInTheDocument();
    });

    describe("details tab", () => {
        beforeEach(() => {
            mockUseMovieDetail.mockReturnValue({
                data: makeProgress(),
                isLoading: false,
                error: null,
                refetch: vi.fn(),
            } as never);
        });

        it("renders the title, poster, year, runtime, watch-count tag, genres, and overview", () => {
            const { container } = renderAt();
            expect(screen.getByText("Some Movie")).toBeInTheDocument();
            expect(container.querySelector('img[src*="w500/poster.jpg"]')).not.toBeNull();
            expect(container.querySelector('img[src*="w1280/backdrop.jpg"]')).not.toBeNull();
            expect(screen.getByText("2020")).toBeInTheDocument();
            expect(screen.getAllByText("120 分钟").length).toBeGreaterThan(0);
            // "观看次数" also labels the sidebar's watch-count metric tile.
            expect(screen.getAllByText(/观看次数/).length).toBeGreaterThan(0);
            expect(screen.getByText("Drama")).toBeInTheDocument();
            expect(screen.getByText("Action")).toBeInTheDocument();
            expect(screen.getByText("Overview text")).toBeInTheDocument();
        });

        it("falls back to the Film icon after the poster fails to load", () => {
            const { container } = renderAt();
            const img = container.querySelector('img[src*="w500/poster.jpg"]')!;
            fireEvent.error(img);
            expect(container.querySelector('img[src*="w500/poster.jpg"]')).toBeNull();
            expect(container.querySelector(".lucide-film")).not.toBeNull();
        });

        it("renders detail rows: release date, runtime, genres, and synced-at", () => {
            renderAt();
            expect(screen.getByText("2020年5月1日")).toBeInTheDocument();
            expect(screen.getByText("Drama / Action")).toBeInTheDocument();
            expect(screen.getByText("2026年7月1日 08:00")).toBeInTheDocument();
        });

        it("renders the watch metrics: count, total runtime, and last-watched (or not-watched-yet)", () => {
            renderAt();
            expect(screen.getByText("2")).toBeInTheDocument(); // watchCount metric
            expect(screen.getByText("4.0h")).toBeInTheDocument(); // 120*2=240min -> 4.0h
            expect(screen.getByText("2026年7月10日 22:30")).toBeInTheDocument();

            mockUseMovieDetail.mockReturnValue({
                data: makeProgress({ watchCount: 0, lastWatchedAt: null }),
                isLoading: false,
                error: null,
                refetch: vi.fn(),
            } as never);
            renderAt();
            expect(screen.getByText("未观看")).toBeInTheDocument();
            expect(screen.getAllByText("—").length).toBeGreaterThan(0); // total runtime "—"
        });

        it("renders external ID rows for TMDB/IMDb/Trakt", () => {
            renderAt();
            expect(screen.getByText("#999")).toBeInTheDocument();
            expect(screen.getByText("tt123")).toBeInTheDocument();
            expect(screen.getByText("some-movie")).toBeInTheDocument();
        });

        it("shows the in-collection badge only when the collection check reports true", () => {
            mockUseCollectionCheck.mockReturnValue({ data: { inCollection: true } } as never);
            renderAt();
            expect(screen.getByText("已在媒体库")).toBeInTheDocument();
        });

        it("marks watched: opens the date picker, confirms, calls the mutation, and closes it", async () => {
            const mutateAsync = vi.fn().mockResolvedValue(undefined);
            mockUseMarkMovieWatched.mockReturnValue({ mutateAsync, isPending: false } as never);
            renderAt();

            fireEvent.click(screen.getByText("再看一次"));
            await waitFor(() =>
                expect(document.getElementById("datetime-picker-input")).not.toBeNull(),
            );
            const modal = document
                .getElementById("datetime-picker-input")!
                .closest(".rounded-2xl") as HTMLElement;
            fireEvent.click(within(modal).getByRole("button", { name: "标记为已观看" }));

            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        });

        it("adds to the watchlist and shows a success toast", async () => {
            const mutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) =>
                opts?.onSuccess?.(),
            );
            mockUseAddToWatchlist.mockReturnValue({ mutate, isPending: false } as never);
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast, toasts: [], dismiss: vi.fn() } as never);
            renderAt();

            fireEvent.click(screen.getByText("加入待看"));
            expect(mutate).toHaveBeenCalledWith(
                { type: "movie", id: 1 },
                expect.objectContaining({ onSuccess: expect.any(Function) }),
            );
            expect(toast).toHaveBeenCalledWith("已添加到待看列表", "success");
        });

        it("removes from the watchlist and shows a success toast when already added", async () => {
            mockUseWatchlist.mockReturnValue({
                data: [{ id: 55, movie: makeMovie(), addedAt: "", listedAt: "", notes: null }],
            } as never);
            const mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) =>
                opts?.onSuccess?.(),
            );
            mockUseRemoveFromWatchlist.mockReturnValue({ mutate, isPending: false } as never);
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast, toasts: [], dismiss: vi.fn() } as never);
            renderAt();

            expect(screen.getByText("已在待看")).toBeInTheDocument();
            fireEvent.click(screen.getByText("已在待看"));
            expect(mutate).toHaveBeenCalledWith(
                55,
                expect.objectContaining({ onSuccess: expect.any(Function) }),
            );
            expect(toast).toHaveBeenCalledWith("已从待看列表移除", "success");
        });

        it("shows the jellyfin delete button only when a jellyfin movie exists, and reports success", async () => {
            mockUseSettings.mockReturnValue({ data: { jellyfinUrl: "http://jf" } } as never);
            mockUseJellyfinMovie.mockReturnValue({
                data: { id: "jf-1", name: "n", path: null },
            } as never);
            const mutateAsync = vi.fn().mockResolvedValue(undefined);
            mockUseDeleteJellyfinItem.mockReturnValue({ mutateAsync, isPending: false } as never);
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast, toasts: [], dismiss: vi.fn() } as never);
            renderAt();

            fireEvent.click(screen.getByText("删除文件"));
            fireEvent.click(screen.getByRole("button", { name: "删除" }));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("jf-1"));
            await waitFor(() => expect(toast).toHaveBeenCalledWith("文件已删除", "success"));
        });

        it("hides the jellyfin delete button when there is no jellyfin movie", () => {
            renderAt();
            expect(screen.queryByText("删除文件")).not.toBeInTheDocument();
        });
    });

    describe("history tab", () => {
        beforeEach(() => {
            mockUseMovieDetail.mockReturnValue({
                data: makeProgress(),
                isLoading: false,
                error: null,
                refetch: vi.fn(),
            } as never);
        });

        it("switches to the history tab and shows the loading/empty states", () => {
            mockUseMovieHistory.mockReturnValue({ data: [], isLoading: true } as never);
            const first = renderAt();
            fireEvent.click(screen.getByText("全剧观看历史"));
            expect(screen.getByText("加载中…")).toBeInTheDocument();
            first.unmount();

            mockUseMovieHistory.mockReturnValue({ data: [], isLoading: false } as never);
            renderAt();
            fireEvent.click(screen.getByText("全剧观看历史"));
            expect(screen.getByText("暂无观看记录")).toBeInTheDocument();
        });

        it("de-duplicates identical history entries and renders the record count", () => {
            const entries: MovieWatchHistoryEntry[] = [
                { id: 1, movieId: 1, watchedAt: "2026-07-01T00:00:00.000Z", source: "trakt" },
                { id: 2, movieId: 1, watchedAt: "2026-07-01T00:00:00.000Z", source: "trakt" }, // duplicate
                { id: 3, movieId: 1, watchedAt: null, source: "manual" },
            ];
            mockUseMovieHistory.mockReturnValue({ data: entries, isLoading: false } as never);
            renderAt();
            fireEvent.click(screen.getByText("全剧观看历史"));
            expect(screen.getByText("共 2 条记录")).toBeInTheDocument();
            expect(screen.getByText("未知时间")).toBeInTheDocument();
        });

        it("deletes a history entry via the confirm dialog", async () => {
            const mutateAsync = vi.fn().mockResolvedValue(undefined);
            mockUseDeleteMovieHistory.mockReturnValue({ mutateAsync, isPending: false } as never);
            mockUseMovieHistory.mockReturnValue({
                data: [{ id: 1, movieId: 1, watchedAt: null, source: "manual" }],
                isLoading: false,
            } as never);
            renderAt();
            fireEvent.click(screen.getByText("全剧观看历史"));

            fireEvent.click(screen.getByLabelText("删除记录"));
            expect(screen.getByText("确认删除这条观看记录？此操作不可撤销。")).toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: "删除" }));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(1));
        });
    });

    it("passes 0 to the detail/history hooks when the route id is not a valid positive integer", () => {
        mockUseMovieDetail.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: vi.fn(),
        } as never);
        renderAt("not-a-number");
        expect(mockUseMovieDetail).toHaveBeenCalledWith(0);
        expect(mockUseMovieHistory).toHaveBeenCalledWith(0);
    });
});
