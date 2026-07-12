import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewText } from "../ui/OverviewText";
import { PendingDeleteBadge } from "../ui/PendingDeleteBadge";

const deferState = vi.hoisted(() => ({
    mutate: vi.fn(),
    isPending: false,
    toast: vi.fn(),
}));

vi.mock("../../hooks", () => ({
    useDeferJellyfinDelete: () => ({ mutate: deferState.mutate, isPending: deferState.isPending }),
}));

vi.mock("../../lib/toast", () => ({
    useToast: () => ({ toast: deferState.toast }),
}));

afterEach(cleanup);

describe("OverviewText", () => {
    // Trimmed so the literal matches testing-library's whitespace-normalized DOM text
    // (getByText trims/collapses the rendered text but compares it as-is against a string matcher).
    const longText = "line ".repeat(200).trim();

    function mockMeasurements(scrollHeight: number, clientHeight: number) {
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
            configurable: true,
            get: () => scrollHeight,
        });
        Object.defineProperty(HTMLElement.prototype, "clientHeight", {
            configurable: true,
            get: () => clientHeight,
        });
    }

    afterEach(() => {
        // jsdom defaults both to 0 — restore by deleting our overrides.
        Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
        Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    });

    it("renders nothing for null text", () => {
        const { container } = render(<OverviewText text={null} />);
        expect(container.firstChild).toBeNull();
    });

    it("shows plain text without a toggle when content fits", () => {
        mockMeasurements(50, 50);
        render(<OverviewText text="short" />);
        expect(screen.getByText("short")).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("offers read-more when clamped, and expands/collapses on click", () => {
        mockMeasurements(200, 80);
        render(<OverviewText text={longText} />);
        const para = screen.getByText(longText);
        // Clamped: -webkit-box styling applied
        expect(para.style.overflow).toBe("hidden");

        const toggle = screen.getByRole("button");
        fireEvent.click(toggle);
        // Expanded: clamp styles removed
        expect(para.style.overflow).toBe("");

        fireEvent.click(toggle);
        expect(para.style.overflow).toBe("hidden");
    });
});

describe("PendingDeleteBadge", () => {
    beforeEach(() => {
        deferState.mutate.mockReset();
        deferState.toast.mockReset();
    });

    it("renders the label", () => {
        render(<PendingDeleteBadge queueId={11} label="明天删除" />);
        expect(screen.getByText("明天删除")).toBeTruthy();
    });

    it("defers the queue entry when the X button is clicked", () => {
        render(<PendingDeleteBadge queueId={11} label="pending" />);
        fireEvent.click(screen.getByRole("button"));
        expect(deferState.mutate).toHaveBeenCalledTimes(1);
        expect(deferState.mutate.mock.calls[0][0]).toBe(11);
    });

    it("shows a success toast when the defer succeeds", () => {
        deferState.mutate.mockImplementation((_id: number, opts: { onSuccess?: () => void }) =>
            opts.onSuccess?.(),
        );
        render(<PendingDeleteBadge queueId={11} label="pending" />);
        fireEvent.click(screen.getByRole("button"));
        expect(deferState.toast).toHaveBeenCalledWith(expect.any(String), "success");
    });

    it("shows an error toast when the defer fails", () => {
        deferState.mutate.mockImplementation((_id: number, opts: { onError?: () => void }) =>
            opts.onError?.(),
        );
        render(<PendingDeleteBadge queueId={11} label="pending" />);
        fireEvent.click(screen.getByRole("button"));
        expect(deferState.toast).toHaveBeenCalledWith(expect.any(String), "error");
    });
});
