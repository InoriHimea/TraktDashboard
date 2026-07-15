import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpNextItem } from "@trakt-dashboard/types";
import { UpNextBanner } from "../UpNextBanner";
import { useUpNext, useMarkEpisodeWatched } from "../../hooks";

vi.mock("../../hooks", () => ({
    useUpNext: vi.fn(),
    useMarkEpisodeWatched: vi.fn(),
}));

const mockUseUpNext = vi.mocked(useUpNext);
const mockUseMarkEpisodeWatched = vi.mocked(useMarkEpisodeWatched);

function makeItem(overrides: Partial<UpNextItem> = {}): UpNextItem {
    return {
        showId: 1,
        showTitle: "Some Show",
        posterPath: null,
        lastWatchedAt: null,
        nextEpisode: {
            id: 100,
            seasonNumber: 1,
            episodeNumber: 2,
            title: "Episode Title",
            stillPath: "/still.jpg",
            airDate: null,
            runtime: null,
        },
        ...overrides,
    };
}

function renderBanner() {
    return render(
        <MemoryRouter>
            <UpNextBanner />
        </MemoryRouter>,
    );
}

describe("UpNextBanner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing while loading", () => {
        mockUseUpNext.mockReturnValue({ data: undefined, isLoading: true } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync: vi.fn() } as never);
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when there are no items", () => {
        mockUseUpNext.mockReturnValue({ data: [], isLoading: false } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync: vi.fn() } as never);
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the header count, show title, episode badge, and the episode's own title", () => {
        mockUseUpNext.mockReturnValue({ data: [makeItem()], isLoading: false } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync: vi.fn() } as never);
        renderBanner();
        expect(screen.getByText("接着看")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("Some Show")).toBeInTheDocument();
        expect(screen.getByText("S01·E02")).toBeInTheDocument();
        expect(screen.getByText("Episode Title")).toBeInTheDocument();
    });

    it("falls back to the episode code as the title when ep.title is null", () => {
        const item = makeItem();
        mockUseUpNext.mockReturnValue({
            data: [{ ...item, nextEpisode: { ...item.nextEpisode, title: null } }],
            isLoading: false,
        } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync: vi.fn() } as never);
        renderBanner();
        // the image overlay badge and the info-section title line both show the code.
        expect(screen.getAllByText("S01·E02")).toHaveLength(2);
    });

    it("shows a Play fallback icon when neither stillPath nor posterPath is set", () => {
        const item = makeItem();
        mockUseUpNext.mockReturnValue({
            data: [
                {
                    ...item,
                    posterPath: null,
                    nextEpisode: { ...item.nextEpisode, stillPath: null },
                },
            ],
            isLoading: false,
        } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync: vi.fn() } as never);
        const { container } = renderBanner();
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelectorAll(".lucide-play").length).toBeGreaterThan(0);
    });

    it("marks an episode watched: shows a spinner while pending, then the marked/disabled state, and blocks a second click", async () => {
        let resolveMutate: (() => void) | undefined;
        const mutateAsync = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveMutate = resolve;
                }),
        );
        mockUseUpNext.mockReturnValue({ data: [makeItem()], isLoading: false } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync } as never);

        const { container } = renderBanner();
        fireEvent.click(screen.getByTitle("标记已看"));

        expect(mutateAsync).toHaveBeenCalledWith({ showId: 1, seasonNumber: 1, episodeNumber: 2 });
        await waitFor(() =>
            expect(container.querySelector(".lucide-loader-circle")).not.toBeNull(),
        );

        resolveMutate?.();

        await waitFor(() => expect(screen.getByTitle("已看")).toBeInTheDocument());
        expect(screen.getByTitle("已看")).toBeDisabled();

        fireEvent.click(screen.getByTitle("已看"));
        expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    it("silently swallows a mutation failure and returns the button to its normal (clickable) state", async () => {
        let rejectMutate: ((err: Error) => void) | undefined;
        const mutateAsync = vi.fn(
            () =>
                new Promise<void>((_resolve, reject) => {
                    rejectMutate = reject;
                }),
        );
        mockUseUpNext.mockReturnValue({ data: [makeItem()], isLoading: false } as never);
        mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync } as never);

        renderBanner();
        fireEvent.click(screen.getByTitle("标记已看"));
        rejectMutate?.(new Error("boom"));

        await waitFor(() => expect(screen.getByTitle("标记已看")).not.toBeDisabled());
    });
});
