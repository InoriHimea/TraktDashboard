import { Hono } from "hono";
import { getDb, userSettings, backupRuns } from "@trakt-dashboard/db";
import { eq, and, desc } from "drizzle-orm";
import { encryptToken, decryptToken } from "../lib/encrypt.js";
import { resolveApiSecret } from "../lib/secret.js";
import {
    startGDriveDeviceFlow,
    pollGDriveToken,
    revokeGDriveToken,
    uploadToGDrive,
    listGDriveBackups,
    deleteGDriveFile,
    pruneOldGDriveBackups,
    uploadToWebDAV,
    listWebDAVBackups,
    deleteWebDAVFile,
    pruneOldWebDAVBackups,
    dumpDatabase,
    type GDriveToken,
    type WebDAVConfig,
} from "../services/backup.js";

export const backupRoutes = new Hono<{ Variables: { userId: number } }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encryptSecret(plain: string): string {
    return encryptToken(plain, resolveApiSecret());
}

function decryptSecret(cipher: string): string {
    return decryptToken(cipher, resolveApiSecret());
}

async function getSettings(userId: number) {
    const db = getDb();
    const [row] = await db
        .select({
            gdriveToken: userSettings.gdriveToken,
            webdavUrl: userSettings.webdavUrl,
            webdavUsername: userSettings.webdavUsername,
            webdavPassword: userSettings.webdavPassword,
            backupAutoEnabled: userSettings.backupAutoEnabled,
            backupRetentionDays: userSettings.backupRetentionDays,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
    return row ?? null;
}

async function saveGDriveToken(userId: number, token: GDriveToken): Promise<void> {
    const db = getDb();
    const encrypted = encryptSecret(JSON.stringify(token));
    await db
        .insert(userSettings)
        .values({ userId, gdriveToken: encrypted })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: { gdriveToken: encrypted, updatedAt: new Date() },
        });
}

function parseGDriveToken(raw: string | null | undefined): GDriveToken | null {
    if (!raw) return null;
    try {
        return JSON.parse(decryptSecret(raw)) as GDriveToken;
    } catch {
        return null;
    }
}

function buildWebDAVConfig(row: {
    webdavUrl: string | null;
    webdavUsername: string | null;
    webdavPassword: string | null;
}): WebDAVConfig | null {
    if (!row.webdavUrl || !row.webdavUsername || !row.webdavPassword) return null;
    return {
        url: row.webdavUrl,
        username: row.webdavUsername,
        password: decryptSecret(row.webdavPassword),
    };
}

function makeFilename(): string {
    return `trakt-dash-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.pgdump.gz`;
}

// ─── Google Drive OAuth Device Flow ──────────────────────────────────────────

// POST /api/backup/gdrive/auth — start device flow
backupRoutes.post("/gdrive/auth", async (c) => {
    try {
        const data = await startGDriveDeviceFlow();
        return c.json({ ok: true, data });
    } catch (err) {
        return c.json({ error: (err as Error).message }, 502);
    }
});

// POST /api/backup/gdrive/poll — exchange device_code for token
backupRoutes.post("/gdrive/poll", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as { device_code?: string };
    if (!body.device_code) return c.json({ error: "device_code required" }, 400);

    let token: Awaited<ReturnType<typeof pollGDriveToken>>;
    try {
        token = await pollGDriveToken(body.device_code);
    } catch (err) {
        // access_denied, expired_token, etc. — surface as structured 400 rather than 500
        return c.json({ ok: false, pending: false, error: (err as Error).message }, 400);
    }
    if (!token) return c.json({ ok: false, pending: true });

    // Google omits refresh_token on re-consent when one was already granted. Persisting
    // an empty refresh_token would brick the next token refresh, so keep the existing one.
    if (!token.refresh_token) {
        const existing = parseGDriveToken((await getSettings(userId))?.gdriveToken);
        if (existing?.refresh_token) token.refresh_token = existing.refresh_token;
    }

    await saveGDriveToken(userId, token);
    return c.json({ ok: true, connected: true });
});

