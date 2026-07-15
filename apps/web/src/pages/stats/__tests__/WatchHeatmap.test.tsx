import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchHeatmap } from "../WatchHeatmap";

// The card header's CalendarDays icon also renders an SVG <rect> (its body
// outline), so queries must be scoped to the heatmap's own <svg> (identified
// by its aria-label) rather than `container.querySelector("rect")` directly.
function heatmapRects(container: HTMLElement): SVGRectElement[] {
    const svg = container.querySelector('svg[aria-label="观看热力图"]')!;
    return Array.from(svg.querySelectorAll("rect"));
}

describe("WatchHeatmap", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders the title, subtitle, weekday labels, a month label, and the legend", () => {
        const { container, getByText, getAllByText } = render(<WatchHeatmap heatmap={[]} />);
        expect(getByText("观看热力图")).toBeInTheDocument();
        expect(getByText("过去 52 周")).toBeInTheDocument();
        // Mon/Wed/Fri row labels.
        expect(getByText("一")).toBeInTheDocument();
        expect(getByText("三")).toBeInTheDocument();
        expect(getByText("五")).toBeInTheDocument();
        expect(getAllByText(/^\d+月$/).length).toBeGreaterThan(0);
        expect(getByText("少")).toBeInTheDocument();
        expect(getByText("多")).toBeInTheDocument();
        // 52 weeks * 7 days, minus any future days this week that get filtered out.
        expect(heatmapRects(container).length).toBeGreaterThan(300);
    });

    it("defaults an unspecified day to the lowest ('no activity') color level", () => {
        const { container } = render(<WatchHeatmap heatmap={[]} />);
        expect(heatmapRects(container)[0].style.fill).toBe("var(--color-surface-3)");
    });

    it("buckets watch counts into the correct heatmap color levels", () => {
        // The first 5 cells (oldest week) are always in the past regardless of
        // "today", so their dates are safe, deterministic anchors to re-render against.
        const { container, rerender } = render(<WatchHeatmap heatmap={[]} />);
        const rects = heatmapRects(container);
        const dateOf = (i: number) => rects[i].querySelector("title")!.textContent!.split(":")[0];
        const [d0, d1, d2, d3, d4] = [0, 1, 2, 3, 4].map(dateOf);

        rerender(
            <WatchHeatmap
                heatmap={[
                    { date: d0, count: 0 },
                    { date: d1, count: 2 },
                    { date: d2, count: 5 },
                    { date: d3, count: 10 },
                    { date: d4, count: 11 },
                ]}
            />,
        );
        const updated = heatmapRects(container);
        expect(updated[0].style.fill).toBe("var(--color-surface-3)");
        expect(updated[1].style.fill).toBe("rgba(139, 92, 246, 0.25)");
        expect(updated[2].style.fill).toBe("rgba(139, 92, 246, 0.52)");
        expect(updated[3].style.fill).toBe("rgba(139, 92, 246, 0.76)");
        // alpha 1.00 rounds down to a plain (alpha-less) rgb() in jsdom's serialized style.
        expect(updated[4].style.fill).toBe("rgb(139, 92, 246)");
    });

    it("shows each cell's date and count in its title tooltip", () => {
        const { container } = render(<WatchHeatmap heatmap={[]} />);
        const title = heatmapRects(container)[0].querySelector("title")!.textContent!;
        expect(title).toMatch(/^\d{4}-\d{2}-\d{2}: 0$/);
    });
});
