import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
    useNote,
    useUpsertNote,
    useDeleteNote,
    useLists,
    useCreateList,
    useAddListItem,
    useRatings,
    useSetRating,
    useRemoveRating,
} from "../index";

vi.mock("../../lib/api", () => ({
    api: {
        notes: {
            get: vi.fn(),
            upsert: vi.fn(),
            delete: vi.fn(),
        },
        lists: {
            getAll: vi.fn(),
            create: vi.fn(),
            addItem: vi.fn(),
        },
        ratings: {
            list: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
        },
    },
}));

import { api } from "../../lib/api";

function makeClientWrapper() {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { queryClient: qc, wrapper };
}

function makeWrapper() {
    return makeClientWrapper().wrapper;
}

beforeEach(() => vi.clearAllMocks());

describe("useNote", () => {
    it("fetches a note scoped to the given media params", async () => {
        vi.mocked(api.notes.get).mockResolvedValue({ data: { id: 1, content: "hi" } } as never);
        const { result } = renderHook(
            () => useNote({ mediaType: "episode", showId: 5, season: 1, episode: 2 }),
            { wrapper: makeWrapper() },
        );
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual({ id: 1, content: "hi" });
        expect(api.notes.get).toHaveBeenCalledWith({
            mediaType: "episode",
            showId: 5,
            season: 1,
            episode: 2,
        });
    });

    it("resolves to null when the API returns no note", async () => {
        vi.mocked(api.notes.get).mockResolvedValue({ data: null } as never);
        const { result } = renderHook(() => useNote({ mediaType: "movie", movieId: 9 }), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toBeNull();
    });
});

describe("useUpsertNote / useDeleteNote", () => {
    it("invalidates the notes family after upsert", async () => {
        vi.mocked(api.notes.upsert).mockResolvedValue({ data: { id: 1 } } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useUpsertNote(), { wrapper });
        result.current.mutate({ mediaType: "show", showId: 5, content: "note" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    });

    it("invalidates the notes family after delete", async () => {
        vi.mocked(api.notes.delete).mockResolvedValue({ ok: true } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useDeleteNote(), { wrapper });
        result.current.mutate(1);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.notes.delete).toHaveBeenCalledWith(1);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notes"] });
    });
});

describe("useLists / useCreateList / useAddListItem", () => {
    it("returns the user's lists", async () => {
        const lists = [{ id: 1, name: "Watch later" }];
        vi.mocked(api.lists.getAll).mockResolvedValue({ data: lists } as never);
        const { result } = renderHook(() => useLists(), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(lists);
    });

    it("invalidates the lists family after create", async () => {
        vi.mocked(api.lists.create).mockResolvedValue({ data: { id: 2 } } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useCreateList(), { wrapper });
        result.current.mutate({ name: "New list" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["lists"] });
    });

    it("invalidates both the specific list's items and the lists family after adding an item", async () => {
        vi.mocked(api.lists.addItem).mockResolvedValue({ data: { id: 9 } } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useAddListItem(), { wrapper });
        result.current.mutate({ listId: 3, mediaType: "show", localId: 5 });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.lists.addItem).toHaveBeenCalledWith(3, { mediaType: "show", localId: 5 });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["lists", 3, "items"] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["lists"] });
    });
});

describe("useRatings / useSetRating / useRemoveRating", () => {
    it("fetches all ratings", async () => {
        const ratings = [{ id: 1, rating: 9 }];
        vi.mocked(api.ratings.list).mockResolvedValue({ data: ratings } as never);
        const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.ratings.list).toHaveBeenCalledWith("all");
        expect(result.current.data).toEqual(ratings);
    });

    it("invalidates ratings after setting one", async () => {
        vi.mocked(api.ratings.set).mockResolvedValue({ ok: true, rating: 8 } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useSetRating(), { wrapper });
        result.current.mutate({ type: "show", localId: 5, rating: 8 });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.ratings.set).toHaveBeenCalledWith("show", 5, 8);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ratings"] });
    });

    it("invalidates ratings after removing one", async () => {
        vi.mocked(api.ratings.remove).mockResolvedValue({ ok: true } as never);
        const { queryClient, wrapper } = makeClientWrapper();
        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        const { result } = renderHook(() => useRemoveRating(), { wrapper });
        result.current.mutate({ type: "movie", localId: 9 });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.ratings.remove).toHaveBeenCalledWith("movie", 9);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ratings"] });
    });
});
