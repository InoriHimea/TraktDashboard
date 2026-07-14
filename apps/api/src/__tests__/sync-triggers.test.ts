import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const traktMockState = vi.hoisted(() => ({ client: null as unknown }));
const tmdbMockState = vi.hoisted(() => ({ getTmdbMovie: vi.fn() }));
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
    getTmdbMovie: tmdbMockState.getTmdbMovie,
}));

vi.mock("@trakt-dashboard/i18n", () => ({
    buildLanguageFallbackChain: i18nMockState.buildLanguageFallbackChain,
}));

// ---------------------------------------------------------------------------
// DB builder stubs — table-reference-dispatched (as in sync-force.test.ts),
// since triggerFullSync/triggerIncrementalSync call the same shared, same-
// module private helpers (upsertShowFromTrakt, syncSingleShow, syncMovies,
// syncWatchlist, syncRatings, syncUserCollection) that a spy/mock cannot
// intercept. Every test below keeps those helpers on their shortest possible
// path (empty Trakt collections, or an immediate "missing id" throw before
// any DB access) so the tests stay focused on triggerFullSync/
// triggerIncrementalSync's OWN orchestration — the shared per-show sync
// logic itself is already covered by sync-force.test.ts (forceSyncShow).
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
    where() {
        return this;
    }
    orderBy() {
        return this;
    }
    limit() {
        return this;
    }
    offset() {
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
    ) {}
    values() {
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

class UpdateBuilder implements PromiseLike<Row[]> {
    constructor(
        private queues: Map<unknown, Queue>,
        private table: unknown,
        private captured: Array<{ table: unknown; set: unknown }>,
    ) {}
    set(v: unknown) {
        this.captured.push({ table: this.table, set: v });
        return this;
    }
    where() {
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
    const updateQueues = new Map<unknown, Queue>();
    const updatesCaptured: Array<{ table: unknown; set: unknown }> = [];
    return {
        __selectQueues: selectQueues,
        __insertQueues: insertQueues,
        __updateQueues: updateQueues,
        __updatesCaptured: updatesCaptured,
        select: vi.fn(() => new SelectBuilder(selectQueues)),
        selectDistinct: vi.fn(() => new SelectBuilder(selectQueues)),
        insert: vi.fn((table: unknown) => new InsertBuilder(insertQueues, table)),
        update: vi.fn((table: unknown) => new UpdateBuilder(updateQueues, table, updatesCaptured)),
        delete: vi.fn(() => new NoopWriteBuilder()),
    };
}

function queueSelect(db: ReturnType<typeof createMockDb>, table: unknown, rows: Row[]) {
    const q = db.__selectQueues.get(table) ?? [];
    q.push(rows);
    db.__selectQueues.set(table, q);
}

function queueUpdate(db: ReturnType<typeof createMockDb>, table: unknown, rows: Row[]) {
    const q = db.__updateQueues.get(table) ?? [];
    q.push(rows);
    db.__updateQueues.set(table, q);
}

function createMockTrakt(overrides: Record<string, unknown> = {}) {
    return {
        getWatchedShows: vi.fn().mockResolvedValue([]),
        getWatchedMovies: vi.fn().mockResolvedValue([]),
        getMovieHistory: vi.fn().mockResolvedValue([]),
        getWatchlistShows: vi.fn().mockResolvedValue([]),
        getWatchlistMovies: vi.fn().mockResolvedValue([]),
        getRatingsShows: vi.fn().mockResolvedValue([]),
        getRatingsMovies: vi.fn().mockResolvedValue([]),
        getCollectionShows: vi.fn().mockResolvedValue([]),
        getCollectionMovies: vi.fn().mockResolvedValue([]),
        getHistory: vi.fn().mockResolvedValue([]),
        getShowDetail: vi.fn(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { triggerFullSync, triggerIncrementalSync } = await import("../services/sync.js");
const {
    syncState: syncStateTable,
    userSettings: userSettingsTable,
    watchHistory: watchHistoryTable,
} = await import("@trakt-dashboard/db");

const USER_ID = 7;

beforeEach(() => {
    dbMockState.db = createMockDb();
    traktMockState.client = createMockTrakt();
    tmdbMockState.getTmdbMovie.mockReset();
    i18nMockState.buildLanguageFallbackChain.mockReset().mockReturnValue([]);
});

/** syncMovies (called by triggerFullSync directly, with all-empty Trakt
 * collections) issues exactly these two selects regardless of userId. */
function queueTrivialSyncMoviesSelects(db: ReturnType<typeof createMockDb>) {
    queueSelect(db, userSettingsTable, [{ displayLanguage: null }]);
    queueSelect(db, watchHistoryTable, []);
}

describe("triggerFullSync", () => {
    it("returns early without fetching anything when a sync is already running", async () => {
        const db = createMockDb();
        queueUpdate(db, syncStateTable, []); // markSyncRunning gate: not acquired
        dbMockState.db = db;

        await triggerFullSync(USER_ID);

        expect(traktMockState.client).toBeDefined();
        expect(
            (traktMockState.client as { getWatchedShows: ReturnType<typeof vi.fn> })
                .getWatchedShows,
        ).not.toHaveBeenCalled();
    });

    it("happy path: no watched shows, syncs sub-collections trivially, marks completed", async () => {
        const db = createMockDb();
        queueUpdate(db, syncStateTable, [{ id: 1 }]); // acquired
        queueTrivialSyncMoviesSelects(db);
        dbMockState.db = db;

        await expect(triggerFullSync(USER_ID)).resolves.toBeUndefined();

        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({ status: "completed" });
    });

    it("counts a show with no TMDB id as failed in the main loop without ever calling syncSingleShow there", async () => {
        const db = createMockDb();
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        queueTrivialSyncMoviesSelects(db);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getWatchedShows: vi.fn().mockResolvedValue([
                {
                    show: { title: "No TMDB", ids: {} },
                    plays: 1,
                    last_watched_at: "",
                    last_updated_at: "",
                    seasons: [],
                },
            ]),
        });

        await triggerFullSync(USER_ID);

        // The main loop short-circuits on the missing tmdbId (never calling
        // syncSingleShow), but the retry pass has no such guard — it retries
        // every failed entry unconditionally, so the final recorded error
        // ends up being syncSingleShow's own "Missing Trakt id" guard
        // (this show also has no traktId) rather than the original
        // "Missing TMDB id", with retryCount bumped to 1.
        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({
            failedShows: [
                { tmdbId: 0, title: "No TMDB", error: "Missing Trakt id", retryCount: 1 },
            ],
        });
    });

    it("retries a failed show once and records retryCount when it fails again", async () => {
        const db = createMockDb();
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        queueTrivialSyncMoviesSelects(db);
        dbMockState.db = db;

        // tmdbId present (not short-circuited) but no traktId — syncSingleShow
        // throws "Missing Trakt id" immediately, before any DB/Trakt access,
        // on both the initial attempt and the retry.
        traktMockState.client = createMockTrakt({
            getWatchedShows: vi.fn().mockResolvedValue([
                {
                    show: { title: "No Trakt Id", ids: { tmdb: 500 } },
                    plays: 1,
                    last_watched_at: "",
                    last_updated_at: "",
                    seasons: [],
                },
            ]),
        });

        await triggerFullSync(USER_ID);

        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({
            failedShows: [
                {
                    tmdbId: 500,
                    title: "No Trakt Id",
                    error: "Missing Trakt id",
                    retryCount: 1,
                },
            ],
        });
    });

    it("sets status to error and re-throws when fetching watched shows fails", async () => {
        const db = createMockDb();
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getWatchedShows: vi.fn().mockRejectedValue(new Error("trakt down")),
        });

        await expect(triggerFullSync(USER_ID)).rejects.toThrow("trakt down");

        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({ status: "error", error: "trakt down" });
    });
});

describe("triggerIncrementalSync", () => {
    it("returns early without fetching history when a sync is already running", async () => {
        const db = createMockDb();
        queueSelect(db, syncStateTable, []); // getSyncStatus
        queueUpdate(db, syncStateTable, []); // markSyncRunning gate: not acquired
        dbMockState.db = db;

        await triggerIncrementalSync(USER_ID);

        expect(
            (traktMockState.client as { getHistory: ReturnType<typeof vi.fn> }).getHistory,
        ).not.toHaveBeenCalled();
    });

    it("happy path: empty history, advances the cursor to now", async () => {
        const db = createMockDb();
        queueSelect(db, syncStateTable, []); // getSyncStatus — no prior state
        queueUpdate(db, syncStateTable, [{ id: 1 }]); // acquired
        dbMockState.db = db;

        const before = Date.now();
        await expect(triggerIncrementalSync(USER_ID)).resolves.toBeUndefined();

        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({ status: "completed" });
        const set = finalUpdate?.set as { lastSyncAt: Date };
        expect(set.lastSyncAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("skips episode entries missing a Trakt show id without counting them as failed", async () => {
        const db = createMockDb();
        queueSelect(db, syncStateTable, []);
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getHistory: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    watched_at: "2026-01-01T00:00:00.000Z",
                    action: "watch",
                    type: "episode",
                    show: { title: "X", year: 2020, ids: { tmdb: 100 } },
                    episode: { season: 1, number: 1, title: "Pilot", ids: {} },
                },
            ]),
        });

        await triggerIncrementalSync(USER_ID);

        const finalUpdate = db.__updatesCaptured.at(-1);
        // No show ever had a resolvable traktId, so nothing failed and the
        // cursor still advances to "now" rather than rolling back.
        const set = finalUpdate?.set as { status: string; lastSyncAt: Date };
        expect(set.status).toBe("completed");
    });

    it("rolls the cursor back to just before the earliest failed entry", async () => {
        const db = createMockDb();
        queueSelect(db, syncStateTable, []);
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        dbMockState.db = db;

        const watchedAt = "2026-01-01T00:00:00.000Z";
        traktMockState.client = createMockTrakt({
            getHistory: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    watched_at: watchedAt,
                    action: "watch",
                    type: "episode",
                    show: { title: "X", year: 2020, ids: { tmdb: 100, trakt: 300 } },
                    episode: { season: 1, number: 1, title: "Pilot", ids: {} },
                },
            ]),
            // upsertShowFromTrakt's very first Trakt call — rejecting here
            // makes the per-show closure's catch block fire without needing
            // any deeper DB mocking.
            getShowDetail: vi.fn().mockRejectedValue(new Error("trakt down")),
        });

        await triggerIncrementalSync(USER_ID);

        const finalUpdate = db.__updatesCaptured.at(-1);
        const set = finalUpdate?.set as { status: string; lastSyncAt: Date };
        expect(set.status).toBe("completed");
        expect(set.lastSyncAt.getTime()).toBe(new Date(watchedAt).getTime() - 1000);
    });

    it("sets status to error when the Trakt history fetch fails", async () => {
        const db = createMockDb();
        queueSelect(db, syncStateTable, []);
        queueUpdate(db, syncStateTable, [{ id: 1 }]);
        dbMockState.db = db;

        traktMockState.client = createMockTrakt({
            getHistory: vi.fn().mockRejectedValue(new Error("trakt down")),
        });

        await expect(triggerIncrementalSync(USER_ID)).resolves.toBeUndefined();

        const finalUpdate = db.__updatesCaptured.at(-1);
        expect(finalUpdate?.set).toMatchObject({ status: "error", error: "trakt down" });
    });
});
