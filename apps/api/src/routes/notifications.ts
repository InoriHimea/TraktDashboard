import { Hono } from "hono";
import { getDb, pushSubscriptions } from "@trakt-dashboard/db";
import { and, eq } from "drizzle-orm";
import { apiOk, apiError } from "../lib/response.js";
import { isPushConfigured, getVapidPublicKey } from "../lib/push.js";

export const notificationRoutes = new Hono<{ Variables: { userId: number } }>();

// GET /api/notifications/vapid-public-key — the key the browser needs to subscribe.
notificationRoutes.get("/vapid-public-key", (c) => {
    const key = getVapidPublicKey();
    if (!key) return apiError(c, 503, "Push notifications are not configured");
    return apiOk(c, { publicKey: key });
});

// POST /api/notifications/subscribe — store (or refresh) a browser subscription.
notificationRoutes.post("/subscribe", async (c) => {
    if (!isPushConfigured()) return apiError(c, 503, "Push notifications are not configured");
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => null)) as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
    } | null;

    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return apiError(c, 400, "Invalid subscription");
    }

    await getDb()
        .insert(pushSubscriptions)
        .values({
            userId,
            endpoint: body.endpoint,
            p256dh: body.keys.p256dh,
            auth: body.keys.auth,
        })
        .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { userId, p256dh: body.keys.p256dh, auth: body.keys.auth },
        });

    return apiOk(c, { ok: true });
});

// POST /api/notifications/unsubscribe — remove a subscription by endpoint.
notificationRoutes.post("/unsubscribe", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => null)) as { endpoint?: string } | null;
    if (!body?.endpoint) return apiError(c, 400, "Missing endpoint");

    await getDb()
        .delete(pushSubscriptions)
        .where(
            and(
                eq(pushSubscriptions.userId, userId),
                eq(pushSubscriptions.endpoint, body.endpoint),
            ),
        );

    return apiOk(c, { ok: true });
});
