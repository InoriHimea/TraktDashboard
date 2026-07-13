import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Most exported functions in services/backup.ts take tokens/configs as parameters and
// don't depend on env vars, so a single static import covers them.
const {
    pollGDriveToken,
    uploadToGDrive,
    listGDriveBackups,
    downloadGDriveFile,
    deleteGDriveFile,
    pruneOldGDriveBackups,
    ensureWebDAVFolder,
    uploadToWebDAV,
    listWebDAVBackups,
    downloadWebDAVFile,
    deleteWebDAVFile,
    pruneOldWebDAVBackups,
    pollOneDriveToken,
    uploadToOneDrive,
    listOneDriveBackups,
    downloadOneDriveFile,
    deleteOneDriveFile,
    pruneOldOneDriveBackups,
    uploadToS3,
    listS3Backups,
    downloadS3File,
    deleteS3File,
    pruneOldS3Backups,
} = await import("../services/backup.js");

function jsonRes(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

function textRes(status: number, body: string): Response {
    return new Response(body, { status });
}

function bodyRes(status: number, body: Uint8Array): Response {
    return new Response(body, { status });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// isGDriveConfigured / isOneDriveConfigured / startXDeviceFlow — these read
// module-level constants captured from env vars AT IMPORT TIME, so exercising
// the "configured" branch requires resetting the module registry and
// re-importing with the env vars already set.
// ---------------------------------------------------------------------------

async function loadFreshBackupService() {
    vi.resetModules();
    return import("../services/backup.js");
}

describe("isGDriveConfigured / isOneDriveConfigured", () => {
    it("is false for both when no credentials are configured", async () => {
        delete process.env.GDRIVE_CLIENT_ID;
        delete process.env.GDRIVE_CLIENT_SECRET;
        delete process.env.ONEDRIVE_CLIENT_ID;
        const mod = await loadFreshBackupService();
        expect(mod.isGDriveConfigured()).toBe(false);
        expect(mod.isOneDriveConfigured()).toBe(false);
    });

    it("is true for GDrive only when both client id and secret are set", async () => {
        process.env.GDRIVE_CLIENT_ID = "real-client-id";
        process.env.GDRIVE_CLIENT_SECRET = "real-secret";
        delete process.env.ONEDRIVE_CLIENT_ID;
        const mod = await loadFreshBackupService();
        expect(mod.isGDriveConfigured()).toBe(true);
        expect(mod.isOneDriveConfigured()).toBe(false);
    });

    it("stays false for GDrive when only the secret is set (id still the placeholder)", async () => {
        delete process.env.GDRIVE_CLIENT_ID;
        process.env.GDRIVE_CLIENT_SECRET = "real-secret";
        const mod = await loadFreshBackupService();
        expect(mod.isGDriveConfigured()).toBe(false);
    });

    it("is true for OneDrive when its client id is set", async () => {
        process.env.ONEDRIVE_CLIENT_ID = "real-onedrive-id";
        const mod = await loadFreshBackupService();
        expect(mod.isOneDriveConfigured()).toBe(true);
    });
});

describe("startGDriveDeviceFlow", () => {
    it("throws when the client secret is not configured", async () => {
        delete process.env.GDRIVE_CLIENT_ID;
        delete process.env.GDRIVE_CLIENT_SECRET;
        const mod = await loadFreshBackupService();
        await expect(mod.startGDriveDeviceFlow()).rejects.toThrow(
            "GDRIVE_CLIENT_SECRET is not configured",
        );
    });

    it("throws when the client id is still the placeholder", async () => {
        delete process.env.GDRIVE_CLIENT_ID;
        process.env.GDRIVE_CLIENT_SECRET = "real-secret";
        const mod = await loadFreshBackupService();
        await expect(mod.startGDriveDeviceFlow()).rejects.toThrow(
            "GDRIVE_CLIENT_ID is not configured",
        );
    });

    it("returns the device auth response when configured and the request succeeds", async () => {
        process.env.GDRIVE_CLIENT_ID = "real-client-id";
        process.env.GDRIVE_CLIENT_SECRET = "real-secret";
        const mod = await loadFreshBackupService();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonRes(200, {
                    device_code: "dc1",
                    user_code: "ABCD-EFGH",
                    verification_url: "https://google.com/device",
                    expires_in: 1800,
                    interval: 5,
                }),
            ),
        );
        const result = await mod.startGDriveDeviceFlow();
        expect(result.user_code).toBe("ABCD-EFGH");
    });

    it("throws with the upstream error body when the request fails", async () => {
        process.env.GDRIVE_CLIENT_ID = "real-client-id";
        process.env.GDRIVE_CLIENT_SECRET = "real-secret";
        const mod = await loadFreshBackupService();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(400, "invalid_client")));
        await expect(mod.startGDriveDeviceFlow()).rejects.toThrow("invalid_client");
    });
});

