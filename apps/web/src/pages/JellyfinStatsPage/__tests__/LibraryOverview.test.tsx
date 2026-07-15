import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LibraryOverview } from "../LibraryOverview";

describe("LibraryOverview", () => {
    it("renders skeleton placeholders while loading", () => {
        const { container } = render(<LibraryOverview data={undefined} isLoading={true} />);
        expect(screen.queryByText("媒体库概览")).not.toBeInTheDocument();
        expect(container.querySelectorAll('[style*="pulse"]').length).toBe(3);
    });

    it("renders zero counts and labels when data is null", () => {
        render(<LibraryOverview data={null} isLoading={false} />);
        expect(screen.getByText("媒体库概览")).toBeInTheDocument();
        expect(screen.getAllByText("0")).toHaveLength(3);
        expect(screen.getByText("电影")).toBeInTheDocument();
        expect(screen.getByText("剧集")).toBeInTheDocument();
        expect(screen.getByText("单集")).toBeInTheDocument();
    });

    it("renders each count formatted with thousands separators", () => {
        render(
            <LibraryOverview
                data={{ movieCount: 1234, seriesCount: 56, episodeCount: 7890 }}
                isLoading={false}
            />,
        );
        expect(screen.getByText("1,234")).toBeInTheDocument();
        expect(screen.getByText("56")).toBeInTheDocument();
        expect(screen.getByText("7,890")).toBeInTheDocument();
    });
});
