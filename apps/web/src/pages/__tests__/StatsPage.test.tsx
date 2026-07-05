import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StatsPage from "../stats";
import type { StatsOverview } from "@trakt-dashboard/types";

const mocks = vi.hoisted(() => ({ useStats: vi.fn() }));

vi.mock("../../hooks", () => ({
    useStats: mocks.useStats,
    useTraktStats: () => ({ data: undefined }),
}));

// Mock the heavy sibling charts/cards so only SignalMetrics renders real values,
// keeping the new-metric assertions free of collisions with KPI numbers.
vi.mock("../stats/StatCard", () => ({ StatCard: () => null }));
vi.mock("../stats/ActivityChart", () => ({ ActivityChart: () => null }));
vi.mock("../stats/MediaComposition", () => ({ MediaComposition: () => null }));
vi.mock("../stats/TopGenres", () => ({ TopGenres: () => null }));
vi.mock("../stats/RecentActivity", () => ({ RecentActivity: () => null }));
vi.mock("../stats/WatchHeatmap", () => ({ WatchHeatmap: () => null }));
vi.mock("../stats/WatchPatterns", () => ({ WatchPatterns: () => null }));
vi.mock("../stats/ScreenTime", () => ({ ScreenTime: () => null }));

function makeStats(over: Partial<StatsOverview> = {}): StatsOverview {
    return {
        totalEpisodesWatched: 250,
        totalShowsWatched: 8,
        totalShowsCompleted: 5,
        totalMoviesWatched: 40,
        totalMovieWatches: 55,
        totalRuntimeMinutes: 12000,
        totalEpisodeRuntimeMinutes: 9000,
        totalMovieRuntimeMinutes: 3000,
        monthlyActivity: [],
        topGenres: [],
        recentlyWatched: [],
        recentlyWatchedMovies: [],
        yearComparison: { thisYear: 120, lastYear: 100 },
        longestStreakDays: 88,
        avgDailyWatches30d: 2.3,
        heatmap: [],
        weekdayDistribution: [],
        ratingDistribution: [],
        ...over,
    };
}

describe("StatsPage signal metrics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useStats.mockReturnValue({ data: makeStats(), isLoading: false, error: null });
    });

    it("renders the year-over-year percentage change", () => {
        render(<StatsPage />);
        // (120 - 100) / 100 = +20%
        expect(screen.getByText("+20%")).toBeInTheDocument();
    });

    it("renders the longest streak and 30-day daily average", () => {
        render(<StatsPage />);
        expect(screen.getByText("88")).toBeInTheDocument();
        expect(screen.getByText("2.3")).toBeInTheDocument();
    });

    it("falls back to this-year count when last year had no data", () => {
        mocks.useStats.mockReturnValue({
            data: makeStats({ yearComparison: { thisYear: 42, lastYear: 0 } }),
            isLoading: false,
            error: null,
        });
        render(<StatsPage />);
        // No percentage is computable, so the raw this-year count is shown
        expect(screen.getByText("42")).toBeInTheDocument();
        expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    });

    it("shows a loading state while fetching", () => {
        mocks.useStats.mockReturnValue({ data: undefined, isLoading: true, error: null });
        const { container } = render(<StatsPage />);
        expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
});
