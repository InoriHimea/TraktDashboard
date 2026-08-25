import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestorableHistoryEntry } from "@trakt-dashboard/types";
import HistoryRestorePage from "../HistoryRestorePage";
import { useRestorableHistory, useRestoreHistory } from "../../hooks";
import { useToast } from "../../lib/toast";

vi.mock("../../hooks", () => ({
    useRestorableHistory: vi.fn(),
    useRestoreHistory: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseRestorableHistory = vi.mocked(useRestorableHistory);
const mockUseRestoreHistory = vi.mocked(useRestoreHistory);
const mockUseToast = vi.mocked(useToast);

function makeEpisodeEntry(overrides: Partial<RestorableHistoryEntry> = {}): RestorableHistoryEntry {
    return {
        id: 1,
        mediaType: "episode",
        source: "trakt",
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

function makeMovieEntry(overrides: Partial<RestorableHistoryEntry> = {}): RestorableHistoryEntry {
    return {
        id: 200,
        mediaType: "movie",
        source: "trakt",
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
            <HistoryRestorePage />
        </MemoryRouter>,
    );
}

function checkboxes(container: HTMLElement) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
}

describe("HistoryRestorePage", () => {
    const toast = vi.fn();
    const mutateAsync = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseToast.mockReturnValue({ toast } as never);
        mockUseRestoreHistory.mockReturnValue({
            mutateAsync,
            isPending: false,
        } as never);
    });

    it("shows a loading spinner while the audit is loading", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("shows a failure message on error", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        } as never);
        renderPage();
        expect(screen.getByText("加载失败，请重试。")).toBeInTheDocument();
    });

    it("shows the empty state when there is nothing to restore", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("没有找到需要恢复的记录")).toBeInTheDocument();
        expect(screen.getByText("本地记录与 Trakt 当前历史一致。")).toBeInTheDocument();
    });

    it("renders an episode entry's title with season/episode and title", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [makeEpisodeEntry()] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Test Show S03E67 · Some Episode")).toBeInTheDocument();
        expect(screen.queryByText("Test Show · Some Episode")).toBeNull();
    });

    it("shows the translated name as primary and the original as a secondary line when they differ", () => {
        mockUseRestorableHistory.mockReturnValue({
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
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [makeMovieEntry()] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Some Movie")).toBeInTheDocument();
    });

    it("shows a distinct source badge for trakt-missing vs manual-only entries", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: {
                entries: [
                    makeEpisodeEntry({ id: 1, source: "trakt" }),
                    makeEpisodeEntry({ id: 2, source: "manual" }),
                ],
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Trakt 曾同步，现已找不到")).toBeInTheDocument();
        expect(screen.getByText("仅本地标记，从未同步")).toBeInTheDocument();
    });

    it("shows the total candidate count", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 }), makeEpisodeEntry({ id: 2 })] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("共 2 条可恢复记录")).toBeInTheDocument();
    });

    it("re-queries with includeManual=true when the toggle is checked", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [] },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(mockUseRestorableHistory).toHaveBeenLastCalledWith(false);

        fireEvent.click(screen.getByRole("checkbox", { name: /同时列出本地手动标记/ }));
        expect(mockUseRestorableHistory).toHaveBeenLastCalledWith(true);
    });

    it("starts with nothing selected", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 })] },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        expect(checkboxes(container).some((b) => b.checked)).toBe(false);
        expect(screen.queryByText(/恢复选中的/)).toBeNull();
    });

    it("toggles an individual checkbox and shows the floating restore bar", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: { entries: [makeEpisodeEntry({ id: 1 })] },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        const [box] = checkboxes(container).filter(
            (b) => b !== screen.getByRole("checkbox", { name: /同时列出本地手动标记/ }),
        );
        fireEvent.click(box);
        expect(box.checked).toBe(true);
        expect(screen.getByText("恢复选中的 1 条")).toBeInTheDocument();
    });

    it("select-all and deselect-all toggle every entry checkbox", () => {
        mockUseRestorableHistory.mockReturnValue({
            data: {
                entries: [makeEpisodeEntry({ id: 1 }), makeEpisodeEntry({ id: 2 })],
            },
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
            mockUseRestorableHistory.mockReturnValue({
                data: { entries: [makeEpisodeEntry({ id: 1 })] },
                isLoading: false,
                isError: false,
            } as never);
            const utils = renderPage();
            fireEvent.click(screen.getByText("全选"));
            return utils;
        }

        it("opens a confirm dialog naming the selected count and shows a success toast on full confirm", async () => {
            mutateAsync.mockResolvedValue({ ok: true, restored: 1, unconfirmed: 0, failed: 0 });
            renderWithOneSelected();

            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            expect(screen.getByText("恢复到 Trakt.tv？")).toBeInTheDocument();
            const dialog = screen
                .getByText("恢复到 Trakt.tv？")
                .closest(".hud-panel-strong") as HTMLElement;
            expect(within(dialog).getByText(/将调用 Trakt 官方接口/)).toBeInTheDocument();

            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            expect(mutateAsync).toHaveBeenCalledWith([1]);
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("已恢复 1 条记录", "success"),
            );
        });

        it("shows a partial-result toast when some entries are unconfirmed or failed", async () => {
            mutateAsync.mockResolvedValue({ ok: true, restored: 1, unconfirmed: 1, failed: 1 });
            renderWithOneSelected();

            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复到 Trakt.tv？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("已恢复 1 条，1 条待确认，1 条失败", "error"),
            );
        });

        it("cancels without restoring", () => {
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复到 Trakt.tv？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it("shows the thrown error message when the restore call fails", async () => {
            mutateAsync.mockRejectedValue(new Error("network down"));
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复到 Trakt.tv？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("network down", "error"));
        });

        it("falls back to the generic failure message when the rejection has no message", async () => {
            mutateAsync.mockRejectedValue({});
            renderWithOneSelected();
            fireEvent.click(screen.getByText("恢复选中的 1 条"));
            const dialog = screen
                .getByText("恢复到 Trakt.tv？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("恢复失败，请重试。", "error"),
            );
        });
    });
});
