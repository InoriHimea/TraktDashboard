import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { Toaster } from "../ui/Toaster";
import { ToastProvider, useToast } from "../../lib/toast";

// AnimatePresence's exit animation keeps the outgoing node mounted until a real
// animation frame resolves, which jsdom never fires deterministically. Strip
// framer-motion down to plain elements so dismiss/unmount is synchronous.
vi.mock("framer-motion", () => ({
    motion: new Proxy(
        {},
        {
            get:
                (_t, tag: string) =>
                ({
                    children,
                    initial: _initial,
                    animate: _animate,
                    exit: _exit,
                    transition: _transition,
                    whileHover: _whileHover,
                    ...rest
                }: Record<string, unknown>) =>
                    createElement(tag, rest, children as never),
        },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

function Trigger() {
    const { toast } = useToast();
    return (
        <>
            <button onClick={() => toast("Saved successfully", "success")}>fire-success</button>
            <button onClick={() => toast("Something broke", "error")}>fire-error</button>
            <button
                onClick={() => toast("Undo?", "info", { label: "Undo", onClick: () => undoSpy() })}
            >
                fire-action
            </button>
        </>
    );
}

let undoCalls = 0;
function undoSpy() {
    undoCalls++;
}

function renderWithProvider() {
    return render(
        <ToastProvider>
            <Trigger />
            <Toaster />
        </ToastProvider>,
    );
}

afterEach(() => {
    cleanup();
    undoCalls = 0;
});

describe("Toaster", () => {
    it("renders nothing when there are no toasts", () => {
        renderWithProvider();
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a toast message when triggered", () => {
        renderWithProvider();
        fireEvent.click(screen.getByText("fire-success"));
        expect(screen.getByText("Saved successfully")).toBeTruthy();
        expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("dismisses a toast when its close button is clicked", () => {
        renderWithProvider();
        fireEvent.click(screen.getByText("fire-error"));
        expect(screen.getByText("Something broke")).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Dismiss"));
        expect(screen.queryByText("Something broke")).toBeNull();
    });

    it("runs the action callback and dismisses the toast when the action button is clicked", () => {
        renderWithProvider();
        fireEvent.click(screen.getByText("fire-action"));
        expect(screen.getByText("Undo?")).toBeTruthy();

        fireEvent.click(screen.getByText("Undo"));
        expect(undoCalls).toBe(1);
        expect(screen.queryByText("Undo?")).toBeNull();
    });

    it("stacks multiple simultaneous toasts", () => {
        renderWithProvider();
        act(() => {
            fireEvent.click(screen.getByText("fire-success"));
            fireEvent.click(screen.getByText("fire-error"));
        });
        expect(screen.getByText("Saved successfully")).toBeTruthy();
        expect(screen.getByText("Something broke")).toBeTruthy();
    });
});
