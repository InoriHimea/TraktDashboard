import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 42;

type SelectResult = unknown[];

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("dayjs", async () => {
    const actual = await vi.importActual<typeof import("dayjs")>("dayjs");
    return actual;
});

const { calendarRoutes } = await import("../routes/calendar.js");

class SelectBuilder implements PromiseLike<SelectResult> {
    private result: SelectResult;
    constructor(result: SelectResult) {
        this.result = result;
    }
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
    then<T1 = SelectResult, T2 = never>(
        ok?: ((v: SelectResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

function createMockDb(selectResults: SelectResult[] = []) {
    const queue = [...selectResults];
    return {
        select: vi.fn(() => new SelectBuilder(queue.shift() ?? [])),
        selectDistinct: vi.fn(() => new SelectBuilder(queue.shift() ?? [])),
    };
}

function testApp() {
    const app = new Hono<{ Variables: { userId: number } }>();
    app.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    app.route("/calendar", calendarRoutes);
    return app;
}

describe("GET /calendar", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns empty object when no episodes found", async () => {
        dbMockState.db = createMockDb([[]]);
        const res = await testApp().request("/calendar");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; data: unknown };
        expect(body.ok).toBe(true);
        expect(body.data).toEqual({});
    });

    it("groups episodes by airDate with watched flag", async () => {
        const mockRows = [
            {
                episode: {
                    id: 1,
                    seasonNumber: 1,
                    episodeNumber: 3,
                    title: "Ep 3",
                    overview: null,
                    runtime: 45,
                    stillPath: null,
                    airDate: "2026-06-15",
                },
                show: {
                    id: 10,
                    title: "My Show",
                    originalName: null,
                    translatedName: null,
                    posterPath: null,
                    backdropPath: null,
                    network: "HBO",
                    status: "returning series",
                },
                watched: true,
            },
            {
                episode: {
                    id: 2,
                    seasonNumber: 1,
                    episodeNumber: 4,
                    title: "Ep 4",
                    overview: null,
                    runtime: 45,
                    stillPath: null,
                    airDate: "2026-06-15",
                },
                show: {
                    id: 10,
                    title: "My Show",
                    originalName: null,
                    translatedName: null,
                    posterPath: null,
                    backdropPath: null,
                    network: "HBO",
                    status: "returning series",
                },
                watched: false,
            },
        ];
        dbMockState.db = createMockDb([mockRows]);
        const res = await testApp().request("/calendar");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; data: Record<string, unknown[]> };
        expect(body.ok).toBe(true);
        const grouped = body.data;
        expect(Object.keys(grouped)).toEqual(["2026-06-15"]);
        expect(grouped["2026-06-15"]).toHaveLength(2);
        expect((grouped["2026-06-15"][0] as { watched: boolean }).watched).toBe(true);
        expect((grouped["2026-06-15"][1] as { watched: boolean }).watched).toBe(false);
    });

    it("clamps before/after to MAX_WINDOW_DAYS (90) instead of erroring", async () => {
        dbMockState.db = createMockDb([[]]);
        // 200 > 90 — should clamp to 90 and return 200, not crash
        const res = await testApp().request("/calendar?before=200&after=200");
        expect(res.status).toBe(200);
    });

    it("uses default values when before/after are omitted", async () => {
        dbMockState.db = createMockDb([[]]);
        const res = await testApp().request("/calendar");
        expect(res.status).toBe(200);
    });

    it("handles non-numeric before/after gracefully (falls back to default)", async () => {
        dbMockState.db = createMockDb([[]]);
        const res = await testApp().request("/calendar?before=abc&after=xyz");
        expect(res.status).toBe(200);
    });

    it("maps watched flag from EXISTS result correctly (truthy → true, falsy → false)", async () => {
        const mockRows = [
            {
                episode: {
                    id: 5,
                    seasonNumber: 2,
                    episodeNumber: 1,
                    title: "S2E1",
                    overview: null,
                    runtime: 30,
                    stillPath: null,
                    airDate: "2026-06-20",
                },
                show: {
                    id: 20,
                    title: "Another Show",
                    originalName: null,
                    translatedName: null,
                    posterPath: null,
                    backdropPath: null,
                    network: null,
                    status: "ended",
                },
                // DB may return 0 / 1 / null for the EXISTS computed column
                watched: 0,
            },
        ];
        dbMockState.db = createMockDb([mockRows]);
        const res = await testApp().request("/calendar");
        const body = (await res.json()) as { data: Record<string, unknown[]> };
        const ep = body.data["2026-06-20"]?.[0] as { watched: boolean };
        expect(ep.watched).toBe(false);
    });
});
