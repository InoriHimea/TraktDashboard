import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatCard } from "../StatCard";
import { TopGenres } from "../TopGenres";
import { COLORS } from "../tokens";

function DummyIcon({ size }: { size?: number; color?: string; "aria-hidden"?: boolean }) {
    return <svg data-testid="stat-icon" width={size} height={size} />;
}

afterEach(cleanup);

describe("StatCard", () => {
    it("renders label, value, and icon", () => {
        render(<StatCard label="Episodes" value={128} icon={DummyIcon} />);
        expect(screen.getByText("Episodes")).toBeTruthy();
        expect(screen.getByText("128")).toBeTruthy();
        expect(screen.getByTestId("stat-icon")).toBeTruthy();
    });

    it("renders sub and signal only when provided", () => {
        const { rerender } = render(
            <StatCard label="Runtime" value="99h" icon={DummyIcon} sub="this year" signal="+12%" />,
        );
        expect(screen.getByText("this year")).toBeTruthy();
        expect(screen.getByText("+12%")).toBeTruthy();

        rerender(<StatCard label="Runtime" value="99h" icon={DummyIcon} />);
        expect(screen.queryByText("this year")).toBeNull();
        expect(screen.queryByText("+12%")).toBeNull();
    });

    it("applies the accent color to the value", () => {
        render(<StatCard label="Movies" value={42} icon={DummyIcon} color={COLORS.violet} />);
        const value = screen.getByText("42");
        expect(value).toHaveStyle({ color: COLORS.violet.light });
    });
});

describe("TopGenres", () => {
    it("renders nothing for an empty genre list", () => {
        const { container } = render(<TopGenres topGenres={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders ranked rows with counts", () => {
        render(
            <TopGenres
                topGenres={[
                    { name: "Drama", count: 12 },
                    { name: "Sci-Fi", count: 6 },
                ]}
            />,
        );
        expect(screen.getByText("#1")).toBeTruthy();
        expect(screen.getByText("#2")).toBeTruthy();
        expect(screen.getByText("Drama")).toBeTruthy();
        expect(screen.getByText("Sci-Fi")).toBeTruthy();
        expect(screen.getByText("12")).toBeTruthy();
        expect(screen.getByText("6")).toBeTruthy();
    });
});
