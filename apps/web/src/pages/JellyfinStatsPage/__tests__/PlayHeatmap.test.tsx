import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayHeatmap } from "../PlayHeatmap";

describe("PlayHeatmap", () => {
    it("renders the header and a skeleton block while loading", () => {
        const { container } = render(<PlayHeatmap data={[]} isLoading={true} />);
        expect(screen.getByText("播放热图")).toBeInTheDocument();
        expect(screen.queryByText("暂无数据")).not.toBeInTheDocument();
        expect(container.querySelector('[style*="height: 140px"]')).not.toBeNull();
    });

    it("shows the empty state when not loading and there is no data", () => {
        render(<PlayHeatmap data={[]} isLoading={false} />);
        expect(screen.getByText("暂无数据")).toBeInTheDocument();
    });

    it("renders the day/hour labels, legend, and buckets counts into the correct color", () => {
        const data = [
            { dayOfWeek: 0, hour: 10, count: 10 }, // ratio 1.0 -> violet.base (>=0.8)
            { dayOfWeek: 1, hour: 5, count: 6 }, // ratio 0.6 -> sky.base (>=0.55)
            { dayOfWeek: 2, hour: 3, count: 3 }, // ratio 0.3 -> emerald.base (>=0.3)
            { dayOfWeek: 3, hour: 1, count: 1 }, // ratio 0.1 -> amber.bg (else)
        ];
        const { container } = render(<PlayHeatmap data={data} isLoading={false} />);

        expect(screen.getByText("少")).toBeInTheDocument();
        expect(screen.getByText("多")).toBeInTheDocument();
        expect(screen.getByText("Sun")).toBeInTheDocument();
        expect(screen.getByText("Sat")).toBeInTheDocument();
        expect(screen.getByText("0")).toBeInTheDocument(); // hour label for hour=0

        // only cells with count > 0 get a `title` attribute at all.
        expect(container.querySelectorAll("[title]").length).toBe(4);

        expect(
            (container.querySelector('[title="10 plays"]') as HTMLElement).style.background,
        ).toBe("var(--color-accent-violet)");
        expect((container.querySelector('[title="6 plays"]') as HTMLElement).style.background).toBe(
            "rgb(56, 189, 248)",
        );
        expect((container.querySelector('[title="3 plays"]') as HTMLElement).style.background).toBe(
            "rgb(6, 185, 129)",
        );
        expect((container.querySelector('[title="1 plays"]') as HTMLElement).style.background).toBe(
            "rgba(248, 211, 92, 0.14)",
        );
    });
});
