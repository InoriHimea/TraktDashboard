import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShowDetailPage from "../ShowDetailPage";
import type { Episode, ShowProgress } from "@trakt-dashboard/types";

const mocks = vi.hoisted(() => ({
    useShowDetail: vi.fn(),
    heroSection: vi.fn(),
    resetProgress: { mutateAsync: vi.fn(), isPending: false },
    markSeasonWatched: { mutate: vi.fn(), isPending: false },
    forceSync: { mutate: vi.fn(), isPending: false },
    addToWatchlist: { mutate: vi.fn(), isPending: false },
    removeFromWatchlist: { mutate: vi.fn(), isPending: false },
    toast: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useShowDetail: mocks.useShowDetail,
    useResetProgress: () => mocks.resetProgress,
    useMarkSeasonWatched: () => mocks.markSeasonWatched,
    useForceSync: () => mocks.forceSync,
    useWatchlist: () => ({ data: [] }),
    useAddToWatchlist: () => mocks.addToWatchlist,
    useRemoveFromWatchlist: () => mocks.removeFromWatchlist,
    useCollectionCheck: () => ({ data: { inCollection: false } }),
    useNote: () => ({ data: null, isLoading: false }),
    useUpsertNote: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteNote: () => ({ mutate: vi.fn(), isPending: false }),
    useRatings: () => ({ data: [] }),
    useSetRating: () => ({ mutate: vi.fn(), isPending: false }),
    useRemoveRating: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../lib/toast", () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../components/HeroSection", () => ({
    HeroSection: (props: { progress: ShowProgress }) => {
        mocks.heroSection(props);
        return (
            <div data-testid="hero-section">
                {props.progress.nextEpisode?.title ?? "No next episode"}
            </div>
        );
    },
}));

vi.mock("../../components/SeasonTab", () => ({
    SeasonTab: () => <div data-testid="season-tab" />,
}));

vi.mock("../../components/EpisodeGrid", () => ({
    EpisodeGrid: () => <div data-testid="episode-grid" />,
}));

vi.mock("../../components/WatchHistoryPanel", () => ({
    WatchHistoryPanel: () => null,
}));

const nextEpisode: Episode = {
    id: 99,
    showId: 1,
    seasonId: 10,
    seasonNumber: 2,
    episodeNumber: 1,
    title: "The Real Next Episode",
    overview: "Next up",
    runtime: 45,
    airDate: "2026-06-05",
    stillPath: null,
    traktId: 990,
    tmdbId: 991,
};

const progress: ShowProgress = {
    show: {
        id: 1,
        tmdbId: 100,
        tvdbId: null,
        imdbId: "tt0000001",
        traktId: 200,
        traktSlug: "fixture-show",
        title: "Fixture Show",
        overview: "A show",
        status: "returning series",
        firstAired: "2024-01-01",
        network: "Fixture Network",
        genres: ["Drama"],
        posterPath: null,
        backdropPath: null,
        totalEpisodes: 2,
        totalSeasons: 1,
        lastSyncedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        originalName: "Fixture Show",
        originalLanguage: "en",
        translatedName: null,
        translatedOverview: null,
        displayLanguage: "zh-CN",
    },
    airedEpisodes: 1,
    watchedEpisodes: 1,
    nextEpisode,
    lastWatchedAt: "2026-01-02T00:00:00.000Z",
    completed: false,
    percentage: 50,
    seasons: [
        {
            seasonNumber: 1,
            episodeCount: 1,
            watchedCount: 1,
            airedCount: 1,
            posterPath: null,
            episodes: [
                {
                    episodeId: 1,
                    seasonNumber: 1,
                    episodeNumber: 1,
                    title: "Pilot",
                    translatedTitle: null,
                    overview: "Pilot overview",
                    translatedOverview: null,
                    airDate: "2024-01-01",
                    watched: true,
                    watchedAt: "2026-01-02T00:00:00.000Z",
                    aired: true,
                    stillPath: null,
                    runtime: 45,
                },
            ],
        },
    ],
};

describe("ShowDetailPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useShowDetail.mockReturnValue({
            data: progress,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        });
    });

    it("passes nextEpisode from the detail response through to the hero data", async () => {
        render(
            <MemoryRouter initialEntries={["/shows/1"]}>
                <Routes>
                    <Route path="/shows/:id" element={<ShowDetailPage />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByTestId("hero-section")).toHaveTextContent(
            "The Real Next Episode",
        );
        await waitFor(() =>
            expect(mocks.heroSection).toHaveBeenCalledWith(
                expect.objectContaining({
                    progress: expect.objectContaining({ nextEpisode }),
                }),
            ),
        );
    });
});
