import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "../../lib/queryKeys";
import * as hooks from "../index";

vi.mock("../../lib/api", () => ({
    api: {
        auth: { logout: vi.fn() },
        sync: { status: vi.fn(), debug: vi.fn(), trigger: vi.fn(), full: vi.fn() },
        shows: {
            progress: vi.fn(),
            detail: vi.fn(),
            history: vi.fn(),
            deleteHistory: vi.fn(),
            reset: vi.fn(),
            markSeasonWatched: vi.fn(),
            forceSync: vi.fn(),
            upNext: vi.fn(),
        },
        stats: { overview: vi.fn(), screenTime: vi.fn() },
        trakt: { stats: vi.fn(), watching: vi.fn() },
        calendar: { list: vi.fn() },
        settings: { get: vi.fn(), update: vi.fn() },
        episodes: { detail: vi.fn(), history: vi.fn(), watch: vi.fn() },
        movies: {
            progress: vi.fn(),
            detail: vi.fn(),
            history: vi.fn(),
            watch: vi.fn(),
            deleteHistory: vi.fn(),
        },
        watchlist: { add: vi.fn(), remove: vi.fn() },
        jellyfin: {
            episode: vi.fn(),
            movie: vi.fn(),
            seasonEpisodes: vi.fn(),
            deleteSeasonEpisodes: vi.fn(),
            deleteQueue: vi.fn(),
            deferDeleteQueue: vi.fn(),
            neverDeleteQueue: vi.fn(),
            deleteQueueNow: vi.fn(),
            deleteExclusions: vi.fn(),
            createDeleteExclusion: vi.fn(),
            removeDeleteExclusion: vi.fn(),
            deleteHistory: vi.fn(),
            deleteItem: vi.fn(),
            nowPlaying: vi.fn(),
            statsOverview: vi.fn(),
            statsActivity: vi.fn(),
            statsTopContent: vi.fn(),
            statsHeatmap: vi.fn(),
        },
        discover: { list: vi.fn() },
        lists: {
            getItems: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            addItem: vi.fn(),
            removeItem: vi.fn(),
            sync: vi.fn(),
        },
        collection: {
            getAll: vi.fn(),
            check: vi.fn(),
            capacity: vi.fn(),
            getShowEpisodes: vi.fn(),
            sync: vi.fn(),
            clearRemote: vi.fn(),
            remove: vi.fn(),
            pruneRemote: vi.fn(),
        },
        system: { metrics: vi.fn() },
        history: { list: vi.fn() },
    },
}));

import { api } from "../../lib/api";

