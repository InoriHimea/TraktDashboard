import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MovieCard } from "../MovieCard";
import type { MovieProgress } from "@trakt-dashboard/types";

const safeText = fc
    .string({ minLength: 1 })
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
const safeDate = fc.date({
    min: new Date("1970-01-01T00:00:00.000Z"),
    max: new Date("2100-12-31T23:59:59.999Z"),
});

function movieProgressArbitrary() {
    return fc.record({
        movie: fc.record({
            id: fc.integer({ min: 1, max: 1_000_000 }),
            tmdbId: fc.integer({ min: 1, max: 1_000_000 }),
            imdbId: fc.option(safeText, { nil: null }),
            traktId: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null }),
            traktSlug: fc.option(safeText, { nil: null }),
            title: safeText,
            overview: fc.option(safeText, { nil: null }),
            releaseDate: fc.option(
                safeDate.map((date) => date.toISOString().slice(0, 10)),
                { nil: null },
            ),
            runtime: fc.option(fc.integer({ min: 1, max: 400 }), { nil: null }),
            posterPath: fc.constant(null),
            backdropPath: fc.constant(null),
            genres: fc.array(safeText, { maxLength: 4 }),
            lastSyncedAt: safeDate.map((date) => date.toISOString()),
            createdAt: safeDate.map((date) => date.toISOString()),
        }),
        watchCount: fc.integer({ min: 0, max: 50 }),
        lastWatchedAt: fc.option(
            safeDate.map((date) => date.toISOString()),
            { nil: null },
        ),
    }) as fc.Arbitrary<MovieProgress>;
}

describe("MovieCard", () => {
    it("renders required fields and links for any movie progress", () => {
        fc.assert(
            fc.property(movieProgressArbitrary(), (movie) => {
                cleanup();
                const { unmount } = render(
                    <MemoryRouter>
                        <MovieCard movie={movie} index={0} />
                    </MemoryRouter>,
                );

                const link = screen.getByRole("link");
                expect(link).toHaveAttribute("href", `/movies/${movie.movie.id}`);
                expect(within(link).getByText(movie.movie.title)).toBeInTheDocument();
                expect(
                    within(link).getByText(
                        movie.watchCount > 0 ? `已观看 ${movie.watchCount} 次` : "未观看",
                    ),
                ).toBeInTheDocument();

                unmount();
            }),
        );
    });
});
