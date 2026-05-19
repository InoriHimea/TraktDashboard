import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import EpisodeDetailPage from "../EpisodeDetailPage";
import { EpisodeInfoCard } from "../../components/EpisodeInfoCard";
import type { EpisodeDetailData } from "@trakt-dashboard/types";

vi.mock("../../hooks", () => ({
    useEpisodeDetail: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    })),
}));

vi.mock("../../components/EpisodeInfoCard", () => ({
    EpisodeInfoCard: vi.fn(() => <div>Episode info</div>),
}));

vi.mock("../../components/EpisodeSeasonStrip", () => ({
    EpisodeSeasonStrip: vi.fn(() => <div>Season strip</div>),
}));

vi.mock("../../components/WatchHistoryPanel", () => ({
    WatchHistoryPanel: vi.fn(() => null),
}));

function detailDataArbitrary() {
    return fc.record({
        episodeId: fc.integer({ min: 1, max: 1_000_000 }),
        showId: fc.integer({ min: 1, max: 1_000_000 }),
        seasonNumber: fc.integer({ min: 0, max: 30 }),
        episodeNumber: fc.integer({ min: 1, max: 200 }),
        title: fc.option(fc.string({ minLength: 1 }), { nil: null }),
        translatedTitle: fc.option(fc.string({ minLength: 1 }), { nil: null }),
        overview: fc.option(fc.string({ minLength: 1 }), { nil: null }),
        translatedOverview: fc.option(fc.string({ minLength: 1 }), { nil: null }),
        airDate: fc.option(fc.date().map((date) => date.toISOString().slice(0, 10)), { nil: null }),
        runtime: fc.option(fc.integer({ min: 1, max: 240 }), { nil: null }),
        stillPath: fc.constant(null),
        watched: fc.boolean(),
        watchedAt: fc.option(fc.date().map((date) => date.toISOString()), { nil: null }),
        traktRating: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
        directors: fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }),
        show: fc.record({
            id: fc.integer({ min: 1, max: 1_000_000 }),
            title: fc.string({ minLength: 1 }),
            translatedName: fc.option(fc.string({ minLength: 1 }), { nil: null }),
            posterPath: fc.constant(null),
            backdropPath: fc.constant(null),
            genres: fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }),
            traktId: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null }),
            traktSlug: fc.option(fc.string({ minLength: 1 }), { nil: null }),
            tmdbId: fc.integer({ min: 1, max: 1_000_000 }),
            imdbId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
            tvdbId: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null }),
        }),
        seasonEpisodes: fc.constant([]),
    }) as fc.Arbitrary<EpisodeDetailData>;
}

describe("EpisodeDetailPage", () => {
    it("redirects invalid route params to TV shows", () => {
        fc.assert(
            fc.property(fc.constantFrom("abc", "show-1", "invalid_id", "NaN"), (badShowId) => {
                const { unmount } = render(
                    <MemoryRouter initialEntries={[`/shows/${badShowId}/seasons/1/episodes/1`]}>
                        <Routes>
                            <Route path="/shows/:showId/seasons/:season/episodes/:episode" element={<EpisodeDetailPage />} />
                            <Route path="/tv-shows" element={<div>TV shows page</div>} />
                        </Routes>
                    </MemoryRouter>,
                );

                expect(screen.getByText("TV shows page")).toBeInTheDocument();
                unmount();
            }),
        );
    });

    it("passes external-link identifiers through to EpisodeInfoCard", async () => {
        const hooks = await import("../../hooks");
        fc.assert(
            fc.property(detailDataArbitrary(), (data) => {
                vi.mocked(hooks.useEpisodeDetail).mockReturnValue({
                    data,
                    isLoading: false,
                    isError: false,
                    refetch: vi.fn(),
                } as never);

                const { unmount } = render(
                    <MemoryRouter initialEntries={["/shows/1/seasons/1/episodes/1"]}>
                        <Routes>
                            <Route path="/shows/:showId/seasons/:season/episodes/:episode" element={<EpisodeDetailPage />} />
                        </Routes>
                    </MemoryRouter>,
                );

                expect(EpisodeInfoCard).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        data: expect.objectContaining({
                            show: expect.objectContaining({
                                traktSlug: data.show.traktSlug,
                                tmdbId: data.show.tmdbId,
                                imdbId: data.show.imdbId,
                                tvdbId: data.show.tvdbId,
                            }),
                        }),
                    }),
                    undefined,
                );

                unmount();
            }),
        );
    });
});
