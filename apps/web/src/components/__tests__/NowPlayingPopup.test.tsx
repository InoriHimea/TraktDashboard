import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NowPlayingEpisode, JellyfinNowPlaying } from "@trakt-dashboard/types";
import {
    NowPlayingPopup,
    computeRemainingMinutes,
    computeProgressPct,
    formatSeasonEpisode,
} from "../NowPlayingPopup";
import { useMarkEpisodeWatched, useMarkMovieWatched } from "../../hooks";

vi.mock("../../hooks", () => ({
    useMarkEpisodeWatched: vi.fn(),
    useMarkMovieWatched: vi.fn(),
}));

const mockUseMarkEpisodeWatched = vi.mocked(useMarkEpisodeWatched);
const mockUseMarkMovieWatched = vi.mocked(useMarkMovieWatched);

function makeTraktData(overrides: Partial<NowPlayingEpisode> = {}): NowPlayingEpisode {
    return {
        show: { title: "Some Show", posterPath: "/poster.jpg", traktSlug: "some-show" },
        episode: { seasonNumber: 2, episodeNumber: 5, title: "Ep Title" },
        expiresAt: "2026-07-15T13:00:00.000Z",
        runtime: 40,
        ...overrides,
    };
}

function makeJellyfinData(overrides: Partial<JellyfinNowPlaying> = {}): JellyfinNowPlaying {
    return {
        jellyfinItemId: "jf-1",
        mediaType: "episode",
        title: "Ep Title",
        seriesTitle: "Some Series",
        seasonNumber: 1,
        episodeNumber: 3,
        posterUrl: "/jf-poster.jpg",
        runtimeMinutes: 30,
        progressPct: 50,
        isPaused: false,
        localShowId: 10,
        localMovieId: null,
        ...overrides,
    };
}

describe("NowPlayingPopup pure helpers", () => {
    it("computeRemainingMinutes clamps to 0 and rounds to the nearest minute", () => {
        const now = Date.parse("2026-07-15T12:00:00.000Z");
        expect(computeRemainingMinutes("2026-07-15T12:10:00.000Z", now)).toBe(10);
        expect(computeRemainingMinutes("2026-07-15T11:59:00.000Z", now)).toBe(0); // already expired
        expect(computeRemainingMinutes("2026-07-15T12:00:29.000Z", now)).toBe(0); // rounds down under 30s
        expect(computeRemainingMinutes("2026-07-15T12:00:31.000Z", now)).toBe(1); // rounds up over 30s
    });

    it("computeProgressPct handles null/zero runtime and clamps to [0, 100]", () => {
        expect(computeProgressPct(null, 10)).toBe(0);
        expect(computeProgressPct(0, 10)).toBe(0);
        expect(computeProgressPct(40, 40)).toBe(0); // nothing elapsed yet
        expect(computeProgressPct(40, 0)).toBe(100); // fully elapsed
        expect(computeProgressPct(40, -10)).toBe(100); // over-elapsed clamps to 100
        expect(computeProgressPct(40, 50)).toBe(0); // remaining > runtime clamps to 0
        expect(computeProgressPct(40, 10)).toBe(75);
    });

    it("formatSeasonEpisode joins with a middle dot, no zero-padding", () => {
        expect(formatSeasonEpisode(2, 5)).toBe("S2·E5");
    });
});

