import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaComposition } from "../MediaComposition";
import { COLORS } from "../tokens";

describe("MediaComposition", () => {
    it("renders the title and total count", () => {
        render(
            <MediaComposition
                totalEntries={120}
                maxMedia={80}
                mediaBreakdown={[{ label: "剧集", value: 80, color: COLORS.cyan }]}
            />,
        );
        expect(screen.getByText("媒体构成")).toBeInTheDocument();
        expect(screen.getByText("共 120 条")).toBeInTheDocument();
    });

    it("renders each breakdown row's label, value, and percentage of the total", () => {
        render(
            <MediaComposition
                totalEntries={100}
                maxMedia={75}
                mediaBreakdown={[
                    { label: "剧集", value: 75, color: COLORS.cyan },
                    { label: "电影", value: 25, color: COLORS.amber },
                ]}
            />,
        );
        expect(screen.getByText("剧集")).toBeInTheDocument();
        expect(screen.getByText("75")).toBeInTheDocument();
        expect(screen.getByText("75%")).toBeInTheDocument();
        expect(screen.getByText("电影")).toBeInTheDocument();
        expect(screen.getByText("25")).toBeInTheDocument();
        expect(screen.getByText("25%")).toBeInTheDocument();
    });

    it("does not divide by zero when totalEntries is 0", () => {
        render(
            <MediaComposition
                totalEntries={0}
                maxMedia={1}
                mediaBreakdown={[{ label: "剧集", value: 0, color: COLORS.cyan }]}
            />,
        );
        expect(screen.getByText("0%")).toBeInTheDocument();
    });
});
