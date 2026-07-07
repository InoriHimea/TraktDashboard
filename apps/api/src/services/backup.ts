import { spawn } from "node:child_process";
import { createGzip, gunzipSync } from "node:zlib";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GDriveToken {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expiry_date: number; // ms epoch
    scope: string;
}

export interface WebDAVConfig {
    url: string;
    username: string;
    password: string;
}

export interface BackupFile {
    name: string;
    fileId: string;
    sizeBytes: number;
    createdAt: string; // ISO
    provider: "gdrive" | "webdav" | "onedrive" | "s3";
}

// ─── Google Drive OAuth Device Flow ──────────────────────────────────────────

const GDRIVE_CLIENT_ID =
    process.env.GDRIVE_CLIENT_ID ?? "YOUR_CLIENT_ID.apps.googleusercontent.com";
const GDRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET ?? "";
const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GDRIVE_DEVICE_AUTH_URL = "https://oauth2.googleapis.com/device/code";
const GDRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GDRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const GDRIVE_LIST_URL = "https://www.googleapis.com/drive/v3/files";
const GDRIVE_FOLDER_NAME = "MediaDashBackups";

export interface DeviceAuthResponse {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
}

// N6 batch 3a: the device flows need a self-registered OAuth application (Google Cloud
// Console / Azure Portal) whose credentials arrive via env vars. When they are absent the
// UI hides the provider instead of offering a connect button that can only fail — these
// helpers are the single source of truth for that gate. See docs/cloud-backup-setup.md.
export function isGDriveConfigured(): boolean {
    return !GDRIVE_CLIENT_ID.includes("YOUR_CLIENT_ID") && GDRIVE_CLIENT_SECRET.length > 0;
}

export function isOneDriveConfigured(): boolean {
    return ONEDRIVE_CLIENT_ID.length > 0;
}

export async function startGDriveDeviceFlow(): Promise<DeviceAuthResponse> {
    if (!GDRIVE_CLIENT_SECRET) {
        throw new Error("GDRIVE_CLIENT_SECRET is not configured");
    }
    if (GDRIVE_CLIENT_ID.includes("YOUR_CLIENT_ID")) {
        throw new Error("GDRIVE_CLIENT_ID is not configured");
    }
    const res = await fetch(GDRIVE_DEVICE_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GDRIVE_CLIENT_ID,
            scope: GDRIVE_SCOPE,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GDrive device auth failed: ${err}`);
    }
    return res.json() as Promise<DeviceAuthResponse>;
}

export async function pollGDriveToken(deviceCode: string): Promise<GDriveToken | null> {
    const res = await fetch(GDRIVE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GDRIVE_CLIENT_ID,
            client_secret: GDRIVE_CLIENT_SECRET,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (data.error === "authorization_pending" || data.error === "slow_down") return null;
    if (data.error) throw new Error(`GDrive poll error: ${String(data.error)}`);
    return {
        access_token: String(data.access_token),
        refresh_token: String(data.refresh_token ?? ""),
        token_type: String(data.token_type ?? "Bearer"),
        scope: String(data.scope ?? GDRIVE_SCOPE),
        expiry_date: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
}

async function refreshGDriveToken(token: GDriveToken): Promise<GDriveToken> {
    if (Date.now() < token.expiry_date - 60_000) return token;
    const res = await fetch(GDRIVE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GDRIVE_CLIENT_ID,
            client_secret: GDRIVE_CLIENT_SECRET,
            refresh_token: token.refresh_token,
            grant_type: "refresh_token",
        }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error)
        throw new Error(`GDrive token refresh failed: ${String(data.error ?? res.status)}`);
    return {
        ...token,
        access_token: String(data.access_token),
        expiry_date: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
}

export async function revokeGDriveToken(token: GDriveToken): Promise<void> {
    await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.access_token)}`,
        { method: "POST" },
    );
}