function makeWrapper() {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const setQueryDataSpy = vi.spyOn(qc, "setQueryData");
    const removeQueriesSpy = vi.spyOn(qc, "removeQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { wrapper, invalidateSpy, setQueryDataSpy, removeQueriesSpy };
}

function invalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
    return spy.mock.calls.map((call: unknown[]) => (call[0] as { queryKey: unknown }).queryKey);
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Query hooks — table-driven: verify the api call args and the unwrapped data
// ---------------------------------------------------------------------------

type QueryCase = {
    name: string;
    useHook: () => unknown;
    apiMock: () => ReturnType<typeof vi.fn>;
    expectedArgs: unknown[];
    resolved: unknown;
    expectedData: unknown;
};

const queryCases: QueryCase[] = [
    {
        name: "useSyncStatus",
        useHook: () => hooks.useSyncStatus(),
        apiMock: () => api.sync.status as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { status: "idle" } },
        expectedData: { status: "idle" },
    },
    {
        name: "useSyncDebug",
        useHook: () => hooks.useSyncDebug(true),
        apiMock: () => api.sync.debug as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { queueDepth: 0 } },
        expectedData: { queueDepth: 0 },
    },
    {
        name: "useShowsProgress",
        useHook: () => hooks.useShowsProgress("watching", "", 50, 0),
        apiMock: () => api.shows.progress as ReturnType<typeof vi.fn>,
        expectedArgs: ["watching", "", 50, 0],
        resolved: { data: [{ show: { id: 1 } }] },
        expectedData: [{ show: { id: 1 } }],
    },
    {
        name: "useShowDetail",
        useHook: () => hooks.useShowDetail(5),
        apiMock: () => api.shows.detail as ReturnType<typeof vi.fn>,
        expectedArgs: [5],
        resolved: { data: { id: 5 } },
        expectedData: { id: 5 },
    },
    {
        name: "useStats",
        useHook: () => hooks.useStats(),
        apiMock: () => api.stats.overview as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { totalEpisodes: 10 } },
        expectedData: { totalEpisodes: 10 },
    },
    {
        name: "useTraktStats",
        useHook: () => hooks.useTraktStats(),
        apiMock: () => api.trakt.stats as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { movies: {} } },
        expectedData: { movies: {} },
    },
    {
        name: "useCalendar",
        useHook: () => hooks.useCalendar(14, 30),
        apiMock: () => api.calendar.list as ReturnType<typeof vi.fn>,
        expectedArgs: [14, 30],
        resolved: { data: { "2026-01-01": [] } },
        expectedData: { "2026-01-01": [] },
    },
    {
        name: "useSettings",
        useHook: () => hooks.useSettings(),
        apiMock: () => api.settings.get as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { displayLanguage: "zh" } },
        expectedData: { displayLanguage: "zh" },
    },
    {
        name: "useEpisodeDetail",
        useHook: () => hooks.useEpisodeDetail(5, 1, 3),
        apiMock: () => api.episodes.detail as ReturnType<typeof vi.fn>,
        expectedArgs: [5, 1, 3],
        resolved: { data: { title: "Pilot" } },
        expectedData: { title: "Pilot" },
    },
    {
        name: "useEpisodeHistory",
        useHook: () => hooks.useEpisodeHistory(5, 1, 3),
        apiMock: () => api.episodes.history as ReturnType<typeof vi.fn>,
        expectedArgs: [5, 1, 3],
        resolved: { data: [{ id: 1 }] },
        expectedData: [{ id: 1 }],
    },
    {
        name: "useShowHistory",
        useHook: () => hooks.useShowHistory(5),
        apiMock: () => api.shows.history as ReturnType<typeof vi.fn>,
        expectedArgs: [5],
        resolved: { data: [{ id: 2 }] },
        expectedData: [{ id: 2 }],
    },
    {
        name: "useMoviesProgress",
        useHook: () => hooks.useMoviesProgress("watched", "", 50, 0),
        apiMock: () => api.movies.progress as ReturnType<typeof vi.fn>,
        expectedArgs: ["watched", "", 50, 0],
        resolved: { data: [{ id: 9 }] },
        expectedData: [{ id: 9 }],
    },
    {
        name: "useMovieDetail",
        useHook: () => hooks.useMovieDetail(9),
        apiMock: () => api.movies.detail as ReturnType<typeof vi.fn>,
        expectedArgs: [9],
        resolved: { data: { id: 9 } },
        expectedData: { id: 9 },
    },
    {
        name: "useMovieHistory",
        useHook: () => hooks.useMovieHistory(9),
        apiMock: () => api.movies.history as ReturnType<typeof vi.fn>,
        expectedArgs: [9],
        resolved: { data: [{ id: 3 }] },
        expectedData: [{ id: 3 }],
    },
    {
        name: "useJellyfinEpisode",
        useHook: () => hooks.useJellyfinEpisode(100, 1, 3),
        apiMock: () => api.jellyfin.episode as ReturnType<typeof vi.fn>,
        expectedArgs: [100, 1, 3],
        resolved: { data: { id: "abc" } },
        expectedData: { id: "abc" },
    },
    {
        name: "useJellyfinMovie",
        useHook: () => hooks.useJellyfinMovie(200),
        apiMock: () => api.jellyfin.movie as ReturnType<typeof vi.fn>,
        expectedArgs: [200],
        resolved: { data: { id: "xyz" } },
        expectedData: { id: "xyz" },
    },
    {
        name: "useJellyfinSeason (defaults to [] on null data)",
        useHook: () => hooks.useJellyfinSeason(100, 1),
        apiMock: () => api.jellyfin.seasonEpisodes as ReturnType<typeof vi.fn>,
        expectedArgs: [100, 1],
        resolved: { data: null },
        expectedData: [],
    },
    {
        name: "useJellyfinDeleteQueue",
        useHook: () => hooks.useJellyfinDeleteQueue(),
        apiMock: () => api.jellyfin.deleteQueue as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: [{ id: 1 }] },
        expectedData: [{ id: 1 }],
    },
    {
        name: "useJellyfinDeleteExclusions",
        useHook: () => hooks.useJellyfinDeleteExclusions(),
        apiMock: () => api.jellyfin.deleteExclusions as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: [{ id: 2 }] },
        expectedData: [{ id: 2 }],
    },
    {
        name: "useJellyfinDeleteHistory",
        useHook: () => hooks.useJellyfinDeleteHistory(20),
        apiMock: () => api.jellyfin.deleteHistory as ReturnType<typeof vi.fn>,
        expectedArgs: [20],
        resolved: { data: [{ id: 3 }] },
        expectedData: [{ id: 3 }],
    },
    {
        name: "useUpNext",
        useHook: () => hooks.useUpNext(),
        apiMock: () => api.shows.upNext as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: [{ showId: 5 }] },
        expectedData: [{ showId: 5 }],
    },
    {
        name: "useDiscover",
        useHook: () => hooks.useDiscover("show", "trending"),
        apiMock: () => api.discover.list as ReturnType<typeof vi.fn>,
        expectedArgs: ["show", "trending"],
        resolved: { data: [{ id: 1 }] },
        expectedData: [{ id: 1 }],
    },
    {
        name: "useJellyfinNowPlaying (defaults to null)",
        useHook: () => hooks.useJellyfinNowPlaying(),
        apiMock: () => api.jellyfin.nowPlaying as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: undefined },
        expectedData: null,
    },
    {
        name: "useListItems",
        useHook: () => hooks.useListItems(3),
        apiMock: () => api.lists.getItems as ReturnType<typeof vi.fn>,
        expectedArgs: [3],
        resolved: { data: [{ id: 1 }] },
        expectedData: [{ id: 1 }],
    },
    {
        name: "useCollection",
        useHook: () => hooks.useCollection("all"),
        apiMock: () => api.collection.getAll as ReturnType<typeof vi.fn>,
        expectedArgs: ["all"],
        resolved: { data: [{ id: 1 }] },
        expectedData: [{ id: 1 }],
    },
    {
        name: "useCollectionCheck (no ApiResponse wrapper)",
        useHook: () => hooks.useCollectionCheck({ showId: 5 }),
        apiMock: () => api.collection.check as ReturnType<typeof vi.fn>,
        expectedArgs: [{ showId: 5 }],
        resolved: { inCollection: true },
        expectedData: { inCollection: true },
    },
    {
        name: "useCollectionCapacity",
        useHook: () => hooks.useCollectionCapacity(),
        apiMock: () => api.collection.capacity as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { used: 1, limit: 100, pct: 1, nearLimit: false } },
        expectedData: { used: 1, limit: 100, pct: 1, nearLimit: false },
    },
    {
        name: "useCollectionShowEpisodes",
        useHook: () => hooks.useCollectionShowEpisodes(5),
        apiMock: () => api.collection.getShowEpisodes as ReturnType<typeof vi.fn>,
        expectedArgs: [5],
        resolved: { data: { seasons: [] } },
        expectedData: { seasons: [] },
    },
    {
        name: "useSystemMetrics",
        useHook: () => hooks.useSystemMetrics(),
        apiMock: () => api.system.metrics as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: { process: {}, system: {} } },
        expectedData: { process: {}, system: {} },
    },
    {
        name: "useScreenTime",
        useHook: () => hooks.useScreenTime(7),
        apiMock: () => api.stats.screenTime as ReturnType<typeof vi.fn>,
        expectedArgs: [7],
        resolved: { data: { days: [] } },
        expectedData: { days: [] },
    },
    {
        name: "useJellyfinStatsOverview (defaults to null)",
        useHook: () => hooks.useJellyfinStatsOverview(),
        apiMock: () => api.jellyfin.statsOverview as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: undefined },
        expectedData: null,
    },
    {
        name: "useJellyfinStatsActivity (defaults to [])",
        useHook: () => hooks.useJellyfinStatsActivity(50),
        apiMock: () => api.jellyfin.statsActivity as ReturnType<typeof vi.fn>,
        expectedArgs: [50],
        resolved: { data: undefined },
        expectedData: [],
    },
    {
        name: "useJellyfinStatsTopContent (defaults to empty shape)",
        useHook: () => hooks.useJellyfinStatsTopContent(),
        apiMock: () => api.jellyfin.statsTopContent as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: undefined },
        expectedData: { movies: [], series: [] },
    },
    {
        name: "useJellyfinStatsHeatmap (defaults to [])",
        useHook: () => hooks.useJellyfinStatsHeatmap(),
        apiMock: () => api.jellyfin.statsHeatmap as ReturnType<typeof vi.fn>,
        expectedArgs: [],
        resolved: { data: undefined },
        expectedData: [],
    },
];

