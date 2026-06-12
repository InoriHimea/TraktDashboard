import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
    useWatchlist,
    useAddToWatchlist,
    useRemoveFromWatchlist,
    useMarkSeasonWatched,
} from "../index";

vi.mock("../../lib/api", () => ({
    api: {
        watchlist: {
            list: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
        },
        shows: {
            markSeasonWatched: vi.fn(),
        },
    },
}));

import { api } from "../../lib/api";

function makeWrapper() {
    return makeClientWrapper().wrapper;
}

function makeClientWrapper() {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { queryClient: qc, wrapper };
}

describe("useWatchlist", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns data from api.watchlist.list", async () => {
        const items = [{ id: 1 }, { id: 2 }];
        vi.mocked(api.watchlist.list).mockResolvedValue({ data: items } as never);

        const { result } = renderHook(() => useWatchlist(), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(items);
        expect(api.watchlist.list).toHaveBeenCalledWith(undefined);
    });

    it("passes type filter to api", async () => {
        vi.mocked(api.watchlist.list).mockResolvedValue({ data: [] } as never);
        const { result } = renderHook(() => useWatchlist("shows"), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.watchlist.list).toHaveBeenCalledWith("shows");
    });

    it("surfaces error when api fails", async () => {
        vi.mocked(api.watchlist.list).mockRejectedValue(new Error("Network error"));
        const { result } = renderHook(() => useWatchlist(), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe("useAddToWatchlist", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls api.watchlist.add with correct args", async () => {
        vi.mocked(api.watchlist.add).mockResolvedValue({ data: { id: 1 } } as never);
        const { result } = renderHook(() => useAddToWatchlist(), { wrapper: makeWrapper() });
        result.current.mutate({ type: "show", id: 42 });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.watchlist.add).toHaveBeenCalledWith("show", 42, undefined);
    });

    it("invalidates watchlist queries after successful add", async () => {
        vi.mocked(api.watchlist.add).mockResolvedValue({ data: { id: 1 } } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useAddToWatchlist(), { wrapper });
        result.current.mutate({ type: "movie", id: 84, notes: "later" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["watchlist"] });
    });
});

describe("useRemoveFromWatchlist", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls api.watchlist.remove with id", async () => {
        vi.mocked(api.watchlist.remove).mockResolvedValue({ ok: true } as never);
        const { result } = renderHook(() => useRemoveFromWatchlist(), { wrapper: makeWrapper() });
        result.current.mutate(7);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.watchlist.remove).toHaveBeenCalledWith(7);
    });

    it("invalidates watchlist queries after successful removal", async () => {
        vi.mocked(api.watchlist.remove).mockResolvedValue({ ok: true } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useRemoveFromWatchlist(), { wrapper });
        result.current.mutate(7);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["watchlist"] });
    });
});

describe("useMarkSeasonWatched", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls api.shows.markSeasonWatched with showId and season", async () => {
        vi.mocked(api.shows.markSeasonWatched).mockResolvedValue({
            ok: true,
            marked: 5,
            alreadyWatched: 0,
        } as never);
        const { result } = renderHook(() => useMarkSeasonWatched(10), { wrapper: makeWrapper() });
        result.current.mutate({ season: 2, watchedAt: null });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.shows.markSeasonWatched).toHaveBeenCalledWith(10, 2, null);
    });

    it("surfaces error when api fails", async () => {
        vi.mocked(api.shows.markSeasonWatched).mockRejectedValue(new Error("Server error"));
        const { result } = renderHook(() => useMarkSeasonWatched(10), { wrapper: makeWrapper() });
        result.current.mutate({ season: 1, watchedAt: null });
        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});