describe("startOneDriveDeviceFlow", () => {
    it("throws when ONEDRIVE_CLIENT_ID is not configured", async () => {
        delete process.env.ONEDRIVE_CLIENT_ID;
        const mod = await loadFreshBackupService();
        await expect(mod.startOneDriveDeviceFlow()).rejects.toThrow("ONEDRIVE_CLIENT_ID 未配置");
    });

    it("maps Microsoft's device response, falling back verification_uri to verification_url", async () => {
        process.env.ONEDRIVE_CLIENT_ID = "real-onedrive-id";
        const mod = await loadFreshBackupService();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonRes(200, {
                    device_code: "dc1",
                    user_code: "XYZ-123",
                    verification_uri: "https://microsoft.com/devicelogin",
                    expires_in: 900,
                    interval: 5,
                }),
            ),
        );
        const result = await mod.startOneDriveDeviceFlow();
        expect(result).toEqual({
            device_code: "dc1",
            user_code: "XYZ-123",
            verification_url: "https://microsoft.com/devicelogin",
            expires_in: 900,
            interval: 5,
        });
    });

    it("throws when the request fails", async () => {
        process.env.ONEDRIVE_CLIENT_ID = "real-onedrive-id";
        const mod = await loadFreshBackupService();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(500, "server error")));
        await expect(mod.startOneDriveDeviceFlow()).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

const freshToken = {
    access_token: "gdrive-access",
    refresh_token: "gdrive-refresh",
    token_type: "Bearer",
    expiry_date: Date.now() + 60 * 60 * 1000,
    scope: "drive.file",
};

describe("pollGDriveToken", () => {
    it("returns null while authorization is pending", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonRes(200, { error: "authorization_pending" })),
        );
        expect(await pollGDriveToken("dc1")).toBeNull();
    });

    it("returns null on slow_down", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { error: "slow_down" })));
        expect(await pollGDriveToken("dc1")).toBeNull();
    });

    it("throws on any other error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { error: "access_denied" })));
        await expect(pollGDriveToken("dc1")).rejects.toThrow("access_denied");
    });

    it("maps a successful token response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonRes(200, {
                    access_token: "at",
                    refresh_token: "rt",
                    expires_in: 3600,
                }),
            ),
        );
        const token = await pollGDriveToken("dc1");
        expect(token).toMatchObject({
            access_token: "at",
            refresh_token: "rt",
            token_type: "Bearer",
        });
    });
});