describe("query hooks", () => {
    it.each(queryCases)(
        "$name calls the api with the right args and unwraps the data",
        async (tc) => {
            tc.apiMock().mockResolvedValue(tc.resolved);
            const { wrapper } = makeWrapper();
            const { result } = renderHook(() => tc.useHook(), { wrapper });
            await waitFor(() =>
                expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true),
            );
            expect((result.current as { data: unknown }).data).toEqual(tc.expectedData);
            expect(tc.apiMock()).toHaveBeenCalledWith(...tc.expectedArgs);
        },
    );
});

// ---------------------------------------------------------------------------
// useNowPlaying — reshapes the query into {data, isWatching, isLoading, error}
// ---------------------------------------------------------------------------

describe("useNowPlaying", () => {
    it("derives isWatching:false and data:null when nothing is playing", async () => {
        vi.mocked(api.trakt.watching).mockResolvedValue({ data: null });
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => hooks.useNowPlaying(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.isWatching).toBe(false);
        expect(result.current.data).toBeNull();
    });

    it("derives isWatching:true when an episode is playing", async () => {
        vi.mocked(api.trakt.watching).mockResolvedValue({ data: { title: "Pilot" } } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => hooks.useNowPlaying(), { wrapper });
        await waitFor(() => expect(result.current.isWatching).toBe(true));
        expect(result.current.data).toEqual({ title: "Pilot" });
    });
});

