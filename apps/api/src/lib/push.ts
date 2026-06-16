import webpush from "web-push";

// Web Push (N2-T05). VAPID keys come from the environment; when they are absent
// the whole feature degrades gracefully (endpoints return 503, sends are no-ops)
// so the app runs fine without push configured.

// Track which key pair is currently loaded in the webpush module so that a
// runtime key rotation (secrets manager hot-reload) is detected and applied.
let configuredPublicKey: string | null = null;
let configuredPrivateKey: string | null = null;

function ensureVapid(): boolean {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey) return false;

    if (!subject) {
        console.error(
            "[push] VAPID_SUBJECT is not set. Push notifications will not be sent. " +
                "Set it to a mailto: or https: URI for your application.",
        );
        return false;
    }

    // Re-configure when keys change (e.g. secret rotation without restart).
    if (publicKey !== configuredPublicKey || privateKey !== configuredPrivateKey) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configuredPublicKey = publicKey;
        configuredPrivateKey = privateKey;
    }

    return true;
}

export function isPushConfigured(): boolean {
    return Boolean(
        process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
    );
}

export function getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
}

export interface PushTarget {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

/**
 * Sends a push notification. Returns `{ ok: false, statusCode }` rather than
 * throwing so callers can prune dead subscriptions (404/410) without aborting a
 * batch. A no-op (`ok: false`, no statusCode) when VAPID is unconfigured.
 */
export async function sendPush(
    target: PushTarget,
    payload: PushPayload,
): Promise<{ ok: boolean; statusCode?: number }> {
    if (!ensureVapid()) return { ok: false };
    try {
        await webpush.sendNotification(
            { endpoint: target.endpoint, keys: target.keys },
            JSON.stringify(payload),
        );
        return { ok: true };
    } catch (e) {
        return { ok: false, statusCode: (e as { statusCode?: number }).statusCode };
    }
}
