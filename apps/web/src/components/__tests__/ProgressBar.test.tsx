import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../ProgressBar";

describe("ProgressBar", () => {
    it("renders the watched count and rounded percentage", () => {
        render(<ProgressBar watched={5} aired={10} total={20} />);
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("hides the label row when showLabel is false", () => {
        render(<ProgressBar watched={5} aired={10} total={20} showLabel={false} />);
        expect(screen.queryByText("50%")).not.toBeInTheDocument();
    });

    it("shows the unaired count when the show has episodes still to air", () => {
        render(<ProgressBar watched={2} aired={5} total={10} />);
        // "5 未播" = "5 not yet aired" (zh-CN default locale).
        expect(screen.getByText(/未播/)).toBeInTheDocument();
    });

    it("treats 0 aired episodes as 0% watched without dividing by zero", () => {
        render(<ProgressBar watched={0} aired={0} total={10} />);
        expect(screen.getByText("0%")).toBeInTheDocument();
    });
});
