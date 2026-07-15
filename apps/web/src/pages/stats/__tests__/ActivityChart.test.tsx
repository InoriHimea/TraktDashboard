import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityChart } from "../ActivityChart";

describe("ActivityChart", () => {
    it("renders the title and subtitle", () => {
        // Note: recharts' ResponsiveContainer never reports a non-zero size in
        // jsdom (no real layout engine), so it mounts no chart DOM here at all —
        // only the surrounding static text is assertable. The per-bar
        // fill/opacity branches below still execute as part of constructing
        // the element tree, so they're exercised for coverage even though
        // nothing renders visually.
        render(
            <ActivityChart
                chartData={[
                    { month: "1月", count: 0 },
                    { month: "2月", count: 5 },
                ]}
                maxBar={5}
            />,
        );
        expect(screen.getByText("月度活跃度")).toBeInTheDocument();
        // "过去 12 个月" = "the past 12 months" (zh-CN default locale).
        expect(screen.getByText(/过去 12 个月/)).toBeInTheDocument();
    });

    it("renders without error when every bucket is zero", () => {
        render(<ActivityChart chartData={[{ month: "1月", count: 0 }]} maxBar={1} />);
        expect(screen.getByText("月度活跃度")).toBeInTheDocument();
    });

    it("renders without error for a single non-zero bucket", () => {
        render(<ActivityChart chartData={[{ month: "3月", count: 9 }]} maxBar={9} />);
        expect(screen.getByText("月度活跃度")).toBeInTheDocument();
    });
});
