import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({
    api: {
        notifications: {
            vapidPublicKey: vi.fn(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        },
    },
}));

import { api } from "../api";
import {
    isPushSupported,
    getExistingSubscription,
    fetchVapidPublicKey,
    enablePush,
    disablePush,
} from "../push";

// "AAAA" / "AAAB" are valid base64url VAPID keys that decode to distinct,
// easy-to-compare byte sequences: [0,0,0] and [0,0,1] respectively.
const KEY_A = "AAAA";
const KEY_A_BYTES = new Uint8Array([0, 0, 0]);
const KEY_B_BYTES = new Uint8Array([0, 0, 1]);

function mockRegistration(
    getSubscriptionImpl: () => Promise<unknown>,
    subscribeImpl?: () => Promise<unknown>,
) {
    return {
        pushManager: {
            getSubscription: vi.fn(getSubscriptionImpl),
            subscribe: vi.fn(subscribeImpl ?? (() => Promise.resolve(makeSubscription("new")))),
        },
    };
}

function makeSubscription(
    endpoint: string,
    applicationServerKey: Uint8Array | null = null,
    overrides: Record<string, unknown> = {},
) {
    return {
        endpoint,
        options: { applicationServerKey },
        toJSON: () => ({ endpoint }),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function enableFullPushSupport(registration: ReturnType<typeof mockRegistration>) {
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    vi.stubGlobal("PushManager", function () {});
    Object.defineProperty(globalThis.navigator, "serviceWorker", {
        value: { ready: Promise.resolve(registration) },
        configurable: true,
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error test-only cleanup of a property we defined ourselves
    delete globalThis.navigator.serviceWorker;
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isPushSupported / getExistingSubscription
// ---------------------------------------------------------------------------

describe("isPushSupported", () => {
    it("is true when serviceWorker, PushManager, and Notification are all present", () => {
        enableFullPushSupport(mockRegistration(() => Promise.resolve(null)));
        expect(isPushSupported()).toBe(true);
    });

    it("is false when PushManager is missing", () => {
        vi.stubGlobal("Notification", {});
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            value: {},
            configurable: true,
        });
        expect(isPushSupported()).toBe(false);
    });

    it("is false when serviceWorker is missing", () => {
        vi.stubGlobal("Notification", {});
        vi.stubGlobal("PushManager", function () {});
        expect(isPushSupported()).toBe(false);
    });
});

describe("getExistingSubscription", () => {
    it("returns null without touching serviceWorker when push isn't supported", async () => {
        const result = await getExistingSubscription();
        expect(result).toBeNull();
    });

    it("returns the current subscription when supported", async () => {
        const sub = makeSubscription("existing");
        enableFullPushSupport(mockRegistration(() => Promise.resolve(sub)));
        const result = await getExistingSubscription();
        expect(result).toBe(sub);
    });
});

// ---------------------------------------------------------------------------
// fetchVapidPublicKey
// ---------------------------------------------------------------------------

describe("fetchVapidPublicKey", () => {
    it("returns the public key on success", async () => {
        vi.mocked(api.notifications.vapidPublicKey).mockResolvedValue({
            data: { publicKey: KEY_A },
        });
        await expect(fetchVapidPublicKey()).resolves.toBe(KEY_A);
    });

    it("returns null when the request fails", async () => {
        vi.mocked(api.notifications.vapidPublicKey).mockRejectedValue(new Error("503"));
        await expect(fetchVapidPublicKey()).resolves.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// enablePush
// ---------------------------------------------------------------------------

describe("enablePush", () => {
    it("throws server-unconfigured when no VAPID key is available", async () => {
        vi.mocked(api.notifications.vapidPublicKey).mockRejectedValue(new Error("503"));
        await expect(enablePush()).rejects.toThrow("server-unconfigured");
    });

    it("throws permission-denied when the user declines the browser prompt", async () => {
        enableFullPushSupport(mockRegistration(() => Promise.resolve(null)));
        vi.stubGlobal("Notification", {
            requestPermission: vi.fn().mockResolvedValue("denied"),
        });
        await expect(enablePush(KEY_A)).rejects.toThrow("permission-denied");
    });

    it("subscribes fresh when there is no existing subscription", async () => {
        const fresh = makeSubscription("fresh");
        const reg = mockRegistration(
            () => Promise.resolve(null),
            () => Promise.resolve(fresh),
        );
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(reg.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: KEY_A_BYTES,
        });
        expect(api.notifications.subscribe).toHaveBeenCalledWith({ endpoint: "fresh" });
    });

    it("reuses the existing subscription when its key already matches", async () => {
        const existing = makeSubscription("existing", KEY_A_BYTES);
        const reg = mockRegistration(() => Promise.resolve(existing));
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
        expect(api.notifications.subscribe).toHaveBeenCalledWith({ endpoint: "existing" });
    });

    it("unsubscribes the stale key and resubscribes when the key has rotated", async () => {
        const existing = makeSubscription("stale", KEY_B_BYTES);
        const fresh = makeSubscription("rotated");
        const reg = mockRegistration(
            () => Promise.resolve(existing),
            () => Promise.resolve(fresh),
        );
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(existing.unsubscribe).toHaveBeenCalled();
        expect(reg.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: KEY_A_BYTES,
        });
        expect(api.notifications.subscribe).toHaveBeenCalledWith({ endpoint: "rotated" });
    });

    it("proceeds to a fresh subscribe when unsubscribe fails but the browser already cleaned up", async () => {
        const existing = makeSubscription("stale", KEY_B_BYTES, {
            unsubscribe: vi.fn().mockRejectedValue(new Error("push service unreachable")),
        });
        const fresh = makeSubscription("cleaned-up");
        let call = 0;
        const reg = mockRegistration(
            () => Promise.resolve(call++ === 0 ? existing : null),
            () => Promise.resolve(fresh),
        );
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(reg.pushManager.subscribe).toHaveBeenCalled();
        expect(api.notifications.subscribe).toHaveBeenCalledWith({ endpoint: "cleaned-up" });
    });

    it("registers the already-active subscription and returns early when a concurrent tab already rotated to the new key", async () => {
        const existing = makeSubscription("stale", KEY_B_BYTES, {
            unsubscribe: vi.fn().mockRejectedValue(new Error("push service unreachable")),
        });
        const concurrentlyActive = makeSubscription("concurrent", KEY_A_BYTES);
        let call = 0;
        const reg = mockRegistration(() =>
            Promise.resolve(call++ === 0 ? existing : concurrentlyActive),
        );
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
        expect(api.notifications.subscribe).toHaveBeenCalledWith({ endpoint: "concurrent" });
    });

    it("throws push-rotation-blocked when unsubscribe fails and the old key is still active", async () => {
        const existing = makeSubscription("stale", KEY_B_BYTES, {
            unsubscribe: vi.fn().mockRejectedValue(new Error("push service unreachable")),
        });
        const stillOld = makeSubscription("still-old", KEY_B_BYTES);
        let call = 0;
        const reg = mockRegistration(() => Promise.resolve(call++ === 0 ? existing : stillOld));
        enableFullPushSupport(reg);

        await expect(enablePush(KEY_A)).rejects.toThrow("push-rotation-blocked");
        expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
    });

    it("treats a failing re-check getSubscription() as cleaned up and subscribes fresh", async () => {
        const existing = makeSubscription("stale", KEY_B_BYTES, {
            unsubscribe: vi.fn().mockRejectedValue(new Error("push service unreachable")),
        });
        const fresh = makeSubscription("after-degraded-recheck");
        let call = 0;
        const reg = mockRegistration(
            () => {
                if (call++ === 0) return Promise.resolve(existing);
                return Promise.reject(new Error("service worker registration degraded"));
            },
            () => Promise.resolve(fresh),
        );
        enableFullPushSupport(reg);

        await enablePush(KEY_A);

        expect(reg.pushManager.subscribe).toHaveBeenCalled();
        expect(api.notifications.subscribe).toHaveBeenCalledWith({
            endpoint: "after-degraded-recheck",
        });
    });
});

// ---------------------------------------------------------------------------
// disablePush
// ---------------------------------------------------------------------------

describe("disablePush", () => {
    it("does nothing when there is no existing subscription", async () => {
        enableFullPushSupport(mockRegistration(() => Promise.resolve(null)));
        await disablePush();
        expect(api.notifications.unsubscribe).not.toHaveBeenCalled();
    });

    it("unsubscribes in the browser and then notifies the backend", async () => {
        const sub = makeSubscription("to-remove");
        enableFullPushSupport(mockRegistration(() => Promise.resolve(sub)));

        await disablePush();

        expect(sub.unsubscribe).toHaveBeenCalled();
        expect(api.notifications.unsubscribe).toHaveBeenCalledWith("to-remove");
    });
});
