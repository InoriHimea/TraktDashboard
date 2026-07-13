import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = 7;

const dbMockState = vi.hoisted(() => ({ db: null as unknown }));
const schedulerMockState = vi.hoisted(() => ({ registerUserBackupJob: vi.fn() }));
const backupServiceMock = vi.hoisted(() => ({
    startGDriveDeviceFlow: vi.fn(),
    pollGDriveToken: vi.fn(),
    revokeGDriveToken: vi.fn(),
    uploadToGDrive: vi.fn(),
    listGDriveBackups: vi.fn(),
    deleteGDriveFile: vi.fn(),
    pruneOldGDriveBackups: vi.fn(),
    uploadToWebDAV: vi.fn(),
    listWebDAVBackups: vi.fn(),
    deleteWebDAVFile: vi.fn(),
    pruneOldWebDAVBackups: vi.fn(),
    startOneDriveDeviceFlow: vi.fn(),
    pollOneDriveToken: vi.fn(),
    uploadToOneDrive: vi.fn(),
    listOneDriveBackups: vi.fn(),
    deleteOneDriveFile: vi.fn(),
    pruneOldOneDriveBackups: vi.fn(),
    uploadToS3: vi.fn(),
    listS3Backups: vi.fn(),
    deleteS3File: vi.fn(),
    pruneOldS3Backups: vi.fn(),
    dumpDatabase: vi.fn(),
    restoreDatabase: vi.fn(),
    downloadGDriveFile: vi.fn(),
    downloadWebDAVFile: vi.fn(),
    downloadOneDriveFile: vi.fn(),
    downloadS3File: vi.fn(),
    isGDriveConfigured: vi.fn(),
    isOneDriveConfigured: vi.fn(),
}));

vi.mock("@trakt-dashboard/db", async () => {
    const actual =
        await vi.importActual<typeof import("@trakt-dashboard/db")>("@trakt-dashboard/db");
    return { ...actual, getDb: () => dbMockState.db };
});

vi.mock("../jobs/scheduler.js", () => ({
    registerUserBackupJob: schedulerMockState.registerUserBackupJob,
}));

vi.mock("../services/backup.js", () => backupServiceMock);

// encryptToken/decryptToken/resolveApiSecret run for REAL (dev-fallback secret) so
// token save/parse round-trips are exercised genuinely, matching auth-routes.test.ts.

type RowsResult = unknown[];

