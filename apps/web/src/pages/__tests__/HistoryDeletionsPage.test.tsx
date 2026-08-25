import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryDeletionEntry } from "@trakt-dashboard/types";
import HistoryDeletionsPage from "../HistoryDeletionsPage";
import { useHistoryDeletions, useRestoreFromDeletions } from "../../hooks";
import { useToast } from "../../lib/toast";

vi.mock("../../hooks", () => ({
    useHistoryDeletions: vi.fn(),
    useRestoreFromDeletions: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseHistoryDeletions = vi.mocked(useHistoryDeletions);
const mockUseRestoreFromDeletions = vi.mocked(useRestoreFromDeletions);
const mockUseToast = vi.mocked(useToast);

function makeEpisodeEntry(overrides: Partial<HistoryDeletionEntry> = {}): HistoryDeletionEntry {
    return {
        id: 1,
        mediaType: "episode",
        reason: "manual",
        deletedAt: "2026-01-02T00:00:00.000Z",
        watchedAt: "2026-01-01T00:00:00.000Z",
        showId: 5,
        showTitle: "Test Show",
        showTranslatedName: null,
        seasonNumber: 3,
        episodeNumber: 67,
        episodeTitle: "Some Episode",
        episodeTranslatedTitle: null,
        movieId: null,
        movieTitle: null,
        ...overrides,
    };
}

function makeMovieEntry(overrides: Partial<HistoryDeletionEntry> = {}): HistoryDeletionEntry {
    return {
        id: 200,
        mediaType: "movie",
        reason: "duplicate-cleanup",
        deletedAt: "2026-01-02T00:00:00.000Z",
        watchedAt: "2026-01-01T00:00:00.000Z",
        showId: null,
        showTitle: null,
        showTranslatedName: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        episodeTranslatedTitle: null,
        movieId: 20,
        movieTitle: "Some Movie",
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <HistoryDeletionsPage />
        </MemoryRouter>,
    );
}

function checkboxes(container: HTMLElement) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
}

describe("HistoryDeletionsPage", () => {
    const toast = vi.fn();
    const mutateAsync = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseToast.mockReturnValue({ toast } as never);
        mockUseRestoreFromDeletions.mockReturnValue({
            mutateAsync,
            isPending: false,
        } as never);
    });

    it("shows a loading spinner while pending deletions are loading", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("shows a failure message on error", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        } as never);
        renderPage();
        expect(screen.getByText("加载失败，请重试。")).toBeInTheDocument();
    });

    it("shows the empty state when the recycle bin is empty", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("回收站是空的")).toBeInTheDocument();
    });

    it("renders an episode entry's title with season/episode and title", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeEpisodeEntry()] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Test Show S03E67 · Some Episode")).toBeInTheDocument();
    });

    it("shows the translated name as primary and the original as a secondary line when they differ", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: {
                entries: [
                    makeEpisodeEntry({
                        showTranslatedName: "测试剧集",
                        episodeTranslatedTitle: "某一集",
                    }),
                ],
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("测试剧集 S03E67 · 某一集")).toBeInTheDocument();
        expect(screen.getByText("Test Show · Some Episode")).toBeInTheDocument();
    });

    it("renders a movie entry's title as the movie title", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeMovieEntry()] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Some Movie")).toBeInTheDocument();
    });

    it("shows a distinct reason badge for manual vs duplicate-cleanup deletes", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: {
                entries: [
                    makeEpisodeEntry({ id: 1, reason: "manual" }),
                    makeEpisodeEntry({ id: 2, reason: "duplicate-cleanup" }),
                ],
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("手动删除")).toBeInTheDocument();
        expect(screen.getByText("重复记录清理")).toBeInTheDocument();
    });

    it("shows the total pending-deletion count", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 }), makeEpisodeEntry({ id: 2 })] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("共 2 条已删除记录")).toBeInTheDocument();
    });

    it("starts with nothing selected and no floating bar", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 })] },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        expect(checkboxes(container).some((b) => b.checked)).toBe(false);
        expect(screen.queryByText(/恢复选中的/)).toBeNull();
    });

    it("toggles an individual checkbox and shows the floating restore bar", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 })] },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        const [box] = checkboxes(container);
        fireEvent.click(box);
        expect(box.checked).toBe(true);
        expect(screen.getByText("恢复选中的 1 条")).toBeInTheDocument();
    });

    it("select-all and deselect-all toggle every entry checkbox", () => {
        mockUseHistoryDeletions.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 }), makeEpisodeEntry({ id: 2 })] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();

        fireEvent.click(screen.getByText("全选"));
        expect(screen.getByText("恢复选中的 2 条")).toBeInTheDocument();

        fireEvent.click(screen.getByText("全不选"));
        expect(screen.queryByText(/恢复选中的/)).toBeNull();
    });

    describe("restore flow", () => {
        function renderWithOneSelected() {
            mockUseHistoryDeletions.mockReturnValue({
                data: { entries: [makeEpisodeEntry({ id: 1 })] },
                isLoading: false,
                isError: false,
            } as never);
            const utils = renderPage();
            fireEvent.click(screen.getByText("全选"));
            return utils;
        }

        it("opens a confirm dialog naming the selected count and shows a success toast on confirm", async () => {
            mutateAsync.mockResolvedValue({ ok: true, restored: 1 });
            renderWithOneSelected();

            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            expect(screen.getByText("恢复这些记录？")).toBeInTheDocument();
            const dialog = screen
                .getByText("恢复这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            expect(within(dialog).getByText(/将把选中的 1 条记录/)).toBeInTheDocument();

            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            expect(mutateAsync).toHaveBeenCalledWith([1]);
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("已恢复 1 条记录", "success"),
            );
        });

        it("cancels without restoring", () => {
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it("shows the thrown error message when the restore call fails", async () => {
            mutateAsync.mockRejectedValue(new Error("network down"));
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("network down", "error"));
        });

        it("falls back to the generic failure message when the rejection has no message", async () => {
            mutateAsync.mockRejectedValue({});
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("恢复失败，请重试。", "error"),
            );
        });
    });
});
