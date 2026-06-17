import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

const dbMockState = vi.hoisted(() => ({ db: null as any }));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

function createMockDb(existingSubCount = 0) {
    const calls = { inserted: [] as unknown[], deleted: 0 };
    return {
        calls,
        select: () => ({
            from: () => ({
                where: () => Promise.resolve([{ value: existingSubCount }]),
            }),
        }),
        insert: () => ({
            values: (v: unknown) => ({
                onConflictDoUpdate: () => {
                    calls.inserted.push(v);
                    return Promise.resolve();
                },
            }),
        }),
        delete: () => ({
            where: () => {
                calls.deleted++;
                return Promise.resolve();
            },
        }),
    };
}

const { notificationRoutes } = await import("../routes/notifications.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/notifications", notificationRoutes);
    return a;
}

const validSub = {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function setVapid() {
    process.env.VAPID_PUBLIC_KEY = "k";
    process.env.VAPID_PRIVATE_KEY = "k";
    process.env.VAPID_SUBJECT = "mailto:test@test.example";
}

beforeEach(() => {
    dbMockState.db = createMockDb(0);
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
});

afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
});

describe("notifications routes", () => {
    it("returns 503 for vapid-public-key when push is unconfigured", async () => {
        const res = await app().request("/notifications/vapid-public-key");
        expect(res.status).toBe(503);
    });

    it("returns the public key when configured", async () => {
        process.env.VAPID_PUBLIC_KEY = "test-public-key";
        process.env.VAPID_PRIVATE_KEY = "test-private-key";
        const res = await app().request("/notifications/vapid-public-key");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { publicKey: string } };
        expect(body.data.publicKey).toBe("test-public-key");
    });

    it("rejects subscribe when push is unconfigured (503)", async () => {
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validSub),
        });
        expect(res.status).toBe(503);
    });

    it("rejects an invalid subscription body (400)", async () => {
        setVapid();
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "x" }), // missing keys
        });
        expect(res.status).toBe(400);
    });

    it("stores a valid subscription", async () => {
        setVapid();
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validSub),
        });
        expect(res.status).toBe(200);
        expect(dbMockState.db.calls.inserted).toHaveLength(1);
        expect(dbMockState.db.calls.inserted[0]).toMatchObject({
            userId: TEST_USER_ID,
            endpoint: validSub.endpoint,
            p256dh: "p256dh-key",
            auth: "auth-key",
        });
    });

    it("rejects subscribe when VAPID_SUBJECT is missing even if keys are set (503)", async () => {
        process.env.VAPID_PUBLIC_KEY = "test-public-key";
        process.env.VAPID_PRIVATE_KEY = "test-private-key";
        // No VAPID_SUBJECT — isPushConfigured() requires all three.
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validSub),
        });
        expect(res.status).toBe(503);
    });

    it("rejects subscribe when user already has 10 subscriptions (429)", async () => {
        setVapid();
        dbMockState.db = createMockDb(10);
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validSub),
        });
        expect(res.status).toBe(429);
        expect(dbMockState.db.calls.inserted).toHaveLength(0);
    });

    it("allows re-subscribe when user has 9 other endpoints at cap (same endpoint excluded from count)", async () => {
        setVapid();
        // The count query excludes the submitted endpoint via ne(), so even if the user
        // has 10 total subscriptions, re-registering an existing endpoint returns 9 here
        // and the zero-net-new-row upsert is allowed.
        dbMockState.db = createMockDb(9);
        const res = await app().request("/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validSub),
        });
        expect(res.status).toBe(200);
        expect(dbMockState.db.calls.inserted).toHaveLength(1);
    });

    it("requires an endpoint to unsubscribe (400)", async () => {
        const res = await app().request("/notifications/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    it("deletes the subscription on unsubscribe", async () => {
        const res = await app().request("/notifications/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: validSub.endpoint }),
        });
        expect(res.status).toBe(200);
        expect(dbMockState.db.calls.deleted).toBe(1);
    });
});