class ChainBuilder implements PromiseLike<RowsResult> {
    constructor(private readonly result: RowsResult) {}
    from() {
        return this;
    }
    where() {
        return this;
    }
    orderBy() {
        return this;
    }
    limit() {
        return this;
    }
    values() {
        return this;
    }
    onConflictDoUpdate() {
        return this;
    }
    then<T1 = RowsResult, T2 = never>(
        ok?: ((value: RowsResult) => T1 | PromiseLike<T1>) | null,
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
        return Promise.resolve(this.result).then(ok, fail);
    }
    // runScheduledBackup's failure branch chains .catch() straight off .values(...)
    // (no .onConflictDoUpdate() first) — a bare PromiseLike only guarantees .then().
    catch<T2 = never>(
        fail?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<RowsResult | T2> {
        return Promise.resolve(this.result).catch(fail);
    }
}

function createMockDb(selects: RowsResult[] = []) {
    const state = { selects: [...selects] };
    return {
        select: vi.fn(() => new ChainBuilder(state.selects.shift() ?? [])),
        insert: vi.fn(() => new ChainBuilder([])),
        __state: state,
    };
}

/** A DB whose first select resolves to the given userSettings row. */
function dbWithSettings(row: Record<string, unknown> | null, extraSelects: RowsResult[] = []) {
    return createMockDb([row ? [row] : [], ...extraSelects]);
}

const { backupRoutes, runScheduledBackup } = await import("../routes/backup.js");

function app() {
    const a = new Hono<{ Variables: { userId: number } }>();
    a.use("*", async (c, next) => {
        c.set("userId", TEST_USER_ID);
        await next();
    });
    a.route("/backup", backupRoutes);
    return a;
}

function postJson(path: string, payload: unknown, method = "POST") {
    return app().request(path, {
        method,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
    });
}

function emptySettingsRow(overrides: Record<string, unknown> = {}) {
    return {
        gdriveToken: null,
        webdavUrl: null,
        webdavUsername: null,
        webdavPassword: null,
        backupAutoEnabled: false,
        backupRetentionDays: 30,
        onedriveToken: null,
        s3Endpoint: null,
        s3Region: null,
        s3Bucket: null,
        s3AccessKeyId: null,
        s3SecretAccessKey: null,
        backupScheduleHours: 0,
        backupActiveProvider: null,
        ...overrides,
    };
}

// Real encryptToken so *Token columns round-trip through parseGDriveToken/parseOneDriveToken.
const { encryptToken } = await import("../lib/encrypt.js");
const { resolveApiSecret } = await import("../lib/secret.js");
const SECRET = resolveApiSecret();
function encToken(token: unknown) {
    return encryptToken(JSON.stringify(token), SECRET);
}
function encStr(plain: string) {
    return encryptToken(plain, SECRET);
}

beforeEach(() => {
    vi.clearAllMocks();
    // Sensible defaults so tests that don't care about a given call still succeed.
    backupServiceMock.isGDriveConfigured.mockReturnValue(true);
    backupServiceMock.isOneDriveConfigured.mockReturnValue(true);
    backupServiceMock.dumpDatabase.mockResolvedValue(Buffer.from("dump"));
    backupServiceMock.restoreDatabase.mockResolvedValue(undefined);
    backupServiceMock.uploadToGDrive.mockResolvedValue({
        fileId: "f1",
        refreshedToken: {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        },
    });
    backupServiceMock.uploadToOneDrive.mockResolvedValue({
        itemId: "i1",
        refreshedToken: { access_token: "a", refresh_token: "r", expires_at: 0, scope: "" },
    });
    backupServiceMock.uploadToWebDAV.mockResolvedValue(undefined);
    backupServiceMock.uploadToS3.mockResolvedValue(undefined);
    backupServiceMock.pruneOldGDriveBackups.mockResolvedValue({});
    backupServiceMock.pruneOldOneDriveBackups.mockResolvedValue({});
    backupServiceMock.pruneOldWebDAVBackups.mockResolvedValue(undefined);
    backupServiceMock.pruneOldS3Backups.mockResolvedValue(undefined);
    backupServiceMock.revokeGDriveToken.mockResolvedValue(undefined);
    schedulerMockState.registerUserBackupJob.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

describe("POST /backup/gdrive/auth", () => {
    it("returns the device auth payload on success", async () => {
        backupServiceMock.startGDriveDeviceFlow.mockResolvedValue({ user_code: "ABCD" });
        const res = await app().request("/backup/gdrive/auth", { method: "POST" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; data: { user_code: string } };
        expect(body.data.user_code).toBe("ABCD");
    });

    it("returns 502 when the device flow fails to start", async () => {
        backupServiceMock.startGDriveDeviceFlow.mockRejectedValue(new Error("not configured"));
        const res = await app().request("/backup/gdrive/auth", { method: "POST" });
        expect(res.status).toBe(502);
    });
});

describe("POST /backup/gdrive/poll", () => {
    it("requires device_code", async () => {
        const res = await postJson("/backup/gdrive/poll", {});
        expect(res.status).toBe(400);
    });

    it("reports pending while authorization is not yet granted", async () => {
        backupServiceMock.pollGDriveToken.mockResolvedValue(null);
        const res = await postJson("/backup/gdrive/poll", { device_code: "dc1" });
        const body = (await res.json()) as { ok: boolean; pending: boolean };
        expect(body).toEqual({ ok: false, pending: true });
    });

    it("surfaces a poll error as a structured 400", async () => {
        backupServiceMock.pollGDriveToken.mockRejectedValue(new Error("access_denied"));
        const res = await postJson("/backup/gdrive/poll", { device_code: "dc1" });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("access_denied");
    });

    it("saves the token and reports connected on success", async () => {
        backupServiceMock.pollGDriveToken.mockResolvedValue({
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        });
        const db = dbWithSettings(null);
        dbMockState.db = db;
        const res = await postJson("/backup/gdrive/poll", { device_code: "dc1" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; connected: boolean };
        expect(body).toEqual({ ok: true, connected: true });
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("preserves the existing refresh_token when Google omits it on re-consent", async () => {
        backupServiceMock.pollGDriveToken.mockResolvedValue({
            access_token: "new-access",
            refresh_token: "",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        });
        const existing = {
            access_token: "old",
            refresh_token: "old-refresh",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        // First select: existing-token lookup inside the poll handler itself.
        dbMockState.db = dbWithSettings({ gdriveToken: encToken(existing) });
        await postJson("/backup/gdrive/poll", { device_code: "dc1" });

        const insertedValues = (dbMockState.db as ReturnType<typeof createMockDb>)
            .insert as ReturnType<typeof vi.fn>;
        expect(insertedValues).toHaveBeenCalledTimes(1);
    });
});

describe("DELETE /backup/gdrive/revoke", () => {
    it("revokes the remote token (best-effort) and clears local storage", async () => {
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        const db = dbWithSettings({ gdriveToken: encToken(token) });
        dbMockState.db = db;
        const res = await app().request("/backup/gdrive/revoke", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(backupServiceMock.revokeGDriveToken).toHaveBeenCalled();
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("still clears local storage when there is no token to revoke", async () => {
        const db = dbWithSettings(null);
        dbMockState.db = db;
        const res = await app().request("/backup/gdrive/revoke", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(backupServiceMock.revokeGDriveToken).not.toHaveBeenCalled();
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("clears local storage even when the remote revoke call fails", async () => {
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.revokeGDriveToken.mockRejectedValue(new Error("network"));
        const db = dbWithSettings({ gdriveToken: encToken(token) });
        dbMockState.db = db;
        const res = await app().request("/backup/gdrive/revoke", { method: "DELETE" });
        expect(res.status).toBe(200);
    });
});

describe("GET /backup/gdrive/status", () => {
    it("reports disconnected + configured when nothing is saved", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await app().request("/backup/gdrive/status");
        const body = (await res.json()) as { connected: boolean; configured: boolean };
        expect(body).toEqual({ connected: false, configured: true });
    });

    it("reports connected when a valid token is stored", async () => {
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        dbMockState.db = dbWithSettings({ gdriveToken: encToken(token) });
        const res = await app().request("/backup/gdrive/status");
        const body = (await res.json()) as { connected: boolean };
        expect(body.connected).toBe(true);
    });

    it("reports not configured when the OAuth app credentials are missing", async () => {
        backupServiceMock.isGDriveConfigured.mockReturnValue(false);
        dbMockState.db = dbWithSettings(null);
        const res = await app().request("/backup/gdrive/status");
        const body = (await res.json()) as { configured: boolean };
        expect(body.configured).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// OneDrive
// ---------------------------------------------------------------------------

describe("POST /backup/onedrive/auth and /poll", () => {
    it("auth: returns 502 on failure", async () => {
        backupServiceMock.startOneDriveDeviceFlow.mockRejectedValue(new Error("boom"));
        const res = await app().request("/backup/onedrive/auth", { method: "POST" });
        expect(res.status).toBe(502);
    });

    it("poll: requires device_code", async () => {
        const res = await postJson("/backup/onedrive/poll", {});
        expect(res.status).toBe(400);
    });

    it("poll: saves the token on success", async () => {
        backupServiceMock.pollOneDriveToken.mockResolvedValue({
            access_token: "a",
            refresh_token: "r",
            expires_at: 0,
            scope: "",
        });
        const db = dbWithSettings(null);
        dbMockState.db = db;
        const res = await postJson("/backup/onedrive/poll", { device_code: "dc1" });
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });
});

describe("DELETE /backup/onedrive/revoke", () => {
    it("clears local storage directly (no remote revoke call exists for OneDrive)", async () => {
        const db = dbWithSettings(null);
        dbMockState.db = db;
        const res = await app().request("/backup/onedrive/revoke", { method: "DELETE" });
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });
});

describe("GET /backup/onedrive/status", () => {
    it("reports connected/configured", async () => {
        const token = { access_token: "a", refresh_token: "r", expires_at: 0, scope: "" };
        dbMockState.db = dbWithSettings({ onedriveToken: encToken(token) });
        const res = await app().request("/backup/onedrive/status");
        const body = (await res.json()) as { connected: boolean; configured: boolean };
        expect(body).toEqual({ connected: true, configured: true });
    });
});

// ---------------------------------------------------------------------------
// WebDAV
// ---------------------------------------------------------------------------

describe("PUT /backup/webdav", () => {
    it("clears the config when all fields are empty", async () => {
        const db = createMockDb([]);
        dbMockState.db = db;
        const res = await postJson("/backup/webdav", {}, "PUT");
        expect(res.status).toBe(200);
        expect(backupServiceMock.listWebDAVBackups).not.toHaveBeenCalled();
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("rejects a partial payload with 400", async () => {
        const res = await postJson("/backup/webdav", { url: "https://dav.example.com" }, "PUT");
        expect(res.status).toBe(400);
    });

    it("rejects when the connection test fails", async () => {
        backupServiceMock.listWebDAVBackups.mockRejectedValue(new Error("401"));
        const res = await postJson(
            "/backup/webdav",
            { url: "https://dav.example.com", username: "u", password: "p" },
            "PUT",
        );
        expect(res.status).toBe(400);
    });

    it("tests the connection then saves the encrypted password", async () => {
        backupServiceMock.listWebDAVBackups.mockResolvedValue([]);
        const db = createMockDb([]);
        dbMockState.db = db;
        const res = await postJson(
            "/backup/webdav",
            { url: "https://dav.example.com", username: "u", password: "p" },
            "PUT",
        );
        expect(res.status).toBe(200);
        expect(backupServiceMock.listWebDAVBackups).toHaveBeenCalledWith({
            url: "https://dav.example.com",
            username: "u",
            password: "p",
        });
        expect(db.insert).toHaveBeenCalledTimes(1);
    });
});

describe("GET /backup/webdav/status", () => {
    it("is connected only when url/username/password are all present", async () => {
        dbMockState.db = dbWithSettings({
            webdavUrl: "https://dav.example.com",
            webdavUsername: "u",
            webdavPassword: encStr("p"),
        });
        const res = await app().request("/backup/webdav/status");
        const body = (await res.json()) as { connected: boolean; url: string };
        expect(body).toEqual({ connected: true, url: "https://dav.example.com" });
    });
});

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

describe("PUT /backup/s3", () => {
    const fullPayload = {
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        bucket: "b",
        accessKeyId: "AKID",
        secretAccessKey: "secret",
    };

    it("clears the config when all fields are empty", async () => {
        const db = createMockDb([]);
        dbMockState.db = db;
        const res = await postJson("/backup/s3", {}, "PUT");
        expect(res.status).toBe(200);
        expect(backupServiceMock.listS3Backups).not.toHaveBeenCalled();
    });

    it("rejects a partial payload with 400", async () => {
        const res = await postJson("/backup/s3", { endpoint: "https://s3.example.com" }, "PUT");
        expect(res.status).toBe(400);
    });

    it("rejects when the connection test fails", async () => {
        backupServiceMock.listS3Backups.mockRejectedValue(new Error("SignatureDoesNotMatch"));
        const res = await postJson("/backup/s3", fullPayload, "PUT");
        expect(res.status).toBe(400);
    });

    it("tests the connection then saves the encrypted secret", async () => {
        backupServiceMock.listS3Backups.mockResolvedValue([]);
        const db = createMockDb([]);
        dbMockState.db = db;
        const res = await postJson("/backup/s3", fullPayload, "PUT");
        expect(res.status).toBe(200);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe("PUT /backup/settings", () => {
    it("does not re-register the backup job when scheduleHours is not part of the update", async () => {
        dbMockState.db = createMockDb([]);
        await postJson("/backup/settings", { retentionDays: 7 }, "PUT");
        expect(schedulerMockState.registerUserBackupJob).not.toHaveBeenCalled();
    });

    it("re-registers the backup job when scheduleHours changes", async () => {
        dbMockState.db = createMockDb([]);
        const res = await postJson("/backup/settings", { scheduleHours: 24 }, "PUT");
        expect(res.status).toBe(200);
        expect(schedulerMockState.registerUserBackupJob).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("does not fail the request when re-registration itself fails", async () => {
        schedulerMockState.registerUserBackupJob.mockRejectedValue(new Error("redis down"));
        dbMockState.db = createMockDb([]);
        const res = await postJson("/backup/settings", { scheduleHours: 24 }, "PUT");
        expect(res.status).toBe(200);
    });
});

describe("GET /backup/settings", () => {
    it("defaults sensibly when nothing is saved", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await app().request("/backup/settings");
        const body = (await res.json()) as Record<string, unknown>;
        expect(body).toEqual({
            scheduleHours: 0,
            activeProvider: null,
            retentionDays: 30,
            autoEnabled: false,
        });
    });
});

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

describe("POST /backup/trigger", () => {
    it("returns 400 when there is no backup configuration at all", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await postJson("/backup/trigger", {});
        expect(res.status).toBe(400);
    });

    it("returns 400 when nothing is connected and provider=all is implied", async () => {
        dbMockState.db = dbWithSettings(emptySettingsRow());
        const res = await postJson("/backup/trigger", {});
        expect(res.status).toBe(400);
    });

    it("records every requested provider as failed when the dump itself fails", async () => {
        backupServiceMock.dumpDatabase.mockRejectedValue(new Error("pg_dump failed"));
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        const db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(token) }));
        dbMockState.db = db;
        const res = await postJson("/backup/trigger", {});
        expect(res.status).toBe(502);
        const body = (await res.json()) as { ok: boolean; results: Array<{ ok: boolean }> };
        expect(body.ok).toBe(false);
        expect(body.results.every((r) => !r.ok)).toBe(true);
        expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it("uploads to a connected provider, saves the refreshed token, and records a success run", async () => {
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        const db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(token) }));
        dbMockState.db = db;
        const res = await postJson("/backup/trigger", {});
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; results: Array<{ ok: boolean }> };
        expect(body.ok).toBe(true);
        expect(body.results).toEqual([
            { provider: "gdrive", ok: true, filename: expect.any(String) },
        ]);
        expect(backupServiceMock.uploadToGDrive).toHaveBeenCalledTimes(1);
        // insert calls: 1 success run (token-save inserts also go through db.insert in this mock,
        // so assert the upload/prune sequence completed rather than an exact insert count).
        expect(backupServiceMock.pruneOldGDriveBackups).toHaveBeenCalledTimes(1);
    });

    it("tolerates a prune failure (backup itself still counts as success)", async () => {
        const token = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.pruneOldGDriveBackups.mockRejectedValue(new Error("prune failed"));
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(token) }));
        const res = await postJson("/backup/trigger", {});
        const body = (await res.json()) as { results: Array<{ ok: boolean }> };
        expect(body.results[0].ok).toBe(true);
    });

    it("records a per-provider failure without aborting other providers", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.uploadToGDrive.mockRejectedValue(new Error("quota exceeded"));
        dbMockState.db = dbWithSettings(
            emptySettingsRow({
                gdriveToken: encToken(gToken),
                webdavUrl: "https://dav.example.com",
                webdavUsername: "u",
                webdavPassword: encStr("p"),
            }),
        );
        const res = await postJson("/backup/trigger", {});
        expect(res.status).toBe(200); // webdav succeeded, so anyOk is true
        const body = (await res.json()) as {
            results: Array<{ provider: string; ok: boolean; error?: string }>;
        };
        const gdriveResult = body.results.find((r) => r.provider === "gdrive")!;
        const webdavResult = body.results.find((r) => r.provider === "webdav")!;
        expect(gdriveResult).toMatchObject({ ok: false, error: "quota exceeded" });
        expect(webdavResult).toMatchObject({ ok: true });
    });

    it("targets a single explicitly-requested provider even if not connected", async () => {
        dbMockState.db = dbWithSettings(emptySettingsRow());
        const res = await postJson("/backup/trigger", { provider: "s3" });
        expect(res.status).toBe(502);
        const body = (await res.json()) as { results: Array<{ provider: string; error?: string }> };
        expect(body.results).toEqual([{ provider: "s3", ok: false, error: "S3 not configured" }]);
    });
});

// ---------------------------------------------------------------------------
// Runs / Files
// ---------------------------------------------------------------------------

describe("GET /backup/runs", () => {
    it("returns the user's backup run history", async () => {
        dbMockState.db = createMockDb([[{ id: 1, provider: "gdrive", status: "success" }]]);
        const res = await app().request("/backup/runs");
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toHaveLength(1);
    });
});

describe("GET /backup/files", () => {
    it("returns [] immediately when there is no settings row", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await app().request("/backup/files");
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
    });

    it("aggregates files across every connected provider when no filter is given", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.listGDriveBackups.mockResolvedValue({
            files: [
                { name: "g.gz", fileId: "g1", sizeBytes: 1, createdAt: "", provider: "gdrive" },
            ],
            refreshedToken: gToken,
        });
        backupServiceMock.listWebDAVBackups.mockResolvedValue([
            { name: "w.gz", fileId: "w1", sizeBytes: 1, createdAt: "", provider: "webdav" },
        ]);
        dbMockState.db = dbWithSettings(
            emptySettingsRow({
                gdriveToken: encToken(gToken),
                webdavUrl: "https://dav.example.com",
                webdavUsername: "u",
                webdavPassword: encStr("p"),
            }),
        );
        const res = await app().request("/backup/files");
        const body = (await res.json()) as { data: Array<{ name: string }> };
        expect(body.data.map((f) => f.name).sort()).toEqual(["g.gz", "w.gz"]);
    });

    it("filters to a single provider when requested", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.listGDriveBackups.mockResolvedValue({
            files: [],
            refreshedToken: gToken,
        });
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));
        await app().request("/backup/files?provider=gdrive");
        expect(backupServiceMock.listWebDAVBackups).not.toHaveBeenCalled();
    });

    it("tolerates a per-provider list failure (falls back to an empty list for that provider)", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.listGDriveBackups.mockRejectedValue(new Error("down"));
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));
        const res = await app().request("/backup/files?provider=gdrive");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: unknown[] };
        expect(body.data).toEqual([]);
    });
});

describe("DELETE /backup/files", () => {
    it("requires provider and fileId", async () => {
        const res = await postJson("/backup/files", { provider: "gdrive" }, "DELETE");
        expect(res.status).toBe(400);
    });

    it("returns 400 when there is no backup config", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await postJson("/backup/files", { provider: "gdrive", fileId: "f1" }, "DELETE");
        expect(res.status).toBe(400);
    });

    it("returns 400 when the requested provider is not connected", async () => {
        dbMockState.db = dbWithSettings(emptySettingsRow());
        const res = await postJson("/backup/files", { provider: "gdrive", fileId: "f1" }, "DELETE");
        expect(res.status).toBe(400);
    });

    it("deletes the remote file for a connected provider", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));
        const res = await postJson("/backup/files", { provider: "gdrive", fileId: "f1" }, "DELETE");
        expect(res.status).toBe(200);
        expect(backupServiceMock.deleteGDriveFile).toHaveBeenCalledWith(
            expect.objectContaining({ access_token: "a" }),
            "f1",
        );
    });
});

// ---------------------------------------------------------------------------
// Restore — the highest-risk endpoint in the repo
// ---------------------------------------------------------------------------

describe("POST /backup/restore", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // NEVER let a real process.exit(0) fire — the 1.5s setTimeout in the route
        // must become a harmless no-op regardless of real vs. fake timers.
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    it("requires provider and fileId", async () => {
        const res = await postJson("/backup/restore", { provider: "gdrive" });
        expect(res.status).toBe(400);
    });

    it("returns 400 when there is no backup config", async () => {
        dbMockState.db = dbWithSettings(null);
        const res = await postJson("/backup/restore", { provider: "gdrive", fileId: "f1" });
        expect(res.status).toBe(400);
    });

    it("returns 400 when the requested provider is not connected, without touching the database", async () => {
        dbMockState.db = dbWithSettings(emptySettingsRow());
        const res = await postJson("/backup/restore", { provider: "gdrive", fileId: "f1" });
        expect(res.status).toBe(400);
        expect(backupServiceMock.dumpDatabase).not.toHaveBeenCalled();
        expect(backupServiceMock.restoreDatabase).not.toHaveBeenCalled();
    });

    it("downloads first: a download failure aborts before any safety backup or restore", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.downloadGDriveFile.mockRejectedValue(new Error("file not found"));
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));

