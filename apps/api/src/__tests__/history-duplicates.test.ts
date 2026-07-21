import { describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

// ---------------------------------------------------------------------------
// DB builder stub — findDuplicateHistoryGroups issues up to 4 selects in a
// fixed order: dup episode ids (no join, groupBy/having) -> full episode rows
// (innerJoin) -> dup movie ids (no join, groupBy/having) -> full movie rows
// (innerJoin). Split into two FIFO queues by whether innerJoin was called,
// since call order within each queue always matches issue order.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

class SelectBuilder implements PromiseLike<Row[]> {
    private joined = false;
    constructor(private queues: { plain: Row[][]; joined: Row[][] }) {}
    from() {
        return this;
    }
    innerJoin() {
        this.joined = true;
        return this;
    }
    where() {
        return this;
    }
    groupBy() {
        return this;
    }
    having() {
        return this;
    }
    orderBy() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        const queue = this.joined ? this.queues.joined : this.queues.plain;
        return Promise.resolve(queue.shift() ?? []).then(ok, fail);
    }
}

function createMockDb(opts: { plain?: Row[][]; joined?: Row[][] } = {}) {
    const queues = { plain: [...(opts.plain ?? [])], joined: [...(opts.joined ?? [])] };
    return { select: vi.fn(() => new SelectBuilder(queues)) };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { clusterBursts, findDuplicateHistoryGroups } =
    await import("../services/history-duplicates.js");

function iso(offsetHoursFromEpoch: number): string {
    return new Date(offsetHoursFromEpoch * 60 * 60 * 1000).toISOString();
}

describe("clusterBursts", () => {
    it("returns no bursts for an empty list", () => {
        expect(clusterBursts([], 72)).toEqual([]);
    });

    it("puts a single entry in its own burst", () => {
        const bursts = clusterBursts([{ id: 1, watchedAt: iso(0) }], 72);
        expect(bursts).toEqual([{ entryIds: [1] }]);
    });

    it("chains entries within the window into one burst", () => {
        const entries = [
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(24) },
            { id: 3, watchedAt: iso(48) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([{ entryIds: [1, 2, 3] }]);
    });

    it("splits into separate bursts once a gap exceeds the window", () => {
        const entries = [
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(24) },
            // ~90 days later — a genuine rewatch, not a bug-repeat
            { id: 3, watchedAt: iso(24 + 90 * 24) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([{ entryIds: [1, 2] }, { entryIds: [3] }]);
    });

    it("does not let a distant rewatch suppress detection of a nearby duplicate (chain, not whole-span)", () => {
        // Five ~daily duplicates (the root-cause-1 bug pattern), then one genuine
        // rewatch far later. A whole-group-span check would see the huge total
        // span and never flag the daily block; chained clustering isolates it.
        const entries = [
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(24) },
            { id: 3, watchedAt: iso(48) },
            { id: 4, watchedAt: iso(72) },
            { id: 5, watchedAt: iso(96) },
            { id: 6, watchedAt: iso(96 + 200 * 24) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([
            { entryIds: [1, 2, 3, 4, 5] },
            { entryIds: [6] },
        ]);
    });

    it("merges a gap exactly equal to the window", () => {
        const entries = [
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(72) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([{ entryIds: [1, 2] }]);
    });

    it("does not merge a gap one hour over the window", () => {
        const entries = [
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(73) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([{ entryIds: [1] }, { entryIds: [2] }]);
    });

    it("sorts unsorted input before clustering", () => {
        const entries = [
            { id: 3, watchedAt: iso(48) },
            { id: 1, watchedAt: iso(0) },
            { id: 2, watchedAt: iso(24) },
        ];
        expect(clusterBursts(entries, 72)).toEqual([{ entryIds: [1, 2, 3] }]);
    });
});

describe("findDuplicateHistoryGroups", () => {
    it("returns an empty array when there are no duplicate episode or movie ids", async () => {
        dbMockState.db = createMockDb({ plain: [[], []] });
        const groups = await findDuplicateHistoryGroups(TEST_USER_ID, 72);
        expect(groups).toEqual([]);
    });

    it("returns an enriched episode group with gap and suggested flags", async () => {
        dbMockState.db = createMockDb({
            plain: [
                [{ episodeId: 10 }], // dup episode ids
                [], // dup movie ids
            ],
            joined: [
                [
                    {
                        id: 100,
                        episodeId: 10,
                        watchedAt: new Date(iso(0)),
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: "测试剧集",
                        seasonNumber: 3,
                        episodeNumber: 67,
                        episodeTitle: "Some Episode",
                        episodeTranslatedTitle: "某一集",
                        runtime: 24,
                    },
                    {
                        id: 101,
                        episodeId: 10,
                        watchedAt: new Date(iso(24)),
                        showId: 5,
                        showTitle: "Test Show",
                        showTranslatedName: "测试剧集",
                        seasonNumber: 3,
                        episodeNumber: 67,
                        episodeTitle: "Some Episode",
                        episodeTranslatedTitle: "某一集",
                        runtime: 24,
                    },
                ], // full episode rows
            ],
        });

        const groups = await findDuplicateHistoryGroups(TEST_USER_ID, 72);
        expect(groups).toEqual([
            {
                mediaType: "episode",
                showId: 5,
                showTitle: "Test Show",
                showTranslatedName: "测试剧集",
                seasonNumber: 3,
                episodeNumber: 67,
                episodeTitle: "Some Episode",
                episodeTranslatedTitle: "某一集",
                movieId: null,
                movieTitle: null,
                runtime: 24,
                entries: [
                    { id: 100, watchedAt: iso(0), gapFromPreviousHours: null, suggested: false },
                    { id: 101, watchedAt: iso(24), gapFromPreviousHours: 24, suggested: true },
                ],
            },
        ]);
    });

    it("returns an enriched movie group", async () => {
        dbMockState.db = createMockDb({
            plain: [
                [], // dup episode ids
                [{ movieId: 20 }], // dup movie ids
            ],
            joined: [
                [
                    {
                        id: 200,
                        movieId: 20,
                        watchedAt: new Date(iso(0)),
                        movieTitle: "Some Movie",
                        runtime: 100,
                    },
                    {
                        id: 201,
                        movieId: 20,
                        watchedAt: new Date(iso(1)),
                        movieTitle: "Some Movie",
                        runtime: 100,
                    },
                ], // full movie rows
            ],
        });

        const groups = await findDuplicateHistoryGroups(TEST_USER_ID, 72);
        expect(groups).toEqual([
            {
                mediaType: "movie",
                showId: null,
                showTitle: null,
                showTranslatedName: null,
                seasonNumber: null,
                episodeNumber: null,
                episodeTitle: null,
                episodeTranslatedTitle: null,
                movieId: 20,
                movieTitle: "Some Movie",
                runtime: 100,
                entries: [
                    { id: 200, watchedAt: iso(0), gapFromPreviousHours: null, suggested: false },
                    { id: 201, watchedAt: iso(1), gapFromPreviousHours: 1, suggested: true },
                ],
            },
        ]);
    });

    it("does not flag a genuine rewatch far outside the window as suggested", async () => {
        dbMockState.db = createMockDb({
            plain: [[{ episodeId: 10 }], []],
            joined: [
                [
                    {
                        id: 100,
                        episodeId: 10,
                        watchedAt: new Date(iso(0)),
                        showId: 5,
                        showTitle: "Test Show",
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: "Pilot",
                    },
                    {
                        id: 101,
                        episodeId: 10,
                        watchedAt: new Date(iso(365 * 24)),
                        showId: 5,
                        showTitle: "Test Show",
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: "Pilot",
                    },
                ],
            ],
        });

        const [group] = await findDuplicateHistoryGroups(TEST_USER_ID, 72);
        expect(group.entries.map((e) => e.suggested)).toEqual([false, false]);
    });
});
