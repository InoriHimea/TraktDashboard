import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const tmdbMockState = vi.hoisted(() => ({
    getTmdbShow: vi.fn(),
    getTmdbSeason: vi.fn(),
}));
const i18nMockState = vi.hoisted(() => ({
    buildLanguageFallbackChain: vi.fn(() => [] as string[]),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../services/trakt.js", () => ({
    getTraktClient: () => traktMockState.client,
}));

vi.mock("../services/tmdb.js", () => ({
    getTmdbShow: tmdbMockState.getTmdbShow,
    getTmdbSeason: tmdbMockState.getTmdbSeason,
}));

vi.mock("@trakt-dashboard/i18n", () => ({
    buildLanguageFallbackChain: i18nMockState.buildLanguageFallbackChain,
}));

// ---------------------------------------------------------------------------
// DB builder stubs — dispatched by table reference (via `.from(table)` for
// selects, or the table argument passed directly to insert/update/delete),
// since forceSyncShow's call graph (syncSingleShow → upsertShowFromTrakt →
// removeStaleShowMetadata → syncEpisodeProgress → findOrCreateEpisode →
// recalcShowProgress) issues a long, deeply-nested sequence of queries across
// many tables — a single global FIFO would be too fragile to hand-order
// correctly. Only select/insert results are ever consumed by the source, so
// update/delete always resolve trivially.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Queue = Row[][];

class SelectBuilder implements PromiseLike<Row[]> {
    private table: unknown;
    constructor(private queues: Map<unknown, Queue>) {}
    from(t: unknown) {
        this.table = t;
        return this;
    }
    innerJoin() {
        return this;
    }
    leftJoin() {
        return this;
    }
    where() {
        return this;
    }
    orderBy() {
        return this;
    }
    limit() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        const q = this.queues.get(this.table);
        return Promise.resolve(q?.shift() ?? []).then(ok, fail);
    }
}

class InsertBuilder implements PromiseLike<Row[]> {
    constructor(
        private queues: Map<unknown, Queue>,
        private table: unknown,
        private captured: Array<{ table: unknown; values: unknown }>,
    ) {}
    values(v: unknown) {
        this.captured.push({ table: this.table, values: v });
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    onConflictDoNothing() {
        return this;
    }
    returning() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        const q = this.queues.get(this.table);
        return Promise.resolve(q?.shift() ?? []).then(ok, fail);
    }
}

