import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeProgress } from "@trakt-dashboard/types";
import { EpisodeSeasonStrip } from "../EpisodeSeasonStrip";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>();
    return { ...actual, useNavigate: () => navigateSpy };
});

function makeEpisode(overrides: Partial<EpisodeProgress> = {}): EpisodeProgress {
    return {
        episodeId: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Pilot",
        translatedTitle: null,
        overview: null,
        translatedOverview: null,
        airDate: "2020-01-01",
        watched: false,
        watchedAt: null,
        aired: true,
        stillPath: null,
        runtime: 42,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
});

function renderStrip(episodes: EpisodeProgress[], overrides: Record<string, unknown> = {}) {
    return render(
        <MemoryRouter>
            <EpisodeSeasonStrip
                episodes={episodes}
                seasonNumber={1}
                currentEpisodeNumber={1}
                showId={5}
                watched={false}
                {...overrides}
            />
        </MemoryRouter>,
    );
}

describe("EpisodeSeasonStrip", () => {
    it("shows the empty state when there are no episodes", () => {
        renderStrip([]);
        expect(screen.getByText(/无|no/i)).toBeInTheDocument();
    });

    it("renders one button per episode", () => {
        renderStrip([makeEpisode({ episodeNumber: 1 }), makeEpisode({ episodeNumber: 2 })]);
        expect(screen.getAllByRole("button")).toHaveLength(2);
    });

    it("marks the current episode with aria-current", () => {
        renderStrip([makeEpisode({ episodeNumber: 1 }), makeEpisode({ episodeNumber: 2 })]);
        const buttons = screen.getAllByRole("button");
        expect(buttons[0]).toHaveAttribute("aria-current", "true");
        expect(buttons[1]).not.toHaveAttribute("aria-current");
    });

    it("navigates to the episode detail route when clicked", () => {
        renderStrip([makeEpisode({ episodeNumber: 2 })], { currentEpisodeNumber: 2 });
        fireEvent.click(screen.getByRole("button"));
        expect(navigateSpy).toHaveBeenCalledWith("/shows/5/seasons/1/episodes/2");
    });

    it("labels season 0 as Specials", () => {
        renderStrip([makeEpisode()], { seasonNumber: 0 });
        expect(screen.getByText("Specials")).toBeInTheDocument();
    });
});
