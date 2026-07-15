import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenTime } from "../ScreenTime";
import { useScreenTime } from "../../../hooks";

vi.mock("../../../hooks", () => ({
    useScreenTime: vi.fn(),
}));

const mockUseScreenTime = vi.mocked(useScreenTime);

const DATA = {
    days: 7,
    daily: [
        { date: "2026-07-09", all: 60, episodes: 60, movies: 0 }, // Thursday, exact hour -> "1h"
        { date: "2026-07-14", all: 0, episodes: 0, movies: 0 }, // Tuesday, val=0 -> "·"
        { date: "2026-07-15", all: 45, episodes: 0, movies: 45 }, // "today", minutes-only -> "45m"
    ],
    totals: { all: 0, episodes: 130, movies: 120 },
    averages: { all: 45, episodes: 20, movies: 10 },
    peaks: {
        morning: { all: 10, episodes: 5, movies: 5 },
        afternoon: { all: 20, episodes: 10, movies: 10 },
        evening: { all: 5, episodes: 5, movies: 0 },
        night: { all: 0, episodes: 0, movies: 0 },
    },
    awake_pct: { all: 65, episodes: 40, movies: 25 },
};

describe("ScreenTime", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the loading placeholder", () => {
        mockUseScreenTime.mockReturnValue({ data: undefined, isLoading: true } as never);
        render(<ScreenTime />);
        expect(screen.getByText("加载中…")).toBeInTheDocument();
    });

    it("renders nothing in the body when there is no data and it isn't loading", () => {
        mockUseScreenTime.mockReturnValue({ data: undefined, isLoading: false } as never);
        render(<ScreenTime />);
        expect(screen.queryByText("加载中…")).not.toBeInTheDocument();
        expect(screen.queryByText("每日明细")).not.toBeInTheDocument();
    });

    it("renders the date range, daily bar labels, totals, average, and peak values for the default 'all' tab", () => {
        mockUseScreenTime.mockReturnValue({ data: DATA, isLoading: false } as never);
        render(<ScreenTime />);

        expect(screen.getByText("2026-07-09 · 2026-07-15")).toBeInTheDocument();

        // fmtMinutes' branches via the daily-bar labels: val=0 -> "·", exact-hour -> "1h", minutes-only -> "45m".
        expect(screen.getByText("1h")).toBeInTheDocument();
        expect(screen.getByText("·")).toBeInTheDocument();
        expect(screen.getByText("45m")).toBeInTheDocument();

        // shortDate: non-today dates fall back to their weekday name, "today" reads literally.
        expect(screen.getByText("周四")).toBeInTheDocument(); // 2026-07-09
        expect(screen.getByText("周二")).toBeInTheDocument(); // 2026-07-14
        expect(screen.getByText("今天")).toBeInTheDocument(); // 2026-07-15

        // totals.all = 0 -> fmtMinutes' m===0 guard branch.
        expect(screen.getByText("0 分钟")).toBeInTheDocument();
        // averages.all = 45 -> fmtMinutes' h===0 branch.
        expect(screen.getByText("45 分钟")).toBeInTheDocument();
        expect(screen.getByText("65%")).toBeInTheDocument();

        // subtotal boxes: episodes(130min) -> 2h + 10m remainder; movies(120min) -> 2h with no remainder.
        expect(screen.getByText("2h10m")).toBeInTheDocument();
        expect(screen.getByText("2h")).toBeInTheDocument();

        // raw peak-hour values for the "all" tab.
        expect(screen.getByText("10")).toBeInTheDocument();
        expect(screen.getByText("20")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("switches tabs and re-derives the total/average/awake% from the selected field", () => {
        mockUseScreenTime.mockReturnValue({ data: DATA, isLoading: false } as never);
        render(<ScreenTime />);

        fireEvent.click(screen.getByRole("button", { name: "剧集" }));
        // totals.episodes = 130 -> h=2, min=10 (fmtMinutes' both-nonzero branch).
        expect(screen.getByText("2 小时 10 分钟")).toBeInTheDocument();
        expect(screen.getByText("40%")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "电影" }));
        // totals.movies = 120 -> h=2, min=0 (fmtMinutes' min===0 branch).
        expect(screen.getByText("2 小时")).toBeInTheDocument();
        expect(screen.getByText("25%")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "媒体" }));
        expect(screen.getByText("0 分钟")).toBeInTheDocument();
        expect(screen.getByText("65%")).toBeInTheDocument();
    });
});
