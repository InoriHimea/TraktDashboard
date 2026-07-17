import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Show, ShowProgress, SeasonProgress } from "@trakt-dashboard/types";
import { HeroSection } from "../HeroSection";

function makeShow(overrides: Partial<Show> = {}): Show {
    return {
        id: 1,
        tmdbId: 100,
        tvdbId: 200,
        imdbId: "tt123",
        traktId: 5,
        traktSlug: "some-show",
        title: "Some Show",
        overview: "Overview text",
        status: "returning series",
        firstAired: "2020-05-01T00:00:00.000Z",
        network: "HBO",
        genres: ["Drama", "Sci-Fi", "Thriller", "Comedy", "Horror", "Extra"],
        posterPath: "/poster.jpg",
        backdropPath: null,
        totalEpisodes: 20,
        totalSeasons: 2,
        lastSyncedAt: "2026-07-01T00:00:00.000Z",
        createdAt: "2020-01-01T00:00:00.000Z",
        originalName: null,
        originalLanguage: "en",
        translatedName: null,
        translatedOverview: null,
        displayLanguage: null,
        ...overrides,
    };
}

function makeSeason(overrides: Partial<SeasonProgress> = {}): SeasonProgress {
    return {
        seasonNumber: 1,
        episodeCount: 10,
        watchedCount: 10,
        airedCount: 10,
        posterPath: null,
        episodes: [],
        ...overrides,
    };
}

type ProgressOverrides = Partial<Omit<ShowProgress, "show">> & { show?: Partial<Show> };

function makeProgress(overrides: ProgressOverrides = {}): ShowProgress {
    const { show: showOverrides, ...rest } = overrides;
    return {
        show: makeShow(showOverrides),
        airedEpisodes: 20,
        watchedEpisodes: 10,
        nextEpisode: null,
        lastWatchedAt: "2026-07-12T12:00:00.000Z",
        completed: false,
        percentage: 50,
        seasons: [
            makeSeason({ seasonNumber: 1, episodeCount: 10, watchedCount: 10 }),
            makeSeason({ seasonNumber: 2, episodeCount: 10, watchedCount: 0 }),
        ],
        ...rest,
    };
}

