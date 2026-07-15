import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WatchPatterns } from "../WatchPatterns";

describe("WatchPatterns", () => {
    it("renders the title and subtitle", () => {
        // Note: recharts' ResponsiveContainer never reports a non-zero size in
        // jsdom (no real layout engine), so it mounts no chart DOM here at all
        // — the weekday-label mapping below still runs as part of
        // constructing the element tree (exercised for coverage), it's just
        // not observable in the rendered output.
        render(
            <WatchPatterns
                weekdayDistribution={[
                    { weekday: 0, count: 2 },
                    { weekday: 1, count: 5 },
                ]}
            />,
        );
        expect(screen.getByText("星期习惯")).toBeInTheDocument();
        expect(screen.getByText("按星期分布")).toBeInTheDocument();
    });

    it("renders without error across every in-range weekday index", () => {
        const weekdayDistribution = Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            count: weekday,
        }));
        render(<WatchPatterns weekdayDistribution={weekdayDistribution} />);
        expect(screen.getByText("星期习惯")).toBeInTheDocument();
    });

    it("renders without error when a weekday index falls back to its raw number", () => {
        render(<WatchPatterns weekdayDistribution={[{ weekday: 9, count: 1 }]} />);
        expect(screen.getByText("星期习惯")).toBeInTheDocument();
    });

    it("renders without error when all counts are zero", () => {
        render(<WatchPatterns weekdayDistribution={[{ weekday: 0, count: 0 }]} />);
        expect(screen.getByText("星期习惯")).toBeInTheDocument();
    });
});
