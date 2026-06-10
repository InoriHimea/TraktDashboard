import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 42;

const dbMock = vi.hoisted(() => ({
    db: null as any,
}));

const redisMock = vi.hoisted(() => ({
    redis: null as any,
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual = await vi.importActual<typeof import("@trakt-dashboard/db")>(
        "@trakt-dashboard/db",
    );
    return {
        ...actual,
        getDb: () => dbMock.db,
    };
});

vi.mock("../jobs/scheduler.js", () => ({
    getRedis: () => redisMock.redis,
}));

type UserRow = {
    id: number;
    traktAccessToken: string;
    traktRefreshToken: string;
    tokenExpiresAt: Date;
};

class SelectBuilder implements PromiseLike<unknown[]> {
    constructor(private readonly result: unknown[]) {}

    from() {
        return this;
    }

    where() {
        return this;
    }

    then<TResult1 = unknown[], TResult2 = never>(
        onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
}

class UpdateBuilder {
    constructor(private readonly result: unknown[]) {}

    set() {
        return this;
    }

    where() {
        return this;
    }

    returning() {
        return Promise.resolve(this.result);
    }
}

function makeDb(selectResults: unknown[][], updateResults: unknown[][] = [[{}]]) {
    return {
        select: vi.fn(() => new SelectBuilder(selectResults.shift() ?? [])),
        update: vi.fn(() => new UpdateBuilder(updateResults.shift() ?? [])),
    };
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
    return {
        id: TEST_USER_ID,
        traktAccessToken: "access-old",
        traktRefreshToken: "refresh-old",
        tokenExpiresAt: new Date(Date.now() - 60_000),
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
    return new Response(JSON.stringify(body), { status, headers });
}

async function loadClient() {
    vi.resetModules();
    const mod = await import("../services/trakt.js");
    return mod.getTraktClient();
}

beforeEach(() => {
    process.env.TRAKT_CLIENT_ID = "client-id";
    process.env.TRAKT_CLIENT_SECRET = "client-secret";
    process.env.TRAKT_REDIRECT_URI = "http://localhost/callback";
    redisMock.redis = {
        set: vi.fn(),
        eval: vi.fn(),
    };
    vi.restoreAllMocks();
});

describe("Trakt token refresh", () => {
    it("refreshes an expired token once and releases only the owned Redis lock", async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000);
        dbMock.db = makeDb(
            [
                [makeUser()],
                [makeUser()],
            ],
            [[{ traktAccessToken: "access-new" }]],
        );
        redisMock.redis.set.mockResolvedValue("OK");
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, {
                        access_token: "access-new",
                        refresh_token: "refresh-new",
                        expires_in: 3600,
                    }),
                )
                .mockResolvedValueOnce(jsonResponse(200, [])),
        );

        const client = await loadClient();
        await client.getWatchedMovies(TEST_USER_ID);

        expect(redisMock.redis.set).toHaveBeenCalledWith(
            "lock:token-refresh:42",
            expect.any(String),
            "PX",
            45_000,
            "NX",
        );
        expect(redisMock.redis.eval).toHaveBeenCalledWith(
            expect.stringContaining("redis.call('get', KEYS[1])"),
            1,
            "lock:token-refresh:42",
            expect.any(String),
        );
        expect(dbMock.db.update).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenLastCalledWith(
            expect.stringContaining("/sync/watched/movies"),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer access-new" }),
            }),
        );
        expect(future.getTime()).toBeGreaterThan(Date.now());
    });

    it("re-reads the DB while waiting and uses a fresh token without refreshing", async () => {
        vi.useFakeTimers();
        dbMock.db = makeDb([
            [makeUser()],
            [
                makeUser({
                    traktAccessToken: "access-fresh",
                    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
                }),
            ],
        ]);
        redisMock.redis.set.mockResolvedValue(null);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [])));

        const client = await loadClient();
        const promise = client.getWatchedMovies(TEST_USER_ID);
        await vi.advanceTimersByTimeAsync(300);
        await promise;

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("/sync/watched/movies"),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer access-fresh" }),
            }),
        );
        vi.useRealTimers();
    });

    it("surfaces refresh failures as TraktApiError with status and body", async () => {
        dbMock.db = makeDb([[makeUser()], [makeUser()]]);
        redisMock.redis.set.mockResolvedValue("OK");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("server down", { status: 503 })),
        );

        const client = await loadClient();
        await expect(client.getWatchedMovies(TEST_USER_ID)).rejects.toMatchObject({
            name: "TraktApiError",
            status: 503,
            body: "server down",
        });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("re-reads after a lost DB update race and uses the fresher token", async () => {
        dbMock.db = makeDb(
            [
                [makeUser()],
                [makeUser()],
                [
                    makeUser({
                        traktAccessToken: "access-raced",
                        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
                    }),
                ],
                [],
            ],
            [[]],
        );
        redisMock.redis.set.mockResolvedValue("OK");
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, {
                        access_token: "access-new",
                        refresh_token: "refresh-new",
                        expires_in: 3600,
                    }),
                )
                .mockResolvedValueOnce(jsonResponse(200, [])),
        );

        const client = await loadClient();
        await client.getWatchedMovies(TEST_USER_ID);

        expect(fetch).toHaveBeenLastCalledWith(
            expect.stringContaining("/sync/watched/movies"),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer access-raced" }),
            }),
        );
    });
});
