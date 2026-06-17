import { api } from "./api";

// Web Push client helpers (N2-T05). Wrap the browser PushManager flow and sync
// the subscription with the backend.

export function isPushSupported(): boolean {
    return (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        typeof window !== "undefined" &&
        "PushManager" in window &&
        "Notification" in window
    );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(normalized);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

/**
 * Checks whether the server has VAPID configured. Returns null when push is
 * unavailable server-side (503), or the public key string on success.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
    try {
        const { data } = await api.notifications.vapidPublicKey();
        return data.publicKey;
    } catch {
        return null;
    }
}

/**
 * Subscribes via PushManager and registers with the backend.
 * Pass `cachedKey` when the caller already has the VAPID public key (e.g. from
 * a previous `fetchVapidPublicKey` call) to avoid an extra round-trip.
 * Throws "permission-denied" if the user declines, "server-unconfigured" if
 * VAPID is not set up.
 */
export async function enablePush(cachedKey?: string): Promise<void> {
    const publicKey = cachedKey ?? (await fetchVapidPublicKey());
    if (!publicKey) throw new Error("server-unconfigured");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("permission-denied");

    const reg = await navigator.serviceWorker.ready;

    const keyBytes = urlBase64ToUint8Array(publicKey);
    const existing = await reg.pushManager.getSubscription();

    // Verify the existing subscription was created with the current VAPID key.
    // A mismatch means the key was rotated — unsubscribe the stale entry so the
    // push service can bind a new subscription to the new key.
    const existingKeyMatches = (() => {
        const k = existing?.options?.applicationServerKey;
        if (!k) return false;
        // Chrome exposes applicationServerKey as Uint8Array; the spec says ArrayBuffer.
        // Handle both to avoid a wrong-type error from new Uint8Array(string).
        const a = k instanceof Uint8Array ? k : new Uint8Array(k as ArrayBuffer);
        return a.length === keyBytes.length && a.every((b, i) => b === keyBytes[i]);
    })();

    if (existing && !existingKeyMatches) {
        try {
            await existing.unsubscribe();
        } catch {
            // Unsubscribe failed (push service unreachable or subscription already
            // expired on the server). Proceed to subscribe with the new key so the
            // user is not permanently wedged. The stale endpoint is auto-pruned on
            // the next 404/410 from the airing-reminders job.
        }
    }

    const subscription =
        existing && existingKeyMatches
            ? existing
            : await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: keyBytes,
              });

    await api.notifications.subscribe(subscription.toJSON() as PushSubscriptionJSON);
}

export async function disablePush(): Promise<void> {
    const subscription = await getExistingSubscription();
    if (!subscription) return;
    // Revoke in browser first. If this fails nothing is deleted from the backend
    // and state stays consistent. If the subsequent backend call fails, the
    // endpoint is already invalid so the airing-reminders job will auto-prune it
    // on the next send attempt (404/410 response).
    await subscription.unsubscribe();
    await api.notifications.unsubscribe(subscription.endpoint);
}
