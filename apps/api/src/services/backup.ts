import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";

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
    provider: "gdrive" | "webdav";
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
const GDRIVE_FOLDER_NAME = "TraktDashboardBackups";

export interface DeviceAuthResponse {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
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
    return `${base}/TraktDashboardBackups/${filename}`;
}

export async function ensureWebDAVFolder(cfg: WebDAVConfig): Promise<void> {
    const base = cfg.url.replace(/\/$/, "");
    const folderUrl = `${base}/TraktDashboardBackups`;
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
    const folderUrl = `${base}/TraktDashboardBackups/`;
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

export async function deleteWebDAVFile(cfg: WebDAVConfig, filePath: string): Promise<void> {
    // filePath is the href returned by PROPFIND (a site-absolute path or full URL).
    // Constrain it to the configured server origin AND the backup folder, so a crafted
    // fileId cannot make the server issue an authenticated DELETE to an arbitrary host
    // (SSRF / credential leak) or delete files outside TraktDashboardBackups.
    const baseUrl = new URL(cfg.url);
    const resolved = new URL(filePath, baseUrl); // absolute URLs keep their own origin
    if (resolved.origin !== baseUrl.origin) {
        throw new Error("WebDAV delete target is outside the configured server");
    }
    // Check the raw (percent-encoded) pathname — do NOT decode before checking.
    // decodeURIComponent() would turn %2F into "/" which lets a crafted path like
    // /TraktDashboardBackups%2F..%2Fetc pass the substring check while the actual
    // request targets a path outside the backup folder on servers that decode %2F.
    if (!resolved.pathname.includes("/TraktDashboardBackups/")) {
        throw new Error("WebDAV delete target is outside the backup folder");
    }
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
