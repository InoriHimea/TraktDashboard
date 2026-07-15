import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JellyfinStatsTopContent } from "@trakt-dashboard/types";
import { TopContent } from "../TopContent";

const DATA: JellyfinStatsTopContent = {
    movies: [
        { id: "m1", name: "Movie A", playCount: 10, type: "Movie" },
        { id: "m2", name: "Movie B", playCount: 5, type: "Movie" },
    ],
    series: [],
};

describe("TopContent", () => {
    it("renders the header and 2 skeleton placeholders while loading", () => {
        const { container } = render(<TopContent data={undefined} isLoading={true} />);
        expect(screen.getByText("热门内容")).toBeInTheDocument();
        expect(screen.queryByText("最多播放的电影")).not.toBeInTheDocument();
        expect(container.querySelectorAll('[style*="height: 300px"]').length).toBe(2);
    });

    it("renders ranked movies with rank, name, and play count", () => {
        render(<TopContent data={DATA} isLoading={false} />);
        expect(screen.getByText("最多播放的电影")).toBeInTheDocument();
        expect(screen.getByText("Movie A")).toBeInTheDocument();
        expect(screen.getByText("10×")).toBeInTheDocument();
        expect(screen.getByText("Movie B")).toBeInTheDocument();
        expect(screen.getByText("5×")).toBeInTheDocument();
    });

    it("shows the empty state for a ranked list with no items", () => {
        render(<TopContent data={DATA} isLoading={false} />);
        expect(screen.getByText("最多播放的剧集")).toBeInTheDocument();
        expect(screen.getByText("暂无数据")).toBeInTheDocument();
    });

    it("falls back to empty movie/series arrays when data is undefined", () => {
        render(<TopContent data={undefined} isLoading={false} />);
        // both lists empty -> 2 "no data" placeholders (one per RankList).
        expect(screen.getAllByText("暂无数据")).toHaveLength(2);
    });
});