class NoopWriteBuilder implements PromiseLike<Row[]> {
    set() {
        return this;
    }
    where() {
        return this;
    }
    then<T1 = Row[], T2 = never>(
        ok?: ((value: Row[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve([]).then(ok, fail);
    }
}

function createMockDb() {
    const selectQueues = new Map<unknown, Queue>();
    const insertQueues = new Map<unknown, Queue>();
    const captured: Array<{ table: unknown; values: unknown }> = [];
    return {
        __selectQueues: selectQueues,
        __insertQueues: insertQueues,
        __captured: captured,
        select: vi.fn(() => new SelectBuilder(selectQueues)),
        selectDistinct: vi.fn(() => new SelectBuilder(selectQueues)),
        insert: vi.fn((table: unknown) => new InsertBuilder(insertQueues, table, captured)),
        update: vi.fn(() => new NoopWriteBuilder()),
        delete: vi.fn(() => new NoopWriteBuilder()),
    };
}

function queueSelect(db: ReturnType<typeof createMockDb>, table: unknown, rows: Row[]) {
    const q = db.__selectQueues.get(table) ?? [];
    q.push(rows);
    db.__selectQueues.set(table, q);
}

function queueInsert(db: ReturnType<typeof createMockDb>, table: unknown, rows: Row[]) {
    const q = db.__insertQueues.get(table) ?? [];
    q.push(rows);
    db.__insertQueues.set(table, q);
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getShowDetail: vi.fn(),
        getSeasons: vi.fn().mockResolvedValue([]),
        getEpisodes: vi.fn().mockResolvedValue([]),
        getShowProgress: vi.fn().mockResolvedValue({
            aired: 0,
            completed: 0,
            last_watched_at: null,
            reset_at: null,
            seasons: [],
            next_episode: null,
        }),
        ...overrides,
    };
}

function makeTraktShowDetail(overrides: Record<string, unknown> = {}) {
    return {
        title: "Test Show",
        year: 2020,
        overview: "overview",
        status: "Ended",
        first_aired: "2020-01-01",
        network: "HBO",
        genres: ["drama"],
        ids: { trakt: 300, slug: "test-show", tvdb: 1, imdb: "tt1", tmdb: 100 },
        ...overrides,
    };
}

function makeTmdbShow(overrides: Record<string, unknown> = {}) {
    return {
        poster_path: "/p.jpg",
        backdrop_path: "/b.jpg",
        original_language: "en",
        seasons: [{ season_number: 1, poster_path: "/s1.jpg" }],
        translations: { translations: [] },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { forceSyncShow } = await import("../services/sync.js");
const {
    shows: showsTable,
    userSettings: userSettingsTable,
    seasons: seasonsTable,
    episodes: episodesTable,
    watchHistory: watchHistoryTable,
    watchResetCursors: watchResetCursorsTable,
} = await import("@trakt-dashboard/db");

const USER_ID = 7;
const SHOW_ID = 5;

beforeEach(() => {
    dbMockState.db = createMockDb();
    traktMockState.client = createMockTrakt();
    tmdbMockState.getTmdbShow.mockReset().mockResolvedValue(makeTmdbShow());
    tmdbMockState.getTmdbSeason.mockReset().mockResolvedValue({ episodes: [] });
    i18nMockState.buildLanguageFallbackChain.mockReset().mockReturnValue([]);
});

/** Sets up the fixed recalcShowProgress tail-call queries shared by every test
 * that reaches the end of syncSingleShow (aired count, reset cursor, watched
 * ids, last watched, show status, upsert). */
function queueRecalcTail(db: ReturnType<typeof createMockDb>, status = "ended") {
    queueSelect(db, episodesTable, [{ count: 0 }]);
    queueSelect(db, watchResetCursorsTable, []);
    queueSelect(db, watchHistoryTable, []); // selectDistinct watchedIds
    queueSelect(db, watchHistoryTable, []); // lastWatched
    queueSelect(db, showsTable, [{ status }]);
}

describe("forceSyncShow", () => {
    it("throws when the show doesn't exist", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, []);
        dbMockState.db = db;

        await expect(forceSyncShow(USER_ID, SHOW_ID)).rejects.toThrow(
            "Show not found or missing Trakt ID",
        );
    });

    it("throws when the show has no Trakt id", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [{ id: SHOW_ID, tmdbId: 100, traktId: null }]);
        dbMockState.db = db;

        await expect(forceSyncShow(USER_ID, SHOW_ID)).rejects.toThrow(
            "Show not found or missing Trakt ID",
        );
    });

    it("resolves the full happy path: upserts the show, one empty season, and recalculates progress", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [
            { id: SHOW_ID, tmdbId: 100, traktId: 300, title: "Test Show" },
        ]);
        queueSelect(db, userSettingsTable, [{ displayLanguage: null }]);
        queueInsert(db, showsTable, [{ id: SHOW_ID }]);
        queueInsert(db, seasonsTable, [{ id: 10 }]);
        queueRecalcTail(db);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getShowDetail: vi.fn().mockResolvedValue(makeTraktShowDetail()),
            getSeasons: vi.fn().mockResolvedValue([
                {
                    number: 1,
                    episode_count: 0,
                    first_aired: "2020-01-01",
                    overview: null,
                    ids: {},
                },
            ]),
            getEpisodes: vi.fn().mockResolvedValue([]),
        });

        await expect(forceSyncShow(USER_ID, SHOW_ID)).resolves.toBeUndefined();

        const showInsert = db.__captured.find((c) => c.table === showsTable);
        expect(showInsert?.values).toMatchObject({ tmdbId: 100, traktId: 300, title: "Test Show" });
    });

    it("keeps poster/backdrop null when the TMDB base show fetch fails, without throwing", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [
            { id: SHOW_ID, tmdbId: 100, traktId: 300, title: "Test Show" },
        ]);
        queueSelect(db, userSettingsTable, [{ displayLanguage: null }]);
        queueInsert(db, showsTable, [{ id: SHOW_ID }]);
        queueInsert(db, seasonsTable, [{ id: 10 }]);
        queueRecalcTail(db);
        dbMockState.db = db;

        tmdbMockState.getTmdbShow.mockRejectedValue(new Error("tmdb down"));
        traktMockState.client = createMockTrakt({
            getShowDetail: vi.fn().mockResolvedValue(makeTraktShowDetail()),
            getSeasons: vi.fn().mockResolvedValue([
                {
                    number: 1,
                    episode_count: 0,
                    first_aired: "2020-01-01",
                    overview: null,
                    ids: {},
                },
            ]),
        });

        await expect(forceSyncShow(USER_ID, SHOW_ID)).resolves.toBeUndefined();

        const showInsert = db.__captured.find((c) => c.table === showsTable);
        expect(showInsert?.values).toMatchObject({ posterPath: null, backdropPath: null });
    });

    it("skips stale-episode cleanup when a season's Trakt episodes fail to fetch", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [
            { id: SHOW_ID, tmdbId: 100, traktId: 300, title: "Test Show" },
        ]);
        queueSelect(db, userSettingsTable, [{ displayLanguage: null }]);
        queueInsert(db, showsTable, [{ id: SHOW_ID }]);
        queueInsert(db, seasonsTable, [{ id: 10 }]);
        queueRecalcTail(db);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getShowDetail: vi.fn().mockResolvedValue(makeTraktShowDetail()),
            getSeasons: vi.fn().mockResolvedValue([
                {
                    number: 1,
                    episode_count: 5,
                    first_aired: "2020-01-01",
                    overview: null,
                    ids: {},
                },
            ]),
            getEpisodes: vi.fn().mockRejectedValue(new Error("trakt down")),
        });

        await expect(forceSyncShow(USER_ID, SHOW_ID)).resolves.toBeUndefined();

        expect(dbMockState.db).toMatchObject({}); // sanity: didn't throw
        expect((dbMockState.db as ReturnType<typeof createMockDb>).delete).not.toHaveBeenCalled();
    });

    it("localizes the show title/overview when a matching translation exists", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [
            { id: SHOW_ID, tmdbId: 100, traktId: 300, title: "Test Show" },
        ]);
        queueSelect(db, userSettingsTable, [{ displayLanguage: "zh-CN" }]);
        queueInsert(db, showsTable, [{ id: SHOW_ID }]);
        queueInsert(db, seasonsTable, [{ id: 10 }]);
        queueRecalcTail(db);
        dbMockState.db = db;

        i18nMockState.buildLanguageFallbackChain.mockReturnValue(["zh-CN"]);
        tmdbMockState.getTmdbShow.mockResolvedValue(
            makeTmdbShow({
                translations: {
                    translations: [
                        {
                            iso_639_1: "zh",
                            iso_3166_1: "CN",
                            data: { name: "测试剧集", overview: "测试概述" },
                        },
                    ],
                },
            }),
        );
        traktMockState.client = createMockTrakt({
            getShowDetail: vi.fn().mockResolvedValue(makeTraktShowDetail({ title: "Test Show" })),
            getSeasons: vi.fn().mockResolvedValue([
                {
                    number: 1,
                    episode_count: 0,
                    first_aired: "2020-01-01",
                    overview: null,
                    ids: {},
                },
            ]),
        });

        await forceSyncShow(USER_ID, SHOW_ID);

        const showInsert = db.__captured.find((c) => c.table === showsTable);
        expect(showInsert?.values).toMatchObject({
            translatedName: "测试剧集",
            translatedOverview: "测试概述",
        });
    });

    it("records a completed episode from Trakt progress via the watch-history insert", async () => {
        const db = createMockDb();
        queueSelect(db, showsTable, [
            { id: SHOW_ID, tmdbId: 100, traktId: 300, title: "Test Show" },
        ]);
        queueSelect(db, userSettingsTable, [{ displayLanguage: null }]);
        queueInsert(db, showsTable, [{ id: SHOW_ID }]);
        queueInsert(db, seasonsTable, [{ id: 10 }]);
        // findOrCreateEpisode: exact match already exists
        queueSelect(db, episodesTable, [
            { id: 42, showId: SHOW_ID, seasonNumber: 1, episodeNumber: 1 },
        ]);
        // syncEpisodeProgress's duplicate-check for this exact watchedAt — not found
        queueSelect(db, watchHistoryTable, []);
        queueRecalcTail(db);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getShowDetail: vi.fn().mockResolvedValue(makeTraktShowDetail()),
            getSeasons: vi.fn().mockResolvedValue([
                {
                    number: 1,
                    episode_count: 0,
                    first_aired: "2020-01-01",
                    overview: null,
                    ids: {},
                },
            ]),
            getShowProgress: vi.fn().mockResolvedValue({
                aired: 1,
                completed: 1,
                last_watched_at: "2026-01-01T00:00:00.000Z",
                reset_at: null,
                seasons: [
                    {
                        number: 1,
                        title: "Season 1",
                        aired: 1,
                        completed: 1,
                        episodes: [
                            {
                                number: 1,
                                completed: true,
                                last_watched_at: "2026-01-01T00:00:00.000Z",
                            },
                        ],
                    },
                ],
                next_episode: null,
            }),
        });

        await forceSyncShow(USER_ID, SHOW_ID);

        const historyInsert = db.__captured.find((c) => c.table === watchHistoryTable);
        expect(historyInsert?.values).toMatchObject({ userId: USER_ID, episodeId: 42 });
    });
});