describe("uploadToGDrive", () => {
    it("uploads to an existing backup folder without refreshing a non-expired token", async () => {
        const fetchMock = vi.fn(
            (url: string) =>
                new Promise((resolve) => {
                    if (String(url).includes("q=")) {
                        resolve(jsonRes(200, { files: [{ id: "folder1" }] }));
                    } else {
                        resolve(jsonRes(200, { id: "file1" }));
                    }
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const result = await uploadToGDrive(freshToken, Buffer.from("data"), "backup.sql.gz");
        expect(result.fileId).toBe("file1");
        expect(result.refreshedToken.access_token).toBe(freshToken.access_token);
        expect(fetchMock).toHaveBeenCalledTimes(2); // folder lookup + upload, no refresh
    });

    it("creates the backup folder when it does not exist yet", async () => {
        let listCalls = 0;
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            const u = String(url);
            if (u.includes("q=") && init?.method !== "POST") {
                listCalls++;
                // First list: empty. Retry list (after create): found.
                return Promise.resolve(
                    listCalls === 1
                        ? jsonRes(200, { files: [] })
                        : jsonRes(200, { files: [{ id: "new-folder" }] }),
                );
            }
            if (init?.method === "POST" && u.includes("/files") && !u.includes("upload")) {
                return Promise.resolve(jsonRes(200, { id: "new-folder" }));
            }
            return Promise.resolve(jsonRes(200, { id: "file1" }));
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await uploadToGDrive(freshToken, Buffer.from("data"), "backup.sql.gz");
        expect(result.fileId).toBe("file1");
    });

    it("refreshes an expired token before uploading", async () => {
        const expired = { ...freshToken, expiry_date: Date.now() - 1000 };
        const fetchMock = vi.fn((url: string) => {
            const u = String(url);
            if (u.includes("oauth2.googleapis.com/token")) {
                return Promise.resolve(
                    jsonRes(200, { access_token: "new-access", expires_in: 3600 }),
                );
            }
            if (u.includes("q="))
                return Promise.resolve(jsonRes(200, { files: [{ id: "folder1" }] }));
            return Promise.resolve(jsonRes(200, { id: "file1" }));
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await uploadToGDrive(expired, Buffer.from("data"), "backup.sql.gz");
        expect(result.refreshedToken.access_token).toBe("new-access");
    });

    it("throws with the upstream error body when the upload request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((url: string) =>
                Promise.resolve(
                    String(url).includes("q=")
                        ? jsonRes(200, { files: [{ id: "folder1" }] })
                        : textRes(403, "quota exceeded"),
                ),
            ),
        );
        await expect(uploadToGDrive(freshToken, Buffer.from("data"), "b.gz")).rejects.toThrow(
            "quota exceeded",
        );
    });
});

describe("listGDriveBackups", () => {
    it("maps files sorted by the API's own ordering", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((url: string) =>
                Promise.resolve(
                    String(url).includes("fields=files(id)")
                        ? jsonRes(200, { files: [{ id: "folder1" }] })
                        : jsonRes(200, {
                              files: [
                                  {
                                      id: "f1",
                                      name: "a.gz",
                                      size: "100",
                                      createdTime: "2026-01-01",
                                  },
                              ],
                          }),
                ),
            ),
        );
        const { files } = await listGDriveBackups(freshToken);
        expect(files).toEqual([
            {
                name: "a.gz",
                fileId: "f1",
                sizeBytes: 100,
                createdAt: "2026-01-01",
                provider: "gdrive",
            },
        ]);
    });

    it("returns an empty list when the folder cannot be found/created", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonRes(500, {})), // folder list AND create-retry both fail
        );
        const { files } = await listGDriveBackups(freshToken);
        expect(files).toEqual([]);
    });
});

describe("downloadGDriveFile / deleteGDriveFile", () => {
    it("downloads file content as a Buffer", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(bodyRes(200, new TextEncoder().encode("gz-content"))),
        );
        const { data } = await downloadGDriveFile(freshToken, "file1");
        expect(data.toString()).toBe("gz-content");
    });

    it("throws when the download fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(downloadGDriveFile(freshToken, "file1")).rejects.toThrow(
            "GDrive download failed",
        );
    });

    it("treats a 404 delete as success (already gone)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(deleteGDriveFile(freshToken, "file1")).resolves.toBeUndefined();
    });

    it("throws on other delete failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(deleteGDriveFile(freshToken, "file1")).rejects.toThrow("GDrive DELETE failed");
    });
});

