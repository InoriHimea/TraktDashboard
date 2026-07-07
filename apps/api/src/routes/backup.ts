import { Hono } from "hono";
import { getDb, userSettings, backupRuns } from "@trakt-dashboard/db";
import { registerUserBackupJob } from "../jobs/scheduler.js";
import { eq, desc } from "drizzle-orm";
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
    startOneDriveDeviceFlow,
    pollOneDriveToken,
    uploadToOneDrive,
    listOneDriveBackups,
    deleteOneDriveFile,
    pruneOldOneDriveBackups,
    uploadToS3,
    listS3Backups,
    deleteS3File,
    pruneOldS3Backups,
    dumpDatabase,
    restoreDatabase,
    downloadGDriveFile,
    downloadWebDAVFile,
    downloadOneDriveFile,
    downloadS3File,
    isGDriveConfigured,
    isOneDriveConfigured,
    type GDriveToken,
    type OneDriveToken,
    type WebDAVConfig,
    type S3Config,
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
            onedriveToken: userSettings.onedriveToken,
            s3Endpoint: userSettings.s3Endpoint,
            s3Region: userSettings.s3Region,
            s3Bucket: userSettings.s3Bucket,
            s3AccessKeyId: userSettings.s3AccessKeyId,
            s3SecretAccessKey: userSettings.s3SecretAccessKey,
            backupScheduleHours: userSettings.backupScheduleHours,
            backupActiveProvider: userSettings.backupActiveProvider,
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
    return `mediadash-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.pgdump.gz`;
}

function parseOneDriveToken(raw: string | null | undefined): OneDriveToken | null {
    if (!raw) return null;
    try {
        return JSON.parse(decryptSecret(raw)) as OneDriveToken;
    } catch {
        return null;
    }
}

async function saveOneDriveToken(userId: number, token: OneDriveToken): Promise<void> {
    const db = getDb();
    const encrypted = encryptSecret(JSON.stringify(token));
    await db
        .insert(userSettings)
        .values({ userId, onedriveToken: encrypted })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: { onedriveToken: encrypted, updatedAt: new Date() },
        });
}

function buildS3Config(row: {
    s3Endpoint: string | null;
    s3Region: string | null;
    s3Bucket: string | null;
    s3AccessKeyId: string | null;
    s3SecretAccessKey: string | null;
}): S3Config | null {
    if (
        !row.s3Endpoint ||
        !row.s3Region ||
        !row.s3Bucket ||
        !row.s3AccessKeyId ||
        !row.s3SecretAccessKey
    )
        return null;
    return {
        endpoint: row.s3Endpoint,
        region: row.s3Region,
        bucket: row.s3Bucket,
        accessKeyId: row.s3AccessKeyId,
        secretAccessKey: decryptSecret(row.s3SecretAccessKey),
    };
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

// GET /api/backup/gdrive/status — check connection.
// `configured` = the self-registered OAuth app credentials exist in env (N6 batch 3a);
// when false the UI hides the provider entirely instead of offering a doomed connect flow.
backupRoutes.get("/gdrive/status", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const connected = !!parseGDriveToken(row?.gdriveToken);
    return c.json({ connected, configured: isGDriveConfigured() });
});

// ─── OneDrive Device Code Flow ───────────────────────────────────────────────

backupRoutes.post("/onedrive/auth", async (c) => {
    try {
        const data = await startOneDriveDeviceFlow();
        return c.json({ ok: true, data });
    } catch (err) {
        return c.json({ error: (err as Error).message }, 502);
    }
});

backupRoutes.post("/onedrive/poll", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as { device_code?: string };
    if (!body.device_code) return c.json({ error: "device_code required" }, 400);

    let token: Awaited<ReturnType<typeof pollOneDriveToken>>;
    try {
        token = await pollOneDriveToken(body.device_code);
    } catch (err) {
        return c.json({ ok: false, pending: false, error: (err as Error).message }, 400);
    }
    if (!token) return c.json({ ok: false, pending: true });

    await saveOneDriveToken(userId, token);
    return c.json({ ok: true, connected: true });
});