async function getOrCreateGDriveFolder(accessToken: string): Promise<string> {
    const q = encodeURIComponent(
        `name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const listHeaders = { Authorization: `Bearer ${accessToken}` };
    // Order by createdTime so we always pick the same folder if duplicates exist.
    const listUrl = `${GDRIVE_LIST_URL}?q=${q}&fields=files(id)&orderBy=createdTime`;

    const res = await fetch(listUrl, { headers: listHeaders });
    const data = (await res.json()) as { files: Array<{ id: string }> };
    if (data.files?.length > 0) return data.files[0].id;

    // Create folder. Two concurrent requests may both reach this point (TOCTOU), creating
    // duplicate folders. Google Drive allows this; we mitigate by re-listing after creation
    // and consistently returning the oldest folder ID so all instances converge.
    await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: GDRIVE_FOLDER_NAME,
            mimeType: "application/vnd.google-apps.folder",
        }),
    });

    // Re-list after creation to pick a stable ID (oldest = createdTime asc order).
    const retryRes = await fetch(listUrl, { headers: listHeaders });
    const retryData = (await retryRes.json()) as { files: Array<{ id: string }> };
    if (retryData.files?.length > 0) return retryData.files[0].id;
    throw new Error("GDrive: failed to create or find backup folder");
}

export async function uploadToGDrive(
    token: GDriveToken,
    buffer: Buffer,
    filename: string,
): Promise<{ fileId: string; refreshedToken: GDriveToken }> {
    const refreshedToken = await refreshGDriveToken(token);
    const folderId = await getOrCreateGDriveFolder(refreshedToken.access_token);

    const metadata = JSON.stringify({
        name: filename,
        parents: [folderId],
        mimeType: "application/gzip",
    });

    const boundary = "===backup_boundary===";
    const body = Buffer.concat([
        Buffer.from(
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
        ),
        buffer,
        Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(GDRIVE_UPLOAD_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${refreshedToken.access_token}`,
            "Content-Type": `multipart/related; boundary="${boundary}"`,
        },
        body: new Uint8Array(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GDrive upload failed (${res.status}): ${err}`);
    }
    const file = (await res.json()) as { id: string };
    return { fileId: file.id, refreshedToken };
}

export async function listGDriveBackups(
    token: GDriveToken,
): Promise<{ files: BackupFile[]; refreshedToken: GDriveToken }> {
    const refreshedToken = await refreshGDriveToken(token);
    const folderId = await getOrCreateGDriveFolder(refreshedToken.access_token).catch(() => null);
    if (!folderId) return { files: [], refreshedToken };

    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent("files(id,name,size,createdTime)");
    const res = await fetch(
        `${GDRIVE_LIST_URL}?q=${q}&fields=${fields}&orderBy=createdTime+desc&pageSize=50`,
        { headers: { Authorization: `Bearer ${refreshedToken.access_token}` } },
    );
    const data = (await res.json()) as {
        files: Array<{ id: string; name: string; size: string; createdTime: string }>;
    };
    const files: BackupFile[] = (data.files ?? []).map((f) => ({
        name: f.name,
        fileId: f.id,
        sizeBytes: Number(f.size ?? 0),
        createdAt: f.createdTime,
        provider: "gdrive",
    }));
    return { files, refreshedToken };
}

// N6 batch 3b: restore needs to read backups back. Same auth/refresh pattern as the
// sibling list/delete functions.
export async function downloadGDriveFile(
    token: GDriveToken,
    fileId: string,
): Promise<{ data: Buffer; refreshedToken: GDriveToken }> {
    const refreshedToken = await refreshGDriveToken(token);
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        { headers: { Authorization: `Bearer ${refreshedToken.access_token}` } },
    );
    if (!res.ok) throw new Error(`GDrive download failed (${res.status})`);
    return { data: Buffer.from(await res.arrayBuffer()), refreshedToken };
}

export async function deleteGDriveFile(token: GDriveToken, fileId: string): Promise<void> {
    const refreshedToken = await refreshGDriveToken(token);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${refreshedToken.access_token}` },
    });
    if (!res.ok && res.status !== 404) {
        throw new Error(`GDrive DELETE failed (${res.status})`);
    }
}

// ─── WebDAV ───────────────────────────────────────────────────────────────────

function webdavAuth(cfg: WebDAVConfig): string {
    return `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`;
}