describe("pruneOldGDriveBackups", () => {
    it("deletes only files older than the retention window and tolerates a delete failure", async () => {
        const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
        const recentDate = new Date().toISOString();
        const deleteCalls: string[] = [];
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            const u = String(url);
            // listGDriveBackups' own fields= param is encodeURIComponent'd (parens/commas
            // become %28/%2C/%29), unlike getOrCreateGDriveFolder's literal "fields=files(id)"
            // — match on "pageSize=50", a substring unique to listGDriveBackups' URL.
            if (u.includes("pageSize=50")) {
                return Promise.resolve(
                    jsonRes(200, {
                        files: [
                            { id: "old1", name: "old.gz", size: "1", createdTime: oldDate },
                            { id: "new1", name: "new.gz", size: "1", createdTime: recentDate },
                        ],
                    }),
                );
            }
            // Folder-lookup call: report it found immediately so getOrCreateGDriveFolder
            // doesn't fall into its create-then-retry path.
            if (u.includes("fields=files(id)")) {
                return Promise.resolve(jsonRes(200, { files: [{ id: "folder1" }] }));
            }
            if (init?.method === "DELETE") {
                deleteCalls.push(u);
                return Promise.resolve(jsonRes(500, {})); // deletion fails, must be swallowed
            }
            return Promise.resolve(jsonRes(200, {}));
        });
        vi.stubGlobal("fetch", fetchMock);
        await expect(pruneOldGDriveBackups(freshToken, 30)).resolves.toBeDefined();
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]).toContain("old1");
    });
});

// ---------------------------------------------------------------------------
// WebDAV
// ---------------------------------------------------------------------------

const webdavCfg = { url: "https://dav.example.com", username: "u", password: "p" };

describe("ensureWebDAVFolder / uploadToWebDAV", () => {
    it.each([201, 200, 405, 207])("treats MKCOL status %d as success", async (status) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(status, {})));
        await expect(ensureWebDAVFolder(webdavCfg)).resolves.toBeUndefined();
    });

    it("throws on an unexpected MKCOL status", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(ensureWebDAVFolder(webdavCfg)).rejects.toThrow("WebDAV MKCOL failed");
    });

    it("ensures the folder then PUTs the backup", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, {}));
        vi.stubGlobal("fetch", fetchMock);
        await uploadToWebDAV(webdavCfg, Buffer.from("data"), "b.gz");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenLastCalledWith(
            "https://dav.example.com/MediaDashBackups/b.gz",
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("throws when the PUT fails", async () => {
        const fetchMock = vi.fn(
            (_url: string, init?: RequestInit) =>
                new Promise((resolve) =>
                    resolve(init?.method === "PUT" ? jsonRes(500, {}) : jsonRes(201, {})),
                ),
        );
        vi.stubGlobal("fetch", fetchMock);
        await expect(uploadToWebDAV(webdavCfg, Buffer.from("data"), "b.gz")).rejects.toThrow(
            "WebDAV PUT failed",
        );
    });
});

