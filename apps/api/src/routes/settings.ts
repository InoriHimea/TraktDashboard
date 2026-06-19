import { Hono } from "hono";
import { getDb, userSettings } from "@trakt-dashboard/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registerUserSyncJob } from "../jobs/scheduler.js";
import { validateBody } from "../lib/validate.js";
import { encryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";

export const settingsRoutes = new Hono<{ Variables: { userId: number } }>();

function resolveIncomingApiKey(
    incoming: string | null | undefined,
    existing: string | null,
): string | null {
    if (incoming === undefined) return existing;
    if (incoming === null || incoming === "") return null;
    if (incoming === "***") return existing;
    return encryptToken(incoming, resolveApiSecret());
}

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
    let jellyfinAutoDeleteLibraryIds: string[] | null = DEFAULTS.jellyfinAutoDeleteLibraryIds;
    if (autoDeleteRaw) {
        try {
            jellyfinAutoDeleteLibraryIds = JSON.parse(autoDeleteRaw) as string[];
        } catch {
            jellyfinAutoDeleteLibraryIds = [];
        }
    }

    return c.json({
        data: {
            userId,
            displayLanguage: row?.displayLanguage ?? DEFAULTS.displayLanguage,
            syncIntervalMinutes: row?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes,
            httpProxy: row?.httpProxy ?? DEFAULTS.httpProxy,
            jellyfinUrl: row?.jellyfinUrl ?? DEFAULTS.jellyfinUrl,
            jellyfinApiKey: row?.jellyfinApiKey ? "***" : null,
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

    // Try explicit select with Jellyfin columns; fall back if migration 0011 not applied.
    type ExistingRow = {
        displayLanguage: string;
        syncIntervalMinutes: number;
        httpProxy: string | null;
        jellyfinUrl?: string | null;
        jellyfinApiKey?: string | null;
        jellyfinAutoDeleteLibraryIds?: string | null;
    };
    let existing: ExistingRow | undefined;
    let jellyfinMigrated = true;
    try {
        const [r] = await db
            .select({
                displayLanguage: userSettings.displayLanguage,
                syncIntervalMinutes: userSettings.syncIntervalMinutes,
                httpProxy: userSettings.httpProxy,
                jellyfinUrl: userSettings.jellyfinUrl,
                jellyfinApiKey: userSettings.jellyfinApiKey,
                jellyfinAutoDeleteLibraryIds: userSettings.jellyfinAutoDeleteLibraryIds,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        existing = r;
    } catch {
        jellyfinMigrated = false;
        const [r] = await db
            .select({
                displayLanguage: userSettings.displayLanguage,
                syncIntervalMinutes: userSettings.syncIntervalMinutes,
                httpProxy: userSettings.httpProxy,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
        existing = r;
    }

    const previousInterval = existing?.syncIntervalMinutes ?? DEFAULTS.syncIntervalMinutes;

    let existingAutoDeleteIds: string[] | null = DEFAULTS.jellyfinAutoDeleteLibraryIds;
    if (existing?.jellyfinAutoDeleteLibraryIds) {
        try {
            existingAutoDeleteIds = JSON.parse(existing.jellyfinAutoDeleteLibraryIds) as string[];
        } catch {
            existingAutoDeleteIds = [];
        }
    }

    const newAutoDeleteIds =
        jellyfinAutoDeleteLibraryIds !== undefined
            ? jellyfinAutoDeleteLibraryIds
            : existingAutoDeleteIds;

    const baseValues = {
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

    if (jellyfinMigrated) {
        const newValues = {
            ...baseValues,
            jellyfinUrl:
                jellyfinUrl !== undefined
                    ? jellyfinUrl || null
                    : (existing?.jellyfinUrl ?? DEFAULTS.jellyfinUrl),
            jellyfinApiKey: resolveIncomingApiKey(jellyfinApiKey, existing?.jellyfinApiKey ?? null),
            jellyfinAutoDeleteLibraryIds: newAutoDeleteIds
                ? JSON.stringify(newAutoDeleteIds)
                : null,
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
        if (
            syncIntervalMinutes !== undefined &&
            newValues.syncIntervalMinutes !== previousInterval
        ) {
            await registerUserSyncJob(userId);
        }
        return c.json({
            data: {
                ...newValues,
                jellyfinApiKey: newValues.jellyfinApiKey ? "***" : null,
                jellyfinAutoDeleteLibraryIds: newAutoDeleteIds,
            },
        });
    } else {
        await db
            .insert(userSettings)
            .values(baseValues)
            .onConflictDoUpdate({
                target: [userSettings.userId],
                set: {
                    displayLanguage: baseValues.displayLanguage,
                    syncIntervalMinutes: baseValues.syncIntervalMinutes,
                    httpProxy: baseValues.httpProxy,
                    updatedAt: baseValues.updatedAt,
                },
            });
        if (
            syncIntervalMinutes !== undefined &&
            baseValues.syncIntervalMinutes !== previousInterval
        ) {
            await registerUserSyncJob(userId);
        }
        return c.json({
            data: {
                ...baseValues,
                jellyfinUrl: DEFAULTS.jellyfinUrl,
                jellyfinApiKey: DEFAULTS.jellyfinApiKey,
                jellyfinAutoDeleteLibraryIds: DEFAULTS.jellyfinAutoDeleteLibraryIds,
            },
        });
    }
});
