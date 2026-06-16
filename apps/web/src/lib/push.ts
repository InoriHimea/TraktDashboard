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
 * Requests notification permission, subscribes via PushManager using the
 * server's VAPID key, and registers the subscription with the backend.
 * Throws "permission-denied" if the user declines.
 */
export async function enablePush(): Promise<void> {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("permission-denied");

    const { data } = await api.notifications.vapidPublicKey();
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
    await api.notifications.subscribe(subscription.toJSON() as PushSubscriptionJSON);
}

export async function disablePush(): Promise<void> {
    const subscription = await getExistingSubscription();
    if (!subscription) return;
    await api.notifications.unsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
}
