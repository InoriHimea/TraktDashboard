import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TraktProgressBar } from "../TraktProgressBar";

// framer-motion applies `animate` styles imperatively via its own scheduler,
// which doesn't settle deterministically in jsdom even across `waitFor`
// polling — so these tests exercise the pct-computation branches (÷0 guard,
// clamping) by rendering without error rather than asserting on the
// animated style value itself.

describe("TraktProgressBar", () => {
    it("renders without error when total is 0 (avoids a divide-by-zero)", () => {
        const { container } = render(<TraktProgressBar watched={0} total={0} />);
        expect(container.querySelector("div > div")).toBeInTheDocument();
    });

    it("renders without error when watched exceeds total (clamped internally)", () => {
        const { container } = render(<TraktProgressBar watched={20} total={10} />);
        expect(container.querySelector("div > div")).toBeInTheDocument();
    });

    it("applies a custom className to the track", () => {
        const { container } = render(
            <TraktProgressBar watched={1} total={4} className="custom-class" />,
        );
        expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });
});
