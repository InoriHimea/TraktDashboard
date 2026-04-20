import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { MovieCard } from "../MovieCard";
import type { MovieProgress } from "@trakt-dashboard/types";

// Mock i18n to return Chinese translations (default locale)
vi.mock("../lib/i18n", () => ({
    t: (key: string, params?: { count?: number }) => {
        if (key === "movies.watchedNTimes" && params?.count) {
            return `已观看 ${params.count} 次`;
        }
        if (key === "movies.notWatched") return "未观看";
        if (key === "movies.lastWatched") return "最后观看";
        return key;
    },
}));

const createMockMovie = (overrides?: Partial<MovieProgress>): MovieProgress => ({
    movie: {
        id: 1,
        tmdbId: 550,
        imdbId: "tt0137523",
        traktId: 1,
        traktSlug: "fight-club-1999",
        title: "Fight Club",
        overview: "A ticking-time-bomb insomniac...",
        releaseDate: "1999-10-15",
        runtime: 139,
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        backdropPath: "/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg",
        genres: ["Drama"],
        lastSyncedAt: "2024-01-01T00:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
    },
    watchCount: 0,
    lastWatchedAt: null,
    ...overrides,
});

describe("MovieCard", () => {
    it("renders movie title", () => {
        const movie = createMockMovie();
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });

    it("renders 'Not watched' for unwatched movie", () => {
        const movie = createMockMovie({ watchCount: 0 });
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        expect(screen.getByText("未观看")).toBeInTheDocument();
    });

    it("renders watch count for watched movie", () => {
        const movie = createMockMovie({ watchCount: 3 });
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        expect(screen.getByText("已观看 3 次")).toBeInTheDocument();
    });

    it("renders release year", () => {
        const movie = createMockMovie();
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        expect(screen.getByText("1999")).toBeInTheDocument();
    });

    it("renders last watched date when available", () => {
        const movie = createMockMovie({
            watchCount: 2,
            lastWatchedAt: "2024-01-15T12:00:00Z",
        });
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        expect(screen.getByText("最后观看")).toBeInTheDocument();
    });

    it("links to movie detail page", () => {
        const movie = createMockMovie();
        render(
            <BrowserRouter>
                <MovieCard movie={movie} index={0} />
            </BrowserRouter>,
        );

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/movies/1");
    });
});
