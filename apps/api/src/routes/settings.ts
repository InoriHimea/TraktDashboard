import { Hono } from "hono";
import { getDb, userSettings } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registerUserSyncJob } from "../jobs/scheduler.js";
import { validateBody } from "../lib/validate.js";

export const settingsRoutes = new Hono<{ Variables: { userId: number } }>();

const DEFAULTS = {
    displayLanguage: "zh-CN",
    syncIntervalMinutes: 60,
    httpProxy: null as string | null,
};

// P2-T11: declarative validation replaces the inline regex/integer checks.
const updateSettingsSchema = z.object({
    displayLanguage: z.string().min(1).max(32).optional(),
    syncIntervalMinutes: z.number().int().min(1).max(10080).optional(),
    httpProxy: z
        .union([
            z.string().regex(/^https?:\/\//i, "httpProxy must be a valid http:// or https:// URL"),
            z.literal(""),
            z.null(),
        ])
        .optional(),
});

// GET /api/settings
settingsRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

    return c.json({
        data: {
            userId,
            displayLanguage: row?.displayLanguage ?? DEFAULTS.displayLanguage,
            syncIntervalMinutes: row?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
            httpProxy: row?.httpProxy ?? DEFAULTS.httpProxy,
        },
    });
});

// PUT /api/settings
settingsRoutes.put("/", async (c) => {
    const userId = c.get("userId");

    const parsed = await validateBody(c, updateSettingsSchema);
    if (parsed instanceof Response) return parsed;
    const { displayLanguage, syncIntervalMinutes, httpProxy } = parsed.data;

    const db = getDb();
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    const previousInterval = existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes;

    const newValues = {
        userId,
        displayLanguage: displayLanguage ?? existing?.displayLanguage ?? DEFAULTS.displayLanguage,
        syncIntervalMinutes:
            syncIntervalMinutes ?? existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
        httpProxy:
            httpProxy !== undefined
                ? httpProxy || null
                : (existing?.httpProxy ?? DEFAULTS.httpProxy),
        updatedAt: new Date(),
    };

    await db
        .insert(userSettings)
        .values(newValues)
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: {
                displayLanguage: newValues.displayLanguage,
                syncIntervalMinutes: newValues.syncIntervalMinutes,
                httpProxy: newValues.httpProxy,
                updatedAt: newValues.updatedAt,
            },
        });

    if (syncIntervalMinutes !== undefined && newValues.syncIntervalMinutes !== previousInterval) {
        await registerUserSyncJob(userId);
    }

    return c.json({ data: { ...newValues } });
});