function webdavBackupPath(cfg: WebDAVConfig, filename: string): string {
    const base = cfg.url.replace(/\/$/, "");
    return `${base}/MediaDashBackups/${filename}`;
}

export async function ensureWebDAVFolder(cfg: WebDAVConfig): Promise<void> {
    const base = cfg.url.replace(/\/$/, "");
    const folderUrl = `${base}/MediaDashBackups`;
    const res = await fetch(folderUrl, {
        method: "MKCOL",
        headers: { Authorization: webdavAuth(cfg) },
    });
    // 201 Created, 200 OK, 405 Method Not Allowed (folder exists), 207 Multi-Status — all OK
    if (res.status !== 201 && res.status !== 405 && res.status !== 200 && res.status !== 207) {
        throw new Error(`WebDAV MKCOL failed: ${res.status}`);
    }
}

export async function uploadToWebDAV(
    cfg: WebDAVConfig,
    buffer: Buffer,
    filename: string,
): Promise<void> {
    await ensureWebDAVFolder(cfg);
    const url = webdavBackupPath(cfg, filename);
    const res = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: webdavAuth(cfg),
            "Content-Type": "application/gzip",
            "Content-Length": String(buffer.byteLength),
        },
        body: new Uint8Array(buffer),
    });
    if (!res.ok) {
        throw new Error(`WebDAV PUT failed (${res.status})`);
    }
}

export async function listWebDAVBackups(cfg: WebDAVConfig): Promise<BackupFile[]> {
    const base = cfg.url.replace(/\/$/, "");
    const folderUrl = `${base}/MediaDashBackups/`;
    const body = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:displayname/><D:getcontentlength/><D:creationdate/></D:prop>
</D:propfind>`;
    const res = await fetch(folderUrl, {
        method: "PROPFIND",
        headers: {
            Authorization: webdavAuth(cfg),
            "Content-Type": "application/xml",
            Depth: "1",
        },
        body,
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`WebDAV PROPFIND failed: ${res.status}`);

    const xml = await res.text();
    // Simple regex parse — avoid pulling in xml2js
    const files: BackupFile[] = [];
    const responseRe = /<D:response>([\s\S]*?)<\/D:response>/gi;
    let m: RegExpExecArray | null;
    while ((m = responseRe.exec(xml)) !== null) {
        const block = m[1];
        const href = /<D:href>(.*?)<\/D:href>/i.exec(block)?.[1] ?? "";
        const name = decodeURIComponent(href.split("/").pop() ?? "");
        if (!name || !name.endsWith(".gz")) continue;
        const size = Number(
            /<D:getcontentlength>(.*?)<\/D:getcontentlength>/i.exec(block)?.[1] ?? 0,
        );
        const created =
            /<D:creationdate>(.*?)<\/D:creationdate>/i.exec(block)?.[1] ?? new Date().toISOString();
        files.push({ name, fileId: href, sizeBytes: size, createdAt: created, provider: "webdav" });
    }
    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Shared SSRF/path-traversal guard for WebDAV file operations: `filePath` is the href
// returned by PROPFIND (a site-absolute path or full URL). Constrain it to the configured
// server origin AND the backup folder so a crafted fileId cannot make the server issue an
// authenticated request to an arbitrary host or touch files outside MediaDashBackups.
// Check the raw (percent-encoded) pathname — do NOT decode before checking:
// decodeURIComponent() would turn %2F into "/" which lets a crafted path like
// /MediaDashBackups%2F..%2Fetc pass the substring check while the actual request targets
// a path outside the backup folder on servers that decode %2F.
function resolveWebDAVBackupHref(cfg: WebDAVConfig, filePath: string): URL {
    const baseUrl = new URL(cfg.url);
    const resolved = new URL(filePath, baseUrl); // absolute URLs keep their own origin
    if (resolved.origin !== baseUrl.origin) {
        throw new Error("WebDAV target is outside the configured server");
    }
    if (!resolved.pathname.includes("/MediaDashBackups/")) {
        throw new Error("WebDAV target is outside the backup folder");
    }
    return resolved;
}

export async function downloadWebDAVFile(cfg: WebDAVConfig, filePath: string): Promise<Buffer> {
    const resolved = resolveWebDAVBackupHref(cfg, filePath);
    const res = await fetch(resolved.toString(), {
        headers: { Authorization: webdavAuth(cfg) },
    });
    if (!res.ok) throw new Error(`WebDAV GET failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
}