// DELETE /api/backup/gdrive/revoke — disconnect Google Drive
backupRoutes.delete("/gdrive/revoke", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const token = parseGDriveToken(row?.gdriveToken);
    if (token) {
        await revokeGDriveToken(token).catch(() => null);
    }
    const db = getDb();
    await db
        .insert(userSettings)
        .values({ userId, gdriveToken: null })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: { gdriveToken: null, updatedAt: new Date() },
        });
    return c.json({ ok: true });
});

// GET /api/backup/gdrive/status — check connection
backupRoutes.get("/gdrive/status", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const connected = !!parseGDriveToken(row?.gdriveToken);
    return c.json({ connected });
});

// ─── WebDAV Config ────────────────────────────────────────────────────────────

// PUT /api/backup/webdav — save WebDAV credentials
backupRoutes.put("/webdav", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        url?: string;
        username?: string;
        password?: string;
    };

    if (!body.url && !body.username && !body.password) {
        // Clear WebDAV config
        const db = getDb();
        await db
            .insert(userSettings)
            .values({ userId, webdavUrl: null, webdavUsername: null, webdavPassword: null })
            .onConflictDoUpdate({
                target: [userSettings.userId],
                set: {
                    webdavUrl: null,
                    webdavUsername: null,
                    webdavPassword: null,
                    updatedAt: new Date(),
                },
            });
        return c.json({ ok: true });
    }

    if (!body.url || !body.username || !body.password) {
        return c.json({ error: "url, username, password are all required" }, 400);
    }

    // Test connection before saving
    const testCfg: WebDAVConfig = {
        url: body.url,
        username: body.username,
        password: body.password,
    };
    try {
        await listWebDAVBackups(testCfg);
    } catch {
        return c.json({ error: "WebDAV connection test failed — check URL and credentials" }, 400);
    }

    const db = getDb();
    const encPwd = encryptSecret(body.password);
    await db
        .insert(userSettings)
        .values({
            userId,
            webdavUrl: body.url,
            webdavUsername: body.username,
            webdavPassword: encPwd,
        })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: {
                webdavUrl: body.url,
                webdavUsername: body.username,
                webdavPassword: encPwd,
                updatedAt: new Date(),
            },
        });
    return c.json({ ok: true });
});

// GET /api/backup/webdav/status
backupRoutes.get("/webdav/status", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const connected = !!(row?.webdavUrl && row?.webdavUsername && row?.webdavPassword);
    return c.json({ connected, url: row?.webdavUrl ?? null });
});

// ─── Backup Settings ──────────────────────────────────────────────────────────

// PUT /api/backup/settings
backupRoutes.put("/settings", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        autoEnabled?: boolean;
        retentionDays?: number;
    };
    const db = getDb();
    await db
        .insert(userSettings)
        .values({ userId })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: {
                ...(body.autoEnabled !== undefined ? { backupAutoEnabled: body.autoEnabled } : {}),
                ...(body.retentionDays !== undefined
                    ? { backupRetentionDays: body.retentionDays }
                    : {}),
                updatedAt: new Date(),
            },
        });
    return c.json({ ok: true });
});

// ─── Trigger Backup ───────────────────────────────────────────────────────────

