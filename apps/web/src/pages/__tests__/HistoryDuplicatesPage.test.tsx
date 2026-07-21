import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryDuplicateEntry, HistoryDuplicateGroup } from "@trakt-dashboard/types";
import HistoryDuplicatesPage from "../HistoryDuplicatesPage";
import { useHistoryDuplicates, useRemoveHistoryDuplicates } from "../../hooks";
import { useToast } from "../../lib/toast";

vi.mock("../../hooks", () => ({
    useHistoryDuplicates: vi.fn(),
    useRemoveHistoryDuplicates: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseHistoryDuplicates = vi.mocked(useHistoryDuplicates);
const mockUseRemoveHistoryDuplicates = vi.mocked(useRemoveHistoryDuplicates);
const mockUseToast = vi.mocked(useToast);

function makeEntry(overrides: Partial<HistoryDuplicateEntry> = {}): HistoryDuplicateEntry {
    return {
        id: 1,
        watchedAt: "2026-01-01T00:00:00.000Z",
        gapFromPreviousHours: null,
        suggested: false,
        ...overrides,
    };
}

function makeEpisodeGroup(overrides: Partial<HistoryDuplicateGroup> = {}): HistoryDuplicateGroup {
    return {
        mediaType: "episode",
        showId: 5,
        showTitle: "Test Show",
        showTranslatedName: null,
        seasonNumber: 3,
        episodeNumber: 67,
        episodeTitle: "Some Episode",
        episodeTranslatedTitle: null,
        movieId: null,
        movieTitle: null,
        runtime: null,
        entries: [makeEntry()],
        ...overrides,
    };
}

function makeMovieGroup(overrides: Partial<HistoryDuplicateGroup> = {}): HistoryDuplicateGroup {
    return {
        mediaType: "movie",
        showId: null,
        showTitle: null,
        showTranslatedName: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        episodeTranslatedTitle: null,
        movieId: 20,
        movieTitle: "Some Movie",
        runtime: null,
        entries: [makeEntry({ id: 200 })],
        ...overrides,
    };
}

function renderPage() {
    return render(
        <MemoryRouter>
            <HistoryDuplicatesPage />
        </MemoryRouter>,
    );
}

function checkboxes(container: HTMLElement) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
}

describe("HistoryDuplicatesPage", () => {
    const toast = vi.fn();
    const mutateAsync = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseToast.mockReturnValue({ toast } as never);
        mockUseRemoveHistoryDuplicates.mockReturnValue({
            mutateAsync,
            isPending: false,
        } as never);
    });

    it("shows a loading spinner while the audit is loading", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("shows a failure message on error", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        } as never);
        renderPage();
        expect(screen.getByText("加载失败，请重试。")).toBeInTheDocument();
    });

    it("shows the empty state when there are no duplicate groups", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("未发现重复记录")).toBeInTheDocument();
        expect(screen.getByText("当前时间窗口内没有找到重复的观看记录。")).toBeInTheDocument();
    });

    it("renders an episode group's label with season/episode and title", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [makeEpisodeGroup()], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Test Show S03E67 · Some Episode")).toBeInTheDocument();
        // No translation on this group — no secondary "original title" line to show.
        expect(screen.queryByText("Test Show · Some Episode")).toBeNull();
    });

    it("shows the translated name/title as primary and the original as a secondary line when they differ", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [
                    makeEpisodeGroup({
                        showTranslatedName: "测试剧集",
                        episodeTranslatedTitle: "某一集",
                    }),
                ],
                windowHours: 72,
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("测试剧集 S03E67 · 某一集")).toBeInTheDocument();
        expect(screen.getByText("Test Show · Some Episode")).toBeInTheDocument();
    });

    it("omits the title separator when the episode has no title", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [makeEpisodeGroup({ episodeTitle: null })],
                windowHours: 72,
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Test Show S03E67")).toBeInTheDocument();
    });

    it("renders a movie group's label as the movie title", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [makeMovieGroup()], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("Some Movie")).toBeInTheDocument();
    });

    it("shows summary stats including the short-interval burst count only when present", () => {
        const groupWithShortGap = makeEpisodeGroup({
            entries: [
                makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" }),
                makeEntry({
                    id: 2,
                    watchedAt: "2026-01-01T00:22:00.000Z",
                    gapFromPreviousHours: 22 / 60,
                    suggested: true,
                }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [groupWithShortGap], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("共 1 组重复记录")).toBeInTheDocument();
        expect(screen.getByText("建议删除 1 条")).toBeInTheDocument();
        expect(screen.getByText("1 组间隔小于 6 小时")).toBeInTheDocument();
    });

    it("omits the short-interval stat when no group has a short gap", () => {
        const group = makeEpisodeGroup({
            entries: [
                makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" }),
                makeEntry({
                    id: 2,
                    watchedAt: "2026-01-04T00:00:00.000Z",
                    gapFromPreviousHours: 72,
                    suggested: true,
                }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.queryByText(/组间隔小于/)).toBeNull();
    });

    it("formats a sub-24h gap in hours and a 24h+ gap in days", () => {
        const group = makeEpisodeGroup({
            entries: [
                makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" }),
                makeEntry({
                    id: 2,
                    watchedAt: "2026-01-01T05:00:00.000Z",
                    gapFromPreviousHours: 5,
                    suggested: true,
                }),
                makeEntry({
                    id: 3,
                    watchedAt: "2026-01-04T05:00:00.000Z",
                    gapFromPreviousHours: 72,
                    suggested: false,
                }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("距上一条 5 小时")).toBeInTheDocument();
        expect(screen.getByText("距上一条 3 天")).toBeInTheDocument();
    });

    it("shows each entry's watch-interval end time computed from the group's runtime", () => {
        const group = makeEpisodeGroup({
            runtime: 24,
            entries: [makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" })],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        const expectedEnd = new Date("2026-01-01T00:24:00.000Z").toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
        expect(screen.getByText(`→ ${expectedEnd}`, { exact: false })).toBeInTheDocument();
    });

    it("shows no end time when the group's runtime is unknown", () => {
        const group = makeEpisodeGroup({ runtime: null });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.queryByText("→", { exact: false })).toBeNull();
    });

    it("flags an entry whose gap is within the previous watch's runtime as overlapping", () => {
        const group = makeEpisodeGroup({
            runtime: 24,
            entries: [
                makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" }),
                makeEntry({
                    id: 2,
                    watchedAt: "2026-01-01T00:20:00.000Z",
                    gapFromPreviousHours: 20 / 60,
                    suggested: true,
                }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.getByText("与前一次观看重叠")).toBeInTheDocument();
    });

    it("does not flag an entry whose gap exceeds the previous watch's runtime", () => {
        const group = makeEpisodeGroup({
            runtime: 24,
            entries: [
                makeEntry({ id: 1, watchedAt: "2026-01-01T00:00:00.000Z" }),
                makeEntry({
                    id: 2,
                    watchedAt: "2026-01-01T00:30:00.000Z",
                    gapFromPreviousHours: 30 / 60,
                    suggested: true,
                }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.queryByText("与前一次观看重叠")).toBeNull();
    });

    it("pre-checks suggested entries and leaves non-suggested ones unchecked", () => {
        const group = makeEpisodeGroup({
            entries: [
                makeEntry({ id: 1, suggested: false }),
                makeEntry({ id: 2, suggested: true }),
                makeEntry({ id: 3, suggested: true }),
            ],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        const boxes = checkboxes(container);
        expect(boxes.map((b) => b.checked)).toEqual([false, true, true]);
    });

    it("re-seeds the default selection when a fresh dataset lands, discarding manual toggles from the old one", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [makeEpisodeGroup({ entries: [makeEntry({ id: 1, suggested: true })] })],
                windowHours: 72,
            },
            isLoading: false,
            isError: false,
        } as never);
        const { container, rerender } = render(
            <MemoryRouter>
                <HistoryDuplicatesPage />
            </MemoryRouter>,
        );
        expect(checkboxes(container).map((b) => b.checked)).toEqual([true]);

        // User manually unchecks the pre-suggested entry.
        fireEvent.click(checkboxes(container)[0]);
        expect(checkboxes(container)[0].checked).toBe(false);

        // A fresh dataset lands (e.g. the window changed) with a different group.
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [makeEpisodeGroup({ entries: [makeEntry({ id: 2, suggested: true })] })],
                windowHours: 24,
            },
            isLoading: false,
            isError: false,
        } as never);
        rerender(
            <MemoryRouter>
                <HistoryDuplicatesPage />
            </MemoryRouter>,
        );

        expect(checkboxes(container).map((b) => b.checked)).toEqual([true]);
    });

    it("toggles an individual checkbox on click", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [makeEpisodeGroup({ entries: [makeEntry({ id: 1 })] })],
                windowHours: 72,
            },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();
        const [box] = checkboxes(container);
        expect(box.checked).toBe(false);
        fireEvent.click(box);
        expect(box.checked).toBe(true);
        fireEvent.click(box);
        expect(box.checked).toBe(false);
    });

    it("select-all and deselect-all toggle every checkbox", () => {
        const group = makeEpisodeGroup({
            entries: [makeEntry({ id: 1 }), makeEntry({ id: 2 })],
        });
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [group], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        const { container } = renderPage();

        fireEvent.click(screen.getByText("全选"));
        expect(checkboxes(container).every((b) => b.checked)).toBe(true);

        fireEvent.click(screen.getByText("全不选"));
        expect(checkboxes(container).every((b) => !b.checked)).toBe(true);
    });

    it("hides the floating delete bar when nothing is selected", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: {
                groups: [makeEpisodeGroup({ entries: [makeEntry({ id: 1, suggested: false })] })],
                windowHours: 72,
            },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(screen.queryByText(/删除已选中的/)).toBeNull();
    });

    it("changes the requested window on input and re-queries", () => {
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        expect(mockUseHistoryDuplicates).toHaveBeenLastCalledWith(72);

        fireEvent.change(screen.getByDisplayValue("72"), { target: { value: "24" } });
        expect(mockUseHistoryDuplicates).toHaveBeenLastCalledWith(24);
    });

    it("clamps a cleared/non-numeric window input to the minimum", () => {
        // jsdom's <input type="number"> coerces an invalid typed value (e.g. "abc")
        // down to an empty string at the DOM level before onChange ever fires, and
        // Number("") is 0 — finite, so it reaches the clamp rather than being
        // dropped, landing on MIN_WINDOW_HOURS.
        mockUseHistoryDuplicates.mockReturnValue({
            data: { groups: [], windowHours: 72 },
            isLoading: false,
            isError: false,
        } as never);
        renderPage();
        fireEvent.change(screen.getByDisplayValue("72"), { target: { value: "abc" } });
        expect(mockUseHistoryDuplicates).toHaveBeenLastCalledWith(1);
    });

    describe("delete flow", () => {
        function renderWithOneSuggested() {
            mockUseHistoryDuplicates.mockReturnValue({
                data: {
                    groups: [
                        makeEpisodeGroup({ entries: [makeEntry({ id: 1, suggested: true })] }),
                    ],
                    windowHours: 72,
                },
                isLoading: false,
                isError: false,
            } as never);
            return renderPage();
        }

        it("opens a confirm dialog naming the selected count and deletes on confirm", async () => {
            mutateAsync.mockResolvedValue({ ok: true, deleted: 1, notFound: 0 });
            renderWithOneSuggested();

            fireEvent.click(screen.getByText("删除已选中的 1 条"));
            expect(screen.getByText("从 Trakt.tv 永久删除这些记录？")).toBeInTheDocument();
            const dialog = screen
                .getByText("从 Trakt.tv 永久删除这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            expect(within(dialog).getByText(/将删除 1 条记录/)).toBeInTheDocument();

            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            expect(mutateAsync).toHaveBeenCalledWith([1]);
            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("已删除 1 条记录", "success"),
            );
        });

        it("cancels without deleting", () => {
            renderWithOneSuggested();
            fireEvent.click(screen.getByText("删除已选中的 1 条"));
            const dialog = screen
                .getByText("从 Trakt.tv 永久删除这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
            expect(mutateAsync).not.toHaveBeenCalled();
        });

        it("shows the thrown error message when the removal fails", async () => {
            mutateAsync.mockRejectedValue(new Error("network down"));
            renderWithOneSuggested();
            fireEvent.click(screen.getByText("删除已选中的 1 条"));
            const dialog = screen
                .getByText("从 Trakt.tv 永久删除这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("network down", "error"));
        });

        it("falls back to the generic failure message when the rejection has no message", async () => {
            mutateAsync.mockRejectedValue({});
            renderWithOneSuggested();
            fireEvent.click(screen.getByText("删除已选中的 1 条"));
            const dialog = screen
                .getByText("从 Trakt.tv 永久删除这些记录？")
                .closest(".hud-panel-strong") as HTMLElement;
            fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

            await vi.waitFor(() =>
                expect(toast).toHaveBeenCalledWith("删除失败，请重试。", "error"),
            );
        });
    });
});
