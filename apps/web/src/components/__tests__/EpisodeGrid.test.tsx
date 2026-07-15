import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeProgress } from "@trakt-dashboard/types";
import { EpisodeGrid } from "../EpisodeGrid";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
    mockNavigate.mockClear();
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
        airDate: "2026-01-01",
        watched: false,
        watchedAt: null,
        aired: true,
        stillPath: "/still.jpg",
        runtime: 42,
        ...overrides,
    };
}

function renderGrid(episodes: EpisodeProgress[], backdropPath: string | null = null) {
    return render(
        <MemoryRouter>
            <EpisodeGrid
                episodes={episodes}
                seasonNumber={1}
                showId={7}
                backdropPath={backdropPath}
            />
        </MemoryRouter>,
    );
}

describe("EpisodeGrid", () => {
    it("renders the title, episode code, and runtime pill, and navigates on click", () => {
        renderGrid([makeEpisode()]);
        expect(screen.getByText("Pilot")).toBeInTheDocument();
        expect(screen.getByText("S01 · E01")).toBeInTheDocument();
        expect(screen.getByText("42 分钟")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Pilot"));
        expect(mockNavigate).toHaveBeenCalledWith("/shows/7/seasons/1/episodes/1");
    });

    it("does not render the runtime pill when runtime is null", () => {
        renderGrid([makeEpisode({ runtime: null })]);
        expect(screen.queryByText(/分钟/)).not.toBeInTheDocument();
    });

    it("shows the watched checkmark only when watched is true", () => {
        const { container: withCheck } = renderGrid([makeEpisode({ watched: true })]);
        expect(withCheck.querySelector(".lucide-check")).not.toBeNull();

        const { container: withoutCheck } = renderGrid([makeEpisode({ watched: false })]);
        expect(withoutCheck.querySelector(".lucide-check")).toBeNull();
    });

    it("shows the unaired label, dims the card, and does not navigate on click", () => {
        const { container } = renderGrid([makeEpisode({ aired: false })]);
        expect(screen.getByText("未播出")).toBeInTheDocument();
        expect(container.querySelector(".opacity-40")).not.toBeNull();
        fireEvent.click(screen.getByText("Pilot"));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("hides the more-options button when unaired", () => {
        renderGrid([makeEpisode({ aired: false })]);
        expect(screen.queryByLabelText("更多选项")).not.toBeInTheDocument();
    });

    it("shows the more-options button when aired, and its click does not trigger navigation", () => {
        renderGrid([makeEpisode({ aired: true })]);
        fireEvent.click(screen.getByLabelText("更多选项"));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("falls back to the backdrop image when stillPath is null", () => {
        renderGrid([makeEpisode({ stillPath: null })], "/backdrop.jpg");
        const img = screen.getByAltText("Pilot") as HTMLImageElement;
        expect(img.src).toContain("/api/img/w1280/backdrop.jpg");
    });

    it("renders the placeholder (no <img>) when neither stillPath nor backdropPath is available", () => {
        const { container } = renderGrid([makeEpisode({ stillPath: null })], null);
        expect(container.querySelector("img")).toBeNull();
    });

    it("falls back to the placeholder after the still image fails to load", () => {
        const { container } = renderGrid([makeEpisode()]);
        const img = container.querySelector("img")!;
        fireEvent.error(img);
        expect(container.querySelector("img")).toBeNull();
    });
});
