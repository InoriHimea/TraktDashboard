import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeasonTab } from "../SeasonTab";
import type { SeasonProgress } from "@trakt-dashboard/types";

function makeSeason(overrides: Partial<SeasonProgress> = {}): SeasonProgress {
    return {
        seasonNumber: 1,
        episodeCount: 10,
        airedCount: 10,
        watchedCount: 10,
        posterPath: null,
        episodes: [],
        ...overrides,
    };
}

describe("SeasonTab", () => {
    it("renders the season label and reflects isActive via aria-selected", () => {
        render(<SeasonTab season={makeSeason()} isActive onClick={vi.fn()} />);
        expect(screen.getByRole("tab")).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText("Season 1")).toBeInTheDocument();
    });

    it("labels season 0 as Specials", () => {
        render(
            <SeasonTab
                season={makeSeason({ seasonNumber: 0 })}
                isActive={false}
                onClick={vi.fn()}
            />,
        );
        expect(screen.getByText("Specials")).toBeInTheDocument();
        expect(screen.getByRole("tab")).toHaveAttribute("aria-label", "Specials");
    });

    it("calls onClick when clicked", () => {
        const onClick = vi.fn();
        render(<SeasonTab season={makeSeason()} isActive={false} onClick={onClick} />);
        fireEvent.click(screen.getByRole("tab"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not show the fallback poster label unless the poster fails to load (no posterPath here)", () => {
        render(
            <SeasonTab
                season={makeSeason({ seasonNumber: 3 })}
                isActive={false}
                onClick={vi.fn()}
            />,
        );
        expect(screen.getByText("S3")).toBeInTheDocument();
    });
});
