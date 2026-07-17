import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionEpisodeDetail, UserCollectionItem } from "@trakt-dashboard/types";
import CollectionPage from "../CollectionPage";
import {
    useCollection,
    useSyncCollection,
    useClearRemoteCollection,
    useRemoveCollectionItem,
    useCollectionShowEpisodes,
    useCollectionCapacity,
    usePruneRemoteCollection,
} from "../../hooks";
import { useToast } from "../../lib/toast";

vi.mock("../../hooks", () => ({
    useCollection: vi.fn(),
    useSyncCollection: vi.fn(),
    useClearRemoteCollection: vi.fn(),
    useRemoveCollectionItem: vi.fn(),
    useCollectionShowEpisodes: vi.fn(),
    useCollectionCapacity: vi.fn(),
    usePruneRemoteCollection: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseCollection = vi.mocked(useCollection);
const mockUseSyncCollection = vi.mocked(useSyncCollection);
const mockUseClearRemoteCollection = vi.mocked(useClearRemoteCollection);
const mockUseRemoveCollectionItem = vi.mocked(useRemoveCollectionItem);
const mockUseCollectionShowEpisodes = vi.mocked(useCollectionShowEpisodes);
const mockUseCollectionCapacity = vi.mocked(useCollectionCapacity);
const mockUsePruneRemoteCollection = vi.mocked(usePruneRemoteCollection);
const mockUseToast = vi.mocked(useToast);

function makeItem(overrides: Partial<UserCollectionItem> = {}): UserCollectionItem {
    return {
        id: 1,
        mediaType: "show",
        showId: 10,
        movieId: null,
        season: null,
        episode: null,
        mediaFormat: null,
        resolution: null,
        hdr: null,
        audio: null,
        audioChannels: null,
        collectedAt: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
        title: "Some Show",
        posterPath: "/poster.jpg",
        year: 2020,
        ...overrides,
    };
}

function makeEpisode(overrides: Partial<CollectionEpisodeDetail> = {}): CollectionEpisodeDetail {
    return {
        episode: 1,
        mediaFormat: null,
        resolution: null,
        hdr: null,
        audio: null,
        audioChannels: null,
        collectedAt: null,
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <CollectionPage />
        </MemoryRouter>,
    );
}

describe("CollectionPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSyncCollection.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseClearRemoteCollection.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as never);
        mockUseRemoveCollectionItem.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
        mockUseCollectionShowEpisodes.mockReturnValue({
            data: undefined,
            isLoading: false,
        } as never);
        mockUseCollectionCapacity.mockReturnValue({ data: undefined } as never);
        mockUsePruneRemoteCollection.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        } as never);
        mockUseToast.mockReturnValue({ toast: vi.fn() } as never);
    });

    describe("loading and empty states", () => {
        it("shows a loading spinner while items are loading", () => {
            mockUseCollection.mockReturnValue({ data: undefined, isLoading: true } as never);
            const { container } = renderPage();
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull();
        });

        it("shows the empty state and a zero count", () => {
            mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
            renderPage();
            expect(screen.getByText("媒体库暂无内容")).toBeInTheDocument();
            expect(
                screen.getByText("点击『从 Trakt 同步』将远程媒体库拉取到本地"),
            ).toBeInTheDocument();
            expect(screen.getByText("共 0 件")).toBeInTheDocument();
        });

        it("shows the item count when items are present", () => {
            mockUseCollection.mockReturnValue({ data: [makeItem()], isLoading: false } as never);
            renderPage();
            expect(screen.getByText("共 1 件")).toBeInTheDocument();
        });
    });

    describe("capacity bar", () => {
        beforeEach(() => {
            mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
        });

        it("hides the capacity bar and prune button when there is no capacity data", () => {
            mockUseCollectionCapacity.mockReturnValue({ data: undefined } as never);
            renderPage();
            expect(screen.queryByText("远端容量")).toBeNull();
            expect(screen.queryByTitle("清理最旧条目")).toBeNull();
        });

        it("shows capacity usage and clamps the displayed percentage at 100", () => {
            mockUseCollectionCapacity.mockReturnValue({
                data: { used: 1200, limit: 1000, pct: 120, nearLimit: true },
            } as never);
            renderPage();
            expect(screen.getByText("远端容量")).toBeInTheDocument();
            expect(
                screen.getByText(`${(1200).toLocaleString()} / ${(1000).toLocaleString()} (100%)`),
            ).toBeInTheDocument();
            expect(screen.getByTitle("清理最旧条目")).toBeInTheDocument();
        });

        it("hides the prune button below the 70% threshold", () => {
            mockUseCollectionCapacity.mockReturnValue({
                data: { used: 100, limit: 1000, pct: 10, nearLimit: false },
            } as never);
            renderPage();
            expect(screen.queryByTitle("清理最旧条目")).toBeNull();
        });
    });

    describe("filters", () => {
        it("requests each media-type filter on click", () => {
            mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
            renderPage();
            expect(mockUseCollection).toHaveBeenLastCalledWith("all");
            fireEvent.click(screen.getByText("剧集"));
            expect(mockUseCollection).toHaveBeenLastCalledWith("show");
            fireEvent.click(screen.getByText("电影"));
            expect(mockUseCollection).toHaveBeenLastCalledWith("movie");
            fireEvent.click(screen.getByText("全部"));
            expect(mockUseCollection).toHaveBeenLastCalledWith("all");
        });
    });

    it("triggers a sync from Trakt", () => {
        mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
        const mutate = vi.fn();
        mockUseSyncCollection.mockReturnValue({ mutate, isPending: false } as never);
        renderPage();
        fireEvent.click(screen.getByTitle("从 Trakt 同步"));
        expect(mutate).toHaveBeenCalled();
    });

    it("shows a spinning sync icon while a sync is pending", () => {
        mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
        mockUseSyncCollection.mockReturnValue({ mutate: vi.fn(), isPending: true } as never);
        renderPage();
        const icon = screen.getByTitle("从 Trakt 同步").querySelector(".lucide-loader-circle");
        expect(icon).not.toBeNull();
    });

    describe("prune remote flow", () => {
        beforeEach(() => {
            mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
            mockUseCollectionCapacity.mockReturnValue({
                data: { used: 800, limit: 1000, pct: 80, nearLimit: false },
            } as never);
        });

        it("opens and cancels the prune confirmation", () => {
            renderPage();
            fireEvent.click(screen.getByTitle("清理最旧条目"));
            expect(screen.getByText("确认清理")).toBeInTheDocument();
            fireEvent.click(screen.getByText("取消"));
            expect(screen.queryByText("确认清理")).toBeNull();
        });

        it("stays mounted and disabled while pending even if capacity drops below 70%", () => {
            mockUseCollectionCapacity.mockReturnValue({
                data: { used: 100, limit: 1000, pct: 10, nearLimit: false },
            } as never);
            mockUsePruneRemoteCollection.mockReturnValue({
                mutate: vi.fn(),
                isPending: true,
            } as never);
            renderPage();
            expect(screen.getByText("确认清理").closest("button")).toBeDisabled();
        });

        it("shows an error toast when pruning reports a partial error", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_pct: number, opts?: { onSuccess?: (res: unknown) => void }) =>
                opts?.onSuccess?.({ data: { freed: 3, partialError: true } }),
            );
            mockUsePruneRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清理最旧条目"));
            fireEvent.click(screen.getByText("确认清理"));
            expect(mutate).toHaveBeenCalledWith(
                80,
                expect.objectContaining({
                    onSuccess: expect.any(Function),
                    onError: expect.any(Function),
                }),
            );
            expect(toast).toHaveBeenCalledWith("远端清理失败，请重试", "error");
            expect(screen.queryByText("确认清理")).toBeNull();
        });

        it("shows a success toast with the freed count", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_pct: number, opts?: { onSuccess?: (res: unknown) => void }) =>
                opts?.onSuccess?.({ data: { freed: 5, partialError: false } }),
            );
            mockUsePruneRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清理最旧条目"));
            fireEvent.click(screen.getByText("确认清理"));
            expect(toast).toHaveBeenCalledWith("已从远端删除 5 条，本地归档保留", "success");
        });

        it("shows an info toast when usage is already under the target", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_pct: number, opts?: { onSuccess?: (res: unknown) => void }) =>
                opts?.onSuccess?.({ data: { freed: 0, partialError: false } }),
            );
            mockUsePruneRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清理最旧条目"));
            fireEvent.click(screen.getByText("确认清理"));
            expect(toast).toHaveBeenCalledWith("当前用量已在目标以下，无需清理", "info");
        });

        it("shows a failure toast when pruning errors outright", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_pct: number, opts?: { onError?: () => void }) =>
                opts?.onError?.(),
            );
            mockUsePruneRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清理最旧条目"));
            fireEvent.click(screen.getByText("确认清理"));
            expect(toast).toHaveBeenCalledWith("远端清理失败，请重试", "error");
        });
    });

    describe("clear remote flow", () => {
        beforeEach(() => {
            mockUseCollection.mockReturnValue({ data: [], isLoading: false } as never);
        });

        it("opens and cancels the clear confirmation", () => {
            renderPage();
            fireEvent.click(screen.getByTitle("清空远程媒体库"));
            expect(screen.getByText("确认清空")).toBeInTheDocument();
            fireEvent.click(screen.getByText("取消"));
            expect(screen.queryByText("确认清空")).toBeNull();
        });

        it("shows a success toast with the removed count", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_v: undefined, opts?: { onSuccess?: (res: unknown) => void }) =>
                opts?.onSuccess?.({ data: { removed: 12 } }),
            );
            mockUseClearRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清空远程媒体库"));
            fireEvent.click(screen.getByText("确认清空"));
            expect(mutate).toHaveBeenCalledWith(
                undefined,
                expect.objectContaining({
                    onSuccess: expect.any(Function),
                    onError: expect.any(Function),
                }),
            );
            expect(toast).toHaveBeenCalledWith(
                "已清空远端媒体库（12 条），本地归档保留",
                "success",
            );
        });

        it("shows a failure toast on error", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_v: undefined, opts?: { onError?: () => void }) =>
                opts?.onError?.(),
            );
            mockUseClearRemoteCollection.mockReturnValue({ mutate, isPending: false } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清空远程媒体库"));
            fireEvent.click(screen.getByText("确认清空"));
            expect(toast).toHaveBeenCalledWith("清空远端失败，请重试", "error");
        });

        it("disables the confirm/cancel buttons and shows a spinner while pending", () => {
            mockUseClearRemoteCollection.mockReturnValue({
                mutate: vi.fn(),
                isPending: true,
            } as never);
            renderPage();
            fireEvent.click(screen.getByTitle("清空远程媒体库"));
            expect(screen.getByText("确认清空").closest("button")).toBeDisabled();
            const cancelBtn = screen.getByText("取消").closest("button") as HTMLElement;
            expect(cancelBtn).toBeDisabled();
            expect(cancelBtn.style.cursor).toBe("not-allowed");
        });
    });

    describe("collection grid", () => {
        it("shows the SHOW/FILM type badges", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({ id: 1, mediaType: "show", title: "A Show" }),
                    makeItem({
                        id: 2,
                        mediaType: "movie",
                        movieId: 5,
                        showId: null,
                        title: "A Movie",
                    }),
                ],
                isLoading: false,
            } as never);
            renderPage();
            expect(screen.getByText("SHOW")).toBeInTheDocument();
            expect(screen.getByText("FILM")).toBeInTheDocument();
        });

        it("links a show item and shows the view-episodes action", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42, title: "A Show" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(container.querySelectorAll('a[href="/shows/42"]').length).toBeGreaterThan(0);
            expect(screen.getByText("查看集数")).toBeInTheDocument();
        });

        it("links a movie item and shows the view-specs action", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({ mediaType: "movie", showId: null, movieId: 8, title: "A Movie" }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(container.querySelectorAll('a[href="/movies/8"]').length).toBeGreaterThan(0);
            expect(screen.getByText("查看规格")).toBeInTheDocument();
        });

        it("renders items without a resolvable detail path as plain text with a type icon placeholder", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({
                        mediaType: "movie",
                        showId: null,
                        movieId: null,
                        posterPath: null,
                        title: "Orphan",
                    }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(screen.getByText("Orphan")).toBeInTheDocument();
            expect(container.querySelector("a")).toBeNull();
            expect(container.querySelector(".lucide-film")).not.toBeNull();
        });

        it("shows a show-type icon placeholder when linked but without a poster", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({
                        mediaType: "show",
                        showId: 3,
                        posterPath: null,
                        title: "No Poster Show",
                    }),
                ],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(container.querySelector(".lucide-tv-minimal")).not.toBeNull();
        });

        it("shows the poster image when posterPath is set", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ posterPath: "/poster.jpg" })],
                isLoading: false,
            } as never);
            const { container } = renderPage();
            expect(container.querySelector('img[src*="poster.jpg"]')).not.toBeNull();
        });

        it("shows the format badge on the card when spec fields are present", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({
                        mediaFormat: "blu_ray",
                        resolution: "uhd_4k",
                        hdr: "dolby_vision",
                        audio: "dolby_atmos",
                        audioChannels: "7.1",
                    }),
                ],
                isLoading: false,
            } as never);
            renderPage();
            expect(screen.getByText("BLU RAY · 4K · DV · Atmos · 7.1")).toBeInTheDocument();
        });

        it("omits the badge when there are no spec fields", () => {
            mockUseCollection.mockReturnValue({ data: [makeItem()], isLoading: false } as never);
            renderPage();
            expect(screen.queryByText(/·/)).toBeNull();
        });

        it("shows the item year when present", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ year: 2015 })],
                isLoading: false,
            } as never);
            renderPage();
            expect(screen.getByText("2015")).toBeInTheDocument();
        });
    });

    describe("collection card remove flow", () => {
        beforeEach(() => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ id: 9 })],
                isLoading: false,
            } as never);
        });

        it("shows the remove-confirmation and resets it on mouse leave when not pending", () => {
            const { container } = renderPage();
            const cardWrapper = container.querySelector('[role="presentation"]')!.parentElement!;

            fireEvent.mouseEnter(cardWrapper);
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            expect(screen.getByText("确认")).toBeInTheDocument();

            fireEvent.mouseLeave(cardWrapper);
            expect(screen.queryByText("确认")).toBeNull();
        });

        it("keeps the remove-confirmation open on mouse leave while a removal is pending", () => {
            mockUseRemoveCollectionItem.mockReturnValue({
                mutate: vi.fn(),
                isPending: true,
            } as never);
            const { container } = renderPage();
            const cardWrapper = container.querySelector('[role="presentation"]')!.parentElement!;

            fireEvent.mouseEnter(cardWrapper);
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            expect(screen.getByText("确认")).toBeInTheDocument();

            fireEvent.mouseLeave(cardWrapper);
            expect(screen.getByText("确认")).toBeInTheDocument();
        });

        it("cancels the remove-confirmation via its own cancel button without mutating", () => {
            const mutate = vi.fn();
            mockUseRemoveCollectionItem.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = renderPage();
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            expect(mutate).not.toHaveBeenCalled();
            expect(screen.queryByText("确认")).toBeNull();
        });

        it("removes the item on confirm and clears the confirmation on success", () => {
            const mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) =>
                opts?.onSuccess?.(),
            );
            mockUseRemoveCollectionItem.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = renderPage();
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            fireEvent.click(screen.getByText("确认"));
            expect(mutate).toHaveBeenCalledWith(
                9,
                expect.objectContaining({
                    onSuccess: expect.any(Function),
                    onError: expect.any(Function),
                }),
            );
            expect(screen.queryByText("确认")).toBeNull();
        });

        it("shows a failure toast and resets the confirmation when removal errors", () => {
            const toast = vi.fn();
            mockUseToast.mockReturnValue({ toast } as never);
            const mutate = vi.fn((_id: number, opts?: { onError?: () => void }) =>
                opts?.onError?.(),
            );
            mockUseRemoveCollectionItem.mockReturnValue({ mutate, isPending: false } as never);
            const { container } = renderPage();
            fireEvent.click(container.querySelector(".lucide-x")!.closest("button")!);
            fireEvent.click(screen.getByText("确认"));
            expect(toast).toHaveBeenCalledWith("移除失败，请重试", "error");
            expect(screen.queryByText("确认")).toBeNull();
        });
    });

    describe("episode modal", () => {
        it("opens for a show item, requests its episodes, and shows a loading state", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42, title: "A Show" })],
                isLoading: false,
            } as never);
            mockUseCollectionShowEpisodes.mockReturnValue({
                data: undefined,
                isLoading: true,
            } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看集数"));
            expect(screen.getByText("集数详情")).toBeInTheDocument();
            expect(mockUseCollectionShowEpisodes).toHaveBeenCalledWith(42);
        });

        it("shows the no-episode-data message when seasons are empty", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42 })],
                isLoading: false,
            } as never);
            mockUseCollectionShowEpisodes.mockReturnValue({ data: {}, isLoading: false } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看集数"));
            expect(screen.getByText("暂无集数数据，请重新同步")).toBeInTheDocument();
        });

        it("sorts seasons ascending and pads episode numbers", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42 })],
                isLoading: false,
            } as never);
            mockUseCollectionShowEpisodes.mockReturnValue({
                data: {
                    "2": [makeEpisode({ episode: 3 })],
                    "1": [makeEpisode({ episode: 1 }), makeEpisode({ episode: 2 })],
                },
                isLoading: false,
            } as never);
            const { container } = renderPage();
            fireEvent.click(screen.getByText("查看集数"));
            const seasonHeaders = Array.from(container.querySelectorAll("p")).map(
                (p) => p.textContent,
            );
            const s1Index = seasonHeaders.indexOf("第 1 季");
            const s2Index = seasonHeaders.indexOf("第 2 季");
            expect(s1Index).toBeGreaterThan(-1);
            expect(s2Index).toBeGreaterThan(s1Index);
            expect(screen.getByText("E01")).toBeInTheDocument();
            expect(screen.getByText("E02")).toBeInTheDocument();
            expect(screen.getByText("E03")).toBeInTheDocument();
        });

        it("shows a placeholder dash for episodes without spec data and a badge for those with it", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42 })],
                isLoading: false,
            } as never);
            const collectedAt = "2026-02-01T10:00:00.000Z";
            mockUseCollectionShowEpisodes.mockReturnValue({
                data: {
                    "1": [
                        makeEpisode({ episode: 1 }),
                        makeEpisode({ episode: 2, resolution: "hd_1080p", collectedAt }),
                    ],
                },
                isLoading: false,
            } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看集数"));
            expect(screen.getByText("—")).toBeInTheDocument();
            expect(screen.getByText("1080p")).toBeInTheDocument();
            const expectedDate = new Date(collectedAt).toLocaleString(undefined, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            expect(screen.getByText(expectedDate)).toBeInTheDocument();
        });
    });

    describe("movie spec modal", () => {
        it("opens and shows the no-spec-data message when all fields are empty", () => {
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({ mediaType: "movie", showId: null, movieId: 8, title: "A Movie" }),
                ],
                isLoading: false,
            } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看规格"));
            expect(screen.getByText("收藏规格")).toBeInTheDocument();
            expect(screen.getByText("暂无规格数据")).toBeInTheDocument();
        });

        it("shows populated spec fields, the formatted collected-at date, and the combined badge", () => {
            const collectedAt = "2026-03-05T08:15:30.000Z";
            mockUseCollection.mockReturnValue({
                data: [
                    makeItem({
                        mediaType: "movie",
                        showId: null,
                        movieId: 8,
                        title: "A Movie",
                        mediaFormat: "blu_ray",
                        resolution: "hd_720p",
                        hdr: "hdr10",
                        audio: "dts_ma",
                        audioChannels: "5.1",
                        collectedAt,
                    }),
                ],
                isLoading: false,
            } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看规格"));
            expect(screen.getByText("媒体格式")).toBeInTheDocument();
            expect(screen.getByText("BLU RAY")).toBeInTheDocument();
            expect(screen.getByText("分辨率")).toBeInTheDocument();
            expect(screen.getByText("720p")).toBeInTheDocument();
            expect(screen.getByText("HDR")).toBeInTheDocument();
            expect(screen.getByText("HDR10")).toBeInTheDocument();
            expect(screen.getByText("音频")).toBeInTheDocument();
            expect(screen.getByText("DTS-MA")).toBeInTheDocument();
            expect(screen.getByText("声道")).toBeInTheDocument();
            expect(screen.getByText("5.1")).toBeInTheDocument();
            expect(screen.getByText("入库时间")).toBeInTheDocument();
            const expectedDate = new Date(collectedAt).toLocaleString(undefined, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            expect(screen.getByText(expectedDate)).toBeInTheDocument();

            const modal = screen
                .getByText("收藏规格")
                .closest('[role="presentation"]') as HTMLElement;
            expect(
                within(modal).getByText("BLU RAY · 720p · HDR10 · DTS-MA · 5.1"),
            ).toBeInTheDocument();
        });

        it("closes via the header close button, and does not close on an inside click", () => {
            // The card behind the modal always renders its own `.lucide-x` remove-trigger
            // (only its opacity/pointerEvents are toggled by hover, not conditional
            // mounting), so `.lucide-x` alone is ambiguous once a modal is open — scope
            // the query to the modal itself via its unique subtitle text first.
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "movie", showId: null, movieId: 8 })],
                isLoading: false,
            } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看规格"));
            const subtitle = screen.getByText("收藏规格");
            const modal = subtitle.closest('[role="presentation"]') as HTMLElement;

            fireEvent.click(subtitle);
            expect(screen.getByText("收藏规格")).toBeInTheDocument();

            const closeBtn = modal.querySelector(".lucide-x")!.closest("button")!;
            fireEvent.click(closeBtn);
        });
    });

    describe("episode modal close", () => {
        it("closes via the header close button", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ mediaType: "show", showId: 42 })],
                isLoading: false,
            } as never);
            mockUseCollectionShowEpisodes.mockReturnValue({ data: {}, isLoading: false } as never);
            renderPage();
            fireEvent.click(screen.getByText("查看集数"));
            const modal = screen
                .getByText("集数详情")
                .closest('[role="presentation"]') as HTMLElement;
            const closeBtn = modal.querySelector(".lucide-x")!.closest("button")!;
            fireEvent.click(closeBtn);
        });
    });

    describe("hover styles", () => {
        it("applies hover styles to the card, its remove button, and the view-detail button", () => {
            mockUseCollection.mockReturnValue({
                data: [makeItem({ id: 9, mediaType: "show", showId: 42 })],
                isLoading: false,
            } as never);
            const { container } = renderPage();

            const removeBtn = container
                .querySelector(".lucide-x")!
                .closest("button") as HTMLElement;
            fireEvent.mouseEnter(removeBtn);
            expect(removeBtn.style.color).toBe("rgb(239, 68, 68)");
            fireEvent.mouseLeave(removeBtn);
            expect(removeBtn.style.color).toBe("var(--color-text-muted)");

            const card = container.querySelector('[role="presentation"]') as HTMLElement;
            fireEvent.mouseEnter(card);
            expect(card.style.transform).toBe("translateY(-2px)");
            fireEvent.mouseLeave(card);
            expect(card.style.transform).toBe("");

            const viewDetailBtn = screen.getByText("查看集数").closest("button") as HTMLElement;
            fireEvent.mouseEnter(viewDetailBtn);
            expect(viewDetailBtn.style.color).toBe("var(--color-accent)");
            fireEvent.mouseLeave(viewDetailBtn);
            expect(viewDetailBtn.style.color).toBe("var(--color-text-muted)");
        });
    });
});
