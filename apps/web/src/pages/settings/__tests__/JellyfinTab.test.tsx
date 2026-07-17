import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
    JellyfinLibrary,
    JellyfinDeleteQueueEntry,
    JellyfinDeleteExclusion,
    JellyfinDeleteHistoryEntry,
} from "@trakt-dashboard/types";
import { JellyfinTab } from "../JellyfinTab";

const LIB_A: JellyfinLibrary = { id: "lib1", name: "Movies", collectionType: "movies" };
const LIB_B: JellyfinLibrary = { id: "lib2", name: "Shows", collectionType: "" };

const QUEUE_SHOW_WHOLE: JellyfinDeleteQueueEntry = {
    id: 1,
    seasonNumber: null,
    queuedAt: "2026-07-01T00:00:00.000Z",
    show: { id: 10, title: "Some Show", posterPath: null },
    movie: null,
};
const QUEUE_SHOW_SEASON: JellyfinDeleteQueueEntry = {
    id: 2,
    seasonNumber: 3,
    queuedAt: "2026-07-02T00:00:00.000Z",
    show: { id: 11, title: "Other Show", posterPath: null },
    movie: null,
};
const QUEUE_MOVIE: JellyfinDeleteQueueEntry = {
    id: 3,
    seasonNumber: null,
    queuedAt: "2026-07-03T00:00:00.000Z",
    show: null,
    movie: { id: 20, title: "Some Movie", posterPath: null },
};

const EX_SEASON: JellyfinDeleteExclusion = {
    id: 1,
    showId: 10,
    movieId: null,
    seasonNumber: 2,
    mode: "never",
    deferUntil: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    title: "Some Show",
};
const EX_DEFER: JellyfinDeleteExclusion = {
    id: 2,
    showId: 11,
    movieId: null,
    seasonNumber: null,
    mode: "defer",
    deferUntil: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    title: "Other Show",
};
const EX_MOVIE: JellyfinDeleteExclusion = {
    id: 3,
    showId: null,
    movieId: 20,
    seasonNumber: null,
    mode: "never",
    deferUntil: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    title: "Some Movie",
};

const HIST_DELETED: JellyfinDeleteHistoryEntry = {
    id: 1,
    showId: 10,
    movieId: null,
    seasonNumber: 2,
    title: "Some Show",
    status: "deleted",
    errorMessage: null,
    processedAt: "2026-07-01T00:00:00.000Z",
};
const HIST_FAILED: JellyfinDeleteHistoryEntry = {
    id: 2,
    showId: 11,
    movieId: null,
    seasonNumber: null,
    title: "Other Show",
    status: "failed",
    errorMessage: "Connection refused",
    processedAt: "2026-07-02T00:00:00.000Z",
};

function baseProps(overrides: Partial<Parameters<typeof JellyfinTab>[0]> = {}) {
    return {
        jellyfinUrl: "",
        setJellyfinUrl: vi.fn(),
        jellyfinApiKey: "",
        setJellyfinApiKey: vi.fn(),
        jellyfinLibraries: [],
        jellyfinLibrariesLoading: false,
        loadJellyfinLibraries: vi.fn(),
        jellyfinAutoDeleteIds: [],
        toggleJellyfinLibrary: vi.fn(),
        jellyfinAutoDeleteEnabled: false,
        setJellyfinAutoDeleteEnabled: vi.fn(),
        deleteQueue: [],
        deleteQueueLoading: false,
        isQueueActionPending: false,
        onDeferDelete: vi.fn(),
        onNeverDelete: vi.fn(),
        onOpenDeleteNow: vi.fn(),
        deleteExclusions: [],
        exclusionsLoading: false,
        isRemovingExclusion: false,
        onRemoveExclusion: vi.fn(),
        deleteHistory: [],
        deleteHistoryLoading: false,
        deleteNowTarget: null,
        isDeletingNow: false,
        onDeleteNowConfirm: vi.fn(),
        onDeleteNowCancel: vi.fn(),
        ...overrides,
    };
}