describe("NowPlayingPopup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
        mockUseMarkEpisodeWatched.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
        mockUseMarkMovieWatched.mockReturnValue({
            mutateAsync: vi.fn(),
            isPending: false,
        } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders nothing when isOpen is false", () => {
        const { container } = render(
            <NowPlayingPopup data={null} isLoading={false} isOpen={false} onClose={vi.fn()} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the skeleton while loading with no data yet", () => {
        render(<NowPlayingPopup data={null} isLoading={true} isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByTestId("now-playing-skeleton")).toBeInTheDocument();
    });

    it("shows the Trakt header/body: poster, episode badge, titles, and remaining time", () => {
        const data = makeTraktData();
        const { container } = render(
            <NowPlayingPopup data={data} isLoading={false} isOpen={true} onClose={vi.fn()} />,
        );
        expect(screen.getByText("正在播放")).toBeInTheDocument();
        expect(container.querySelector('img[src*="/api/img/w92/poster.jpg"]')).not.toBeNull();
        expect(screen.getByText("S2·E5")).toBeInTheDocument();
        expect(screen.getByText("Ep Title")).toBeInTheDocument();
        expect(screen.getByText("Some Show")).toBeInTheDocument();
        // expiresAt is 1h after "now" -> 60 min remaining.
        expect(screen.getByText("60 min remaining")).toBeInTheDocument();
    });

    it("falls back to the Tv2 placeholder after the Trakt poster fails to load", () => {
        const { container } = render(
            <NowPlayingPopup
                data={makeTraktData()}
                isLoading={false}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );
        const img = container.querySelector("img")!;
        fireEvent.error(img);
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector('[data-testid="poster-placeholder"]')).not.toBeNull();
    });

    it("resets the poster-error state once a new episode with a different poster arrives", () => {
        const { container, rerender } = render(
            <NowPlayingPopup
                data={makeTraktData({ show: { ...makeTraktData().show, posterPath: "/a.jpg" } })}
                isLoading={false}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );
        fireEvent.error(container.querySelector("img")!);
        expect(container.querySelector("img")).toBeNull();

        rerender(
            <NowPlayingPopup
                data={makeTraktData({ show: { ...makeTraktData().show, posterPath: "/b.jpg" } })}
                isLoading={false}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );
        expect(container.querySelector('img[src*="/api/img/w92/b.jpg"]')).not.toBeNull();
    });

    it("ticks the remaining-time countdown down every minute", () => {
        render(
            <NowPlayingPopup
                data={makeTraktData()}
                isLoading={false}
                isOpen={true}
                onClose={vi.fn()}
            />,
        );
        expect(screen.getByText("60 min remaining")).toBeInTheDocument();
        // the setInterval callback's setState happens outside a React event
        // handler, so it must be wrapped in act() to flush synchronously.
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        expect(screen.getByText("59 min remaining")).toBeInTheDocument();
    });

    it("closes on a mousedown outside the card, but not on the card itself or the trigger button", () => {
        const onClose = vi.fn();
        const triggerRef = { current: document.createElement("button") };
        document.body.appendChild(triggerRef.current);
        render(
            <NowPlayingPopup
                data={makeTraktData()}
                isLoading={false}
                isOpen={true}
                onClose={onClose}
                triggerRef={triggerRef}
            />,
        );

        fireEvent.mouseDown(screen.getByText("Some Show"));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(triggerRef.current);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
        const onClose = vi.fn();
        render(
            <NowPlayingPopup
                data={makeTraktData()}
                isLoading={false}
                isOpen={true}
                onClose={onClose}
            />,
        );
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
    });

    describe("Jellyfin body", () => {
        it("shows the jellyfin header/title, poster, episode badge, series title, and paused state", () => {
            const { container } = render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData({ isPaused: true })}
                    isLoading={false}
                    isOpen={true}
                    onClose={vi.fn()}
                />,
            );
            expect(screen.getByText("Jellyfin 播放中")).toBeInTheDocument();
            expect(container.querySelector('img[src="/jf-poster.jpg"]')).not.toBeNull();
            expect(screen.getByText("S1·E3")).toBeInTheDocument();
            expect(screen.getByText("Ep Title")).toBeInTheDocument();
            expect(screen.getByText("Some Series")).toBeInTheDocument();
            expect(screen.getByText("已暂停")).toBeInTheDocument();
        });

        it("hides the mark-watched button for an episode missing local ids", () => {
            render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData({ localShowId: null })}
                    isLoading={false}
                    isOpen={true}
                    onClose={vi.fn()}
                />,
            );
            expect(screen.queryByText("标记已看")).not.toBeInTheDocument();
        });

        it("marks a jellyfin episode watched, then closes the popup after a delay", async () => {
            const mutateAsync = vi.fn().mockResolvedValue(undefined);
            mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync, isPending: false } as never);
            const onClose = vi.fn();
            render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData()}
                    isLoading={false}
                    isOpen={true}
                    onClose={onClose}
                />,
            );

            fireEvent.click(screen.getByText("标记已看"));
            expect(mutateAsync).toHaveBeenCalledWith({
                showId: 10,
                seasonNumber: 1,
                episodeNumber: 3,
            });
            await waitFor(() => expect(screen.getByText("已看")).toBeInTheDocument());
            expect(onClose).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1000);
            expect(onClose).toHaveBeenCalled();
        });

        it("marks a jellyfin movie watched via useMarkMovieWatched", async () => {
            const mutateAsync = vi.fn().mockResolvedValue(undefined);
            mockUseMarkMovieWatched.mockReturnValue({ mutateAsync, isPending: false } as never);
            render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData({
                        mediaType: "movie",
                        localShowId: null,
                        localMovieId: 55,
                        seasonNumber: null,
                        episodeNumber: null,
                    })}
                    isLoading={false}
                    isOpen={true}
                    onClose={vi.fn()}
                />,
            );
            fireEvent.click(screen.getByText("标记已看"));
            await waitFor(() =>
                expect(mutateAsync).toHaveBeenCalledWith("2026-07-15T12:00:00.000Z"),
            );
        });

        it("silently ignores a failed mark-as-watched and leaves the button clickable again", async () => {
            const mutateAsync = vi.fn().mockRejectedValue(new Error("boom"));
            mockUseMarkEpisodeWatched.mockReturnValue({ mutateAsync, isPending: false } as never);
            render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData()}
                    isLoading={false}
                    isOpen={true}
                    onClose={vi.fn()}
                />,
            );
            fireEvent.click(screen.getByText("标记已看"));
            await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
            expect(screen.getByText("标记已看")).toBeInTheDocument();
            expect(screen.queryByText("已看")).not.toBeInTheDocument();
        });

        it("falls back to the Tv2 icon when there is no jellyfin poster", () => {
            const { container } = render(
                <NowPlayingPopup
                    data={null}
                    jellyfinData={makeJellyfinData({ posterUrl: null })}
                    isLoading={false}
                    isOpen={true}
                    onClose={vi.fn()}
                />,
            );
            expect(container.querySelector("img")).toBeNull();
            expect(container.querySelectorAll(".lucide-tv-minimal").length).toBeGreaterThan(0);
        });
    });
});
