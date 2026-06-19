import { beforeEach, describe, expect, it, vi } from "vitest";
import dayjs from "dayjs";

const dbMockState = vi.hoisted(() => ({ db: null as any }));
const pushMock = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../../lib/push.js", () => ({
    sendPush: pushMock.send,
}));

class SelectBuilder {
    constructor(private result: unknown[]) {}
    from() {
        return this;
    }
    innerJoin() {
        return this;
    }
    leftJoin() {
        return this;
    }
    where() {
        // Apply date-range filtering on items with an airDate field (episode queries).
        // Items without airDate (e.g. subscription rows) pass through untouched.
        const today = dayjs().format("YYYY-MM-DD");
        const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
        this.result = (this.result as any[]).filter((item) => {
            if (!("airDate" in item) || item.airDate == null) return true;
            return item.airDate >= today && item.airDate < tomorrow;
        });
        return this;
    }
    orderBy() {
        return this;
    }
    then<T1, T2 = never>(
        ok?: ((v: unknown[]) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

function createMockDb(results: unknown[][]) {
    const state = { results: [...results], deleted: 0 };
    return {
        state,
        select: () => new SelectBuilder(state.results.shift() ?? []),
        delete: () => ({
            where: () => {
                state.deleted++;
                return Promise.resolve();
            },
        }),
    };
}

const { runAiringReminders } = await import("../airing-reminders.js");

const sub = { id: 1, userId: 7, endpoint: "https://push/x", p256dh: "p", auth: "a" };
const airingEp = {
    title: "Pilot",
    seasonNumber: 1,
    episodeNumber: 3,
    showTitle: "Test Show",
    airDate: dayjs().toISOString(), // today — matches the gte/lt range in production code
    seasonEpisodeCount: null,
};
// Settings row returned for the notificationEventTypes lookup (null = all types enabled)
const settingsRow = { notificationEventTypes: null };
const staleEp = { ...airingEp, airDate: dayjs().subtract(1, "day").toISOString() };

beforeEach(() => {
    pushMock.send.mockReset();
});

describe("runAiringReminders", () => {
    it("no-ops when there are no subscriptions", async () => {
        dbMockState.db = createMockDb([[]]);
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 0 });
        expect(pushMock.send).not.toHaveBeenCalled();
    });

    it("sends one push per subscription with airing episodes", async () => {
        // Query order: [userId probe] → [settingsRow] → [airing episodes] → [user subs for send]
        dbMockState.db = createMockDb([[sub], [settingsRow], [airingEp], [sub]]);
        pushMock.send.mockResolvedValue({ ok: true });
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 1, pruned: 0 });
        expect(pushMock.send).toHaveBeenCalledTimes(1);
        expect(pushMock.send.mock.calls[0][1]).toMatchObject({
            title: "Test Show",
            url: "/calendar",
        });
    });

    it("skips users with no episodes airing today", async () => {
        // userId probe returns sub, settings row, episodes query returns empty — no send query.
        dbMockState.db = createMockDb([[sub], [settingsRow], []]);
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 0 });
        expect(pushMock.send).not.toHaveBeenCalled();
    });

    it("prunes dead subscriptions on 410 Gone", async () => {
        dbMockState.db = createMockDb([[sub], [settingsRow], [airingEp], [sub]]);
        pushMock.send.mockResolvedValue({ ok: false, statusCode: 410 });
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 1 });
        expect(dbMockState.db.state.deleted).toBe(1);
    });

    it("skips episodes airing on a different date", async () => {
        // staleEp.airDate is yesterday — the gte/lt range filter should exclude it.
        dbMockState.db = createMockDb([[sub], [settingsRow], [staleEp]]);
        pushMock.send.mockResolvedValue({ ok: true });
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 0 });
        expect(pushMock.send).not.toHaveBeenCalled();
    });

    it("does not push for episodes already watched today", async () => {
        // DB returns [] because NOT EXISTS (watch_history) filtered out watched episodes.
        dbMockState.db = createMockDb([[sub], [settingsRow], []]);
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 0 });
        expect(pushMock.send).not.toHaveBeenCalled();
    });
});
