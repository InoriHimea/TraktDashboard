import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeDetailData, WatchHistoryEntry } from "@trakt-dashboard/types";
import { EpisodeInfoCard } from "../EpisodeInfoCard";
import {
    useMarkWatched,
    useEpisodeHistory,
    useDeleteHistory,
    useJellyfinEpisode,
    useDeleteJellyfinItem,
} from "../../hooks";
import { useToast } from "../../lib/toast";

vi.mock("../../hooks", () => ({
    useMarkWatched: vi.fn(),
    useEpisodeHistory: vi.fn(),
    useDeleteHistory: vi.fn(),
    useJellyfinEpisode: vi.fn(),
    useDeleteJellyfinItem: vi.fn(),
}));

vi.mock("../../lib/toast", () => ({
    useToast: vi.fn(),
}));

const mockUseMarkWatched = vi.mocked(useMarkWatched);
const mockUseEpisodeHistory = vi.mocked(useEpisodeHistory);
const mockUseDeleteHistory = vi.mocked(useDeleteHistory);
const mockUseJellyfinEpisode = vi.mocked(useJellyfinEpisode);
const mockUseDeleteJellyfinItem = vi.mocked(useDeleteJellyfinItem);
const mockUseToast = vi.mocked(useToast);

type DataOverrides = Partial<Omit<EpisodeDetailData, "show">> & {
    show?: Partial<EpisodeDetailData["show"]>;
};

function makeData(overrides: DataOverrides = {}): EpisodeDetailData {
    const { show: showOverrides, ...rest } = overrides;
    return {
        episodeId: 1,
        showId: 100,
        seasonNumber: 2,
        episodeNumber: 5,
        title: "Original Title",
        translatedTitle: "翻译标题",
        overview: "Some overview text",
        translatedOverview: null,
        airDate: "2024-03-15",
        runtime: 45,
        stillPath: null,
        watched: false,
        watchedAt: null,
        traktRating: 85,
        directors: ["Alice"],
        show: {
            id: 100,
            title: "Some Show",
            translatedName: null,
            posterPath: null,
            backdropPath: null,
            genres: ["Drama", "Sci-Fi", "Thriller", "Extra"],
            traktId: 1,
            traktSlug: "some-show",
            tmdbId: 999,
            imdbId: "tt123456",
            tvdbId: 456,
            ...showOverrides,
        },
        seasonEpisodes: [],
        ...rest,
    };
}

function renderCard(
    dataOverrides: DataOverrides = {},
    props: Partial<{ isWatched: boolean; onHistoryClick: () => void; onRefetch: () => void }> = {},
) {
    return render(
        <EpisodeInfoCard
            data={makeData(dataOverrides)}
            isWatched={props.isWatched ?? false}
            onHistoryClick={props.onHistoryClick ?? vi.fn()}
            onRefetch={props.onRefetch ?? vi.fn()}
        />,
    );
}

