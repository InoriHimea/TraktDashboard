import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatsOverview } from "@trakt-dashboard/types";
import { RecentActivity } from "../RecentActivity";

type Episode = StatsOverview["recentlyWatched"][number];
type Movie = StatsOverview["recentlyWatchedMovies"][number];

function fmtWatchedAt(iso: string) {
    return new Date(iso).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function makeEpisode(i: number, overrides: Partial<Episode> = {}): Episode {
    return {
        showId: i,
        showTitle: `Show ${i}`,
        posterPath: null,
        stillPath: `/still${i}.jpg`,
        episodeTitle: `Ep ${i}`,
        seasonNumber: 1,
        episodeNumber: i + 1,
        watchedAt: "2026-07-10T08:30:00.000Z",
        ...overrides,
    };
}

function makeMovie(i: number, overrides: Partial<Movie> = {}): Movie {
    return {
        movieId: i,
        movieTitle: `Movie ${i}`,
        posterPath: `/poster${i}.jpg`,
        watchedAt: "2026-07-10T08:30:00.000Z",
        ...overrides,
    };
}

describe("RecentActivity", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders nothing when there is no recent activity at all", () => {
        const { container } = render(<RecentActivity recentlyWatched={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the episode section header and slices to the first 15 entries", () => {
        const episodes = Array.from({ length: 16 }, (_, i) => makeEpisode(i));
        render(<RecentActivity recentlyWatched={episodes} />);
        expect(screen.getByText("最近动态")).toBeInTheDocument();
        expect(screen.getByText("Show 14")).toBeInTheDocument();
        expect(screen.queryByText("Show 15")).not.toBeInTheDocument();
    });

    it("renders each episode's image (or fallback icon), badge, title line, and watched time", () => {
        const withStill = makeEpisode(0, {
            stillPath: "/still0.jpg",
            posterPath: null,
            seasonNumber: 2,
            episodeNumber: 3,
            episodeTitle: "Pilot",
        });
        const withPosterOnly = makeEpisode(1, {
            stillPath: null,
            posterPath: "/poster1.jpg",
            episodeTitle: null,
            watchedAt: "2026-07-11T10:00:00.000Z",
        });
        const withNoImage = makeEpisode(2, { stillPath: null, posterPath: null, watchedAt: "" });

        const { container } = render(
            <RecentActivity recentlyWatched={[withStill, withPosterOnly, withNoImage]} />,
        );

        // Still images are requested at w500; poster-only fallback uses w342.
        expect(container.querySelector('img[src="/api/img/w500/still0.jpg"]')).not.toBeNull();
        expect(container.querySelector('img[src="/api/img/w342/poster1.jpg"]')).not.toBeNull();
        // The 3rd item has neither image -> renders the Tv2 fallback icon, no <img>.
        expect(container.querySelectorAll("img").length).toBe(2);

        // Badge overlay never includes the episode title.
        expect(screen.getByText("S02E03")).toBeInTheDocument();
        // Text line below appends " · <title>" only when episodeTitle is set.
        expect(screen.getByText("S02E03 · Pilot")).toBeInTheDocument();
        // No episodeTitle -> badge and text line render the identical bare "S..E..", no " · " suffix.
        expect(screen.getAllByText("S01E02")).toHaveLength(2);

        expect(screen.getByText(fmtWatchedAt(withStill.watchedAt))).toBeInTheDocument();
        // Falsy watchedAt falls back to the "unknown time" label.
        expect(screen.getByText("未知时间")).toBeInTheDocument();
    });

    it("renders the movie section header, slices to the first 8, and the fallback icon branch", () => {
        const movies = Array.from({ length: 9 }, (_, i) => makeMovie(i));
        movies[1] = makeMovie(1, { posterPath: null });

        const { container } = render(
            <RecentActivity recentlyWatched={[]} recentlyWatchedMovies={movies} />,
        );

        expect(screen.getByText("最近电影")).toBeInTheDocument();
        expect(screen.getByText("Movie 7")).toBeInTheDocument();
        expect(screen.queryByText("Movie 8")).not.toBeInTheDocument();
        // 8 rendered (index 0-7), all but movies[1] have a poster -> 7 <img> elements.
        expect(container.querySelectorAll("img").length).toBe(7);
    });

    it("formats each movie's watched date via fmtDateZh", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
        const movie = makeMovie(0, { watchedAt: "2026-07-10T00:00:00.000Z" });
        render(<RecentActivity recentlyWatched={[]} recentlyWatchedMovies={[movie]} />);
        expect(screen.getByText("3 天前")).toBeInTheDocument();
    });

    it("shows only the movie section when recentlyWatched is empty but movies exist", () => {
        render(<RecentActivity recentlyWatched={[]} recentlyWatchedMovies={[makeMovie(0)]} />);
        expect(screen.queryByText("最近动态")).not.toBeInTheDocument();
        expect(screen.getByText("最近电影")).toBeInTheDocument();
    });

    it("shows only the episode section when recentlyWatchedMovies is empty", () => {
        render(<RecentActivity recentlyWatched={[makeEpisode(0)]} recentlyWatchedMovies={[]} />);
        expect(screen.getByText("最近动态")).toBeInTheDocument();
        expect(screen.queryByText("最近电影")).not.toBeInTheDocument();
    });
});