export async function deleteWebDAVFile(cfg: WebDAVConfig, filePath: string): Promise<void> {
    const resolved = resolveWebDAVBackupHref(cfg, filePath);
    const res = await fetch(resolved.toString(), {
        method: "DELETE",
        headers: { Authorization: webdavAuth(cfg) },
    });
    if (!res.ok && res.status !== 404) {
        throw new Error(`WebDAV DELETE failed (${res.status})`);
    }
}

// ─── pg_dump ──────────────────────────────────────────────────────────────────

export async function dumpDatabase(): Promise<Buffer> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL not set");

    return new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        let dumpTimer: ReturnType<typeof setTimeout> | null = null;
        const settle = (fn: () => void) => {
            if (!settled) {
                settled = true;
                if (dumpTimer) {
                    clearTimeout(dumpTimer);
                    dumpTimer = null;
                }
                fn();
            }
        };

        // Spawn pg_dump directly — no sh -c, so DATABASE_URL cannot inject shell commands.
        const pg = spawn("pg_dump", ["--format=plain", databaseUrl], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        const gz = createGzip();
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];

        // Resolve ONLY when the gzip stream has fully flushed AND pg_dump exited
        // cleanly (code 0). Wiring resolve() to gz "end" alone is unsafe: when
        // pg_dump fails, stdout closes early, the pipe ends gzip, and gz "end" can
        // fire (with a truncated/empty buffer) before the non-zero "close" event —
        // the race would let a corrupt dump be recorded as a successful backup.
        let gzEnded = false;
        let pgOk = false;
        const maybeResolve = () => {
            if (!gzEnded || !pgOk) return;
            const buf = Buffer.concat(chunks);
            // A gzip stream always emits at least a 20-byte header+footer even for empty
            // input, so buf.length === 0 can never fire here. Use a small threshold that
            // is above the bare envelope size (20 bytes) but below any real pg_dump output
            // (which includes PostgreSQL version comments and SET statements).
            if (buf.length < 100) {
                settle(() => reject(new Error("pg_dump produced an empty dump")));
                return;
            }
            settle(() => resolve(buf));
        };

        // Kill pg_dump if it stalls waiting for a DB lock — without a timeout the
        // Promise would hang indefinitely, holding the HTTP connection open forever.
        dumpTimer = setTimeout(
            () => {
                settle(() => reject(new Error("pg_dump timed out after 5 minutes")));
                try {
                    pg.kill("SIGTERM");
                } catch {
                    /* already exited */
                }
            },
            5 * 60 * 1000,
        );

        pg.stdout!.pipe(gz);
        gz.on("data", (d: Buffer) => chunks.push(d));
        gz.on("end", () => {
            gzEnded = true;
            maybeResolve();
        });

        pg.stderr!.on("data", (d: Buffer) => errChunks.push(d));
        pg.on("close", (code) => {
            if (code !== 0) {
                const errMsg = Buffer.concat(errChunks).toString("utf8").slice(0, 300);
                settle(() => reject(new Error(`pg_dump failed (exit ${code}): ${errMsg}`)));
                return;
            }
            pgOk = true;
            maybeResolve();
        });
        pg.on("error", (err) => settle(() => reject(err)));
        gz.on("error", (err) => settle(() => reject(err)));
    });
}

