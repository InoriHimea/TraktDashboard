import { useState, type Dispatch, type SetStateAction } from "react";
import { HardDrive, Cloud, Database, Loader2, Check, RefreshCw, Server, X } from "lucide-react";
import type { BackupFile as BackupFileEntry } from "@trakt-dashboard/types";
import { t } from "../../lib/i18n";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import type { DeviceAuthState } from "./shared";

interface BackupRun {
    id: number;
    provider: string;
    status: string;
    filename: string | null;
    sizeBytes: number | null;
    error: string | null;
    startedAt: string;
}

interface BackupTabProps {
    // 云盘 OAuth 应用凭据是否已配进环境变量（GDRIVE_CLIENT_ID/SECRET、ONEDRIVE_CLIENT_ID）。
    // false 时隐藏对应卡片，显示"已禁用"提示（N6 批次 3a，详见 docs/cloud-backup-setup.md）。
    gdriveConfigured: boolean;
    onedriveConfigured: boolean;
    gdriveConnected: boolean;
    setGdriveConnected: Dispatch<SetStateAction<boolean>>;
    gdriveLoading: boolean;
    setGdriveLoading: Dispatch<SetStateAction<boolean>>;
    gdriveDeviceAuth: DeviceAuthState;
    setGdriveDeviceAuth: Dispatch<SetStateAction<DeviceAuthState>>;
    gdrivePollTimer: ReturnType<typeof setInterval> | null;
    setGdrivePollTimer: Dispatch<SetStateAction<ReturnType<typeof setInterval> | null>>;

    onedriveConnected: boolean;
    setOnedriveConnected: Dispatch<SetStateAction<boolean>>;
    onedriveLoading: boolean;
    setOnedriveLoading: Dispatch<SetStateAction<boolean>>;
    onedriveDeviceAuth: DeviceAuthState;
    setOnedriveDeviceAuth: Dispatch<SetStateAction<DeviceAuthState>>;
    onedrivePollTimer: ReturnType<typeof setInterval> | null;
    setOnedrivePollTimer: Dispatch<SetStateAction<ReturnType<typeof setInterval> | null>>;

    webdavUrl: string;
    setWebdavUrl: Dispatch<SetStateAction<string>>;
    webdavUsername: string;
    setWebdavUsername: Dispatch<SetStateAction<string>>;
    webdavPassword: string;
    setWebdavPassword: Dispatch<SetStateAction<string>>;
    webdavConnected: boolean;
    setWebdavConnected: Dispatch<SetStateAction<boolean>>;
    webdavSaving: boolean;
    setWebdavSaving: Dispatch<SetStateAction<boolean>>;

    s3Endpoint: string;
    setS3Endpoint: Dispatch<SetStateAction<string>>;
    s3Region: string;
    setS3Region: Dispatch<SetStateAction<string>>;
    s3Bucket: string;
    setS3Bucket: Dispatch<SetStateAction<string>>;
    s3AccessKeyId: string;
    setS3AccessKeyId: Dispatch<SetStateAction<string>>;
    s3SecretAccessKey: string;
    setS3SecretAccessKey: Dispatch<SetStateAction<string>>;
    s3Connected: boolean;
    setS3Connected: Dispatch<SetStateAction<boolean>>;
    s3Saving: boolean;
    setS3Saving: Dispatch<SetStateAction<boolean>>;

    backupScheduleHours: number;
    setBackupScheduleHours: Dispatch<SetStateAction<number>>;
    backupTriggerLoading: boolean;
    setBackupTriggerLoading: Dispatch<SetStateAction<boolean>>;
    backupRuns: BackupRun[];
    setBackupRuns: Dispatch<SetStateAction<BackupRun[]>>;
    backupRunsLoading: boolean;
}

