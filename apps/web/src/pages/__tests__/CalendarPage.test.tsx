import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEpisode } from "@trakt-dashboard/types";
import CalendarPage from "../CalendarPage";
import { useCalendar } from "../../hooks";

vi.mock("../../hooks", () => ({
    useCalendar: vi.fn(),
}));

const mockUseCalendar = vi.mocked(useCalendar);

// jsdom doesn't implement scrollIntoView; CalendarPage calls it in an effect
// whenever the selected date changes.
Element.prototype.scrollIntoView = vi.fn();

type EpisodeOverrides = Partial<Omit<CalendarEpisode, "show">> & {
    show?: Partial<CalendarEpisode["show"]>;
};

function makeEpisode(overrides: EpisodeOverrides = {}): CalendarEpisode {
    const { show: showOverrides, ...rest } = overrides;
    return {
        id: 1,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Some Episode",
        overview: null,
        runtime: 30,
        stillPath: "/still.jpg",
        airDate: "2026-07-15T09:05:00",
        watched: false,
        isFinale: false,
        show: {
            id: 100,
            title: "Some Show",
            originalName: null,
            translatedName: null,
            posterPath: null,
            backdropPath: "/backdrop.jpg",
            network: "HBO",
            status: "running",
            ...showOverrides,
        },
        ...rest,
    };
}

// yesterday=07-14, today=07-15, tomorrow=07-16, a later day=07-20 ("now" is
// fixed at 07-15T10:00 below). Deliberately declared out of chronological
// order to prove the same-day sort actually reorders by air time.
const EVENING = makeEpisode({
    id: 3,
    seasonNumber: 1,
    episodeNumber: 3,
    title: "Evening Ep",
    airDate: "2026-07-15T18:00:00",
});
const MORNING = makeEpisode({
    id: 1,
    seasonNumber: 1,
    episodeNumber: 1,
    title: "Morning Ep",
    airDate: "2026-07-15T09:05:00",
});
const AFTERNOON_FINALE = makeEpisode({
    id: 2,
    seasonNumber: 1,
    episodeNumber: 2,
    title: "Finale Ep",
    airDate: "2026-07-15T15:30:00",
    isFinale: true,
    watched: true,
});

const FULL_DATA: Record<string, CalendarEpisode[]> = {
    "2026-07-14": [
        makeEpisode({
            id: 10,
            airDate: "2026-07-14T20:00:00",
            title: null,
            show: { network: null },
        }),
    ],
    "2026-07-15": [EVENING, MORNING, AFTERNOON_FINALE],
    "2026-07-16": [makeEpisode({ id: 20, airDate: "2026-07-16T20:00:00", title: "Tomorrow Ep" })],
    "2026-07-20": [makeEpisode({ id: 30, airDate: "2026-07-20T20:00:00", title: "Later Ep" })],
};

function renderPage() {
    return render(
        <MemoryRouter>
            <CalendarPage />
        </MemoryRouter>,
    );
}

