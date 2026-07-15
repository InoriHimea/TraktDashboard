import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchHistoryEntry } from "@trakt-dashboard/types";
import { WatchHistoryPanel } from "../WatchHistoryPanel";
import { useEpisodeHistory, useShowHistory, useDeleteHistory } from "../../hooks";

vi.mock("../../hooks", () => ({
    useEpisodeHistory: vi.fn(),
    useShowHistory: vi.fn(),
    useDeleteHistory: vi.fn(),
}));

const mockEpisodeHistory = vi.mocked(useEpisodeHistory);
const mockShowHistory = vi.mocked(useShowHistory);
const mockDeleteHistory = vi.mocked(useDeleteHistory);

const ENTRY_WITH_TITLE: WatchHistoryEntry = {
    id: 501,
    episodeId: 10,
    seasonNumber: 2,
    episodeNumber: 5,
    episodeTitle: "The Return",
    watchedAt: "2026-07-15T10:00:00.000Z",
    source: "trakt",
};

const ENTRY_NO_TITLE_NO_TIME: WatchHistoryEntry = {
    id: 502,
    episodeId: 11,
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: null,
    watchedAt: null,
    source: "manual",
};

function baseProps(overrides: Partial<Parameters<typeof WatchHistoryPanel>[0]> = {}) {
    return {
        open: true,
        onClose: vi.fn(),
        showId: 7,
        onDeleted: vi.fn(),
        ...overrides,
    };
}

describe("WatchHistoryPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // shouldAdvanceTime keeps real-timer-backed utilities like waitFor()
        // functional while still letting setSystemTime pin "now" for dayjs.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
        mockDeleteHistory.mockReturnValue({ mutateAsync: vi.fn() } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("uses the episode-scoped hook and title when season/episode are both provided", () => {
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        mockShowHistory.mockReturnValue({ data: [], isLoading: false } as never);
        render(<WatchHistoryPanel {...baseProps({ seasonNumber: 2, episodeNumber: 5 })} />);
        expect(mockEpisodeHistory).toHaveBeenCalledWith(7, 2, 5);
        expect(screen.getByText("单集观看历史")).toBeInTheDocument();
    });

    it("uses the show-scoped hook and title when season/episode are omitted", () => {
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        mockShowHistory.mockReturnValue({ data: [], isLoading: false } as never);
        render(<WatchHistoryPanel {...baseProps()} />);
        expect(mockShowHistory).toHaveBeenCalledWith(7);
        expect(screen.getByText("全剧观看历史")).toBeInTheDocument();
    });

    it("shows the empty state when there is no history", () => {
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        mockShowHistory.mockReturnValue({ data: [], isLoading: false } as never);
        render(<WatchHistoryPanel {...baseProps()} />);
        expect(screen.getByText("暂无观看记录")).toBeInTheDocument();
        expect(screen.getByText("观看后记录将出现在这里")).toBeInTheDocument();
    });

    it("shows the record-count subtitle and renders each entry's SxE badge, title, and time", () => {
        mockShowHistory.mockReturnValue({
            data: [ENTRY_WITH_TITLE, ENTRY_NO_TITLE_NO_TIME],
            isLoading: false,
        } as never);
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        render(<WatchHistoryPanel {...baseProps()} />);

        expect(screen.getByText("共 2 条记录")).toBeInTheDocument();
        // show-scoped -> SxE badge visible.
        expect(screen.getByText("S02·E05")).toBeInTheDocument();
        expect(screen.getByText("The Return")).toBeInTheDocument();
        expect(screen.getByText("2 小时前")).toBeInTheDocument();
        expect(screen.getByText("2026/07/15 18:00")).toBeInTheDocument();
        // no watchedAt -> unknown-time fallback.
        expect(screen.getByText("未知时间")).toBeInTheDocument();
    });

    it("hides the SxE badge when scoped to a single episode", () => {
        mockEpisodeHistory.mockReturnValue({ data: [ENTRY_WITH_TITLE], isLoading: false } as never);
        mockShowHistory.mockReturnValue({ data: [], isLoading: false } as never);
        render(<WatchHistoryPanel {...baseProps({ seasonNumber: 2, episodeNumber: 5 })} />);
        expect(screen.queryByText("S02·E05")).not.toBeInTheDocument();
        expect(screen.getByText("The Return")).toBeInTheDocument();
    });

    it("deletes an entry: opens the confirm dialog, calls the mutation, and reports success", async () => {
        const mutateAsync = vi.fn().mockResolvedValue(undefined);
        mockDeleteHistory.mockReturnValue({ mutateAsync } as never);
        mockShowHistory.mockReturnValue({ data: [ENTRY_WITH_TITLE], isLoading: false } as never);
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        const onDeleted = vi.fn();

        render(<WatchHistoryPanel {...baseProps({ onDeleted })} />);
        fireEvent.click(screen.getByLabelText("删除记录"));

        expect(screen.getByText("确认删除？此操作不可撤销。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        expect(mutateAsync).toHaveBeenCalledWith(501);
        // Note: the confirm dialog's exit is animated via framer-motion's
        // AnimatePresence, which doesn't reliably complete/unmount in jsdom
        // (same snag as TraktProgressBar's `animate` prop elsewhere in this
        // suite) — assert the resulting behavior instead of DOM removal.
        await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    });

    it("shows the server error message and keeps the confirm dialog open when deletion fails", async () => {
        const mutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
        mockDeleteHistory.mockReturnValue({ mutateAsync } as never);
        mockShowHistory.mockReturnValue({ data: [ENTRY_WITH_TITLE], isLoading: false } as never);
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);

        render(<WatchHistoryPanel {...baseProps()} />);
        fireEvent.click(screen.getByLabelText("删除记录"));
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        await waitFor(() => expect(screen.getByText("network down")).toBeInTheDocument());
        expect(screen.getByText("确认删除？此操作不可撤销。")).toBeInTheDocument();
    });

    it("falls back to a generic error message when the rejection isn't an Error instance", async () => {
        const mutateAsync = vi.fn().mockRejectedValue("boom");
        mockDeleteHistory.mockReturnValue({ mutateAsync } as never);
        mockShowHistory.mockReturnValue({ data: [ENTRY_WITH_TITLE], isLoading: false } as never);
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);

        render(<WatchHistoryPanel {...baseProps()} />);
        fireEvent.click(screen.getByLabelText("删除记录"));
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        await waitFor(() => expect(screen.getByText("删除失败，请重试")).toBeInTheDocument());
    });

    it("cancels the confirm dialog without deleting", () => {
        mockShowHistory.mockReturnValue({ data: [ENTRY_WITH_TITLE], isLoading: false } as never);
        mockEpisodeHistory.mockReturnValue({ data: [], isLoading: false } as never);
        const mutateAsync = vi.fn();
        mockDeleteHistory.mockReturnValue({ mutateAsync } as never);

        render(<WatchHistoryPanel {...baseProps()} />);
        fireEvent.click(screen.getByLabelText("删除记录"));
        fireEvent.click(screen.getByRole("button", { name: "取消" }));

        expect(mutateAsync).not.toHaveBeenCalled();
    });
});