// N6 batch 3b: restore a plain-format pg_dump (gzipped) produced by dumpDatabase().
// Runs in a single psql transaction: DROP both app schemas, recreate public, then replay
// the dump — all-or-nothing, so a mid-file failure leaves the old data untouched.
// The drizzle schema must be dropped too: the dump recreates it (journal table included),
// and leaving the live one in place would collide under ON_ERROR_STOP.
// Callers are expected to restart the process afterwards — the drizzle connection pool
// holds prepared statements against the pre-restore schema.
export async function restoreDatabase(dumpGz: Buffer): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL not set");

    let sqlText: string;
    try {
        sqlText = gunzipSync(dumpGz).toString("utf8");
    } catch {
        throw new Error("backup file is not valid gzip data");
    }
    if (!sqlText.includes("PostgreSQL database dump")) {
        throw new Error("backup file does not look like a pg_dump");
    }

    const prelude =
        "DROP SCHEMA IF EXISTS public CASCADE;\n" +
        "DROP SCHEMA IF EXISTS drizzle CASCADE;\n" +
        "CREATE SCHEMA public;\n";

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                fn();
            }
        };
        // Spawn psql directly (no sh -c) — DATABASE_URL cannot inject shell commands.
        const psql = spawn("psql", ["-v", "ON_ERROR_STOP=1", "--single-transaction", databaseUrl], {
            stdio: ["pipe", "ignore", "pipe"],
        });
        const errChunks: Buffer[] = [];
        const timer = setTimeout(
            () => {
                settle(() => reject(new Error("psql restore timed out after 10 minutes")));
                try {
                    psql.kill("SIGTERM");
                } catch {
                    /* already exited */
                }
            },
            10 * 60 * 1000,
        );

        psql.stderr!.on("data", (d: Buffer) => errChunks.push(d));
        psql.on("close", (code) => {
            if (code === 0) {
                settle(() => resolve());
            } else {
                const errMsg = Buffer.concat(errChunks).toString("utf8").slice(0, 500);
                settle(() => reject(new Error(`psql restore failed (exit ${code}): ${errMsg}`)));
            }
        });
        psql.on("error", (err) => settle(() => reject(err)));

        psql.stdin!.write(prelude);
        psql.stdin!.write(sqlText);
        psql.stdin!.end();
    });
}

// ─── Cleanup old backups ──────────────────────────────────────────────────────

export async function pruneOldGDriveBackups(
    token: GDriveToken,
    retentionDays: number,
): Promise<GDriveToken> {
    const { files, refreshedToken } = await listGDriveBackups(token);
    const cutoff = Date.now() - retentionDays * 86_400_000;
    for (const f of files) {
        if (new Date(f.createdAt).getTime() < cutoff) {
            await deleteGDriveFile(refreshedToken, f.fileId).catch(() => null);
        }
    }
    return refreshedToken;
}

export async function pruneOldWebDAVBackups(
    cfg: WebDAVConfig,
    retentionDays: number,
): Promise<void> {
    const files = await listWebDAVBackups(cfg);
    const cutoff = Date.now() - retentionDays * 86_400_000;
    for (const f of files) {
        if (new Date(f.createdAt).getTime() < cutoff) {
            await deleteWebDAVFile(cfg, f.fileId).catch(() => null);
        }
    }
}

// ─── OneDrive (Microsoft Graph Device Code Flow) ──────────────────────────────

export interface OneDriveToken {
    access_token: string;
    refresh_token: string;
    expires_at: number; // ms epoch
    scope: string;
}

const ONEDRIVE_CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID ?? "";
const ONEDRIVE_TENANT = "common";
const ONEDRIVE_SCOPE = "https://graph.microsoft.com/Files.ReadWrite offline_access";
const ONEDRIVE_DEVICE_URL = `https://login.microsoftonline.com/${ONEDRIVE_TENANT}/oauth2/v2.0/devicecode`;
const ONEDRIVE_TOKEN_URL = `https://login.microsoftonline.com/${ONEDRIVE_TENANT}/oauth2/v2.0/token`;
const ONEDRIVE_FOLDER = "MediaDashBackups";