backupRoutes.delete("/onedrive/revoke", async (c) => {
    const userId = c.get("userId");
    const db = getDb();
    await db
        .insert(userSettings)
        .values({ userId, onedriveToken: null })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: { onedriveToken: null, updatedAt: new Date() },
        });
    return c.json({ ok: true });
});

// `configured` semantics — see the gdrive/status comment above.
backupRoutes.get("/onedrive/status", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const connected = !!parseOneDriveToken(row?.onedriveToken);
    return c.json({ connected, configured: isOneDriveConfigured() });
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

// ─── S3-compatible Storage ────────────────────────────────────────────────────

// PUT /api/backup/s3 — save S3 config (also tests connectivity by listing)
backupRoutes.put("/s3", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        endpoint?: string;
        region?: string;
        bucket?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
    };

    if (
        !body.endpoint &&
        !body.region &&
        !body.bucket &&
        !body.accessKeyId &&
        !body.secretAccessKey
    ) {
        // Clear S3 config
        const db = getDb();
        await db
            .insert(userSettings)
            .values({
                userId,
                s3Endpoint: null,
                s3Region: null,
                s3Bucket: null,
                s3AccessKeyId: null,
                s3SecretAccessKey: null,
            })
            .onConflictDoUpdate({
                target: [userSettings.userId],
                set: {
                    s3Endpoint: null,
                    s3Region: null,
                    s3Bucket: null,
                    s3AccessKeyId: null,
                    s3SecretAccessKey: null,
                    updatedAt: new Date(),
                },
            });
        return c.json({ ok: true });
    }

    if (
        !body.endpoint ||
        !body.region ||
        !body.bucket ||
        !body.accessKeyId ||
        !body.secretAccessKey
    ) {
        return c.json(
            { error: "endpoint, region, bucket, accessKeyId, secretAccessKey are all required" },
            400,
        );
    }

    const testCfg: S3Config = {
        endpoint: body.endpoint,
        region: body.region,
        bucket: body.bucket,
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
    };
    try {
        await listS3Backups(testCfg);
    } catch {
        return c.json(
            { error: "S3 connection test failed — check endpoint, region, bucket and credentials" },
            400,
        );
    }

    const db = getDb();
    const encSecret = encryptSecret(body.secretAccessKey);
    await db
        .insert(userSettings)
        .values({
            userId,
            s3Endpoint: body.endpoint,
            s3Region: body.region,
            s3Bucket: body.bucket,
            s3AccessKeyId: body.accessKeyId,
            s3SecretAccessKey: encSecret,
        })
        .onConflictDoUpdate({
            target: [userSettings.userId],
            set: {
                s3Endpoint: body.endpoint,
                s3Region: body.region,
                s3Bucket: body.bucket,
                s3AccessKeyId: body.accessKeyId,
                s3SecretAccessKey: encSecret,
                updatedAt: new Date(),
            },
        });
    return c.json({ ok: true });
});

// GET /api/backup/s3/status
backupRoutes.get("/s3/status", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    const connected = !!(
        row?.s3Endpoint &&
        row?.s3Bucket &&
        row?.s3AccessKeyId &&
        row?.s3SecretAccessKey
    );
    return c.json({
        connected,
        endpoint: row?.s3Endpoint ?? null,
        bucket: row?.s3Bucket ?? null,
    });
});

// ─── Backup Settings ──────────────────────────────────────────────────────────

// PUT /api/backup/settings
backupRoutes.put("/settings", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        autoEnabled?: boolean;
        retentionDays?: number;
        scheduleHours?: number;
        activeProvider?: string | null;
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
                ...(body.scheduleHours !== undefined
                    ? { backupScheduleHours: body.scheduleHours }
                    : {}),
                ...(body.activeProvider !== undefined
                    ? { backupActiveProvider: body.activeProvider }
                    : {}),
                updatedAt: new Date(),
            },
        });
    // Re-register backup job so schedule change takes effect without a restart
    if (body.scheduleHours !== undefined) {
        await registerUserBackupJob(userId).catch(() => null);
    }
    return c.json({ ok: true });
});

