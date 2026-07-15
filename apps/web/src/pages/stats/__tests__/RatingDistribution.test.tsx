import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RatingDistribution } from "../RatingDistribution";

describe("RatingDistribution", () => {
    it("renders nothing when there are no ratings", () => {
        const { container } = render(<RatingDistribution ratingDistribution={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when all counts are zero", () => {
        const { container } = render(
            <RatingDistribution
                ratingDistribution={[
                    { rating: 8, count: 0 },
                    { rating: 9, count: 0 },
                ]}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the title, subtitle, and average label", () => {
        // Note: recharts' ResponsiveContainer never reports a non-zero size in
        // jsdom (no real layout engine), so it mounts no chart DOM here at all —
        // only the surrounding static text is assertable.
        render(
            <RatingDistribution
                ratingDistribution={[
                    { rating: 8, count: 3 },
                    { rating: 10, count: 1 },
                ]}
            />,
        );
        expect(screen.getByText("评分分布")).toBeInTheDocument();
        // 共 4 条评分 = "4 ratings total" (4 = 3 + 1).
        expect(screen.getByText("共 4 条评分")).toBeInTheDocument();
        // avg = (8*3 + 10*1) / 4 = 8.5
        expect(screen.getByText("均分 8.5 / 10")).toBeInTheDocument();
    });

    it("renders without error for a single rating bucket", () => {
        render(<RatingDistribution ratingDistribution={[{ rating: 10, count: 1 }]} />);
        expect(screen.getByText("均分 10.0 / 10")).toBeInTheDocument();
    });
});
