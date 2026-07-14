import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SlidingPanel } from "../SlidingPanel";

describe("SlidingPanel", () => {
    it("renders nothing when closed", () => {
        const { container } = render(
            <SlidingPanel open={false} onClose={vi.fn()} title="Test">
                <p>content</p>
            </SlidingPanel>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the title, subtitle, and children when open", () => {
        render(
            <SlidingPanel open onClose={vi.fn()} title="Test Panel" subtitle="a subtitle">
                <p>panel body</p>
            </SlidingPanel>,
        );
        expect(screen.getByText("Test Panel")).toBeInTheDocument();
        expect(screen.getByText("a subtitle")).toBeInTheDocument();
        expect(screen.getByText("panel body")).toBeInTheDocument();
    });

    it("calls onClose when the close button is clicked", () => {
        const onClose = vi.fn();
        render(
            <SlidingPanel open onClose={onClose} title="Test">
                <p>content</p>
            </SlidingPanel>,
        );
        fireEvent.click(screen.getByRole("button"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Escape key is pressed", () => {
        const onClose = vi.fn();
        render(
            <SlidingPanel open onClose={onClose} title="Test">
                <p>content</p>
            </SlidingPanel>,
        );
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