// GET /api/backup/settings
backupRoutes.get("/settings", async (c) => {
    const userId = c.get("userId");
    const row = await getSettings(userId);
    return c.json({
        scheduleHours: row?.backupScheduleHours ?? 0,
        activeProvider: row?.backupActiveProvider ?? null,
        retentionDays: row?.backupRetentionDays ?? 30,
        autoEnabled: row?.backupAutoEnabled ?? false,
    });
});

// ─── Trigger Backup ───────────────────────────────────────────────────────────

// POST /api/backup/trigger
backupRoutes.post("/trigger", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        provider?: "gdrive" | "webdav" | "onedrive" | "s3" | "all";
    };

    const row = await getSettings(userId);
    if (!row) return c.json({ error: "No backup configuration found" }, 400);

    // Expand "all" to whatever providers are currently connected
    let providers: string[];
    if (!body.provider || body.provider === "all") {
        providers = [];
        if (parseGDriveToken(row.gdriveToken)) providers.push("gdrive");
        if (row.webdavUrl && row.webdavUsername && row.webdavPassword) providers.push("webdav");
        if (parseOneDriveToken(row.onedriveToken)) providers.push("onedrive");
        if (row.s3Endpoint && row.s3Bucket && row.s3AccessKeyId && row.s3SecretAccessKey)
            providers.push("s3");
    } else {
        providers = [body.provider];
    }

    if (providers.length === 0) return c.json({ error: "No providers connected" }, 400);

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

        try {
            if (provider === "gdrive") {
                const token = parseGDriveToken(row.gdriveToken);
                if (!token) throw new Error("Google Drive not connected");
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
            } else if (provider === "webdav") {
                const cfg = buildWebDAVConfig(row);
                if (!cfg) throw new Error("WebDAV not configured");
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
            } else if (provider === "onedrive") {
                const token = parseOneDriveToken(row.onedriveToken);
                if (!token) throw new Error("OneDrive not connected");
                const { itemId, refreshedToken } = await uploadToOneDrive(
                    token,
                    dumpBuffer,
                    filename,
                );
                await saveOneDriveToken(userId, refreshedToken);
                const prunedToken = await pruneOldOneDriveBackups(
                    refreshedToken,
                    retentionDays,
                ).catch(() => refreshedToken);
                await saveOneDriveToken(userId, prunedToken);
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "success",
                    filename,
                    sizeBytes: dumpBuffer.byteLength,
                    fileId: itemId,
                    startedAt,
                    finishedAt: new Date(),
                });
                results.push({ provider, ok: true, filename });
            } else if (provider === "s3") {
                const cfg = buildS3Config(row);
                if (!cfg) throw new Error("S3 not configured");
                await uploadToS3(cfg, dumpBuffer, filename);
                await pruneOldS3Backups(cfg, retentionDays).catch(() => null);
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
            }
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

// GET /api/backup/files?provider=gdrive|webdav|onedrive|s3
backupRoutes.get("/files", async (c) => {
    const userId = c.get("userId");
    const provider = c.req.query("provider") as "gdrive" | "webdav" | "onedrive" | "s3" | undefined;
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
        if (cfg) files.push(...(await listWebDAVBackups(cfg).catch(() => [])));
    }
    if (!provider || provider === "onedrive") {
        const token = parseOneDriveToken(row.onedriveToken);
        if (token) {
            const { files: oFiles, refreshedToken } = await listOneDriveBackups(token).catch(
                () => ({ files: [], refreshedToken: token }),
            );
            await saveOneDriveToken(userId, refreshedToken).catch(() => null);
            files.push(...oFiles);
        }
    }
    if (!provider || provider === "s3") {
        const cfg = buildS3Config(row);
        if (cfg) files.push(...(await listS3Backups(cfg).catch(() => [])));
    }

    return c.json({ data: files });
});