describe("HeroSection", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders the title, year, episode count, network, first genre, and status tag", () => {
        render(<HeroSection progress={makeProgress()} />);
        expect(screen.getByText("Some Show")).toBeInTheDocument();
        // "2020" also appears in the sidebar's first-aired-year stat.
        expect(screen.getAllByText("2020").length).toBeGreaterThan(0);
        expect(screen.getByText("20 eps.")).toBeInTheDocument();
        expect(screen.getAllByText("HBO").length).toBeGreaterThan(0);
        // "Drama" also appears as a sidebar genre tag; the status tag is
        // rendered once in the main column and again in the sidebar header.
        expect(screen.getAllByText("Drama").length).toBeGreaterThan(0);
        expect(screen.getAllByText("连载中").length).toBe(2);
    });

    it("prefers the translated name as the title", () => {
        render(<HeroSection progress={makeProgress({ show: { translatedName: "翻译剧名" } })} />);
        expect(screen.getByText("翻译剧名")).toBeInTheDocument();
        expect(screen.queryByText("Some Show")).not.toBeInTheDocument();
    });

    it("renders the poster image, and falls back to the Tv2 icon after it fails to load", () => {
        // the fixture's imdbId also renders a favicon <img>, so scope to the
        // poster specifically rather than asserting "no <img> anywhere".
        const { container } = render(<HeroSection progress={makeProgress()} />);
        const img = container.querySelector('img[src*="poster.jpg"]')!;
        expect(img).not.toBeNull();
        fireEvent.error(img);
        expect(container.querySelector('img[src*="poster.jpg"]')).toBeNull();
        expect(container.querySelector(".lucide-tv-minimal")).not.toBeNull();
    });

    it("calls onWatchClick when the poster is clicked or Enter is pressed on it", () => {
        const onWatchClick = vi.fn();
        render(<HeroSection progress={makeProgress()} onWatchClick={onWatchClick} />);
        const poster = screen.getByRole("button", { name: "继续观看" });
        fireEvent.click(poster);
        expect(onWatchClick).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(poster, { key: "Enter" });
        expect(onWatchClick).toHaveBeenCalledTimes(2);
        fireEvent.keyDown(poster, { key: " " });
        expect(onWatchClick).toHaveBeenCalledTimes(2); // only Enter triggers it
    });

    it("shows the watched badge only when every aired episode has been watched", () => {
        // WatchedBadge renders a bespoke inline SVG (no lucide class), so
        // detect it via its text label instead.
        const { container: notAllWatched } = render(
            <HeroSection progress={makeProgress({ airedEpisodes: 20, watchedEpisodes: 10 })} />,
        );
        expect(within(notAllWatched).queryByText("已观看")).not.toBeInTheDocument();

        const { container: allWatched } = render(
            <HeroSection progress={makeProgress({ airedEpisodes: 20, watchedEpisodes: 20 })} />,
        );
        expect(within(allWatched).getByText("已观看")).toBeInTheDocument();
    });

    it("renders external link pills only for each ID that exists", () => {
        const { container: allLinks } = render(
            <HeroSection
                progress={makeProgress({
                    show: { imdbId: "tt1", tmdbId: 1, tvdbId: 1, traktSlug: "s" },
                })}
            />,
        );
        expect(allLinks.querySelector('a[aria-label="IMDb"]')).not.toBeNull();
        expect(allLinks.querySelector('a[aria-label="TMDB"]')).not.toBeNull();
        expect(allLinks.querySelector('a[aria-label="TheTVDB"]')).not.toBeNull();
        expect(allLinks.querySelector('a[aria-label="Trakt"]')).not.toBeNull();

        const { container: noLinks } = render(
            <HeroSection
                progress={makeProgress({
                    show: { imdbId: null, tmdbId: 0, tvdbId: null, traktSlug: null },
                })}
            />,
        );
        expect(noLinks.querySelector('a[aria-label="IMDb"]')).toBeNull();
        expect(noLinks.querySelector('a[aria-label="TMDB"]')).toBeNull();
    });

    it("renders the reset/history/force-sync/watchlist action buttons only when wired up", () => {
        const first = render(
            <HeroSection progress={makeProgress()} isComplete={true} onResetClick={vi.fn()} />,
        );
        expect(screen.getByText("再看一遍...")).toBeInTheDocument();
        first.unmount();

        const second = render(
            <HeroSection progress={makeProgress()} isComplete={false} onResetClick={vi.fn()} />,
        );
        expect(screen.queryByText("再看一遍...")).not.toBeInTheDocument();
        second.unmount();

        render(<HeroSection progress={makeProgress()} />);
        expect(screen.queryByText("观看历史")).not.toBeInTheDocument();
        expect(screen.queryByText("刷新元数据")).not.toBeInTheDocument();
        expect(screen.queryByText("加入待看")).not.toBeInTheDocument();
    });

    it("calls onHistoryClick when the history button is clicked", () => {
        const onHistoryClick = vi.fn();
        render(<HeroSection progress={makeProgress()} onHistoryClick={onHistoryClick} />);
        fireEvent.click(screen.getByText("观看历史"));
        expect(onHistoryClick).toHaveBeenCalled();
    });

    it("disables the force-sync button and spins its icon while syncing", () => {
        const onForceSyncClick = vi.fn();
        const { container } = render(
            <HeroSection
                progress={makeProgress()}
                onForceSyncClick={onForceSyncClick}
                isForceSyncing={true}
            />,
        );
        const button = screen.getByText("刷新元数据").closest("button")!;
        expect(button).toBeDisabled();
        expect(container.querySelector(".animate-spin")).not.toBeNull();
        fireEvent.click(button);
        expect(onForceSyncClick).not.toHaveBeenCalled();
    });

    it("toggles the watchlist button's label/fill by inWatchlist, and disables it while pending", () => {
        const onToggleWatchlist = vi.fn();
        const { rerender } = render(
            <HeroSection
                progress={makeProgress()}
                onToggleWatchlist={onToggleWatchlist}
                inWatchlist={false}
                isWatchlistPending={false}
            />,
        );
        expect(screen.getByText("加入待看")).toBeInTheDocument();
        fireEvent.click(screen.getByText("加入待看"));
        expect(onToggleWatchlist).toHaveBeenCalled();

        rerender(
            <HeroSection
                progress={makeProgress()}
                onToggleWatchlist={onToggleWatchlist}
                inWatchlist={true}
                isWatchlistPending={true}
            />,
        );
        expect(screen.getByText("已在待看").closest("button")).toBeDisabled();
    });

    it("renders the sidebar stats: total count, network/status, and first-aired year", () => {
        render(<HeroSection progress={makeProgress()} />);
        expect(screen.getByText("2S · 20集")).toBeInTheDocument();
        expect(screen.getByText("总集数")).toBeInTheDocument();
        expect(screen.getByText("平台")).toBeInTheDocument();
        expect(screen.getByText("首播年份")).toBeInTheDocument();
    });

    it("falls back to the status, then '—', for the network stat when network is missing", () => {
        render(<HeroSection progress={makeProgress({ show: { network: null } })} />);
        expect(screen.getByText("returning series")).toBeInTheDocument();

        render(
            <HeroSection
                progress={makeProgress({
                    show: { network: null, status: "" as unknown as Show["status"] },
                })}
            />,
        );
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    it("renders the last-watched relative date with its prefix", () => {
        render(
            <HeroSection progress={makeProgress({ lastWatchedAt: "2026-07-12T12:00:00.000Z" })} />,
        );
        // "上次：" + fmtDateZh("2026-07-12...") -> exactly 3 days before "now".
        expect(screen.getByText("上次：3 天前")).toBeInTheDocument();
    });

    it("computes the overall progress percentage, remaining count, and progress label", () => {
        render(<HeroSection progress={makeProgress()} />);
        // watched 10 / total 20 -> 50%, 10 remaining.
        expect(screen.getByText("50%")).toBeInTheDocument();
        expect(screen.getByText("· 10集未看")).toBeInTheDocument();
        expect(screen.getByText("10 / 20 集")).toBeInTheDocument();
    });

    it("falls back to summing season episode counts when show.totalEpisodes is nullish", () => {
        // totalEpisodes is typed as a non-nullable number, but the component
        // defensively codes `show.totalEpisodes ?? <season sum>` — 0 would
        // NOT trigger `??` (only null/undefined do), so force it past the
        // type to actually exercise that fallback branch.
        render(
            <HeroSection
                progress={makeProgress({
                    show: { totalEpisodes: null as unknown as number },
                    seasons: [
                        makeSeason({ seasonNumber: 1, episodeCount: 4, watchedCount: 4 }),
                        makeSeason({ seasonNumber: 2, episodeCount: 6, watchedCount: 0 }),
                    ],
                })}
            />,
        );
        // total = 4 + 6 = 10, watched = 4 -> 40%.
        expect(screen.getByText("40%")).toBeInTheDocument();
        expect(screen.getByText("4 / 10 集")).toBeInTheDocument();
    });

    it("renders each season's label (or 'Specials' for season 0) and status text", () => {
        render(
            <HeroSection
                progress={makeProgress({
                    seasons: [
                        makeSeason({ seasonNumber: 0, episodeCount: 2, watchedCount: 2 }),
                        makeSeason({ seasonNumber: 1, episodeCount: 10, watchedCount: 10 }),
                        makeSeason({ seasonNumber: 2, episodeCount: 10, watchedCount: 0 }),
                        makeSeason({ seasonNumber: 3, episodeCount: 8, watchedCount: 3 }),
                    ],
                })}
            />,
        );
        expect(screen.getByText("Specials")).toBeInTheDocument();
        expect(screen.getByText("2集 · 全部看完")).toBeInTheDocument();
        expect(screen.getByText("Season 1")).toBeInTheDocument();
        expect(screen.getByText("10集 · 全部看完")).toBeInTheDocument();
        expect(screen.getByText("Season 2")).toBeInTheDocument();
        expect(screen.getByText("10集 · 未开始")).toBeInTheDocument();
        expect(screen.getByText("Season 3")).toBeInTheDocument();
        expect(screen.getByText("8集 · 已看 3集")).toBeInTheDocument();
    });

    it("renders at most 5 genre tags", () => {
        render(<HeroSection progress={makeProgress()} />);
        // "Drama" also appears as the first-genre chip in the main info line.
        expect(screen.getAllByText("Drama").length).toBe(2);
        for (const g of ["Sci-Fi", "Thriller", "Comedy", "Horror"]) {
            expect(screen.getByText(g)).toBeInTheDocument();
        }
        expect(screen.queryByText("Extra")).not.toBeInTheDocument();
    });
});
