import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const schedulerMockState = vi.hoisted(() => ({ registerUserSyncJob: vi.fn() }));
const syncMockState = vi.hoisted(() => ({ triggerFullSync: vi.fn() }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../jobs/scheduler.js", () => ({
    registerUserSyncJob: schedulerMockState.registerUserSyncJob,
}));

vi.mock("../services/sync.js", () => ({
    triggerFullSync: syncMockState.triggerFullSync,
}));

type RowsResult = unknown[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(private readonly result: RowsResult) {}
    from() {
        return this;
    }
    where() {
        return this;
    }
    limit() {
        return this;
    }
    set() {
        return this;
    }
    values() {
        return this;
    }
    onConflictDoNothing() {
        return this;
    }
    returning() {
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
}

function createMockDb(queues: {
    selects?: RowsResult[];
    updates?: RowsResult[];
    inserts?: RowsResult[];
}) {
    const state = {
        selects: [...(queues.selects ?? [])],
        updates: [...(queues.updates ?? [])],
        inserts: [...(queues.inserts ?? [])],
    };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        update: vi.fn(() => new ChainBuilder(state.updates.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder(state.inserts.shift() ?? [])),
    };
}

const { authRoutes } = await import("../routes/auth.js");

function app() {
    const a = new Hono();
    a.route("/auth", authRoutes);
    return a;
}

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRAKT_CLIENT_ID = "client-id";
    process.env.TRAKT_CLIENT_SECRET = "client-secret";
    process.env.TRAKT_REDIRECT_URI = "http://localhost/auth/callback";
    delete process.env.FRONTEND_URL;
    schedulerMockState.registerUserSyncJob.mockResolvedValue(undefined);
    syncMockState.triggerFullSync.mockResolvedValue(undefined);
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
});

describe("GET /auth/trakt", () => {
    it("redirects to Trakt's authorize URL with a state cookie set", async () => {
        const res = await app().request("/auth/trakt", { redirect: "manual" });
        expect(res.status).toBe(302);
        const location = res.headers.get("location")!;
        expect(location).toContain("https://trakt.tv/oauth/authorize");
        expect(location).toContain("client_id=client-id");
        expect(location).toContain(
            `redirect_uri=${encodeURIComponent("http://localhost/auth/callback")}`,
        );
        expect(location).toMatch(/state=[0-9a-f]{32}/);
        expect(res.headers.get("set-cookie")).toContain("oauth_state=");
    });
});

describe("GET /auth/callback", () => {
    function callback(query: string, cookie?: string) {
        return app().request(`/auth/callback${query}`, {
            redirect: "manual",
            headers: cookie ? { Cookie: cookie } : {},
        });
    }

    it("rejects a missing code with 400", async () => {
        const res = await callback("?state=abc", "oauth_state=abc");
        expect(res.status).toBe(400);
    });

    it("rejects when there is no stored state cookie", async () => {
        const res = await callback("?code=xyz&state=abc");
        expect(res.status).toBe(400);
    });

    it("rejects when the query state does not match the stored cookie", async () => {
        const res = await callback("?code=xyz&state=abc", "oauth_state=different");
        expect(res.status).toBe(400);
    });

    it("returns 400 when the token exchange fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "bad" })));

        const res = await callback("?code=xyz&state=abc", "oauth_state=abc");
        expect(res.status).toBe(400);
    });

    it("updates the existing user, re-registers the sync job, and redirects on success", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, {
                        access_token: "at",
                        refresh_token: "rt",
                        expires_in: 3600,
                    }),
                )
                .mockResolvedValueOnce(jsonResponse(200, { username: "himea" })),
        );
        const db = createMockDb({
            selects: [[{ id: 1 }]],
            updates: [[]],
            inserts: [[]],
        });
        dbMockState.db = db;

        const res = await callback("?code=xyz&state=abc", "oauth_state=abc");
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("http://localhost:5173?auth=success");
        expect(res.headers.get("set-cookie")).toContain("session=");
        expect(db.update).toHaveBeenCalledTimes(1);
        expect(db.insert).toHaveBeenCalledTimes(1); // syncState only — no new user row
        expect(schedulerMockState.registerUserSyncJob).toHaveBeenCalledWith(1);
        expect(syncMockState.triggerFullSync).toHaveBeenCalledWith(1);
    });

    it("creates a new user and initializes sync state when none exists", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, {
                        access_token: "at",
                        refresh_token: "rt",
                        expires_in: 3600,
                    }),
                )
                .mockResolvedValueOnce(jsonResponse(200, { username: "himea" })),
        );
        const db = createMockDb({
            selects: [[]], // no existing user
            inserts: [[{ id: 9 }], []], // users insert (.returning()) then syncState insert
        });
        dbMockState.db = db;

        const res = await callback("?code=xyz&state=abc", "oauth_state=abc");
        expect(res.status).toBe(302);
        expect(db.update).not.toHaveBeenCalled();
        expect(db.insert).toHaveBeenCalledTimes(2);
        expect(schedulerMockState.registerUserSyncJob).toHaveBeenCalledWith(9);
        expect(syncMockState.triggerFullSync).toHaveBeenCalledWith(9);
    });

    it("still succeeds with a null username when the profile fetch fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, {
                        access_token: "at",
                        refresh_token: "rt",
                        expires_in: 3600,
                    }),
                )
                .mockResolvedValueOnce(jsonResponse(500, {})),
        );
        dbMockState.db = createMockDb({ selects: [[]], inserts: [[{ id: 9 }], []] });

        const res = await callback("?code=xyz&state=abc", "oauth_state=abc");
        expect(res.status).toBe(302);
    });
});

describe("GET /auth/me", () => {
    it("reports unauthenticated when there is no token", async () => {
        const res = await app().request("/auth/me");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { authenticated: boolean; user: unknown };
        expect(body).toEqual({ authenticated: false, user: null });
    });

    it("reports unauthenticated for an invalid token", async () => {
        const res = await app().request("/auth/me", {
            headers: { Authorization: "Bearer garbage" },
        });
        const body = (await res.json()) as { authenticated: boolean };
        expect(body.authenticated).toBe(false);
    });

    it("reports authenticated with the user row for a valid session", async () => {
        const { signToken } = await import("../middleware/auth.js");
        const token = await signToken(1);
        dbMockState.db = createMockDb({ selects: [[{ id: 1, traktUsername: "himea" }]] });

        const res = await app().request("/auth/me", { headers: { Cookie: `session=${token}` } });
        const body = (await res.json()) as {
            authenticated: boolean;
            user: { id: number; traktUsername: string } | null;
        };
        expect(body.authenticated).toBe(true);
        expect(body.user).toEqual({ id: 1, traktUsername: "himea" });
    });

    it("reports unauthenticated when the token is valid but the user row is gone", async () => {
        const { signToken } = await import("../middleware/auth.js");
        const token = await signToken(999);
        dbMockState.db = createMockDb({ selects: [[]] });

        const res = await app().request("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as { authenticated: boolean; user: unknown };
        expect(body).toEqual({ authenticated: false, user: null });
    });
});

describe("POST /auth/logout", () => {
    it("clears the session cookie and returns ok", async () => {
        const res = await app().request("/auth/logout", { method: "POST" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
        expect(res.headers.get("set-cookie")).toContain("session=;");
    });
});