describe("listWebDAVBackups", () => {
    it("parses PROPFIND XML into files sorted by createdAt desc", async () => {
        const xml = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">
            <D:response><D:href>/MediaDashBackups/old.gz</D:href>
                <D:propstat><D:prop><D:getcontentlength>100</D:getcontentlength><D:creationdate>2026-01-01T00:00:00Z</D:creationdate></D:prop></D:propstat>
            </D:response>
            <D:response><D:href>/MediaDashBackups/new.gz</D:href>
                <D:propstat><D:prop><D:getcontentlength>200</D:getcontentlength><D:creationdate>2026-06-01T00:00:00Z</D:creationdate></D:prop></D:propstat>
            </D:response>
            <D:response><D:href>/MediaDashBackups/</D:href></D:response>
        </D:multistatus>`;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(207, xml)));
        const files = await listWebDAVBackups(webdavCfg);
        expect(files.map((f) => f.name)).toEqual(["new.gz", "old.gz"]);
        expect(files[0].sizeBytes).toBe(200);
    });

    it("returns [] on 404", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        expect(await listWebDAVBackups(webdavCfg)).toEqual([]);
    });

    it("throws on other failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(listWebDAVBackups(webdavCfg)).rejects.toThrow("WebDAV PROPFIND failed");
    });
});

describe("downloadWebDAVFile / deleteWebDAVFile (origin + folder containment guard)", () => {
    it("downloads a same-origin file inside the backup folder", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(bodyRes(200, new TextEncoder().encode("content"))),
        );
        const data = await downloadWebDAVFile(webdavCfg, "/MediaDashBackups/b.gz");
        expect(data.toString()).toBe("content");
    });

    it("rejects a target on a different origin without making a request", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            downloadWebDAVFile(webdavCfg, "https://evil.example.com/MediaDashBackups/b.gz"),
        ).rejects.toThrow("outside the configured server");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a same-origin target outside the backup folder", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(downloadWebDAVFile(webdavCfg, "/etc/passwd")).rejects.toThrow(
            "outside the backup folder",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a %2F-encoded traversal attempt (percent-encoding is not decoded before the check)", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            downloadWebDAVFile(webdavCfg, "/MediaDashBackups%2F..%2Fetc%2Fpasswd"),
        ).rejects.toThrow("outside the backup folder");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the download response is not ok", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(downloadWebDAVFile(webdavCfg, "/MediaDashBackups/b.gz")).rejects.toThrow(
            "WebDAV GET failed",
        );
    });

    it("tolerates a 404 on delete (already gone)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(
            deleteWebDAVFile(webdavCfg, "/MediaDashBackups/b.gz"),
        ).resolves.toBeUndefined();
    });

    it("throws on other delete failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(deleteWebDAVFile(webdavCfg, "/MediaDashBackups/b.gz")).rejects.toThrow(
            "WebDAV DELETE failed",
        );
    });
});

describe("pruneOldWebDAVBackups", () => {
    it("deletes only files older than the retention window and tolerates a delete failure", async () => {
        const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
        const recentDate = new Date().toISOString();
        const xml = `<D:multistatus xmlns:D="DAV:">
            <D:response><D:href>/MediaDashBackups/old.gz</D:href>
                <D:propstat><D:prop><D:getcontentlength>1</D:getcontentlength><D:creationdate>${oldDate}</D:creationdate></D:prop></D:propstat>
            </D:response>
            <D:response><D:href>/MediaDashBackups/new.gz</D:href>
                <D:propstat><D:prop><D:getcontentlength>1</D:getcontentlength><D:creationdate>${recentDate}</D:creationdate></D:prop></D:propstat>
            </D:response>
        </D:multistatus>`;
        const deleteCalls: string[] = [];
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
                deleteCalls.push(String(url));
                return Promise.resolve(jsonRes(500, {}));
            }
            return Promise.resolve(textRes(207, xml));
        });
        vi.stubGlobal("fetch", fetchMock);
        await pruneOldWebDAVBackups(webdavCfg, 30);
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]).toContain("old.gz");
    });
});

// ---------------------------------------------------------------------------
// OneDrive
// ---------------------------------------------------------------------------

const oneDriveToken = {
    access_token: "od-access",
    refresh_token: "od-refresh",
    expires_at: Date.now() + 60 * 60 * 1000,
    scope: "Files.ReadWrite",
};

describe("pollOneDriveToken", () => {
    it("returns null while pending", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonRes(200, { error: "authorization_pending" })),
        );
        expect(await pollOneDriveToken("dc1")).toBeNull();
    });

    it("throws on a hard error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { error: "expired_token" })));
        await expect(pollOneDriveToken("dc1")).rejects.toThrow("expired_token");
    });

    it("maps a successful token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(jsonRes(200, { access_token: "at", expires_in: 3600 })),
        );
        const token = await pollOneDriveToken("dc1");
        expect(token?.access_token).toBe("at");
    });
});

describe("uploadToOneDrive", () => {
    it("PUTs small files (<=4MB) directly", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { id: "item1" }));
        vi.stubGlobal("fetch", fetchMock);
        const result = await uploadToOneDrive(oneDriveToken, Buffer.from("small"), "b.gz");
        expect(result.itemId).toBe("item1");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining(":/content"),
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("throws with the upstream body when the small-file PUT fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(413, "too large")));
        await expect(uploadToOneDrive(oneDriveToken, Buffer.from("small"), "b.gz")).rejects.toThrow(
            "too large",
        );
    });

    it("uses a chunked upload session for files over 4MB", async () => {
        const big = Buffer.alloc(5 * 1024 * 1024, 1);
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            const u = String(url);
            if (u.includes("createUploadSession")) {
                return Promise.resolve(
                    jsonRes(200, { uploadUrl: "https://upload.example.com/s1" }),
                );
            }
            if (init?.method === "PUT") {
                // Last chunk returns 200 with the final item id; earlier chunks 202.
                const isLast =
                    init.headers &&
                    String((init.headers as Record<string, string>)["Content-Range"]).includes(
                        `${big.byteLength - 1}/${big.byteLength}`,
                    );
                return Promise.resolve(isLast ? jsonRes(200, { id: "item1" }) : jsonRes(202, {}));
            }
            return Promise.resolve(jsonRes(200, {}));
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await uploadToOneDrive(oneDriveToken, big, "big.gz");
        expect(result.itemId).toBe("item1");
    });

    it("throws when creating the upload session fails", async () => {
        const big = Buffer.alloc(5 * 1024 * 1024, 1);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(uploadToOneDrive(oneDriveToken, big, "big.gz")).rejects.toThrow(
            "createUploadSession failed",
        );
    });
});

describe("listOneDriveBackups", () => {
    it("filters to .gz files and maps fields", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonRes(200, {
                    value: [
                        { id: "f1", name: "a.gz", size: 100, createdDateTime: "2026-01-01" },
                        { id: "f2", name: "notes.txt", size: 10, createdDateTime: "2026-01-02" },
                    ],
                }),
            ),
        );
        const { files } = await listOneDriveBackups(oneDriveToken);
        expect(files).toEqual([
            {
                name: "a.gz",
                fileId: "f1",
                sizeBytes: 100,
                createdAt: "2026-01-01",
                provider: "onedrive",
            },
        ]);
    });

    it("returns [] on 404 (folder not created yet)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        expect((await listOneDriveBackups(oneDriveToken)).files).toEqual([]);
    });

    it("throws on other failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(listOneDriveBackups(oneDriveToken)).rejects.toThrow("OneDrive list failed");
    });
});

describe("downloadOneDriveFile / deleteOneDriveFile", () => {
    it("downloads content as a Buffer", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(bodyRes(200, new TextEncoder().encode("content"))),
        );
        const { data } = await downloadOneDriveFile(oneDriveToken, "item1");
        expect(data.toString()).toBe("content");
    });

    it("throws when the download fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(downloadOneDriveFile(oneDriveToken, "item1")).rejects.toThrow(
            "OneDrive download failed",
        );
    });

    it("tolerates a 404 delete", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(deleteOneDriveFile(oneDriveToken, "item1")).resolves.toBeUndefined();
    });

    it("throws on other delete failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(deleteOneDriveFile(oneDriveToken, "item1")).rejects.toThrow(
            "OneDrive DELETE failed",
        );
    });
});

describe("pruneOldOneDriveBackups", () => {
    it("deletes only files older than the retention window and tolerates a delete failure", async () => {
        const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
        const recentDate = new Date().toISOString();
        const deleteCalls: string[] = [];
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            const u = String(url);
            if (u.includes(":/children")) {
                return Promise.resolve(
                    jsonRes(200, {
                        value: [
                            { id: "old1", name: "old.gz", size: 1, createdDateTime: oldDate },
                            { id: "new1", name: "new.gz", size: 1, createdDateTime: recentDate },
                        ],
                    }),
                );
            }
            if (init?.method === "DELETE") {
                deleteCalls.push(u);
                return Promise.resolve(jsonRes(500, {}));
            }
            return Promise.resolve(jsonRes(200, {}));
        });
        vi.stubGlobal("fetch", fetchMock);
        await pruneOldOneDriveBackups(oneDriveToken, 30);
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]).toContain("old1");
    });
});

// ---------------------------------------------------------------------------
// S3-compatible storage
// ---------------------------------------------------------------------------

const s3Cfg = {
    endpoint: "https://s3.example.com",
    region: "us-east-1",
    bucket: "my-bucket",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret",
};

describe("uploadToS3", () => {
    it("PUTs under the mediadash-backups/ prefix with a SigV4 Authorization header", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, {}));
        vi.stubGlobal("fetch", fetchMock);
        await uploadToS3(s3Cfg, Buffer.from("data"), "b.gz");
        expect(fetchMock).toHaveBeenCalledWith(
            "https://s3.example.com/my-bucket/mediadash-backups/b.gz",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    Authorization: expect.stringMatching(/^AWS4-HMAC-SHA256 Credential=/),
                }),
            }),
        );
    });

    it("throws with the upstream error body when the PUT fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(403, "AccessDenied")));
        await expect(uploadToS3(s3Cfg, Buffer.from("data"), "b.gz")).rejects.toThrow(
            "AccessDenied",
        );
    });
});

describe("listS3Backups", () => {
    it("parses ListObjectsV2 XML, filters to .gz, and sorts desc by LastModified", async () => {
        const xml = `<ListBucketResult>
            <Contents><Key>mediadash-backups/old.gz</Key><Size>1</Size><LastModified>2026-01-01T00:00:00Z</LastModified></Contents>
            <Contents><Key>mediadash-backups/new.gz</Key><Size>2</Size><LastModified>2026-06-01T00:00:00Z</LastModified></Contents>
            <Contents><Key>mediadash-backups/readme.txt</Key><Size>3</Size><LastModified>2026-06-02T00:00:00Z</LastModified></Contents>
        </ListBucketResult>`;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(200, xml)));
        const files = await listS3Backups(s3Cfg);
        expect(files.map((f) => f.name)).toEqual(["new.gz", "old.gz"]);
    });

    it("throws with the upstream error body when LIST fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textRes(403, "SignatureDoesNotMatch")));
        await expect(listS3Backups(s3Cfg)).rejects.toThrow("SignatureDoesNotMatch");
    });
});

describe("downloadS3File / deleteS3File", () => {
    it("rejects a key outside the backup prefix without making a request", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(downloadS3File(s3Cfg, "other-prefix/file.gz")).rejects.toThrow(
            "outside the backup prefix",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("downloads a key under the backup prefix", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(bodyRes(200, new TextEncoder().encode("content"))),
        );
        const data = await downloadS3File(s3Cfg, "mediadash-backups/b.gz");
        expect(data.toString()).toBe("content");
    });

    it("throws when the GET fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(downloadS3File(s3Cfg, "mediadash-backups/b.gz")).rejects.toThrow(
            "S3 GET failed",
        );
    });

    it("tolerates 204 on delete", async () => {
        // 204/205/304 are "null body status" responses per the Fetch spec — no JSON body.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
        await expect(deleteS3File(s3Cfg, "mediadash-backups/b.gz")).resolves.toBeUndefined();
    });

    it("tolerates 404 on delete", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(404, {})));
        await expect(deleteS3File(s3Cfg, "mediadash-backups/b.gz")).resolves.toBeUndefined();
    });

    it("throws on other delete failures", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(500, {})));
        await expect(deleteS3File(s3Cfg, "mediadash-backups/b.gz")).rejects.toThrow(
            "S3 DELETE failed",
        );
    });
});

describe("pruneOldS3Backups", () => {
    it("deletes only files older than the retention window and tolerates a delete failure", async () => {
        const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
        const recentDate = new Date().toISOString();
        const xml = `<ListBucketResult>
            <Contents><Key>mediadash-backups/old.gz</Key><Size>1</Size><LastModified>${oldDate}</LastModified></Contents>
            <Contents><Key>mediadash-backups/new.gz</Key><Size>1</Size><LastModified>${recentDate}</LastModified></Contents>
        </ListBucketResult>`;
        const deleteCalls: string[] = [];
        const fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (init?.method === "DELETE") {
                deleteCalls.push(String(url));
                return Promise.resolve(jsonRes(500, {}));
            }
            return Promise.resolve(textRes(200, xml));
        });
        vi.stubGlobal("fetch", fetchMock);
        await pruneOldS3Backups(s3Cfg, 30);
        expect(deleteCalls).toHaveLength(1);
        expect(deleteCalls[0]).toContain("old.gz");
    });
});
