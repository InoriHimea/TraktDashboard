import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JellyfinStatsPage from "../index";
import {
    useSettings,
    useJellyfinStatsOverview,
    useJellyfinStatsActivity,
    useJellyfinStatsTopContent,
    useJellyfinStatsHeatmap,
} from "../../../hooks";

vi.mock("../../../hooks", () => ({
    useSettings: vi.fn(),
    useJellyfinStatsOverview: vi.fn(),
    useJellyfinStatsActivity: vi.fn(),
    useJellyfinStatsTopContent: vi.fn(),
    useJellyfinStatsHeatmap: vi.fn(),
}));

const mockUseSettings = vi.mocked(useSettings);
const mockOverview = vi.mocked(useJellyfinStatsOverview);
const mockActivity = vi.mocked(useJellyfinStatsActivity);
const mockTopContent = vi.mocked(useJellyfinStatsTopContent);
const mockHeatmap = vi.mocked(useJellyfinStatsHeatmap);

describe("JellyfinStatsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // React calls every hook unconditionally before either early return,
        // so all 5 need a valid shape in every test regardless of scenario.
        mockOverview.mockReturnValue({ data: null, isLoading: false } as never);
        mockActivity.mockReturnValue({ data: [], isLoading: false } as never);
        mockTopContent.mockReturnValue({ data: undefined, isLoading: false } as never);
        mockHeatmap.mockReturnValue({ data: [], isLoading: false } as never);
    });

    it("shows only a loading spinner while settings are loading", () => {
        mockUseSettings.mockReturnValue({ data: undefined, isLoading: true } as never);
        render(<JellyfinStatsPage />);
        expect(screen.queryByText("Jellyfin")).not.toBeInTheDocument();
        expect(screen.queryByText("Jellyfin 未配置")).not.toBeInTheDocument();
    });

    it("shows the 'not configured' message and gates the stats hooks with enabled=false", () => {
        mockUseSettings.mockReturnValue({ data: {}, isLoading: false } as never);
        render(<JellyfinStatsPage />);
        expect(screen.getByText("Jellyfin 未配置")).toBeInTheDocument();
        expect(
            screen.getByText("请前往设置页面配置 Jellyfin 服务器地址和 API Key 后再查看统计。"),
        ).toBeInTheDocument();
        expect(mockOverview).toHaveBeenCalledWith(false);
        expect(mockActivity).toHaveBeenCalledWith(50, false);
        expect(mockTopContent).toHaveBeenCalledWith(false);
        expect(mockHeatmap).toHaveBeenCalledWith(false);
    });

    it("renders the full page, gates hooks with enabled=true, and passes data through to each section", () => {
        mockUseSettings.mockReturnValue({
            data: { jellyfinUrl: "http://jf.local" },
            isLoading: false,
        } as never);
        mockOverview.mockReturnValue({
            data: { movieCount: 3, seriesCount: 2, episodeCount: 9 },
            isLoading: false,
        } as never);

        render(<JellyfinStatsPage />);

        expect(screen.getByText("Jellyfin")).toBeInTheDocument();
        expect(screen.getByText("Jellyfin 服务器统计概览")).toBeInTheDocument();
        expect(mockOverview).toHaveBeenCalledWith(true);
        expect(mockActivity).toHaveBeenCalledWith(50, true);
        expect(mockTopContent).toHaveBeenCalledWith(true);
        expect(mockHeatmap).toHaveBeenCalledWith(true);

        // section headers from each child component are all present.
        expect(screen.getByText("媒体库概览")).toBeInTheDocument();
        expect(screen.getByText("热门内容")).toBeInTheDocument();
        expect(screen.getByText("播放热图")).toBeInTheDocument();
        expect(screen.getByText("最近播放")).toBeInTheDocument();
        // LibraryOverview's counts passed through correctly.
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("9")).toBeInTheDocument();
    });
});