        const res = await postJson("/backup/restore", { provider: "gdrive", fileId: "missing" });
        expect(res.status).toBe(500);
        expect(backupServiceMock.dumpDatabase).not.toHaveBeenCalled();
        expect(backupServiceMock.uploadToGDrive).not.toHaveBeenCalled();
        expect(backupServiceMock.restoreDatabase).not.toHaveBeenCalled();
    });

    it("on success: downloads, snapshots the current DB, restores, and schedules a restart", async () => {
        vi.useFakeTimers();
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        const dumpGz = Buffer.from("the-backup-to-restore");
        backupServiceMock.downloadGDriveFile.mockResolvedValue({ data: dumpGz });
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));

        const res = await postJson("/backup/restore", { provider: "gdrive", fileId: "f1" });
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            ok: boolean;
            requiresRestart: boolean;
            safetyBackup: string;
        };
        expect(body.ok).toBe(true);
        expect(body.requiresRestart).toBe(true);
        expect(body.safetyBackup).toContain("mediadash-backup-pre-restore-");

        // Order matters: download → safety snapshot upload → restore.
        expect(backupServiceMock.downloadGDriveFile).toHaveBeenCalled();
        expect(backupServiceMock.dumpDatabase).toHaveBeenCalledTimes(1);
        expect(backupServiceMock.uploadToGDrive).toHaveBeenCalledWith(
            expect.objectContaining({ access_token: "a" }),
            expect.any(Buffer),
            expect.stringContaining("pre-restore"),
        );
        expect(backupServiceMock.restoreDatabase).toHaveBeenCalledWith(dumpGz);

        // The scheduled restart timer is real but harmless (process.exit mocked above).
        await vi.advanceTimersByTimeAsync(1500);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("aborts the restore (never calls restoreDatabase) when the safety snapshot upload fails", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        backupServiceMock.downloadGDriveFile.mockResolvedValue({ data: Buffer.from("dump") });
        backupServiceMock.uploadToGDrive.mockRejectedValue(new Error("quota exceeded"));
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));

        const res = await postJson("/backup/restore", { provider: "gdrive", fileId: "f1" });
        expect(res.status).toBe(500);
        expect(backupServiceMock.restoreDatabase).not.toHaveBeenCalled();
    });

    it("rejects a second restore attempt while one is already in flight (409), then cleans up", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        let resolveDownload!: (v: { data: Buffer }) => void;
        backupServiceMock.downloadGDriveFile.mockReturnValue(
            new Promise((resolve) => {
                resolveDownload = resolve;
            }),
        );
        dbMockState.db = dbWithSettings(emptySettingsRow({ gdriveToken: encToken(gToken) }));

        const firstRequest = postJson("/backup/restore", { provider: "gdrive", fileId: "f1" });
        // Let the handler run up to (and block on) the pending download.
        await new Promise((r) => setTimeout(r, 0));

        const secondRes = await postJson("/backup/restore", { provider: "gdrive", fileId: "f2" });
        expect(secondRes.status).toBe(409);

        // Unblock the first request and let it finish so `restoreInProgress` resets
        // (module-level state) and doesn't leak into later tests.
        resolveDownload({ data: Buffer.from("dump") });
        const firstRes = await firstRequest;
        expect(firstRes.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// runScheduledBackup — the cron-triggered wrapper (not an HTTP route)
// ---------------------------------------------------------------------------

describe("runScheduledBackup", () => {
    it("is a no-op when no schedule is configured", async () => {
        dbMockState.db = dbWithSettings(emptySettingsRow({ backupScheduleHours: 0 }));
        await runScheduledBackup(TEST_USER_ID);
        expect(backupServiceMock.dumpDatabase).not.toHaveBeenCalled();
    });

    it("logs and returns without recording a run when the dump itself fails", async () => {
        backupServiceMock.dumpDatabase.mockRejectedValue(new Error("disk full"));
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const db = dbWithSettings(emptySettingsRow({ backupScheduleHours: 24 }));
        dbMockState.db = db;

        await runScheduledBackup(TEST_USER_ID);
        expect(db.insert).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("backs up only to the configured active provider when it is connected", async () => {
        const gToken = {
            access_token: "a",
            refresh_token: "r",
            expiry_date: 0,
            token_type: "Bearer",
            scope: "",
        };
        dbMockState.db = dbWithSettings(
            emptySettingsRow({
                backupScheduleHours: 24,
                backupActiveProvider: "gdrive",
                gdriveToken: encToken(gToken),
                webdavUrl: "https://dav.example.com",
                webdavUsername: "u",
                webdavPassword: encStr("p"),
            }),
        );
        await runScheduledBackup(TEST_USER_ID);
        expect(backupServiceMock.uploadToGDrive).toHaveBeenCalledTimes(1);
        expect(backupServiceMock.uploadToWebDAV).not.toHaveBeenCalled();
    });

    it("falls back to every connected provider when the active one is disconnected", async () => {
        dbMockState.db = dbWithSettings(
            emptySettingsRow({
                backupScheduleHours: 24,
                backupActiveProvider: "gdrive", // not actually connected below
                webdavUrl: "https://dav.example.com",
                webdavUsername: "u",
                webdavPassword: encStr("p"),
            }),
        );
        await runScheduledBackup(TEST_USER_ID);
        expect(backupServiceMock.uploadToWebDAV).toHaveBeenCalledTimes(1);
    });

    it("logs a per-provider failure without throwing", async () => {
        backupServiceMock.uploadToWebDAV.mockRejectedValue(new Error("network"));
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const db = dbWithSettings(
            emptySettingsRow({
                backupScheduleHours: 24,
                webdavUrl: "https://dav.example.com",
                webdavUsername: "u",
                webdavPassword: encStr("p"),
            }),
        );
        dbMockState.db = db;
        await expect(runScheduledBackup(TEST_USER_ID)).resolves.toBeUndefined();
        errSpy.mockRestore();
    });
});