// DELETE /api/backup/files — delete a remote file
backupRoutes.delete("/files", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        provider: "gdrive" | "webdav" | "onedrive" | "s3";
        fileId: string;
    };
    if (!body.provider || !body.fileId)
        return c.json({ error: "provider and fileId required" }, 400);

    const row = await getSettings(userId);
    if (!row) return c.json({ error: "No backup config" }, 400);

    if (body.provider === "gdrive") {
        const token = parseGDriveToken(row.gdriveToken);
        if (!token) return c.json({ error: "GDrive not connected" }, 400);
        await deleteGDriveFile(token, body.fileId);
    } else if (body.provider === "webdav") {
        const cfg = buildWebDAVConfig(row);
        if (!cfg) return c.json({ error: "WebDAV not configured" }, 400);
        await deleteWebDAVFile(cfg, body.fileId);
    } else if (body.provider === "onedrive") {
        const token = parseOneDriveToken(row.onedriveToken);
        if (!token) return c.json({ error: "OneDrive not connected" }, 400);
        await deleteOneDriveFile(token, body.fileId);
    } else if (body.provider === "s3") {
        const cfg = buildS3Config(row);
        if (!cfg) return c.json({ error: "S3 not configured" }, 400);
        await deleteS3File(cfg, body.fileId);
    }

    return c.json({ ok: true });
});

// ─── Restore (N6 batch 3b) ───────────────────────────────────────────────────

// Restore replaces the ENTIRE database, so guard against concurrent invocations —
// module-level state is fine: restores are rare, and the process exits on success.
let restoreInProgress = false;

// POST /api/backup/restore { provider, fileId } — download a backup, snapshot the current
// DB to the same provider as a safety net, replay the dump, then exit the process so the
// container/watcher restarts it with a clean connection pool (drizzle's pool holds
// prepared statements against the pre-restore schema).
backupRoutes.post("/restore", async (c) => {
    const userId = c.get("userId");
    const body = (await c.req.json().catch(() => ({}))) as {
        provider?: "gdrive" | "webdav" | "onedrive" | "s3";
        fileId?: string;
    };
    if (!body.provider || !body.fileId)
        return c.json({ error: "provider and fileId required" }, 400);
    if (restoreInProgress) return c.json({ error: "restore already in progress" }, 409);
    restoreInProgress = true;

    try {
        const row = await getSettings(userId);
        if (!row) return c.json({ error: "No backup config" }, 400);

        // 1. Download the requested backup first — no point snapshotting if the
        //    file is unreachable.
        let dumpGz: Buffer;
        if (body.provider === "gdrive") {
            const token = parseGDriveToken(row.gdriveToken);
            if (!token) return c.json({ error: "GDrive not connected" }, 400);
            dumpGz = (await downloadGDriveFile(token, body.fileId)).data;
        } else if (body.provider === "webdav") {
            const cfg = buildWebDAVConfig(row);
            if (!cfg) return c.json({ error: "WebDAV not configured" }, 400);
            dumpGz = await downloadWebDAVFile(cfg, body.fileId);
        } else if (body.provider === "onedrive") {
            const token = parseOneDriveToken(row.onedriveToken);
            if (!token) return c.json({ error: "OneDrive not connected" }, 400);
            dumpGz = (await downloadOneDriveFile(token, body.fileId)).data;
        } else if (body.provider === "s3") {
            const cfg = buildS3Config(row);
            if (!cfg) return c.json({ error: "S3 not configured" }, 400);
            dumpGz = await downloadS3File(cfg, body.fileId);
        } else {
            return c.json({ error: "unknown provider" }, 400);
        }

        // 2. Safety net: snapshot the CURRENT database to the same provider before
        //    overwriting anything. A failed safety upload aborts the restore.
        const safetyName = makeFilename().replace(
            "mediadash-backup-",
            "mediadash-backup-pre-restore-",
        );
        const currentDump = await dumpDatabase();
        if (body.provider === "gdrive") {
            const token = parseGDriveToken(row.gdriveToken)!;
            const { refreshedToken } = await uploadToGDrive(token, currentDump, safetyName);
            await saveGDriveToken(userId, refreshedToken).catch(() => null);
        } else if (body.provider === "webdav") {
            await uploadToWebDAV(buildWebDAVConfig(row)!, currentDump, safetyName);
        } else if (body.provider === "onedrive") {
            const token = parseOneDriveToken(row.onedriveToken)!;
            const { refreshedToken } = await uploadToOneDrive(token, currentDump, safetyName);
            await saveOneDriveToken(userId, refreshedToken).catch(() => null);
        } else {
            await uploadToS3(buildS3Config(row)!, currentDump, safetyName);
        }

        // 3. Replay the dump (single transaction — all-or-nothing).
        await restoreDatabase(dumpGz);

        // 4. Hand the response back, then exit so the process restarts with a clean
        //    pool against the restored schema (docker restart policy / bun --watch).
        setTimeout(() => {
            console.log("[backup] Restore complete — exiting for a clean restart");
            process.exit(0);
        }, 1500);
        return c.json({ ok: true, requiresRestart: true, safetyBackup: safetyName });
    } catch (err) {
        return c.json({ error: (err as Error).message }, 500);
    } finally {
        restoreInProgress = false;
    }
});

