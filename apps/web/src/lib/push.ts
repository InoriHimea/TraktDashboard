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
 * Fetches the VAPID key BEFORE requesting notification permission so the
 * browser permission prompt is never shown when the server is unconfigured.
 * Throws "permission-denied" if the user declines, "server-unconfigured" if
 * VAPID is not set up.
 */
export async function enablePush(): Promise<void> {
    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) throw new Error("server-unconfigured");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("permission-denied");

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api.notifications.subscribe(subscription.toJSON() as PushSubscriptionJSON);
}

export async function disablePush(): Promise<void> {
    const subscription = await getExistingSubscription();
    if (!subscription) return;
    await api.notifications.unsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
}