export async function startOneDriveDeviceFlow(): Promise<DeviceAuthResponse> {
    if (!ONEDRIVE_CLIENT_ID) throw new Error("ONEDRIVE_CLIENT_ID 未配置");
    const res = await fetch(ONEDRIVE_DEVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: ONEDRIVE_CLIENT_ID, scope: ONEDRIVE_SCOPE }),
    });
    if (!res.ok) throw new Error(`OneDrive device auth failed: ${await res.text()}`);
    const data = (await res.json()) as Record<string, unknown>;
    // Microsoft returns "user_code", "device_code", "verification_uri", "expires_in", "interval"
    return {
        device_code: String(data.device_code),
        user_code: String(data.user_code),
        verification_url: String(data.verification_uri ?? data.verification_url ?? ""),
        expires_in: Number(data.expires_in ?? 900),
        interval: Number(data.interval ?? 5),
    };
}

export async function pollOneDriveToken(deviceCode: string): Promise<OneDriveToken | null> {
    const res = await fetch(ONEDRIVE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: ONEDRIVE_CLIENT_ID,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (data.error === "authorization_pending" || data.error === "slow_down") return null;
    if (data.error) throw new Error(`OneDrive poll error: ${String(data.error)}`);
    return {
        access_token: String(data.access_token),
        refresh_token: String(data.refresh_token ?? ""),
        expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
        scope: String(data.scope ?? ONEDRIVE_SCOPE),
    };
}

async function refreshOneDriveToken(token: OneDriveToken): Promise<OneDriveToken> {
    if (Date.now() < token.expires_at - 60_000) return token;
    const res = await fetch(ONEDRIVE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: ONEDRIVE_CLIENT_ID,
            refresh_token: token.refresh_token,
            grant_type: "refresh_token",
            scope: ONEDRIVE_SCOPE,
        }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error)
        throw new Error(`OneDrive token refresh failed: ${String(data.error ?? res.status)}`);
    return {
        ...token,
        access_token: String(data.access_token),
        refresh_token: String(data.refresh_token ?? token.refresh_token),
        expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
}

export async function uploadToOneDrive(
    token: OneDriveToken,
    buffer: Buffer,
    filename: string,
): Promise<{ itemId: string; refreshedToken: OneDriveToken }> {
    const refreshedToken = await refreshOneDriveToken(token);
    const auth = `Bearer ${refreshedToken.access_token}`;
    const graphBase = "https://graph.microsoft.com/v1.0";

    // For files > 4 MB create an upload session; otherwise PUT directly.
    if (buffer.byteLength > 4 * 1024 * 1024) {
        const sessionRes = await fetch(
            `${graphBase}/me/drive/root:/${ONEDRIVE_FOLDER}/${filename}:/createUploadSession`,
            {
                method: "POST",
                headers: { Authorization: auth, "Content-Type": "application/json" },
                body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
            },
        );
        if (!sessionRes.ok)
            throw new Error(`OneDrive createUploadSession failed (${sessionRes.status})`);
        const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };
        const chunkSize = 10 * 1024 * 1024; // 10 MB
        let start = 0;
        let lastJson: { id?: string } = {};
        while (start < buffer.byteLength) {
            const end = Math.min(start + chunkSize, buffer.byteLength);
            const chunk = buffer.subarray(start, end);
            const r = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Range": `bytes ${start}-${end - 1}/${buffer.byteLength}`,
                    "Content-Length": String(chunk.byteLength),
                },
                body: new Uint8Array(chunk),
            });
            if (!r.ok && r.status !== 202)
                throw new Error(`OneDrive chunk upload failed (${r.status})`);
            lastJson = (await r.json().catch(() => ({}))) as { id?: string };
            start = end;
        }
        return { itemId: String(lastJson.id ?? ""), refreshedToken };
    }

    const putRes = await fetch(
        `${graphBase}/me/drive/root:/${ONEDRIVE_FOLDER}/${filename}:/content`,
        {
            method: "PUT",
            headers: {
                Authorization: auth,
                "Content-Type": "application/octet-stream",
                "Content-Length": String(buffer.byteLength),
            },
            body: new Uint8Array(buffer),
        },
    );
    if (!putRes.ok)
        throw new Error(`OneDrive PUT failed (${putRes.status}): ${await putRes.text()}`);
    const file = (await putRes.json()) as { id: string };
    return { itemId: file.id, refreshedToken };
}

