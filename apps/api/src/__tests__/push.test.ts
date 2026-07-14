import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const webpushMock = vi.hoisted(() => ({
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
}));

vi.mock("web-push", () => ({ default: webpushMock }));

const ORIGINAL_ENV = { ...process.env };
const target = { endpoint: "https://push.example.com/ep1", keys: { p256dh: "p", auth: "a" } };
const payload = { title: "New episode", body: "S1E1 is out" };

/** ensureVapid()'s "did anything change" comparison is module-level state, so tests
 * that must start from a clean slate reset the module registry and re-import. */
async function loadFreshPush() {
    vi.resetModules();
    return import("../lib/push.js");
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("isPushConfigured / getVapidPublicKey", () => {
    it("is false and null when nothing is set", async () => {
        const { isPushConfigured, getVapidPublicKey } = await loadFreshPush();
        expect(isPushConfigured()).toBe(false);
        expect(getVapidPublicKey()).toBeNull();
    });

    it("is true and returns the key once all three env vars are set", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { isPushConfigured, getVapidPublicKey } = await loadFreshPush();
        expect(isPushConfigured()).toBe(true);
        expect(getVapidPublicKey()).toBe("pub");
    });

    it("is false when only the subject is missing", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        const { isPushConfigured } = await loadFreshPush();
        expect(isPushConfigured()).toBe(false);
    });
});

describe("sendPush", () => {
    it("is a no-op when the public/private keys are missing", async () => {
        const { sendPush } = await loadFreshPush();
        const result = await sendPush(target, payload);
        expect(result).toEqual({ ok: false });
        expect(webpushMock.setVapidDetails).not.toHaveBeenCalled();
        expect(webpushMock.sendNotification).not.toHaveBeenCalled();
    });

    it("is a no-op and logs when only the subject is missing", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        const { sendPush } = await loadFreshPush();
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const result = await sendPush(target, payload);
        expect(result).toEqual({ ok: false });
        expect(webpushMock.sendNotification).not.toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("VAPID_SUBJECT"));
        errSpy.mockRestore();
    });

    it("sends with an 86400s TTL and reports success", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockResolvedValue(undefined);

        const result = await sendPush(target, payload);
        expect(result).toEqual({ ok: true });
        expect(webpushMock.sendNotification).toHaveBeenCalledWith(
            { endpoint: target.endpoint, keys: target.keys },
            JSON.stringify(payload),
            { TTL: 86400 },
        );
    });

    it("configures VAPID details on first use with the given subject/keys", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockResolvedValue(undefined);

        await sendPush(target, payload);
        expect(webpushMock.setVapidDetails).toHaveBeenCalledWith("mailto:a@b.com", "pub", "priv");
    });

    it("extracts statusCode from a rejection that carries one", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockRejectedValue(
            Object.assign(new Error("Gone"), { statusCode: 410 }),
        );

        const result = await sendPush(target, payload);
        expect(result).toEqual({ ok: false, statusCode: 410 });
    });

    it("returns no statusCode when the rejection is a plain error", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockRejectedValue(new Error("network down"));

        const result = await sendPush(target, payload);
        expect(result).toEqual({ ok: false, statusCode: undefined });
    });
});

describe("sendPush VAPID rotation detection (sequential, shares module state by design)", () => {
    it("does not re-configure on a second call with unchanged VAPID values", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockResolvedValue(undefined);

        await sendPush(target, payload);
        expect(webpushMock.setVapidDetails).toHaveBeenCalledTimes(1);

        await sendPush(target, payload);
        expect(webpushMock.setVapidDetails).toHaveBeenCalledTimes(1); // still 1 — no re-configure
    });

    it("re-configures when the public key rotates", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub-v1";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:a@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockResolvedValue(undefined);

        await sendPush(target, payload);
        expect(webpushMock.setVapidDetails).toHaveBeenCalledTimes(1);

        process.env.VAPID_PUBLIC_KEY = "pub-v2";
        await sendPush(target, payload);
        expect(webpushMock.setVapidDetails).toHaveBeenCalledTimes(2);
        expect(webpushMock.setVapidDetails).toHaveBeenLastCalledWith(
            "mailto:a@b.com",
            "pub-v2",
            "priv",
        );
    });

    it("re-configures when only the subject changes", async () => {
        process.env.VAPID_PUBLIC_KEY = "pub";
        process.env.VAPID_PRIVATE_KEY = "priv";
        process.env.VAPID_SUBJECT = "mailto:old@b.com";
        const { sendPush } = await loadFreshPush();
        webpushMock.sendNotification.mockResolvedValue(undefined);

        await sendPush(target, payload);
        process.env.VAPID_SUBJECT = "mailto:new@b.com";
        await sendPush(target, payload);

        expect(webpushMock.setVapidDetails).toHaveBeenCalledTimes(2);
        expect(webpushMock.setVapidDetails).toHaveBeenLastCalledWith(
            "mailto:new@b.com",
            "pub",
            "priv",
        );
    });
});
