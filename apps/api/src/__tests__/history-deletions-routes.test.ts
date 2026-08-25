import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

// ---------------------------------------------------------------------------
// Hoisted mocks — the routes delegate entirely to services/history-audit.js.
// ---------------------------------------------------------------------------

const auditMockState = vi.hoisted(() => ({
    findPendingDeletions: vi.fn().mockResolvedValue([]),
    restoreFromDeletions: vi.fn().mockResolvedValue({ ok: true, restored: 0 }),
}));

vi.mock("../services/history-audit.js", () => ({
    findPendingDeletions: auditMockState.findPendingDeletions,
    restoreFromDeletions: auditMockState.restoreFromDeletions,
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
vi.mock("../services/history-restore.js", () => ({
    findRestorableHistoryEntries: vi.fn().mockResolvedValue([]),
    restoreHistoryEntries: vi.fn().mockResolvedValue({
        ok: true,
        restored: 0,
        unconfirmed: 0,
        failed: 0,
    }),
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

function postDeletionsRestore(ids: unknown) {
    return app().request("/history/deletions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    auditMockState.findPendingDeletions.mockResolvedValue([]);
    auditMockState.restoreFromDeletions.mockResolvedValue({ ok: true, restored: 0 });
});

describe("GET /history/deletions", () => {
    it("wraps the service result", async () => {
        const entries = [{ id: 1, mediaType: "episode" }];
        auditMockState.findPendingDeletions.mockResolvedValue(entries);

        const res = await app().request("/history/deletions");
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(auditMockState.findPendingDeletions).toHaveBeenCalledWith(TEST_USER_ID);
        expect(body).toEqual({ ok: true, data: { entries } });
    });
});

describe("POST /history/deletions/restore", () => {
    it("rejects invalid JSON", async () => {
        const res = await app().request("/history/deletions/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        });
        expect(res.status).toBe(400);
        expect(auditMockState.restoreFromDeletions).not.toHaveBeenCalled();
    });

    it("rejects a body with no valid ids", async () => {
        const res = await postDeletionsRestore("not-an-array");
        expect(res.status).toBe(400);
        expect(auditMockState.restoreFromDeletions).not.toHaveBeenCalled();
    });

    it("filters non-integer entries out of the ids array before calling the service", async () => {
        await postDeletionsRestore([1, "two", 3.5, 4]);
        expect(auditMockState.restoreFromDeletions).toHaveBeenCalledWith(TEST_USER_ID, [1, 4]);
    });

    it("returns the service result as-is", async () => {
        auditMockState.restoreFromDeletions.mockResolvedValue({ ok: true, restored: 2 });

        const res = await postDeletionsRestore([1, 2]);
        const body = await res.json();

        expect(auditMockState.restoreFromDeletions).toHaveBeenCalledWith(TEST_USER_ID, [1, 2]);
        expect(body).toEqual({ ok: true, restored: 2 });
    });
});