export function BackupTab({
    gdriveConfigured,
    onedriveConfigured,
    gdriveConnected,
    setGdriveConnected,
    gdriveLoading,
    setGdriveLoading,
    gdriveDeviceAuth,
    setGdriveDeviceAuth,
    gdrivePollTimer,
    setGdrivePollTimer,
    onedriveConnected,
    setOnedriveConnected,
    onedriveLoading,
    setOnedriveLoading,
    onedriveDeviceAuth,
    setOnedriveDeviceAuth,
    onedrivePollTimer,
    setOnedrivePollTimer,
    webdavUrl,
    setWebdavUrl,
    webdavUsername,
    setWebdavUsername,
    webdavPassword,
    setWebdavPassword,
    webdavConnected,
    setWebdavConnected,
    webdavSaving,
    setWebdavSaving,
    s3Endpoint,
    setS3Endpoint,
    s3Region,
    setS3Region,
    s3Bucket,
    setS3Bucket,
    s3AccessKeyId,
    setS3AccessKeyId,
    s3SecretAccessKey,
    setS3SecretAccessKey,
    s3Connected,
    setS3Connected,
    s3Saving,
    setS3Saving,
    backupScheduleHours,
    setBackupScheduleHours,
    backupTriggerLoading,
    setBackupTriggerLoading,
    backupRuns,
    setBackupRuns,
    backupRunsLoading,
}: BackupTabProps) {
    const { toast } = useToast();

    // 云端文件列表 + 恢复（N6 批次 3b）：本地 state 即可，列表按需加载
    const [cloudFiles, setCloudFiles] = useState<BackupFileEntry[]>([]);
    const [cloudFilesLoading, setCloudFilesLoading] = useState(false);
    const [cloudFilesLoaded, setCloudFilesLoaded] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState<BackupFileEntry | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [restoreDone, setRestoreDone] = useState(false);

    async function loadCloudFiles() {
        setCloudFilesLoading(true);
        try {
            const r = await api.backup.files();
            setCloudFiles(r.data);
            setCloudFilesLoaded(true);
        } catch {
            toast(t("settings.backup.filesLoadFailed"), "error");
        } finally {
            setCloudFilesLoading(false);
        }
    }

    async function handleRestoreConfirm() {
        if (!restoreTarget) return;
        setRestoring(true);
        try {
            await api.backup.restore(restoreTarget.provider, restoreTarget.fileId);
            setRestoreTarget(null);
            // 服务端随即 process.exit 重启，全屏提示替代一切后续交互
            setRestoreDone(true);
        } catch (e) {
            toast((e as Error).message || t("settings.backup.restoreFailed"), "error");
        } finally {
            setRestoring(false);
        }
    }

    return (
        <div>
            <span
                style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    marginBottom: "6px",
                    display: "block",
                }}
            >
                <HardDrive size={14} style={{ display: "inline", marginRight: 6 }} />
                {t("settings.backup.title")}
            </span>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginBottom: 16,
                }}
            >
                {t("settings.backup.hint")}
            </p>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 18,
                }}
            >
                {/* 云盘 OAuth 凭据未配置时隐藏对应卡片，仅提示如何启用（N6 批次 3a） */}
                {(!gdriveConfigured || !onedriveConfigured) && (
                    <div
                        style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "1px dashed var(--color-border)",
                            background: "var(--color-surface-2)",
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                            lineHeight: 1.6,
                        }}
                    >
                        {t("settings.backup.cloudDisabled", {
                            providers: [
                                !gdriveConfigured ? "Google Drive" : null,
                                !onedriveConfigured ? "OneDrive" : null,
                            ]
                                .filter(Boolean)
                                .join(" / "),
                        })}{" "}
                        <a
                            href="https://github.com/InoriHimea/TraktDashboard/blob/main/docs/cloud-backup-setup.md"
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--color-accent)" }}
                        >
                            {t("settings.backup.cloudDisabledDocs")}
                        </a>
                    </div>
                )}

                {/* Google Drive */}
                {gdriveConfigured && (
                    <div
                        style={{
                            padding: "14px 16px",
                            borderRadius: 12,
                            border: "1px solid var(--color-border-subtle)",
                            background: "var(--color-surface-2)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontWeight: 600,
                                    fontSize: 13,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Cloud size={14} />
                                Google Drive
                                {gdriveConnected && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: "2px 7px",
                                            borderRadius: 10,
                                            background: "rgba(16,185,129,0.15)",
                                            color: "#10b981",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t("settings.backup.connected")}
                                    </span>
                                )}
                            </span>
                            {gdriveConnected ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await api.backup.gdriveRevoke().catch(() => null);
                                        setGdriveConnected(false);
                                        toast(t("settings.backup.gdriveDisconnected"), "success");
                                    }}
                                    style={{
                                        fontSize: 12,
                                        color: "#ef4444",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("settings.backup.disconnect")}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={gdriveLoading}
                                    onClick={async () => {
                                        setGdriveLoading(true);
                                        try {
                                            const res = await api.backup.gdriveStartAuth();
                                            setGdriveDeviceAuth(res.data);
                                            // Stop polling once the device code expires.
                                            const deadline =
                                                Date.now() + res.data.expires_in * 1000;
                                            const stopPolling = (
                                                timer: ReturnType<typeof setInterval>,
                                            ) => {
                                                clearInterval(timer);
                                                setGdrivePollTimer(null);
                                                setGdriveDeviceAuth(null);
                                                setGdriveLoading(false);
                                            };
                                            const timer = setInterval(
                                                async () => {
                                                    if (Date.now() >= deadline) {
                                                        stopPolling(timer);
                                                        toast(
                                                            t("settings.backup.gdriveAuthFailed"),
                                                            "error",
                                                        );
                                                        return;
                                                    }
                                                    try {
                                                        const poll = await api.backup.gdrivePoll(
                                                            res.data.device_code,
                                                        );
                                                        if (poll.connected) {
                                                            stopPolling(timer);
                                                            setGdriveConnected(true);
                                                            toast(
                                                                t(
                                                                    "settings.backup.gdriveConnected",
                                                                ),
                                                                "success",
                                                            );
                                                        }
                                                    } catch {
                                                        // Denied / expired / network — stop and surface failure
                                                        // instead of looping forever with a stuck spinner.
                                                        stopPolling(timer);
                                                        toast(
                                                            t("settings.backup.gdriveAuthFailed"),
                                                            "error",
                                                        );
                                                    }
                                                },
                                                (res.data.interval + 1) * 1000,
                                            );
                                            setGdrivePollTimer(timer);
                                        } catch {
                                            setGdriveLoading(false);
                                            toast(t("settings.backup.gdriveAuthFailed"), "error");
                                        }
                                    }}
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: "5px 12px",
                                        borderRadius: 7,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-surface-2)",
                                        color: "var(--color-text)",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                    }}
                                >
                                    {gdriveLoading ? (
                                        <Loader2
                                            size={12}
                                            style={{
                                                animation: "spin 1s linear infinite",
                                            }}
                                        />
                                    ) : (
                                        <Cloud size={12} />
                                    )}
                                    {t("settings.backup.connect")}
                                </button>
                            )}
                        </div>
                        {/* Device Flow 提示 */}
                        {gdriveDeviceAuth && (
                            <div
                                style={{
                                    marginTop: 10,
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                    }}
                                >
                                    {t("settings.backup.deviceFlowHint")}
                                </p>
                                <p
                                    style={{
                                        margin: "6px 0 0",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        letterSpacing: "0.1em",
                                        color: "var(--color-text)",
                                    }}
                                >
                                    {gdriveDeviceAuth!.user_code}
                                </p>
                                <a
                                    href={gdriveDeviceAuth!.verification_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-accent)",
                                        marginTop: 4,
                                        display: "block",
                                    }}
                                >
                                    {gdriveDeviceAuth!.verification_url}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (gdrivePollTimer) clearInterval(gdrivePollTimer);
                                        setGdrivePollTimer(null);
                                        setGdriveDeviceAuth(null);
                                        setGdriveLoading(false);
                                    }}
                                    style={{
                                        marginTop: 8,
                                        fontSize: 11,
                                        color: "var(--color-text-muted)",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("common.cancel")}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* OneDrive */}
                {onedriveConfigured && (
                    <div
                        style={{
                            padding: "14px 16px",
                            borderRadius: 12,
                            border: "1px solid var(--color-border-subtle)",
                            background: "var(--color-surface-2)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontWeight: 600,
                                    fontSize: 13,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Cloud size={14} />
                                OneDrive
                                {onedriveConnected && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: "2px 7px",
                                            borderRadius: 10,
                                            background: "rgba(16,185,129,0.15)",
                                            color: "#10b981",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t("settings.backup.connected")}
                                    </span>
                                )}
                            </span>
                            {onedriveConnected ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await api.backup.onedriveRevoke().catch(() => null);
                                        setOnedriveConnected(false);
                                        toast(t("settings.backup.onedriveDisconnected"), "success");
                                    }}
                                    style={{
                                        fontSize: 12,
                                        color: "#ef4444",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("settings.backup.disconnect")}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={onedriveLoading}
                                    onClick={async () => {
                                        setOnedriveLoading(true);
                                        try {
                                            const res = await api.backup.onedriveStartAuth();
                                            setOnedriveDeviceAuth(res.data);
                                            const deadline =
                                                Date.now() + res.data.expires_in * 1000;
                                            const stopPolling = (
                                                timer: ReturnType<typeof setInterval>,
                                            ) => {
                                                clearInterval(timer);
                                                setOnedrivePollTimer(null);
                                                setOnedriveDeviceAuth(null);
                                                setOnedriveLoading(false);
                                            };
                                            const timer = setInterval(
                                                async () => {
                                                    if (Date.now() >= deadline) {
                                                        stopPolling(timer);
                                                        toast(
                                                            t("settings.backup.onedriveAuthFailed"),
                                                            "error",
                                                        );
                                                        return;
                                                    }
                                                    try {
                                                        const poll = await api.backup.onedrivePoll(
                                                            res.data.device_code,
                                                        );
                                                        if (poll.connected) {
                                                            stopPolling(timer);
                                                            setOnedriveConnected(true);
                                                            toast(
                                                                t(
                                                                    "settings.backup.onedriveConnected",
                                                                ),
                                                                "success",
                                                            );
                                                        }
                                                    } catch {
                                                        stopPolling(timer);
                                                        toast(
                                                            t("settings.backup.onedriveAuthFailed"),
                                                            "error",
                                                        );
                                                    }
                                                },
                                                (res.data.interval + 1) * 1000,
                                            );
                                            setOnedrivePollTimer(timer);
                                        } catch {
                                            setOnedriveLoading(false);
                                            toast(t("settings.backup.onedriveAuthFailed"), "error");
                                        }
                                    }}
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: "5px 12px",
                                        borderRadius: 7,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-surface-2)",
                                        color: "var(--color-text)",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                    }}
                                >
                                    {onedriveLoading ? (
                                        <Loader2
                                            size={12}
                                            style={{
                                                animation: "spin 1s linear infinite",
                                            }}
                                        />
                                    ) : (
                                        <Cloud size={12} />
                                    )}
                                    {t("settings.backup.connect")}
                                </button>
                            )}
                        </div>
                        {onedriveDeviceAuth && (
                            <div
                                style={{
                                    marginTop: 10,
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border-subtle)",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                    }}
                                >
                                    {t("settings.backup.deviceFlowHint")}
                                </p>
                                <p
                                    style={{
                                        margin: "6px 0 0",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        letterSpacing: "0.1em",
                                        color: "var(--color-text)",
                                    }}
                                >
                                    {onedriveDeviceAuth.user_code}
                                </p>
                                <a
                                    href={onedriveDeviceAuth.verification_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        fontSize: 11,
                                        color: "var(--color-accent)",
                                        marginTop: 4,
                                        display: "block",
                                    }}
                                >
                                    {onedriveDeviceAuth.verification_url}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onedrivePollTimer) clearInterval(onedrivePollTimer);
                                        setOnedrivePollTimer(null);
                                        setOnedriveDeviceAuth(null);
                                        setOnedriveLoading(false);
                                    }}
                                    style={{
                                        marginTop: 8,
                                        fontSize: 11,
                                        color: "var(--color-text-muted)",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    {t("common.cancel")}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* WebDAV */}
                <div
                    style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border-subtle)",
                        background: "var(--color-surface-2)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 10,
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 600,
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <Server size={14} />
                            WebDAV
                            {webdavConnected && (
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: "2px 7px",
                                        borderRadius: 10,
                                        background: "rgba(16,185,129,0.15)",
                                        color: "#10b981",
                                        fontWeight: 700,
                                    }}
                                >
                                    {t("settings.backup.connected")}
                                </span>
                            )}
                        </span>
                        {webdavConnected && (
                            <button
                                type="button"
                                onClick={async () => {
                                    await api.backup.webdavClear().catch(() => null);
                                    setWebdavConnected(false);
                                    setWebdavUrl("");
                                    setWebdavUsername("");
                                    setWebdavPassword("");
                                    toast(t("settings.backup.webdavCleared"), "success");
                                }}
                                style={{
                                    fontSize: 12,
                                    color: "#ef4444",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                {t("settings.backup.disconnect")}
                            </button>
                        )}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {[
                            {
                                label: t("settings.backup.webdavUrl"),
                                value: webdavUrl,
                                onChange: setWebdavUrl,
                                placeholder:
                                    "https://nextcloud.example.com/remote.php/dav/files/user/",
                            },
                            {
                                label: t("settings.backup.webdavUsername"),
                                value: webdavUsername,
                                onChange: setWebdavUsername,
                                placeholder: "username",
                            },
                            {
                                label: t("settings.backup.webdavPassword"),
                                value: webdavPassword,
                                onChange: setWebdavPassword,
                                placeholder: "••••••••",
                                type: "password",
                            },
                        ].map(({ label, value, onChange, placeholder, type }) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                        width: 80,
                                        flexShrink: 0,
                                    }}
                                >
                                    {label}
                                </span>
                                <input
                                    type={type ?? "text"}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder={placeholder}
                                    style={{
                                        flex: 1,
                                        padding: "6px 10px",
                                        borderRadius: 7,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-surface-2)",
                                        color: "var(--color-text)",
                                        fontSize: 12,
                                        fontFamily: "inherit",
                                    }}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            disabled={
                                webdavSaving || !webdavUrl || !webdavUsername || !webdavPassword
                            }
                            onClick={async () => {
                                setWebdavSaving(true);
                                try {
                                    await api.backup.webdavSave({
                                        url: webdavUrl,
                                        username: webdavUsername,
                                        password: webdavPassword,
                                    });
                                    setWebdavConnected(true);
                                    setWebdavPassword("");
                                    toast(t("settings.backup.webdavSaved"), "success");
                                } catch (e) {
                                    toast(
                                        (e as Error).message || t("settings.backup.webdavFailed"),
                                        "error",
                                    );
                                } finally {
                                    setWebdavSaving(false);
                                }
                            }}
                            style={{
                                alignSelf: "flex-start",
                                marginTop: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 14px",
                                borderRadius: 7,
                                border: "none",
                                background: "#10b981",
                                color: "#fff",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                opacity:
                                    !webdavUrl || !webdavUsername || !webdavPassword ? 0.45 : 1,
                            }}
                        >
                            {webdavSaving ? (
                                <Loader2
                                    size={11}
                                    style={{
                                        animation: "spin 1s linear infinite",
                                    }}
                                />
                            ) : (
                                <Check size={11} />
                            )}
                            {t("settings.backup.webdavTest")}
                        </button>
                    </div>
                </div>

                {/* S3-compatible Storage */}
                <div
                    style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border-subtle)",
                        background: "var(--color-surface-2)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 10,
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 600,
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <Database size={14} />
                            S3
                            {s3Connected && (
                                <span
                                    style={{
                                        fontSize: 10,
                                        padding: "2px 7px",
                                        borderRadius: 10,
                                        background: "rgba(16,185,129,0.15)",
                                        color: "#10b981",
                                        fontWeight: 700,
                                    }}
                                >
                                    {t("settings.backup.connected")}
                                </span>
                            )}
                        </span>
                        {s3Connected && (
                            <button
                                type="button"
                                onClick={async () => {
                                    await api.backup.s3Clear().catch(() => null);
                                    setS3Connected(false);
                                    setS3Endpoint("");
                                    setS3Region("");
                                    setS3Bucket("");
                                    setS3AccessKeyId("");
                                    setS3SecretAccessKey("");
                                    toast(t("settings.backup.s3Cleared"), "success");
                                }}
                                style={{
                                    fontSize: 12,
                                    color: "#ef4444",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                }}
                            >
                                {t("settings.backup.disconnect")}
                            </button>
                        )}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {(
                            [
                                {
                                    label: "Endpoint",
                                    value: s3Endpoint,
                                    onChange: setS3Endpoint,
                                    placeholder: "https://s3.amazonaws.com",
                                },
                                {
                                    label: "Region",
                                    value: s3Region,
                                    onChange: setS3Region,
                                    placeholder: "us-east-1",
                                },
                                {
                                    label: "Bucket",
                                    value: s3Bucket,
                                    onChange: setS3Bucket,
                                    placeholder: "my-backup-bucket",
                                },
                                {
                                    label: "Access Key",
                                    value: s3AccessKeyId,
                                    onChange: setS3AccessKeyId,
                                    placeholder: "AKIAIOSFODNN7EXAMPLE",
                                },
                                {
                                    label: "Secret Key",
                                    value: s3SecretAccessKey,
                                    onChange: setS3SecretAccessKey,
                                    placeholder: "••••••••",
                                    type: "password" as const,
                                },
                            ] as Array<{
                                label: string;
                                value: string;
                                onChange: (v: string) => void;
                                placeholder: string;
                                type?: string;
                            }>
                        ).map(({ label, value, onChange, placeholder, type }) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                        width: 80,
                                        flexShrink: 0,
                                    }}
                                >
                                    {label}
                                </span>
                                <input
                                    type={type ?? "text"}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder={placeholder}
                                    style={{
                                        flex: 1,
                                        padding: "6px 10px",
                                        borderRadius: 7,
                                        border: "1px solid var(--color-border)",
                                        background: "var(--color-surface-2)",
                                        color: "var(--color-text)",
                                        fontSize: 12,
                                        fontFamily: "inherit",
                                    }}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            disabled={
                                s3Saving ||
                                !s3Endpoint ||
                                !s3Region ||
                                !s3Bucket ||
                                !s3AccessKeyId ||
                                !s3SecretAccessKey
                            }
                            onClick={async () => {
                                setS3Saving(true);
                                try {
                                    await api.backup.s3Save({
                                        endpoint: s3Endpoint,
                                        region: s3Region,
                                        bucket: s3Bucket,
                                        accessKeyId: s3AccessKeyId,
                                        secretAccessKey: s3SecretAccessKey,
                                    });
                                    setS3Connected(true);
                                    setS3SecretAccessKey("");
                                    toast(t("settings.backup.s3Saved"), "success");
                                } catch (e) {
                                    toast(
                                        (e as Error).message || t("settings.backup.s3Failed"),
                                        "error",
                                    );
                                } finally {
                                    setS3Saving(false);
                                }
                            }}
                            style={{
                                alignSelf: "flex-start",
                                marginTop: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 14px",
                                borderRadius: 7,
                                border: "none",
                                background: "#10b981",
                                color: "#fff",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                opacity:
                                    !s3Endpoint ||
                                    !s3Region ||
                                    !s3Bucket ||
                                    !s3AccessKeyId ||
                                    !s3SecretAccessKey
                                        ? 0.45
                                        : 1,
                            }}
                        >
                            {s3Saving ? (
                                <Loader2
                                    size={11}
                                    style={{
                                        animation: "spin 1s linear infinite",
                                    }}
                                />
                            ) : (
                                <Check size={11} />
                            )}
                            {t("settings.backup.s3Test")}
                        </button>
                    </div>
                </div>

                {/* 定时备份 */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--color-border-subtle)",
                        background: "var(--color-surface-2)",
                    }}
                >
                    <HardDrive
                        size={14}
                        style={{
                            color: "var(--color-text-muted)",
                            flexShrink: 0,
                        }}
                    />
                    <span
                        style={{
                            fontSize: 13,
                            color: "var(--color-text-muted)",
                            flex: 1,
                        }}
                    >
                        {t("settings.backup.scheduleLabel")}
                    </span>
                    <select
                        value={backupScheduleHours}
                        onChange={async (e) => {
                            const h = Number(e.target.value);
                            setBackupScheduleHours(h);
                            await api.backup.saveSettings({ scheduleHours: h }).catch(() => null);
                        }}
                        style={{
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 7,
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface-2)",
                            color: "var(--color-text)",
                            cursor: "pointer",
                        }}
                    >
                        <option value={0}>{t("settings.backup.scheduleOff")}</option>
                        <option value={6}>6h</option>
                        <option value={12}>12h</option>
                        <option value={24}>24h</option>
                        <option value={48}>48h</option>
                        <option value={168}>7 days</option>
                    </select>
                </div>

                {/* 立即备份 */}
                {(gdriveConnected || webdavConnected || onedriveConnected || s3Connected) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <button
                            type="button"
                            disabled={backupTriggerLoading}
                            onClick={async () => {
                                setBackupTriggerLoading(true);
                                try {
                                    const res = await api.backup.trigger("all");
                                    const successCount = res.results.filter((r) => r.ok).length;
                                    if (res.ok) {
                                        toast(
                                            t("settings.backup.triggerSuccess", {
                                                n: successCount,
                                            }),
                                            "success",
                                        );
                                    } else {
                                        toast(t("settings.backup.triggerFailed"), "error");
                                    }
                                    // Refresh run history
                                    api.backup
                                        .runs(10)
                                        .then((r) => setBackupRuns(r.data))
                                        .catch(() => null);
                                } catch (e) {
                                    toast((e as Error).message, "error");
                                } finally {
                                    setBackupTriggerLoading(false);
                                }
                            }}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 18px",
                                borderRadius: 8,
                                border: "none",
                                background: "var(--color-accent)",
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            {backupTriggerLoading ? (
                                <Loader2
                                    size={13}
                                    style={{
                                        animation: "spin 1s linear infinite",
                                    }}
                                />
                            ) : (
                                <RefreshCw size={13} />
                            )}
                            {t("settings.backup.triggerNow")}
                        </button>
                    </div>
                )}

                {/* 备份历史 */}
                {backupRuns.length > 0 && (
                    <div>
                        <p
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--color-text-muted)",
                                marginBottom: 8,
                            }}
                        >
                            {t("settings.backup.history")}
                        </p>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 5,
                            }}
                        >
                            {backupRuns.map((run) => (
                                <div
                                    key={run.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        borderRadius: 8,
                                        background: "var(--color-surface-2)",
                                        border: `1px solid ${run.status === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                                    }}
                                >
                                    {run.status === "success" ? (
                                        <Check
                                            size={12}
                                            style={{
                                                color: "#10b981",
                                                flexShrink: 0,
                                            }}
                                        />
                                    ) : (
                                        <X
                                            size={12}
                                            style={{
                                                color: "#ef4444",
                                                flexShrink: 0,
                                            }}
                                        />
                                    )}
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "var(--color-text-muted)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {run.provider.toUpperCase()}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "var(--color-text)",
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {run.filename ?? run.error ?? "—"}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: "var(--color-text-muted)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {new Date(run.startedAt).toLocaleString()}
                                    </span>
                                    {run.sizeBytes && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: "var(--color-text-muted)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {(run.sizeBytes / 1024 / 1024).toFixed(1)} MB
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {backupRunsLoading && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            padding: "8px 0",
                        }}
                    >
                        <Loader2
                            size={16}
                            style={{
                                animation: "spin 1s linear infinite",
                                color: "var(--color-text-muted)",
                            }}
                        />
                    </div>
                )}

                {/* 云端备份文件 + 恢复（N6 批次 3b）。按需加载，避免每次进页签都打全部 provider */}
                <div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--color-text-muted)",
                            }}
                        >
                            {t("settings.backup.filesTitle")}
                        </p>
                        <button
                            type="button"
                            disabled={cloudFilesLoading}
                            onClick={loadCloudFiles}
                            style={{
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 7,
                                border: "1px solid var(--color-border)",
                                background: "var(--color-surface-2)",
                                color: "var(--color-text-secondary)",
                                cursor: cloudFilesLoading ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                            }}
                        >
                            {cloudFilesLoading ? (
                                <Loader2
                                    size={11}
                                    style={{ animation: "spin 1s linear infinite" }}
                                />
                            ) : (
                                <RefreshCw size={11} />
                            )}
                            {t("settings.backup.filesLoad")}
                        </button>
                    </div>
                    {cloudFilesLoaded && cloudFiles.length === 0 && !cloudFilesLoading && (
                        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                            {t("settings.backup.filesEmpty")}
                        </p>
                    )}
                    {cloudFiles.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {cloudFiles.map((f) => (
                                <div
                                    key={`${f.provider}:${f.fileId}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        borderRadius: 8,
                                        background: "var(--color-surface-2)",
                                        border: "1px solid var(--color-border-subtle)",
                                    }}
                                >
                                    <Database
                                        size={12}
                                        style={{
                                            color: "var(--color-text-muted)",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "var(--color-text-muted)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {f.provider.toUpperCase()}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: "var(--color-text)",
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                        title={f.name}
                                    >
                                        {f.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: "var(--color-text-muted)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {(f.sizeBytes / 1024 / 1024).toFixed(1)} MB ·{" "}
                                        {new Date(f.createdAt).toLocaleString()}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={restoring}
                                        onClick={() => setRestoreTarget(f)}
                                        style={{
                                            fontSize: 10,
                                            padding: "3px 8px",
                                            borderRadius: 6,
                                            border: "1px solid rgba(248,113,113,0.5)",
                                            background: "rgba(248,113,113,0.12)",
                                            color: "#f87171",
                                            cursor: restoring ? "not-allowed" : "pointer",
                                            flexShrink: 0,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {t("settings.backup.restore")}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={restoreTarget !== null}
                title={t("settings.backup.restoreConfirmTitle")}
                description={t("settings.backup.restoreConfirmDesc", {
                    name: restoreTarget?.name ?? "",
                })}
                confirmText={t("settings.backup.restore")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={restoring}
                onConfirm={handleRestoreConfirm}
                onCancel={() => setRestoreTarget(null)}
            />

            {restoreDone && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
                        backdropFilter: "blur(4px)",
                    }}
                >
                    <Check size={32} style={{ color: "#10b981" }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                        {t("settings.backup.restoreDone")}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                        {t("settings.backup.restoreDoneHint")}
                    </p>
                </div>
            )}
        </div>
    );
}