describe("JellyfinTab", () => {
    it("renders the URL/API key inputs and calls their setters on change", () => {
        const setJellyfinUrl = vi.fn();
        const setJellyfinApiKey = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({
                    jellyfinUrl: "http://nas:8096",
                    setJellyfinUrl,
                    setJellyfinApiKey,
                })}
            />,
        );
        expect(screen.getByDisplayValue("http://nas:8096")).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText("http://nas:8096"), {
            target: { value: "http://new:8096" },
        });
        expect(setJellyfinUrl).toHaveBeenCalledWith("http://new:8096");

        fireEvent.change(screen.getByPlaceholderText(/^x+$/), { target: { value: "secret" } });
        expect(setJellyfinApiKey).toHaveBeenCalledWith("secret");
    });

    it("shows the loading label and disables the button while loading libraries", () => {
        const loadJellyfinLibraries = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({ jellyfinLibrariesLoading: true, loadJellyfinLibraries })}
            />,
        );
        const button = screen.getByText("加载中…").closest("button")!;
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(loadJellyfinLibraries).not.toHaveBeenCalled();
    });

    it("loads libraries when the button is clicked while not loading", () => {
        const loadJellyfinLibraries = vi.fn();
        render(<JellyfinTab {...baseProps({ loadJellyfinLibraries })} />);
        fireEvent.click(screen.getByText("加载媒体库"));
        expect(loadJellyfinLibraries).toHaveBeenCalled();
    });

    it("renders the library checklist with collectionType suffix, checked state, and toggling", () => {
        const toggleJellyfinLibrary = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({
                    jellyfinLibraries: [LIB_A, LIB_B],
                    jellyfinAutoDeleteIds: ["lib1"],
                    toggleJellyfinLibrary,
                })}
            />,
        );
        expect(screen.getByText("Movies")).toBeInTheDocument();
        expect(screen.getByText("(movies)")).toBeInTheDocument();
        expect(screen.getByText("Shows")).toBeInTheDocument();

        const checkboxA = screen.getByText("Movies").closest("label")!.querySelector("input")!;
        const checkboxB = screen.getByText("Shows").closest("label")!.querySelector("input")!;
        expect(checkboxA).toBeChecked();
        expect(checkboxB).not.toBeChecked();

        fireEvent.click(checkboxB);
        expect(toggleJellyfinLibrary).toHaveBeenCalledWith("lib2");
    });

    it("hides the library checklist entirely when there are no libraries", () => {
        render(<JellyfinTab {...baseProps({ jellyfinLibraries: [] })} />);
        expect(screen.queryByText("Movies")).not.toBeInTheDocument();
    });

    it("toggles the auto-delete switch and shows the enabled/disabled hint accordingly", () => {
        const setJellyfinAutoDeleteEnabled = vi.fn();
        const { rerender } = render(
            <JellyfinTab
                {...baseProps({ jellyfinAutoDeleteEnabled: false, setJellyfinAutoDeleteEnabled })}
            />,
        );
        expect(
            screen.getByText("自动删除已停用：不会标记新内容，队列中已有条目也不会被删除。"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByText("启用自动删除"));
        expect(setJellyfinAutoDeleteEnabled).toHaveBeenCalledWith(true);

        rerender(
            <JellyfinTab
                {...baseProps({ jellyfinAutoDeleteEnabled: true, setJellyfinAutoDeleteEnabled })}
            />,
        );
        expect(
            screen.getByText(
                "每日定时任务运行中：符合条件的内容将被标记，次日从 Jellyfin 删除文件。",
            ),
        ).toBeInTheDocument();
    });

    it("shows the empty state for the delete queue, exclusions, and delete history", () => {
        render(<JellyfinTab {...baseProps()} />);
        expect(screen.getByText("暂无待删除项目")).toBeInTheDocument();
        expect(screen.getByText("暂无排除项目")).toBeInTheDocument();
        expect(screen.getByText("暂无删除记录")).toBeInTheDocument();
    });

    it("renders each delete-queue entry with its whole-show/season/movie scope, date, and action buttons", () => {
        const onDeferDelete = vi.fn();
        const onNeverDelete = vi.fn();
        const onOpenDeleteNow = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({
                    deleteQueue: [QUEUE_SHOW_WHOLE, QUEUE_SHOW_SEASON, QUEUE_MOVIE],
                    onDeferDelete,
                    onNeverDelete,
                    onOpenDeleteNow,
                })}
            />,
        );

        expect(screen.getByText("Some Show · 整剧")).toBeInTheDocument();
        expect(screen.getByText("Other Show · 第 3 季")).toBeInTheDocument();
        // movie entries never get a scope suffix.
        expect(screen.getByText("Some Movie")).toBeInTheDocument();

        const row = screen.getByText("Some Show · 整剧").parentElement!;
        fireEvent.click(within(row).getByText("推迟 7 天"));
        expect(onDeferDelete).toHaveBeenCalledWith(1);
        fireEvent.click(within(row).getByText("永不删除"));
        expect(onNeverDelete).toHaveBeenCalledWith(1);
        fireEvent.click(within(row).getByText("立即删除"));
        expect(onOpenDeleteNow).toHaveBeenCalledWith({ id: 1, title: "Some Show · 整剧" });
    });

    it("disables the delete-queue action buttons while a queue action is pending", () => {
        render(
            <JellyfinTab
                {...baseProps({ deleteQueue: [QUEUE_SHOW_WHOLE], isQueueActionPending: true })}
            />,
        );
        const row = screen.getByText("Some Show · 整剧").parentElement!;
        expect(within(row).getByText("推迟 7 天")).toBeDisabled();
        expect(within(row).getByText("永不删除")).toBeDisabled();
        expect(within(row).getByText("立即删除")).toBeDisabled();
    });

    it("shows a loading indicator instead of the delete-queue list while loading", () => {
        const { container } = render(
            <JellyfinTab
                {...baseProps({ deleteQueue: [QUEUE_SHOW_WHOLE], deleteQueueLoading: true })}
            />,
        );
        expect(screen.queryByText("Some Show · 整剧")).not.toBeInTheDocument();
        expect(screen.queryByText("暂无待删除项目")).not.toBeInTheDocument();
        expect(container.querySelector('[style*="spin"]')).not.toBeNull();
    });

    it("renders each exclusion with its scope, mode label (never vs defer-until date), and remove button", () => {
        const onRemoveExclusion = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({
                    deleteExclusions: [EX_SEASON, EX_DEFER, EX_MOVIE],
                    onRemoveExclusion,
                })}
            />,
        );
        expect(screen.getByText("Some Show · 第 2 季")).toBeInTheDocument();
        expect(screen.getByText("Other Show · 整剧")).toBeInTheDocument();
        expect(screen.getByText("Some Movie")).toBeInTheDocument();
        expect(screen.getAllByText("永不删除")).toHaveLength(2); // EX_SEASON + EX_MOVIE
        expect(screen.getByText("推迟至 8/1/2026")).toBeInTheDocument();

        fireEvent.click(screen.getAllByTitle("移除排除")[0]);
        expect(onRemoveExclusion).toHaveBeenCalled();
    });

    it("disables the exclusion remove button while a removal is pending", () => {
        render(
            <JellyfinTab
                {...baseProps({ deleteExclusions: [EX_SEASON], isRemovingExclusion: true })}
            />,
        );
        expect(screen.getByTitle("移除排除")).toBeDisabled();
    });

    it("renders delete-history entries with status label and an error message only when failed", () => {
        render(<JellyfinTab {...baseProps({ deleteHistory: [HIST_DELETED, HIST_FAILED] })} />);
        expect(screen.getByText("Some Show · 第 2 季")).toBeInTheDocument();
        expect(screen.getByText("已删除")).toBeInTheDocument();
        // no season, but showId is set -> falls back to the whole-show scope.
        expect(screen.getByText("Other Show · 整剧")).toBeInTheDocument();
        expect(screen.getByText("删除失败")).toBeInTheDocument();
        expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });

    it("shows the delete-now confirm dialog with the target's title, and wires confirm/cancel", () => {
        const onDeleteNowConfirm = vi.fn();
        const onDeleteNowCancel = vi.fn();
        render(
            <JellyfinTab
                {...baseProps({
                    deleteNowTarget: { id: 1, title: "Some Show · 整剧" },
                    onDeleteNowConfirm,
                    onDeleteNowCancel,
                })}
            />,
        );
        expect(
            screen.getByText(
                "将立即从 Jellyfin 删除「Some Show · 整剧」，不再等待次日定时任务。此操作不可撤销。",
            ),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "立即删除" }));
        expect(onDeleteNowConfirm).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        expect(onDeleteNowCancel).toHaveBeenCalled();
    });

    it("keeps the delete-now dialog closed when there is no target", () => {
        render(<JellyfinTab {...baseProps({ deleteNowTarget: null })} />);
        expect(screen.queryByText("立即删除该条目？")).not.toBeInTheDocument();
    });
});
