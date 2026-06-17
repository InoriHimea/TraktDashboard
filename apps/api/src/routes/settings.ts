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
    jellyfinUrl: null as string | null,
    jellyfinApiKey: null as string | null,
    jellyfinAutoDeleteLibraryIds: null as string[] | null,
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
    jellyfinUrl: z
        .union([
            z
                .string()
                .regex(/^https?:\/\//i, "jellyfinUrl must be a valid http:// or https:// URL"),
            z.literal(""),
            z.null(),
        ])
        .optional(),
    jellyfinApiKey: z.union([z.string(), z.null()]).optional(),
    jellyfinAutoDeleteLibraryIds: z.union([z.array(z.string()), z.null()]).optional(),
});

// GET /api/settings
settingsRoutes.get("/", async (c) => {
    const userId = c.get("userId");
    const db = getDb();

    // Try full select (requires migration 0011). If the Jellyfin columns don't exist
    // yet (migration not applied), fall back to the pre-0011 column set.
    type SettingsRow = {
        displayLanguage: string;
        syncIntervalMinutes: number;
        httpProxy: string | null;
        jellyfinUrl?: string | null;
        jellyfinApiKey?: string | null;
        jellyfinAutoDeleteLibraryIds?: string | null;
    };
    let row: SettingsRow | undefined;
    try {
        const [r] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
        row = r;
    } catch {
        // Migration 0011 not yet applied — query only the original columns.
        const [r] = await db
            .select({
                displayLanguage: userSettings.displayLanguage,
                syncIntervalMinutes: userSettings.syncIntervalMinutes,
                httpProxy: userSettings.httpProxy,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        row = r;
    }

    const autoDeleteRaw = row?.jellyfinAutoDeleteLibraryIds ?? null;
    const jellyfinAutoDeleteLibraryIds = autoDeleteRaw
        ? (JSON.parse(autoDeleteRaw) as string[])
        : DEFAULTS.jellyfinAutoDeleteLibraryIds;

    return c.json({
        data: {
            userId,
            displayLanguage: row?.displayLanguage ?? DEFAULTS.displayLanguage,
            syncIntervalMinutes: row?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
            httpProxy: row?.httpProxy ?? DEFAULTS.httpProxy,
            jellyfinUrl: row?.jellyfinUrl ?? DEFAULTS.jellyfinUrl,
            jellyfinApiKey: row?.jellyfinApiKey ?? DEFAULTS.jellyfinApiKey,
            jellyfinAutoDeleteLibraryIds,
        },
    });
});

// PUT /api/settings
settingsRoutes.put("/", async (c) => {
    const userId = c.get("userId");

    const parsed = await validateBody(c, updateSettingsSchema);
    if (parsed instanceof Response) return parsed;
    const {
        displayLanguage,
        syncIntervalMinutes,
        httpProxy,
        jellyfinUrl,
        jellyfinApiKey,
        jellyfinAutoDeleteLibraryIds,
    } = parsed.data;

    const db = getDb();
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    const previousInterval = existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes;

    const existingAutoDeleteIds = existing?.jellyfinAutoDeleteLibraryIds
        ? (JSON.parse(existing.jellyfinAutoDeleteLibraryIds) as string[])
        : DEFAULTS.jellyfinAutoDeleteLibraryIds;

    const newAutoDeleteIds =
        jellyfinAutoDeleteLibraryIds !== undefined
            ? jellyfinAutoDeleteLibraryIds
            : existingAutoDeleteIds;

    const newValues = {
        userId,
        displayLanguage: displayLanguage ?? existing?.displayLanguage ?? DEFAULTS.displayLanguage,
        syncIntervalMinutes:
            syncIntervalMinutes ?? existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
        httpProxy:
            httpProxy !== undefined
                ? httpProxy || null
                : (existing?.httpProxy ?? DEFAULTS.httpProxy),
        jellyfinUrl:
            jellyfinUrl !== undefined
                ? jellyfinUrl || null
                : (existing?.jellyfinUrl ?? DEFAULTS.jellyfinUrl),
        jellyfinApiKey:
            jellyfinApiKey !== undefined
                ? jellyfinApiKey || null
                : (existing?.jellyfinApiKey ?? DEFAULTS.jellyfinApiKey),
        jellyfinAutoDeleteLibraryIds: newAutoDeleteIds ? JSON.stringify(newAutoDeleteIds) : null,
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
                jellyfinUrl: newValues.jellyfinUrl,
                jellyfinApiKey: newValues.jellyfinApiKey,
                jellyfinAutoDeleteLibraryIds: newValues.jellyfinAutoDeleteLibraryIds,
                updatedAt: newValues.updatedAt,
            },
        });

    if (syncIntervalMinutes !== undefined && newValues.syncIntervalMinutes !== previousInterval) {
        await registerUserSyncJob(userId);
    }

    return c.json({
        data: {
            ...newValues,
            jellyfinAutoDeleteLibraryIds: newAutoDeleteIds,
        },
    });
});
