import { beforeEach, describe, expect, it, vi } from "vitest";

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
    where() {
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
const airingEp = { title: "Pilot", seasonNumber: 1, episodeNumber: 3, showTitle: "Test Show" };

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
        dbMockState.db = createMockDb([[sub], [airingEp]]);
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
        dbMockState.db = createMockDb([[sub], []]);
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 0 });
        expect(pushMock.send).not.toHaveBeenCalled();
    });

    it("prunes dead subscriptions on 410 Gone", async () => {
        dbMockState.db = createMockDb([[sub], [airingEp]]);
        pushMock.send.mockResolvedValue({ ok: false, statusCode: 410 });
        const result = await runAiringReminders();
        expect(result).toEqual({ sent: 0, pruned: 1 });
        expect(dbMockState.db.state.deleted).toBe(1);
    });
});
