import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimePickerModal } from "../DateTimePickerModal";

describe("DateTimePickerModal", () => {
    it("renders nothing when closed", () => {
        const { container } = render(
            <DateTimePickerModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("seeds the input with the given defaultValue when opened", () => {
        render(
            <DateTimePickerModal
                open
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                defaultValue={new Date("2026-03-04T10:30:00")}
            />,
        );
        // Default locale is zh-CN ("日期和时间" = "date and time").
        const input = screen.getByLabelText("日期和时间") as HTMLInputElement;
        expect(input.value).toBe("2026-03-04T10:30");
    });

    it("confirms with the ISO string derived from the input value", () => {
        const onConfirm = vi.fn();
        render(
            <DateTimePickerModal
                open
                onClose={vi.fn()}
                onConfirm={onConfirm}
                defaultValue={new Date("2026-03-04T10:30:00")}
            />,
        );
        fireEvent.change(screen.getByLabelText("日期和时间"), {
            target: { value: "2026-05-01T09:00" },
        });
        // "标记为已观看" = "mark as watched" (zh-CN default locale).
        fireEvent.click(screen.getByRole("button", { name: "标记为已观看" }));
        expect(onConfirm).toHaveBeenCalledWith(new Date("2026-05-01T09:00").toISOString());
    });

    it("calls onClose when the Escape key is pressed", () => {
        const onClose = vi.fn();
        render(<DateTimePickerModal open onClose={onClose} onConfirm={vi.fn()} />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