describe("CalendarPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 15, 10, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the skeleton while loading", () => {
        mockUseCalendar.mockReturnValue({ data: undefined, isLoading: true, error: null } as never);
        const { container } = renderPage();
        expect(screen.queryByText("播出日历")).not.toBeInTheDocument();
        expect(container.querySelector(".animate-pulse")).not.toBeNull();
    });

    it("shows the load-failed message on error", () => {
        mockUseCalendar.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error("boom"),
        } as never);
        renderPage();
        expect(screen.getByText("加载失败，请重试")).toBeInTheDocument();
    });

    it("shows the empty state when there is no calendar data", () => {
        mockUseCalendar.mockReturnValue({ data: {}, isLoading: false, error: null } as never);
        renderPage();
        expect(screen.getAllByText("没有近期播出的剧集").length).toBeGreaterThan(0);
    });

    it("auto-selects today, shows the summary/date-title/count, and the day-picker's dots+overflow badge", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();

        // 4 days total, 1 + 3 + 1 + 1 = 6 episodes.
        expect(screen.getByText("4 个播出日 · 6 集")).toBeInTheDocument();
        // "今天" also appears as the static "jump to today" button label, so
        // scope to the date-title element specifically.
        expect(container.querySelector(".text-sm.font-medium")?.textContent).toContain("今天");
        // "/" separator is a sibling span, so "3 集" isn't its own text node.
        expect(container.querySelector(".text-sm.font-medium")?.textContent).toContain("3 集");

        const todayButton = screen.getByText("15").closest("button")!;
        expect(todayButton).toHaveAttribute("aria-current", "date");
        // today has 3 episodes -> 2 dots + a "+1" overflow badge.
        expect(
            todayButton.querySelectorAll(".rounded-full.bg-\\[var\\(--action-cyan-solid\\)\\]")
                .length,
        ).toBe(2);
        expect(todayButton.textContent).toContain("+1");
    });

    it("sorts same-day episodes by air time ascending regardless of input order", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        const hrefs = Array.from(container.querySelectorAll('a[href*="/episodes/"]')).map((a) =>
            a.getAttribute("href"),
        );
        expect(hrefs).toEqual([
            "/shows/100/seasons/1/episodes/1", // 09:05 morning
            "/shows/100/seasons/1/episodes/2", // 15:30 finale
            "/shows/100/seasons/1/episodes/3", // 18:00 evening
        ]);
    });

    it("renders 昨天/明天/formatted date titles when other days are selected", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        renderPage();

        fireEvent.click(screen.getByText("14"));
        expect(screen.getByText("昨天")).toBeInTheDocument();

        fireEvent.click(screen.getByText("16"));
        expect(screen.getByText("明天")).toBeInTheDocument();

        fireEvent.click(screen.getByText("20"));
        expect(screen.getByText("7月20日 星期一")).toBeInTheDocument();
    });

    it("disables prev/next at the boundaries and navigates day-by-day between them", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        renderPage();

        const prev = screen.getByLabelText("前一天");
        const next = screen.getByLabelText("后一天");
        expect(prev).not.toBeDisabled();
        expect(next).not.toBeDisabled();

        fireEvent.click(prev); // today -> 07-14 (first day)
        expect(screen.getByText("昨天")).toBeInTheDocument();
        expect(prev).toBeDisabled();

        fireEvent.click(next); // -> 07-15
        fireEvent.click(next); // -> 07-16
        fireEvent.click(next); // -> 07-20 (last day)
        expect(screen.getByText("7月20日 星期一")).toBeInTheDocument();
        expect(next).toBeDisabled();
    });

    it("jumps back to today via the today button after navigating away", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        fireEvent.click(screen.getByText("20"));
        expect(screen.getByText("7月20日 星期一")).toBeInTheDocument();

        // unambiguous here: the date-title doesn't say "今天" yet, only the button does.
        fireEvent.click(screen.getByText("今天"));
        expect(container.querySelector(".text-sm.font-medium")?.textContent).toContain("今天");
    });

    it("shows the finale badge, air time, watched badge, and episode/network fallbacks", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        renderPage();

        // morning (S01E01, not finale): plain badge + morning air time.
        expect(screen.getByText("S01E01")).toBeInTheDocument();
        expect(screen.getByText("上午 9:05")).toBeInTheDocument();

        // afternoon (S01E02, finale, watched): finale badge + afternoon air time + watched badge.
        expect(screen.getByText("结局")).toBeInTheDocument();
        expect(screen.getByText("S01E02")).toBeInTheDocument();
        expect(screen.getByText("下午 3:30")).toBeInTheDocument();
        expect(screen.getByText("已观看")).toBeInTheDocument();

        // evening (S01E03): show title "Some Show" appears (shared by all 3).
        expect(screen.getAllByText("Some Show").length).toBe(3);

        fireEvent.click(screen.getByText("14")); // yesterday: null title/network
        expect(screen.getByText("第 1 集")).toBeInTheDocument(); // episodeFallback
        expect(screen.getByText("未知平台")).toBeInTheDocument();
    });

    it("renders the still image when stillPath is present", () => {
        mockUseCalendar.mockReturnValue({
            data: FULL_DATA,
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector('img[src*="/api/img/w500/still.jpg"]')).not.toBeNull();
    });

    it("falls back to the backdrop image when stillPath is null", () => {
        mockUseCalendar.mockReturnValue({
            data: { "2026-07-15": [makeEpisode({ stillPath: null })] },
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector('img[src*="/api/img/w1280/backdrop.jpg"]')).not.toBeNull();
    });

    it("falls back to the placeholder with the unaired overlay when neither image exists and the episode hasn't aired", () => {
        mockUseCalendar.mockReturnValue({
            data: {
                "2026-07-20": [
                    makeEpisode({
                        stillPath: null,
                        airDate: "2026-07-20T20:00:00",
                        show: { backdropPath: null },
                    }),
                ],
            },
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector("img")).toBeNull();
        expect(screen.getByText("未播出")).toBeInTheDocument();
    });

    it("falls back to the placeholder without the unaired overlay when the episode already aired", () => {
        mockUseCalendar.mockReturnValue({
            data: {
                "2026-07-14": [
                    makeEpisode({
                        stillPath: null,
                        airDate: "2026-07-14T20:00:00",
                        show: { backdropPath: null },
                    }),
                ],
            },
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();
        expect(container.querySelector("img")).toBeNull();
        expect(screen.queryByText("未播出")).not.toBeInTheDocument();
    });

    it("falls through still -> backdrop -> placeholder as each image fails to load", () => {
        mockUseCalendar.mockReturnValue({
            data: { "2026-07-15": [makeEpisode()] },
            isLoading: false,
            error: null,
        } as never);
        const { container } = renderPage();

        const stillImg = container.querySelector('img[src*="still.jpg"]')!;
        fireEvent.error(stillImg);
        const backdropImg = container.querySelector('img[src*="backdrop.jpg"]')!;
        expect(backdropImg).not.toBeNull();

        fireEvent.error(backdropImg);
        expect(container.querySelector("img")).toBeNull();
    });
});