// ---------------------------------------------------------------------------
// useInfiniteHistory — pagination via getNextPageParam
// ---------------------------------------------------------------------------

describe("useInfiniteHistory", () => {
    it("returns a next page param while more entries remain", async () => {
        vi.mocked(api.history.list).mockResolvedValue({
            data: { entries: new Array(50).fill({ id: 1 }), total: 120 },
        } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => hooks.useInfiniteHistory(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.hasNextPage).toBe(true);
    });

    it("stops paginating once every entry has been loaded", async () => {
        vi.mocked(api.history.list).mockResolvedValue({
            data: { entries: new Array(10).fill({ id: 1 }), total: 10 },
        } as never);
        const { wrapper } = makeWrapper();
        const { result } = renderHook(() => hooks.useInfiniteHistory(), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.hasNextPage).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Mutation hooks — table-driven: verify the api call + invalidation set
// ---------------------------------------------------------------------------

type MutationCase = {
    name: string;
    useHook: () => unknown;
    mutateArgs: unknown;
    apiMock: () => ReturnType<typeof vi.fn>;
    expectedApiArgs: unknown[];
    expectedInvalidations: readonly (readonly unknown[])[];
};

const mutationCases: MutationCase[] = [
    {
        name: "useTriggerSync",
        useHook: () => hooks.useTriggerSync(),
        mutateArgs: undefined,
        apiMock: () => api.sync.trigger as ReturnType<typeof vi.fn>,
        expectedApiArgs: [],
        expectedInvalidations: [queryKeys.syncStatus],
    },
    {
        name: "useTriggerFullSync",
        useHook: () => hooks.useTriggerFullSync(),
        mutateArgs: undefined,
        apiMock: () => api.sync.full as ReturnType<typeof vi.fn>,
        expectedApiArgs: [],
        expectedInvalidations: [queryKeys.syncStatus],
    },
    {
        name: "useForceSync",
        useHook: () => hooks.useForceSync(5),
        mutateArgs: undefined,
        apiMock: () => api.shows.forceSync as ReturnType<typeof vi.fn>,
        expectedApiArgs: [5],
        expectedInvalidations: [
            queryKeys.showDetail(5),
            queryKeys.showsProgress.all,
            queryKeys.syncStatus,
        ],
    },
    {
        name: "useUpdateSettings",
        useHook: () => hooks.useUpdateSettings(),
        mutateArgs: { syncIntervalMinutes: 30 },
        apiMock: () => api.settings.update as ReturnType<typeof vi.fn>,
        expectedApiArgs: [{ syncIntervalMinutes: 30 }],
        expectedInvalidations: [queryKeys.settings],
    },
    {
        name: "useMarkWatched",
        useHook: () => hooks.useMarkWatched(5, 1, 3),
        mutateArgs: "2026-01-01T00:00:00.000Z",
        apiMock: () => api.episodes.watch as ReturnType<typeof vi.fn>,
        expectedApiArgs: [5, 1, 3, "2026-01-01T00:00:00.000Z"],
        expectedInvalidations: [queryKeys.episodeDetail.byEp(5, 1, 3), queryKeys.showDetail(5)],
    },
    {
        name: "useResetProgress",
        useHook: () => hooks.useResetProgress(5),
        mutateArgs: undefined,
        apiMock: () => api.shows.reset as ReturnType<typeof vi.fn>,
        expectedApiArgs: [5],
        expectedInvalidations: [queryKeys.showDetail(5), queryKeys.showsProgress.all],
    },
    {
        name: "useMarkMovieWatched",
        useHook: () => hooks.useMarkMovieWatched(9),
        mutateArgs: null,
        apiMock: () => api.movies.watch as ReturnType<typeof vi.fn>,
        expectedApiArgs: [9, null],
        expectedInvalidations: [
            queryKeys.movieDetail(9),
            queryKeys.movieHistory(9),
            queryKeys.moviesProgress.all,
        ],
    },
    {
        name: "useDeleteMovieHistory",
        useHook: () => hooks.useDeleteMovieHistory(9),
        mutateArgs: 2,
        apiMock: () => api.movies.deleteHistory as ReturnType<typeof vi.fn>,
        expectedApiArgs: [9, 2],
        expectedInvalidations: [
            queryKeys.movieHistory(9),
            queryKeys.movieDetail(9),
            queryKeys.moviesProgress.all,
        ],
    },
    {
        name: "useMarkSeasonWatched",
        useHook: () => hooks.useMarkSeasonWatched(5),
        mutateArgs: { season: 1, watchedAt: null },
        apiMock: () => api.shows.markSeasonWatched as ReturnType<typeof vi.fn>,
        expectedApiArgs: [5, 1, null],
        expectedInvalidations: [queryKeys.showDetail(5), queryKeys.showsProgress.all],
    },
    {
        name: "useDeferJellyfinDelete",
        useHook: () => hooks.useDeferJellyfinDelete(),
        mutateArgs: 7,
        apiMock: () => api.jellyfin.deferDeleteQueue as ReturnType<typeof vi.fn>,
        expectedApiArgs: [7],
        expectedInvalidations: [queryKeys.jellyfinDeleteQueue, queryKeys.jellyfinDeleteExclusions],
    },
    {
        name: "useNeverJellyfinDelete",
        useHook: () => hooks.useNeverJellyfinDelete(),
        mutateArgs: 7,
        apiMock: () => api.jellyfin.neverDeleteQueue as ReturnType<typeof vi.fn>,
        expectedApiArgs: [7],
        expectedInvalidations: [queryKeys.jellyfinDeleteQueue, queryKeys.jellyfinDeleteExclusions],
    },
    {
        name: "useDeleteNowJellyfinDelete",
        useHook: () => hooks.useDeleteNowJellyfinDelete(),
        mutateArgs: 7,
        apiMock: () => api.jellyfin.deleteQueueNow as ReturnType<typeof vi.fn>,
        expectedApiArgs: [7],
        expectedInvalidations: [queryKeys.jellyfinDeleteQueue, queryKeys.jellyfinDeleteHistory(20)],
    },
    {
        name: "useCreateJellyfinExclusion",
        useHook: () => hooks.useCreateJellyfinExclusion(),
        mutateArgs: { showId: 5 },
        apiMock: () => api.jellyfin.createDeleteExclusion as ReturnType<typeof vi.fn>,
        expectedApiArgs: [{ showId: 5 }],
        expectedInvalidations: [queryKeys.jellyfinDeleteExclusions, queryKeys.jellyfinDeleteQueue],
    },
    {
        name: "useRemoveJellyfinExclusion",
        useHook: () => hooks.useRemoveJellyfinExclusion(),
        mutateArgs: 9,
        apiMock: () => api.jellyfin.removeDeleteExclusion as ReturnType<typeof vi.fn>,
        expectedApiArgs: [9],
        expectedInvalidations: [queryKeys.jellyfinDeleteExclusions, queryKeys.jellyfinDeleteQueue],
    },
    {
        name: "useUpdateList",
        useHook: () => hooks.useUpdateList(),
        mutateArgs: { id: 3, name: "Renamed" },
        apiMock: () => api.lists.update as ReturnType<typeof vi.fn>,
        expectedApiArgs: [3, { name: "Renamed" }],
        expectedInvalidations: [queryKeys.lists.all],
    },
    {
        name: "useDeleteList",
        useHook: () => hooks.useDeleteList(),
        mutateArgs: 3,
        apiMock: () => api.lists.delete as ReturnType<typeof vi.fn>,
        expectedApiArgs: [3],
        expectedInvalidations: [queryKeys.lists.all],
    },
    {
        name: "useAddListItem",
        useHook: () => hooks.useAddListItem(),
        mutateArgs: { listId: 3, mediaType: "show", localId: 5 },
        apiMock: () => api.lists.addItem as ReturnType<typeof vi.fn>,
        expectedApiArgs: [3, { mediaType: "show", localId: 5 }],
        expectedInvalidations: [queryKeys.lists.items(3), queryKeys.lists.all],
    },
    {
        name: "useRemoveListItem",
        useHook: () => hooks.useRemoveListItem(),
        mutateArgs: { listId: 3, itemId: 10 },
        apiMock: () => api.lists.removeItem as ReturnType<typeof vi.fn>,
        expectedApiArgs: [3, 10],
        expectedInvalidations: [queryKeys.lists.items(3), queryKeys.lists.all],
    },
    {
        name: "useSyncLists",
        useHook: () => hooks.useSyncLists(),
        mutateArgs: undefined,
        apiMock: () => api.lists.sync as ReturnType<typeof vi.fn>,
        expectedApiArgs: [],
        expectedInvalidations: [queryKeys.lists.all],
    },
    {
        name: "useSyncCollection",
        useHook: () => hooks.useSyncCollection(),
        mutateArgs: undefined,
        apiMock: () => api.collection.sync as ReturnType<typeof vi.fn>,
        expectedApiArgs: [],
        expectedInvalidations: [
            queryKeys.collection.all,
            queryKeys.collection.checkAll,
            queryKeys.collection.capacity,
        ],
    },
    {
        name: "useClearRemoteCollection",
        useHook: () => hooks.useClearRemoteCollection(),
        mutateArgs: undefined,
        apiMock: () => api.collection.clearRemote as ReturnType<typeof vi.fn>,
        expectedApiArgs: [],
        expectedInvalidations: [
            queryKeys.collection.capacity,
            queryKeys.collection.all,
            queryKeys.collection.checkAll,
        ],
    },
    {
        name: "useRemoveCollectionItem",
        useHook: () => hooks.useRemoveCollectionItem(),
        mutateArgs: 5,
        apiMock: () => api.collection.remove as ReturnType<typeof vi.fn>,
        expectedApiArgs: [5],
        expectedInvalidations: [queryKeys.collection.all, queryKeys.collection.checkAll],
    },
    {
        name: "usePruneRemoteCollection",
        useHook: () => hooks.usePruneRemoteCollection(),
        mutateArgs: 80,
        apiMock: () => api.collection.pruneRemote as ReturnType<typeof vi.fn>,
        expectedApiArgs: [80],
        expectedInvalidations: [
            queryKeys.collection.capacity,
            queryKeys.collection.all,
            queryKeys.collection.checkAll,
        ],
    },
];

describe("mutation hooks", () => {
    it.each(mutationCases)(
        "$name calls the api and invalidates the right query keys",
        async (tc) => {
            tc.apiMock().mockResolvedValue(undefined);
            const { wrapper, invalidateSpy } = makeWrapper();
            const { result } = renderHook(() => tc.useHook(), { wrapper }) as {
                result: { current: { mutate: (v: unknown) => void; isSuccess: boolean } };
            };
            result.current.mutate(tc.mutateArgs);
            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Some mutationFns pass the api method by bare reference (not wrapped
            // in an arrow function), so react-query's own extra call arguments
            // (variables, mutation context) pass through too — only assert on
            // the leading args this test actually cares about.
            const actualArgs = tc.apiMock().mock.calls[0]?.slice(0, tc.expectedApiArgs.length);
            expect(actualArgs).toEqual(tc.expectedApiArgs);
            const keys = invalidatedKeys(invalidateSpy);
            for (const expectedKey of tc.expectedInvalidations) {
                expect(keys).toContainEqual(expectedKey);
            }
        },
    );
});

// ---------------------------------------------------------------------------
// useDeleteHistory — invalidation set differs with/without season+episode
// ---------------------------------------------------------------------------

describe("useDeleteHistory", () => {
    it("invalidates episode-specific queries when season/episode are given", async () => {
        vi.mocked(api.shows.deleteHistory).mockResolvedValue(undefined as never);
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useDeleteHistory(5, 1, 3), { wrapper });
        result.current.mutate(1);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(api.shows.deleteHistory).toHaveBeenCalledWith(5, 1);
        const keys = invalidatedKeys(invalidateSpy);
        expect(keys).toContainEqual(queryKeys.episodeHistory.byEp(5, 1, 3));
        expect(keys).toContainEqual(queryKeys.episodeDetail.byEp(5, 1, 3));
        expect(keys).not.toContainEqual(queryKeys.episodeHistory.all);
    });

    it("invalidates the broad episode-* families when season/episode are omitted", async () => {
        vi.mocked(api.shows.deleteHistory).mockResolvedValue(undefined as never);
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useDeleteHistory(5), { wrapper });
        result.current.mutate(1);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        const keys = invalidatedKeys(invalidateSpy);
        expect(keys).toContainEqual(queryKeys.episodeHistory.all);
        expect(keys).toContainEqual(queryKeys.episodeDetail.all);
        expect(keys).toContainEqual(queryKeys.showHistory(5));
    });
});

// ---------------------------------------------------------------------------
// useLogout — setQueryData + removeQueries (no invalidateQueries)
// ---------------------------------------------------------------------------

describe("useLogout", () => {
    it("marks auth as logged out and clears show/stats caches", async () => {
        vi.mocked(api.auth.logout).mockResolvedValue({ ok: true });
        const { wrapper, setQueryDataSpy, removeQueriesSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useLogout(), { wrapper });
        result.current.mutate();
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(setQueryDataSpy).toHaveBeenCalledWith(queryKeys.auth, {
            authenticated: false,
            user: null,
        });
        const removedKeys = removeQueriesSpy.mock.calls.map(
            (call) => (call[0] as { queryKey: unknown }).queryKey,
        );
        expect(removedKeys).toContainEqual(queryKeys.showsProgress.all);
        expect(removedKeys).toContainEqual(queryKeys.stats);
    });
});

// ---------------------------------------------------------------------------
// Misc single-purpose mutations not covered by the generic table above
// ---------------------------------------------------------------------------

describe("useAddToWatchlist / useRemoveFromWatchlist", () => {
    it("useAddToWatchlist posts and invalidates the whole watchlist family", async () => {
        vi.mocked(api.watchlist.add).mockResolvedValue({ data: {} } as never);
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useAddToWatchlist(), { wrapper });
        result.current.mutate({ type: "show", id: 5, notes: "n" });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.watchlist.add).toHaveBeenCalledWith("show", 5, "n");
        expect(invalidatedKeys(invalidateSpy)).toContainEqual(queryKeys.watchlist.all);
    });
});

describe("useDeleteJellyfinSeason", () => {
    it("invalidates the jellyfin-season family scoped to the show", async () => {
        vi.mocked(api.jellyfin.deleteSeasonEpisodes).mockResolvedValue({
            ok: true,
            deleted: 1,
        });
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useDeleteJellyfinSeason(), { wrapper });
        result.current.mutate({ showTmdbId: 100, season: 1 });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.jellyfin.deleteSeasonEpisodes).toHaveBeenCalledWith(100, 1);
        expect(invalidatedKeys(invalidateSpy)).toContainEqual(["jellyfin-season", 100]);
    });
});

