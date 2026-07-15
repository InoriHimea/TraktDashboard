import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TraktOfficialStats } from "@trakt-dashboard/types";
import { TraktStats } from "../TraktStats";

// movies.plays === movies.watched (undefined "+diff" secondary branch);
// episodes.plays > episodes.watched (defined "+diff" secondary branch).
const STATS: TraktOfficialStats = {
    movies: { plays: 40, watched: 40, minutes: 1200, collected: 5, ratings: 2 },
    shows: { watched: 77, collected: 10, ratings: 3 },
    episodes: { plays: 230, watched: 200, minutes: 6000, collected: 50, ratings: 9 },
    ratings: { total: 33, distribution: {} },
};

describe("TraktStats", () => {
    it("renders the header and summary row (total hours/days, plays, ratings)", () => {
        render(<TraktStats stats={STATS} />);
        expect(screen.getByText("Trakt 官方数据")).toBeInTheDocument();
        expect(screen.getByText("Trakt")).toBeInTheDocument();
        // totalMinutes = 6000 + 1200 = 7200 -> 120h / 5.0d
        expect(screen.getByText("120h")).toBeInTheDocument();
        expect(screen.getByText("5.0d")).toBeInTheDocument();
        // totalPlays = 230 + 40 = 270
        expect(screen.getByText("270")).toBeInTheDocument();
        expect(screen.getByText("33")).toBeInTheDocument();
        expect(screen.getByText("总观看时长")).toBeInTheDocument();
        expect(screen.getByText("总播放次数")).toBeInTheDocument();
        expect(screen.getByText("总评分数")).toBeInTheDocument();
    });

    it("renders each detail row with its primary value and hour secondary", () => {
        render(<TraktStats stats={STATS} />);
        const episodesRow = screen.getByText("剧集观看（集）").parentElement!;
        expect(within(episodesRow).getByText("200")).toBeInTheDocument();
        expect(within(episodesRow).getByText("100h")).toBeInTheDocument(); // toHours(6000)

        const moviesRow = screen.getByText("电影观看（部）").parentElement!;
        expect(within(moviesRow).getByText("40")).toBeInTheDocument();
        expect(within(moviesRow).getByText("20h")).toBeInTheDocument(); // toHours(1200)

        const showsRow = screen.getByText("追过的剧集").parentElement!;
        expect(within(showsRow).getByText("77")).toBeInTheDocument();
        expect(within(showsRow).getByText("部剧")).toBeInTheDocument();
    });

    it("shows a '+diff' secondary when plays exceed watched, and omits it when equal", () => {
        render(<TraktStats stats={STATS} />);
        // episodes: plays(230) > watched(200) -> "+30"
        const episodesPlaysRow = screen.getByText("剧集播放（含重播）").parentElement!;
        expect(within(episodesPlaysRow).getByText("+30")).toBeInTheDocument();

        // movies: plays(40) === watched(40) -> no "+" secondary rendered
        const moviesPlaysRow = screen.getByText("电影播放（含重播）").parentElement!;
        expect(within(moviesPlaysRow).getByText("40")).toBeInTheDocument();
        expect(within(moviesPlaysRow).queryByText(/^\+/)).not.toBeInTheDocument();
    });
});
