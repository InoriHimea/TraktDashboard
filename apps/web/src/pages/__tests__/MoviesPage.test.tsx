import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MoviesPage from "../MoviesPage";

const mocks = vi.hoisted(() => ({ useMoviesProgress: vi.fn() }));

vi.mock("../../hooks", () => ({ useMoviesProgress: mocks.useMoviesProgress }));

vi.mock("../../components/MovieCard", () => ({
    MovieCard: ({ movie }: { movie: { movie: { id: number; title: string } } }) => (
        <div>{movie.movie.title}</div>
    ),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMoviesProgress.mockReturnValue({
        data: [{ movie: { id: 1, title: "Arrival" } }],
        isLoading: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
    });
});

describe("MoviesPage", () => {
    it("renders movies from useMoviesProgress via MovieCard", () => {
        render(<MoviesPage />);
        expect(screen.getByText("Arrival")).toBeInTheDocument();
    });

    it("hides the filter row (hideFilters is passed through)", () => {
        render(<MoviesPage />);
        // "已观看" = "watched" (zh-CN); MediaListPage renders filter labels via t(),
        // so its absence confirms hideFilters suppressed the filter row entirely.
        expect(screen.queryByText("已观看")).not.toBeInTheDocument();
    });

    it("shows the loading label while fetching", () => {
        mocks.useMoviesProgress.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            isFetching: true,
            refetch: vi.fn(),
        });
        render(<MoviesPage />);
        // "正在加载电影…" = "loading movies…" (zh-CN default locale).
        expect(screen.getByText("正在加载电影…")).toBeInTheDocument();
    });
});