export async function listOneDriveBackups(
    token: OneDriveToken,
): Promise<{ files: BackupFile[]; refreshedToken: OneDriveToken }> {
    const refreshedToken = await refreshOneDriveToken(token);
    const auth = `Bearer ${refreshedToken.access_token}`;
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FOLDER}:/children?$orderby=createdDateTime desc&$select=id,name,size,createdDateTime`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (res.status === 404) return { files: [], refreshedToken };
    if (!res.ok) throw new Error(`OneDrive list failed (${res.status})`);
    const data = (await res.json()) as {
        value: Array<{ id: string; name: string; size: number; createdDateTime: string }>;
    };
    const files: BackupFile[] = (data.value ?? [])
        .filter((f) => f.name.endsWith(".gz"))
        .map((f) => ({
            name: f.name,
            fileId: f.id,
            sizeBytes: f.size ?? 0,
            createdAt: f.createdDateTime,
            provider: "onedrive",
        }));
    return { files, refreshedToken };
}

export async function downloadOneDriveFile(
    token: OneDriveToken,
    itemId: string,
): Promise<{ data: Buffer; refreshedToken: OneDriveToken }> {
    const refreshedToken = await refreshOneDriveToken(token);
    // Graph responds 302 to a pre-authenticated download URL; fetch follows it.
    const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`,
        { headers: { Authorization: `Bearer ${refreshedToken.access_token}` } },
    );
    if (!res.ok) throw new Error(`OneDrive download failed (${res.status})`);
    return { data: Buffer.from(await res.arrayBuffer()), refreshedToken };
}

export async function deleteOneDriveFile(token: OneDriveToken, itemId: string): Promise<void> {
    const refreshedToken = await refreshOneDriveToken(token);
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${refreshedToken.access_token}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`OneDrive DELETE failed (${res.status})`);
}

export async function pruneOldOneDriveBackups(
    token: OneDriveToken,
    retentionDays: number,
): Promise<OneDriveToken> {
    const { files, refreshedToken } = await listOneDriveBackups(token);
    const cutoff = Date.now() - retentionDays * 86_400_000;
    for (const f of files) {
        if (new Date(f.createdAt).getTime() < cutoff) {
            await deleteOneDriveFile(refreshedToken, f.fileId).catch(() => null);
        }
    }
    return refreshedToken;
}

// ─── S3-compatible Storage (AWS Signature V4) ────────────────────────────────

export interface S3Config {
    endpoint: string; // e.g. "https://s3.amazonaws.com" or "https://abc.r2.cloudflarestorage.com"
    region: string; // e.g. "us-east-1" or "auto"
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
}

const S3_PREFIX = "mediadash-backups/";

