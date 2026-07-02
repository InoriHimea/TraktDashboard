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

const NOTIFICATION_EVENT_TYPES = [
    "series_premiere",
    "season_premiere",
    "finale",
    "regular",
] as const;
type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
const DEFAULT_NOTIFICATION_TYPES: NotificationEventType[] = [
    "series_premiere",
    "season_premiere",
    "finale",
    "regular",
];

function parseNotificationEventTypes(raw: string | null | undefined): NotificationEventType[] {
    if (!raw) return DEFAULT_NOTIFICATION_TYPES;
    try {
        const parsed = JSON.parse(raw) as unknown[];
        const valid = parsed.filter(
            (v): v is NotificationEventType =>
                typeof v === "string" &&
                (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(v),
        );
        return valid.length > 0 ? valid : DEFAULT_NOTIFICATION_TYPES;
    } catch {
        return DEFAULT_NOTIFICATION_TYPES;
    }
}

const DEFAULTS = {
    displayLanguage: "zh-CN",
    syncIntervalMinutes: 60,
    httpProxy: null as string | null,
    jellyfinUrl: null as string | null,
    jellyfinApiKey: null as string | null,
    jellyfinAutoDeleteLibraryIds: null as string[] | null,
    jellyfinAutoDeleteEnabled: false,
    notificationEventTypes: DEFAULT_NOTIFICATION_TYPES as NotificationEventType[],
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
    jellyfinAutoDeleteEnabled: z.boolean().optional(),
    notificationEventTypes: z
        .union([z.array(z.enum(NOTIFICATION_EVENT_TYPES)), z.null()])
        .optional(),
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
        jellyfinAutoDeleteEnabled?: boolean;
        notificationEventTypes?: string | null;
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
            jellyfinAutoDeleteEnabled:
                row?.jellyfinAutoDeleteEnabled ?? DEFAULTS.jellyfinAutoDeleteEnabled,
            notificationEventTypes: parseNotificationEventTypes(row?.notificationEventTypes),
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
        jellyfinAutoDeleteEnabled,
        notificationEventTypes,
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
        jellyfinAutoDeleteEnabled?: boolean;
        notificationEventTypes?: string | null;
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
                jellyfinAutoDeleteEnabled: userSettings.jellyfinAutoDeleteEnabled,
                notificationEventTypes: userSettings.notificationEventTypes,
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

    const existingNotifTypes = parseNotificationEventTypes(existing?.notificationEventTypes);
    const newNotifTypes =
        notificationEventTypes !== undefined ? notificationEventTypes : existingNotifTypes;

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
            jellyfinAutoDeleteEnabled:
                jellyfinAutoDeleteEnabled ??
                existing?.jellyfinAutoDeleteEnabled ??
                DEFAULTS.jellyfinAutoDeleteEnabled,
            notificationEventTypes: newNotifTypes ? JSON.stringify(newNotifTypes) : null,
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
                    jellyfinAutoDeleteEnabled: newValues.jellyfinAutoDeleteEnabled,
                    notificationEventTypes: newValues.notificationEventTypes,
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
                notificationEventTypes: newNotifTypes ?? DEFAULTS.notificationEventTypes,
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
                jellyfinAutoDeleteEnabled: DEFAULTS.jellyfinAutoDeleteEnabled,
                notificationEventTypes: DEFAULTS.notificationEventTypes,
            },
        });
    }
});
