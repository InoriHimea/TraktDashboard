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

    // Re-use an existing browser subscription when one already exists so that
    // rapid double-invocation (e.g. user clicks Enable twice) doesn't create
    // duplicate endpoints and trigger duplicate daily notifications.
    const existing = await reg.pushManager.getSubscription();
    const subscription =
        existing ??
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
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