describe("useDeleteJellyfinItem", () => {
    it("invalidates both jellyfin-episode and jellyfin-movie families", async () => {
        vi.mocked(api.jellyfin.deleteItem).mockResolvedValue({ ok: true });
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useDeleteJellyfinItem(), { wrapper });
        result.current.mutate("item-1");
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.jellyfin.deleteItem).toHaveBeenCalledWith("item-1");
        const keys = invalidatedKeys(invalidateSpy);
        expect(keys).toContainEqual(["jellyfin-episode"]);
        expect(keys).toContainEqual(["jellyfin-movie"]);
    });
});

describe("useMarkEpisodeWatched", () => {
    it("watches the episode with the current timestamp and invalidates up-next", async () => {
        vi.mocked(api.episodes.watch).mockResolvedValue({ ok: true, historyId: 1 });
        const { wrapper, invalidateSpy } = makeWrapper();
        const { result } = renderHook(() => hooks.useMarkEpisodeWatched(), { wrapper });
        result.current.mutate({ showId: 5, seasonNumber: 1, episodeNumber: 3 });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(api.episodes.watch).toHaveBeenCalledWith(5, 1, 3, expect.any(String));
        const keys = invalidatedKeys(invalidateSpy);
        expect(keys).toContainEqual(queryKeys.upNext);
        expect(keys).toContainEqual(queryKeys.showsProgress.all);
    });
});