function toArrayBuffer(buf: ArrayBuffer | Uint8Array): ArrayBuffer {
    if (buf instanceof ArrayBuffer) return buf;
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function sha256hex(data: string | Uint8Array): Promise<string> {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

async function hmacSHA256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
}

async function s3SigningKey(secret: string, date: string, region: string): Promise<ArrayBuffer> {
    const kDate = await hmacSHA256(new TextEncoder().encode(`AWS4${secret}`), date);
    const kRegion = await hmacSHA256(kDate, region);
    const kService = await hmacSHA256(kRegion, "s3");
    return hmacSHA256(kService, "aws4_request");
}

async function s3Sign(
    cfg: S3Config,
    method: string,
    path: string,
    query: string,
    extraHeaders: Record<string, string>,
    bodyHash: string,
): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate =
        now
            .toISOString()
            .replace(/[:\-]/g, "")
            .replace(/\.\d{3}/, "")
            .slice(0, 15) + "Z";
    const dateStr = amzDate.slice(0, 8);
    const host = new URL(cfg.endpoint).host;

    const allHeaders: Record<string, string> = {
        host,
        "x-amz-content-sha256": bodyHash,
        "x-amz-date": amzDate,
        ...extraHeaders,
    };

    const sortedKeys = Object.keys(allHeaders).sort();
    const canonicalHeaders =
        sortedKeys.map((k) => `${k}:${allHeaders[k].trim()}`).join("\n") + "\n";
    const signedHeaders = sortedKeys.join(";");

    const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, bodyHash].join(
        "\n",
    );

    const credScope = `${dateStr}/${cfg.region}/s3/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credScope,
        await sha256hex(canonicalRequest),
    ].join("\n");

    const sigKey = await s3SigningKey(cfg.secretAccessKey, dateStr, cfg.region);
    const sigBytes = await hmacSHA256(sigKey, stringToSign);
    const signature = Array.from(new Uint8Array(sigBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return {
        ...allHeaders,
        Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
}

export async function uploadToS3(cfg: S3Config, buffer: Buffer, filename: string): Promise<void> {
    const key = `${S3_PREFIX}${filename}`;
    const endpoint = cfg.endpoint.replace(/\/$/, "");
    const url = `${endpoint}/${cfg.bucket}/${key}`;
    const bodyHash = await sha256hex(new Uint8Array(buffer));
    const headers = await s3Sign(
        cfg,
        "PUT",
        `/${cfg.bucket}/${key}`,
        "",
        {
            "content-type": "application/gzip",
            "content-length": String(buffer.byteLength),
        },
        bodyHash,
    );
    const res = await fetch(url, {
        method: "PUT",
        headers,
        body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`S3 PUT failed (${res.status}): ${await res.text()}`);
}

export async function listS3Backups(cfg: S3Config): Promise<BackupFile[]> {
    const endpoint = cfg.endpoint.replace(/\/$/, "");
    const query = `list-type=2&prefix=${encodeURIComponent(S3_PREFIX)}&max-keys=200`;
    const emptyHash = await sha256hex("");
    const headers = await s3Sign(cfg, "GET", `/${cfg.bucket}`, query, {}, emptyHash);
    const url = `${endpoint}/${cfg.bucket}?${query}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`S3 LIST failed (${res.status}): ${await res.text()}`);
    const xml = await res.text();
    const files: BackupFile[] = [];
    const re = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
        const block = m[1];
        const key = /<Key>(.*?)<\/Key>/.exec(block)?.[1] ?? "";
        const size = Number(/<Size>(.*?)<\/Size>/.exec(block)?.[1] ?? 0);
        const lastMod = /<LastModified>(.*?)<\/LastModified>/.exec(block)?.[1] ?? "";
        const name = key.split("/").pop() ?? key;
        if (!name.endsWith(".gz")) continue;
        files.push({ name, fileId: key, sizeBytes: size, createdAt: lastMod, provider: "s3" });
    }
    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function downloadS3File(cfg: S3Config, key: string): Promise<Buffer> {
    // Only objects under the backup prefix are downloadable — restore feeds this straight
    // into psql, so keep the same containment discipline as the WebDAV href guard.
    if (!key.startsWith(S3_PREFIX)) {
        throw new Error("S3 download target is outside the backup prefix");
    }
    const endpoint = cfg.endpoint.replace(/\/$/, "");
    const url = `${endpoint}/${cfg.bucket}/${key}`;
    const emptyHash = await sha256hex("");
    const headers = await s3Sign(cfg, "GET", `/${cfg.bucket}/${key}`, "", {}, emptyHash);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`S3 GET failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
}

export async function deleteS3File(cfg: S3Config, key: string): Promise<void> {
    const endpoint = cfg.endpoint.replace(/\/$/, "");
    const url = `${endpoint}/${cfg.bucket}/${key}`;
    const emptyHash = await sha256hex("");
    const headers = await s3Sign(cfg, "DELETE", `/${cfg.bucket}/${key}`, "", {}, emptyHash);
    const res = await fetch(url, { method: "DELETE", headers });
    if (!res.ok && res.status !== 204 && res.status !== 404)
        throw new Error(`S3 DELETE failed (${res.status})`);
}

export async function pruneOldS3Backups(cfg: S3Config, retentionDays: number): Promise<void> {
    const files = await listS3Backups(cfg);
    const cutoff = Date.now() - retentionDays * 86_400_000;
    for (const f of files) {
        if (new Date(f.createdAt).getTime() < cutoff) {
            await deleteS3File(cfg, f.fileId).catch(() => null);
        }
    }
}
