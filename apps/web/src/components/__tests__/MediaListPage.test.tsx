import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tv2, Film } from "lucide-react";
import { MediaListPage, type MediaFilterOption } from "../MediaListPage";

// Deliberately fake, nonexistent translation keys: `t()` falls back to
// returning the key verbatim when no translation entry exists, so these
// render literally instead of resolving to real (Chinese) UI strings.
const FILTERS: MediaFilterOption[] = [
    { key: "shows", labelKey: "test.fakeShowsFilter", icon: Tv2, color: "#111" },
    { key: "movies", labelKey: "test.fakeMoviesFilter", icon: Film, color: "#222" },
];

function baseProps(overrides: Record<string, unknown> = {}) {
    return {
        filters: FILTERS,
        filter: "shows",
        onFilterChange: vi.fn(),
        search: "",
        onSearchChange: vi.fn(),
        searchPlaceholder: "search…",
        items: [] as unknown[],
        isLoading: false,
        error: null,
        isFetching: false,
        onRetry: vi.fn(),
        countLabel: "2 items",
        loadingLabel: "Loading…",
        errorLabel: "Failed to load",
        emptyLabel: "Nothing here",
        searchEmptyLabel: "No results",
        importHint: "Import hint",
        renderItem: (item: unknown, i: number) => <div key={i}>{String(item)}</div>,
        ...overrides,
    };
}

describe("MediaListPage", () => {
    it("renders filter buttons and calls onFilterChange when clicked", () => {
        const onFilterChange = vi.fn();
        render(<MediaListPage {...baseProps({ onFilterChange })} />);
        fireEvent.click(screen.getByText("test.fakeMoviesFilter"));
        expect(onFilterChange).toHaveBeenCalledWith("movies");
    });

    it("hides filter buttons when hideFilters is set", () => {
        render(<MediaListPage {...baseProps({ hideFilters: true })} />);
        expect(screen.queryByText("test.fakeMoviesFilter")).not.toBeInTheDocument();
    });

    it("calls onSearchChange as the user types", () => {
        const onSearchChange = vi.fn();
        render(<MediaListPage {...baseProps({ onSearchChange })} />);
        fireEvent.change(screen.getByPlaceholderText("search…"), { target: { value: "abc" } });
        expect(onSearchChange).toHaveBeenCalledWith("abc");
    });

    it("shows a clear button when search is non-empty and clears it on click", () => {
        const onSearchChange = vi.fn();
        render(<MediaListPage {...baseProps({ search: "abc", onSearchChange })} />);
        // "清除搜索" = "clear search" (zh-CN default locale).
        fireEvent.click(screen.getByLabelText("清除搜索"));
        expect(onSearchChange).toHaveBeenCalledWith("");
    });

    it("shows the loading state", () => {
        render(<MediaListPage {...baseProps({ isLoading: true })} />);
        expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("shows the error state and calls onRetry", () => {
        const onRetry = vi.fn();
        render(<MediaListPage {...baseProps({ error: new Error("boom"), onRetry })} />);
        expect(screen.getByText("Failed to load")).toBeInTheDocument();
        // "重试" = "retry" (zh-CN default locale).
        fireEvent.click(screen.getByText("重试"));
        expect(onRetry).toHaveBeenCalled();
    });

    it("shows the plain empty state (no search) with the import hint", () => {
        render(<MediaListPage {...baseProps({ items: [] })} />);
        expect(screen.getByText("Nothing here")).toBeInTheDocument();
        expect(screen.getByText("Import hint")).toBeInTheDocument();
    });

    it("shows the search-empty state (no import hint) when searching", () => {
        render(<MediaListPage {...baseProps({ items: [], search: "xyz" })} />);
        expect(screen.getByText("No results")).toBeInTheDocument();
        expect(screen.queryByText("Import hint")).not.toBeInTheDocument();
    });

    it("renders items via renderItem", () => {
        render(<MediaListPage {...baseProps({ items: ["one", "two"] })} />);
        expect(screen.getByText("one")).toBeInTheDocument();
        expect(screen.getByText("two")).toBeInTheDocument();
    });

    it("renders the headerSlot above the content", () => {
        render(<MediaListPage {...baseProps({ headerSlot: <div>banner</div>, items: ["one"] })} />);
        expect(screen.getByText("banner")).toBeInTheDocument();
    });

    it("focuses the search input when '/' is pressed outside of an input", () => {
        render(<MediaListPage {...baseProps()} />);
        const input = screen.getByPlaceholderText("search…");
        fireEvent.keyDown(window, { key: "/" });
        expect(input).toHaveFocus();
    });

    it("clears the search and blurs when Escape is pressed while focused", () => {
        const onSearchChange = vi.fn();
        render(<MediaListPage {...baseProps({ search: "abc", onSearchChange })} />);
        const input = screen.getByPlaceholderText("search…");
        input.focus();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onSearchChange).toHaveBeenCalledWith("");
    });
});
