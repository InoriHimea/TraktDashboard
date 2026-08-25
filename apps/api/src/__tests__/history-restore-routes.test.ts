import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks — the routes delegate entirely to services/history-restore.js,
// so there's no need to mock the db/trakt client here (see history-restore.test.ts
// for that layer).
// ---------------------------------------------------------------------------

const restoreMockState = vi.hoisted(() => ({
    findRestorableHistoryEntries: vi.fn().mockResolvedValue([]),
    restoreHistoryEntries: vi.fn().mockResolvedValue({
        ok: true,
        restored: 0,
        unconfirmed: 0,
        failed: 0,
    }),
}));

vi.mock("../services/history-restore.js", () => ({
    findRestorableHistoryEntries: restoreMockState.findRestorableHistoryEntries,
    restoreHistoryEntries: restoreMockState.restoreHistoryEntries,
}));

// history.ts also imports these — stub them out so the module loads cleanly.
vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => ({}) };
});
vi.mock("../services/trakt.js", () => ({ getTraktClient: () => ({}) }));
vi.mock("../services/sync.js", () => ({
    recalcShowProgress: vi.fn(),
    recalcMovieProgress: vi.fn(),
}));
vi.mock("../services/history-duplicates.js", () => ({
    findDuplicateHistoryGroups: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { historyRoutes } = await import("../routes/history.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/history", historyRoutes);
    return a;
}

function postRestore(ids: unknown) {
    return app().request("/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    restoreMockState.findRestorableHistoryEntries.mockResolvedValue([]);
    restoreMockState.restoreHistoryEntries.mockResolvedValue({
        ok: true,
        restored: 0,
        unconfirmed: 0,
        failed: 0,
    });
});

describe("GET /history/restorable", () => {
    it("defaults includeManual to false and wraps the service result", async () => {
        const entries = [{ id: 1, mediaType: "episode" }];
        restoreMockState.findRestorableHistoryEntries.mockResolvedValue(entries);

        const res = await app().request("/history/restorable");
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(restoreMockState.findRestorableHistoryEntries).toHaveBeenCalledWith(
            TEST_USER_ID,
            false,
        );
        expect(body).toEqual({ ok: true, data: { entries } });
    });

    it("passes includeManual=true through when requested", async () => {
        await app().request("/history/restorable?includeManual=true");
        expect(restoreMockState.findRestorableHistoryEntries).toHaveBeenCalledWith(
            TEST_USER_ID,
            true,
        );
    });

    it("treats any value other than the literal string 'true' as false", async () => {
        await app().request("/history/restorable?includeManual=1");
        expect(restoreMockState.findRestorableHistoryEntries).toHaveBeenCalledWith(
            TEST_USER_ID,
            false,
        );
    });
});

describe("POST /history/restore", () => {
    it("rejects invalid JSON", async () => {
        const res = await app().request("/history/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        });
        expect(res.status).toBe(400);
        expect(restoreMockState.restoreHistoryEntries).not.toHaveBeenCalled();
    });

    it("rejects a body with no valid ids", async () => {
        const res = await postRestore("not-an-array");
        expect(res.status).toBe(400);
        expect(restoreMockState.restoreHistoryEntries).not.toHaveBeenCalled();
    });

    it("filters non-integer entries out of the ids array before calling the service", async () => {
        await postRestore([1, "two", 3.5, 4]);
        expect(restoreMockState.restoreHistoryEntries).toHaveBeenCalledWith(TEST_USER_ID, [1, 4]);
    });

    it("returns the service result as-is", async () => {
        restoreMockState.restoreHistoryEntries.mockResolvedValue({
            ok: true,
            restored: 2,
            unconfirmed: 1,
            failed: 0,
        });

        const res = await postRestore([1, 2, 3]);
        const body = await res.json();

        expect(restoreMockState.restoreHistoryEntries).toHaveBeenCalledWith(
            TEST_USER_ID,
            [1, 2, 3],
        );
        expect(body).toEqual({ ok: true, restored: 2, unconfirmed: 1, failed: 0 });
    });
});