// POST /api/backup/trigger
backupRoutes.post("/trigger", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        provider?: "gdrive" | "webdav" | "all";
    };
    const providers =
        body.provider === "gdrive"
            ? ["gdrive"]
            : body.provider === "webdav"
              ? ["webdav"]
              : ["gdrive", "webdav"];

    const row = await getSettings(userId);
    if (!row) return c.json({ error: "No backup configuration found" }, 400);

    const retentionDays = row.backupRetentionDays ?? 30;
    const results: Array<{ provider: string; ok: boolean; error?: string; filename?: string }> = [];

    let dumpBuffer: Buffer | null = null;
    let dumpError: string | null = null;
    try {
        dumpBuffer = await dumpDatabase();
    } catch (err) {
        dumpError = (err as Error).message;
    }

    const db = getDb();
    const filename = makeFilename();

    for (const provider of providers) {
        const startedAt = new Date();
        if (dumpError || !dumpBuffer) {
            await db.insert(backupRuns).values({
                userId,
                provider,
                status: "failed",
                filename,
                error: dumpError ?? "dump failed",
                startedAt,
                finishedAt: new Date(),
            });
            results.push({ provider, ok: false, error: dumpError ?? "dump failed" });
            continue;
        }

        if (provider === "gdrive") {
            const token = parseGDriveToken(row.gdriveToken);
            if (!token) {
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "failed",
                    filename,
                    error: "Google Drive not connected",
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: false, error: "Google Drive not connected" });
                continue;
            }
            try {
                const { fileId, refreshedToken } = await uploadToGDrive(
                    token,
                    dumpBuffer,
                    filename,
                );
                await saveGDriveToken(userId, refreshedToken);
                const prunedToken = await pruneOldGDriveBackups(
                    refreshedToken,
                    retentionDays,
                ).catch(() => refreshedToken);
                await saveGDriveToken(userId, prunedToken);
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "success",
                    filename,
                    sizeBytes: dumpBuffer.byteLength,
                    fileId,
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: true, filename });
            } catch (err) {
                const error = (err as Error).message;
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "failed",
                    filename,
                    error,
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: false, error });
            }
        } else if (provider === "webdav") {
            const cfg = buildWebDAVConfig(row);
            if (!cfg) {
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "failed",
                    filename,
                    error: "WebDAV not configured",
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: false, error: "WebDAV not configured" });
                continue;
            }
            try {
                await uploadToWebDAV(cfg, dumpBuffer, filename);
                await pruneOldWebDAVBackups(cfg, retentionDays).catch(() => null);
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "success",
                    filename,
                    sizeBytes: dumpBuffer.byteLength,
                    fileId: filename,
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: true, filename });
            } catch (err) {
                const error = (err as Error).message;
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "failed",
                    filename,
                    error,
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: false, error });
            }
        }
    }

    const anyOk = results.some((r) => r.ok);
    return c.json({ ok: anyOk, results }, anyOk ? 200 : 502);
});

// ─── Backup History ───────────────────────────────────────────────────────────

// GET /api/backup/runs?limit=20
backupRoutes.get("/runs", async (c) => {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
    const db = getDb();
    const runs = await db
        .select()
        .from(backupRuns)
        .where(eq(backupRuns.userId, userId))
        .orderBy(desc(backupRuns.startedAt))
        .limit(limit);
    return c.json({ data: runs });
});

// ─── List / Delete Remote Files ───────────────────────────────────────────────

// GET /api/backup/files?provider=gdrive|webdav
backupRoutes.get("/files", async (c) => {
    const userId = c.get("userId");
    const provider = c.req.query("provider") as "gdrive" | "webdav" | undefined;
    const row = await getSettings(userId);
    if (!row) return c.json({ data: [] });

    const files = [];
    if (!provider || provider === "gdrive") {
        const token = parseGDriveToken(row.gdriveToken);
        if (token) {
            const { files: gFiles, refreshedToken } = await listGDriveBackups(token).catch(() => ({
                files: [],
                refreshedToken: token,
            }));
            await saveGDriveToken(userId, refreshedToken).catch(() => null);
            files.push(...gFiles);
        }
    }
    if (!provider || provider === "webdav") {
        const cfg = buildWebDAVConfig(row);
        if (cfg) {
            const wFiles = await listWebDAVBackups(cfg).catch(() => []);
            files.push(...wFiles);
        }
    }

    return c.json({ data: files });
});

// DELETE /api/backup/files — delete a remote file
backupRoutes.delete("/files", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        provider: "gdrive" | "webdav";
        fileId: string;
    };
    if (!body.provider || !body.fileId) {
        return c.json({ error: "provider and fileId required" }, 400);
    }

    const row = await getSettings(userId);
    if (!row) return c.json({ error: "No backup config" }, 400);

    if (body.provider === "gdrive") {
        const token = parseGDriveToken(row.gdriveToken);
        if (!token) return c.json({ error: "GDrive not connected" }, 400);
        await deleteGDriveFile(token, body.fileId);
    } else {
        const cfg = buildWebDAVConfig(row);
        if (!cfg) return c.json({ error: "WebDAV not configured" }, 400);
        await deleteWebDAVFile(cfg, body.fileId);
    }

    return c.json({ ok: true });
});