describe("EpisodeInfoCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseMarkWatched.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
        mockUseEpisodeHistory.mockReturnValue({ data: [] } as never);
        mockUseDeleteHistory.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
        mockUseJellyfinEpisode.mockReturnValue({ data: null } as never);
        mockUseDeleteJellyfinItem.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
        mockUseToast.mockReturnValue({ toast: vi.fn(), toasts: [], dismiss: vi.fn() } as never);
    });

    it("prefers the translated title, and shows the original title only when it differs", () => {
        renderCard();
        expect(screen.getByText("S02E05")).toBeInTheDocument();
        expect(screen.getByText("Some Show")).toBeInTheDocument();
        expect(screen.getByText("翻译标题")).toBeInTheDocument();
        expect(screen.getByText("Original Title")).toBeInTheDocument();
    });

    it("hides the original-title line when it's identical to the translated title", () => {
        renderCard({ title: "Same", translatedTitle: "Same" });
        expect(screen.getAllByText("Same")).toHaveLength(1);
    });

    it("falls back to the episode code as the title when both title fields are null", () => {
        renderCard({ title: null, translatedTitle: null });
        // the Tag badge and the <h1> both render "S02E05".
        expect(screen.getAllByText("S02E05")).toHaveLength(2);
    });

    it("renders air date and runtime, falling back to 'unknown' when missing", () => {
        renderCard({ airDate: "2024-03-15", runtime: 45 });
        expect(screen.getByText("2024年3月15日")).toBeInTheDocument();
        expect(screen.getByText("45 分钟")).toBeInTheDocument();

        renderCard({ airDate: null, runtime: null });
        expect(screen.getAllByText("未知")).toHaveLength(2);
    });

    it("omits the director meta item when there are no directors, joins up to 2 with a slash, and summarizes 3+", () => {
        const { container: noDirectors } = renderCard({ directors: [] });
        expect(within(noDirectors).queryByText("导演")).not.toBeInTheDocument();

        renderCard({ directors: ["Alice", "Bob"] });
        expect(screen.getByText("Alice / Bob")).toBeInTheDocument();

        renderCard({ directors: ["Alice", "Bob", "Carol"] });
        expect(screen.getByText("Alice / Bob 等 3 人")).toBeInTheDocument();
    });

    it("shows the overview, or the no-overview fallback when blank", () => {
        renderCard({ overview: "Some overview text" });
        expect(screen.getByText("Some overview text")).toBeInTheDocument();

        renderCard({ overview: "   ", translatedOverview: null });
        expect(screen.getByText("暂无简介")).toBeInTheDocument();
    });

    it("renders at most 3 genre tags", () => {
        renderCard({ show: { genres: ["Drama", "Sci-Fi", "Thriller", "Extra"] } });
        expect(screen.getByText("Drama")).toBeInTheDocument();
        expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
        expect(screen.getByText("Thriller")).toBeInTheDocument();
        expect(screen.queryByText("Extra")).not.toBeInTheDocument();
    });

    it("shows the trakt rating badge only when traktRating is set", () => {
        const { container: withRating } = renderCard({ traktRating: 85 });
        expect(within(withRating).getByText("85")).toBeInTheDocument();

        const { container: withoutRating } = renderCard({ traktRating: null });
        expect(within(withoutRating).queryByText("Trakt 评分")).not.toBeInTheDocument();
    });

    it("renders an external link pill only for each ID that exists", () => {
        const { container: allLinks } = renderCard({
            show: { traktSlug: "s", tmdbId: 1, imdbId: "tt1", tvdbId: 1 },
        });
        expect(within(allLinks).getByText("IMDb")).toBeInTheDocument();
        expect(within(allLinks).getByText("TMDB")).toBeInTheDocument();
        expect(within(allLinks).getByText("TVDB")).toBeInTheDocument();
        expect(within(allLinks).getByText("Trakt")).toBeInTheDocument();

        const { container: noLinks } = renderCard({
            show: { traktSlug: null, tmdbId: 0, imdbId: null, tvdbId: null },
        });
        expect(within(noLinks).queryByText("IMDb")).not.toBeInTheDocument();
        expect(within(noLinks).queryByText("TMDB")).not.toBeInTheDocument();
    });

    it("marks watched: confirm -> date picker -> confirm date -> calls the mutation and onRefetch", async () => {
        const mutateAsync = vi.fn().mockResolvedValue(undefined);
        mockUseMarkWatched.mockReturnValue({ mutateAsync, isPending: false } as never);
        const onRefetch = vi.fn();
        renderCard({}, { isWatched: false, onRefetch });

        fireEvent.click(screen.getByText("标记已观看"));
        expect(
            screen.getByText("确认将此集标记为已观看？你可以在下一步选择观看时间。"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "继续" }));

        // DateTimePickerModal is now open. Its confirm button's accessible
        // text ("标记为已观看" / episode.markWatched) collides with the page
        // button's aria-label (also episode.markWatched, even though its
        // visible text is the shorter markWatchedShort) — scope the query to
        // the date-picker's own container via its unique input id.
        await waitFor(() =>
            expect(document.getElementById("datetime-picker-input")).not.toBeNull(),
        );
        const dateInput = document.getElementById("datetime-picker-input")!;
        const modalContainer = dateInput.closest(".rounded-2xl") as HTMLElement;
        fireEvent.click(within(modalContainer).getByRole("button", { name: "标记为已观看" }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        expect(onRefetch).toHaveBeenCalled();
    });

    it("unwatches directly when there is exactly one history entry", async () => {
        const mutateAsync = vi.fn().mockResolvedValue(undefined);
        mockUseDeleteHistory.mockReturnValue({ mutateAsync, isPending: false } as never);
        mockUseEpisodeHistory.mockReturnValue({
            data: [{ id: 501 } as WatchHistoryEntry],
        } as never);
        const onRefetch = vi.fn();
        renderCard({}, { isWatched: true, onRefetch });

        fireEvent.click(screen.getByText("已观看"));
        expect(screen.getByText("确认删除此集的观看记录？此操作不可撤销。")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(501));
        expect(onRefetch).toHaveBeenCalled();
    });

    it("picks a specific entry to delete when there are multiple history entries", async () => {
        const mutateAsync = vi.fn().mockResolvedValue(undefined);
        mockUseDeleteHistory.mockReturnValue({ mutateAsync, isPending: false } as never);
        mockUseEpisodeHistory.mockReturnValue({
            data: [
                { id: 501, watchedAt: null } as WatchHistoryEntry,
                { id: 502, watchedAt: null } as WatchHistoryEntry,
            ],
        } as never);
        renderCard({}, { isWatched: true });

        fireEvent.click(screen.getByText("已观看"));
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        // 2 unknown-time entries listed in the picker modal.
        const entryButtons = screen.getAllByText("未知时间");
        expect(entryButtons.length).toBe(2);
        fireEvent.click(entryButtons[0]);

        // A second confirm dialog appears before the actual delete fires.
        // Its confirm button also reads "删除", but so does the first
        // (confirmUnwatchOpen) dialog's — which lingers in the DOM because
        // AnimatePresence's exit doesn't complete in jsdom (same snag as
        // WatchHistoryPanel/batch 8). Scope by this dialog's own title.
        const dialogTitle = screen.getByText("删除观看记录");
        const dialogContainer = dialogTitle.closest(".rounded-2xl") as HTMLElement;
        fireEvent.click(within(dialogContainer).getByRole("button", { name: "删除" }));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(501));
    });

    it("shows the jellyfin delete button only when a jellyfin episode exists, and reports success", async () => {
        const mutateAsync = vi.fn().mockResolvedValue(undefined);
        mockUseDeleteJellyfinItem.mockReturnValue({ mutateAsync, isPending: false } as never);
        const toast = vi.fn();
        mockUseToast.mockReturnValue({ toast, toasts: [], dismiss: vi.fn() } as never);
        mockUseJellyfinEpisode.mockReturnValue({
            data: { id: "jf-1", name: "n", seriesName: "s", path: null },
        } as never);
        renderCard();

        fireEvent.click(screen.getByText("删除文件"));
        expect(
            screen.getByText("将从 Jellyfin 媒体库中删除此集的视频文件，此操作不可撤销。"),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "删除" }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("jf-1"));
        await waitFor(() => expect(toast).toHaveBeenCalledWith("文件已删除", "success"));
    });

    it("hides the jellyfin delete button when there is no jellyfin episode", () => {
        mockUseJellyfinEpisode.mockReturnValue({ data: null } as never);
        renderCard();
        expect(screen.queryByText("删除文件")).not.toBeInTheDocument();
    });

    it("calls onHistoryClick when the watch-history button is clicked", () => {
        const onHistoryClick = vi.fn();
        renderCard({}, { onHistoryClick });
        fireEvent.click(screen.getByText("观看历史"));
        expect(onHistoryClick).toHaveBeenCalled();
    });
});