// ─── Exported helper for scheduler ───────────────────────────────────────────

export async function runScheduledBackup(userId: number): Promise<void> {
    const row = await getSettings(userId);
    if (!row || !row.backupScheduleHours || row.backupScheduleHours <= 0) return;

    const retentionDays = row.backupRetentionDays ?? 30;
    const db = getDb();
    const filename = makeFilename();

    let dumpBuffer: Buffer;
    try {
        dumpBuffer = await dumpDatabase();
    } catch (err) {
        console.error(`[backup] Scheduled dump failed for user ${userId}:`, err);
        return;
    }

    const connected: string[] = [];
    if (parseGDriveToken(row.gdriveToken)) connected.push("gdrive");
    if (row.webdavUrl && row.webdavUsername && row.webdavPassword) connected.push("webdav");
    if (parseOneDriveToken(row.onedriveToken)) connected.push("onedrive");
    if (row.s3Endpoint && row.s3Bucket && row.s3AccessKeyId && row.s3SecretAccessKey)
        connected.push("s3");

    const target = row.backupActiveProvider;
    const targets = target && connected.includes(target) ? [target] : connected;

    for (const provider of targets) {
        const startedAt = new Date();
        try {
            if (provider === "gdrive") {
                const token = parseGDriveToken(row.gdriveToken)!;
                const { fileId, refreshedToken } = await uploadToGDrive(
                    token,
                    dumpBuffer,
                    filename,
                );
                await saveGDriveToken(userId, refreshedToken);
                await pruneOldGDriveBackups(refreshedToken, retentionDays).catch(() => null);
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
            } else if (provider === "webdav") {
                const cfg = buildWebDAVConfig(row)!;
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
            } else if (provider === "onedrive") {
                const token = parseOneDriveToken(row.onedriveToken)!;
                const { itemId, refreshedToken } = await uploadToOneDrive(
                    token,
                    dumpBuffer,
                    filename,
                );
                await saveOneDriveToken(userId, refreshedToken);
                await pruneOldOneDriveBackups(refreshedToken, retentionDays).catch(() => null);
                await db.insert(backupRuns).values({
                    userId,
                    provider,
                    status: "success",
                    filename,
                    sizeBytes: dumpBuffer.byteLength,
                    fileId: itemId,
                    startedAt,
                    finishedAt: new Date(),
                });
            } else if (provider === "s3") {
                const cfg = buildS3Config(row)!;
                await uploadToS3(cfg, dumpBuffer, filename);
                await pruneOldS3Backups(cfg, retentionDays).catch(() => null);
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
            }
            console.log(`[backup] Scheduled backup to ${provider} succeeded for user ${userId}`);
        } catch (err) {
            const error = (err as Error).message;
            console.error(
                `[backup] Scheduled backup to ${provider} failed for user ${userId}:`,
                error,
            );
            await db
                .insert(backupRuns)
                .values({
                    userId,
                    provider,
                    status: "failed",
                    filename,
                    error,
                    startedAt,
                    finishedAt: new Date(),
                })
                .catch(() => null);
        }
    }
}
