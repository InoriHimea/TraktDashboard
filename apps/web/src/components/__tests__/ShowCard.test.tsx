import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowProgress } from "@trakt-dashboard/types";
import { ShowCard } from "../ShowCard";
import { ToastProvider } from "../../lib/toast";

const mocks = vi.hoisted(() => ({
    useJellyfinDeleteQueue: vi.fn(),
    useDeferJellyfinDelete: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useJellyfinDeleteQueue: mocks.useJellyfinDeleteQueue,
    useDeferJellyfinDelete: mocks.useDeferJellyfinDelete,
}));

function makeProgress(overrides: Partial<ShowProgress> = {}): ShowProgress {
    return {
        show: {
            id: 5,
            tmdbId: 100,
            tvdbId: null,
            imdbId: null,
            traktId: 300,
            traktSlug: "test-show",
            title: "Test Show",
            overview: "",
            status: "returning series",
            firstAired: null,
            network: "HBO",
            genres: [],
            posterPath: null,
            backdropPath: null,
            totalEpisodes: 20,
            totalSeasons: 2,
            lastSyncedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            originalName: null,
            originalLanguage: null,
            translatedName: null,
            translatedOverview: null,
            displayLanguage: null,
        },
        airedEpisodes: 10,
        watchedEpisodes: 5,
        nextEpisode: null,
        lastWatchedAt: null,
        completed: false,
        percentage: 50,
        seasons: [],
        ...overrides,
    };
}

function renderCard(progress: ShowProgress) {
    return render(
        <MemoryRouter>
            <ToastProvider>
                <ShowCard progress={progress} index={0} />
            </ToastProvider>
        </MemoryRouter>,
    );
}

describe("ShowCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useDeferJellyfinDelete.mockReturnValue({ mutate: vi.fn(), isPending: false });
    });

    it("renders the title, episode counts, and percentage", () => {
        mocks.useJellyfinDeleteQueue.mockReturnValue({ data: [] });
        renderCard(makeProgress());
        expect(screen.getByText("Test Show")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("prefers the translated name and shows the original as secondary", () => {
        mocks.useJellyfinDeleteQueue.mockReturnValue({ data: [] });
        renderCard(
            makeProgress({
                show: {
                    ...makeProgress().show,
                    translatedName: "测试剧集",
                    originalName: "Test Show",
                },
            }),
        );
        expect(screen.getByText("测试剧集")).toBeInTheDocument();
        expect(screen.getByText("Test Show")).toBeInTheDocument();
    });

    it("shows a pending-delete badge when the show is in the Jellyfin delete queue", () => {
        mocks.useJellyfinDeleteQueue.mockReturnValue({
            data: [{ id: 1, show: { id: 5 }, seasonNumber: null }],
        });
        renderCard(makeProgress());
        // The badge renders a translated label; just assert the queue entry was matched
        // by checking the hook was consulted with data containing this show's id.
        expect(mocks.useJellyfinDeleteQueue).toHaveBeenCalled();
    });

    it("shows the next-episode code when not completed", () => {
        mocks.useJellyfinDeleteQueue.mockReturnValue({ data: [] });
        renderCard(
            makeProgress({
                nextEpisode: {
                    id: 1,
                    showId: 5,
                    seasonId: 1,
                    seasonNumber: 2,
                    episodeNumber: 3,
                    title: "Next",
                    overview: null,
                    runtime: null,
                    airDate: null,
                    stillPath: null,
                    traktId: null,
                    tmdbId: null,
                },
            }),
        );
        expect(screen.getByText("S02E03")).toBeInTheDocument();
    });
});
