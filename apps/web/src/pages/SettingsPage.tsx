import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    Save,
    Download,
    Bell,
    Server,
    HardDrive,
    Cloud,
    Loader2,
    Check,
    X,
    Trash2,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    Database,
    Activity,
} from "lucide-react";
import type { JellyfinLibrary } from "@trakt-dashboard/types";
import {
    useSettings,
    useUpdateSettings,
    useSyncStatus,
    useTriggerSync,
    useTriggerFullSync,
    useSystemMetrics,
    useJellyfinDeleteQueue,
    useDeferJellyfinDelete,
    useNeverJellyfinDelete,
    useDeleteNowJellyfinDelete,
    useJellyfinDeleteExclusions,
    useRemoveJellyfinExclusion,
    useJellyfinDeleteHistory,
} from "../hooks";
import { api } from "../lib/api";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
    isPushSupported,
    getExistingSubscription,
    enablePush,
    disablePush,
    fetchVapidPublicKey,
} from "../lib/push";
import { loadTheme, applyTheme, persistTheme, Theme } from "../lib/theme";
import { t, setLocale } from "../lib/i18n";
import { useToast } from "../lib/toast";

const exportButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 16px",
    borderRadius: "var(--radius-md)",
    background: "var(--color-surface-3)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
    transition: "border-color 0.15s",
};

// Move styles outside component to avoid recreation on every render
const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    background: "var(--color-surface-3)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--color-text-secondary)",
    marginBottom: "6px",
    display: "block",
};

export default function SettingsPage() {
    const { data: settings, isLoading } = useSettings();
    const { mutateAsync: updateSettings, isPending: saving } = useUpdateSettings();

    const [displayLanguage, setDisplayLanguage] = useState("zh-CN");
    const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60);
    const [httpProxy, setHttpProxy] = useState("");
    const [jellyfinUrl, setJellyfinUrl] = useState("");
    const [jellyfinApiKey, setJellyfinApiKey] = useState("");
    const [jellyfinAutoDeleteIds, setJellyfinAutoDeleteIds] = useState<string[]>([]);
    const [jellyfinAutoDeleteEnabled, setJellyfinAutoDeleteEnabled] = useState(false);
    const [notifEventTypes, setNotifEventTypes] = useState<string[]>([
        "series_premiere",
        "season_premiere",
        "finale",
        "regular",
    ]);
    const [jellyfinLibraries, setJellyfinLibraries] = useState<JellyfinLibrary[]>([]);
    const [jellyfinLibrariesLoading, setJellyfinLibrariesLoading] = useState(false);
    const { toast } = useToast();
    const [theme, setTheme] = useState<Theme>(loadTheme);

    // ── 备份状态 ──────────────────────────────────────────────────────────────
    type DeviceAuthState = {
        user_code: string;
        verification_url: string;
        device_code: string;
        interval: number;
        expires_in: number;
    } | null;
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [gdriveLoading, setGdriveLoading] = useState(false);
    const [gdriveDeviceAuth, setGdriveDeviceAuth] = useState<DeviceAuthState>(null);
    const [gdrivePollTimer, setGdrivePollTimer] = useState<ReturnType<typeof setInterval> | null>(
        null,
    );
    const gdrivePollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [onedriveConnected, setOnedriveConnected] = useState(false);
    const [onedriveLoading, setOnedriveLoading] = useState(false);
    const [onedriveDeviceAuth, setOnedriveDeviceAuth] = useState<DeviceAuthState>(null);
    const [onedrivePollTimer, setOnedrivePollTimer] = useState<ReturnType<
        typeof setInterval
    > | null>(null);
    const onedrivePollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [webdavUrl, setWebdavUrl] = useState("");
    const [webdavUsername, setWebdavUsername] = useState("");
    const [webdavPassword, setWebdavPassword] = useState("");
    const [webdavConnected, setWebdavConnected] = useState(false);
    const [webdavSaving, setWebdavSaving] = useState(false);

    const [s3Endpoint, setS3Endpoint] = useState("");
    const [s3Region, setS3Region] = useState("");
    const [s3Bucket, setS3Bucket] = useState("");
    const [s3AccessKeyId, setS3AccessKeyId] = useState("");
    const [s3SecretAccessKey, setS3SecretAccessKey] = useState("");
    const [s3Connected, setS3Connected] = useState(false);
    const [s3Saving, setS3Saving] = useState(false);

    const [backupScheduleHours, setBackupScheduleHours] = useState(0);
    const [backupTriggerLoading, setBackupTriggerLoading] = useState(false);
    const [backupRuns, setBackupRuns] = useState<
        Array<{
            id: number;
            provider: string;
            status: string;
            filename: string | null;
            sizeBytes: number | null;
            error: string | null;
            startedAt: string;
        }>
    >([]);
    const [backupRunsLoading, setBackupRunsLoading] = useState(false);
    // Track whether the form has been seeded. Prevents window-focus refetches from
    // clobbering unsaved edits. Reset to false after a successful save so fresh
    // server values propagate.
    const hasSeededRef = useRef(false);

    // Seed form from fetched settings on first load only.
    useEffect(() => {
        if (!settings || hasSeededRef.current) return;
        setDisplayLanguage(settings.displayLanguage);
        setSyncIntervalMinutes(settings.syncIntervalMinutes);
        setHttpProxy(settings.httpProxy ?? "");
        setJellyfinUrl(settings.jellyfinUrl ?? "");
        setJellyfinApiKey(settings.jellyfinApiKey ?? "");
        setJellyfinAutoDeleteIds(settings.jellyfinAutoDeleteLibraryIds ?? []);
        setJellyfinAutoDeleteEnabled(settings.jellyfinAutoDeleteEnabled ?? false);
        setNotifEventTypes(
            settings.notificationEventTypes.length > 0
                ? settings.notificationEventTypes
                : ["series_premiere", "season_premiere", "finale", "regular"],
        );
        hasSeededRef.current = true;
    }, [settings]);

    useEffect(() => {
        gdrivePollTimerRef.current = gdrivePollTimer;
    }, [gdrivePollTimer]);
    useEffect(() => {
        onedrivePollTimerRef.current = onedrivePollTimer;
    }, [onedrivePollTimer]);
    useEffect(() => {
        return () => {
            if (gdrivePollTimerRef.current) clearInterval(gdrivePollTimerRef.current);
            if (onedrivePollTimerRef.current) clearInterval(onedrivePollTimerRef.current);
        };
    }, []);

    // 初始化备份状态
    useEffect(() => {
        api.backup
            .gdriveStatus()
            .then((r) => setGdriveConnected(r.connected))
            .catch(() => null);
        api.backup
            .onedriveStatus()
            .then((r) => setOnedriveConnected(r.connected))
            .catch(() => null);
        api.backup
            .webdavStatus()
            .then((r) => {
                setWebdavConnected(r.connected);
                if (r.url) setWebdavUrl(r.url);
            })
            .catch(() => null);
        api.backup
            .s3Status()
            .then((r) => {
                setS3Connected(r.connected);
                if (r.endpoint) setS3Endpoint(r.endpoint);
                if (r.bucket) setS3Bucket(r.bucket);
            })
            .catch(() => null);
        api.backup
            .getSettings()
            .then((r) => {
                setBackupScheduleHours(r.scheduleHours);
            })
            .catch(() => null);
        setBackupRunsLoading(true);
        api.backup
            .runs(10)
            .then((r) => setBackupRuns(r.data))
            .catch(() => null)
            .finally(() => setBackupRunsLoading(false));
    }, []);

    // Apply the saved display language to the UI locale (a real side effect).
    const settingsLanguage = settings?.displayLanguage;
    useEffect(() => {
        if (settingsLanguage) setLocale(settingsLanguage);
    }, [settingsLanguage]);

    // Web Push (N2-T05). Browser capability check is synchronous; server-side
    // VAPID config is probed asynchronously so we never show the permission
    // dialog when the server isn't set up.
    const pushBrowserSupported = isPushSupported();
    // Store the key itself so we can pass it to enablePush without a second fetch.
    const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushBusy, setPushBusy] = useState(false);

    const pushSupported = pushBrowserSupported && vapidPublicKey !== null;

    // useCallback with [] is correct: getExistingSubscription is a stable module
    // import and setPushEnabled is a stable React state setter, so this function
    // never needs to re-bind. Wrapping it satisfies react-hooks/exhaustive-deps.
    const syncPushState = useCallback(() => {
        getExistingSubscription()
            .then((sub) => setPushEnabled(!!sub))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!pushBrowserSupported) return;
        // Run independently so one failure doesn't prevent the other from updating state.
        fetchVapidPublicKey()
            .then((key) => setVapidPublicKey(key))
            .catch(() => {});
        syncPushState();
    }, [pushBrowserSupported, syncPushState]);

    async function togglePush() {
        setPushBusy(true);
        try {
            if (pushEnabled) {
                await disablePush();
                setPushEnabled(false);
                toast(t("settings.pushDisabled"), "success");
            } else {
                // Pass the pre-fetched key to avoid a redundant network request.
                await enablePush(vapidPublicKey ?? undefined);
                setPushEnabled(true);
                toast(t("settings.pushEnabled"), "success");
            }
        } catch (err) {
            if (!pushEnabled) {
                // Was trying to enable but failed. The browser may have created a
                // subscription before the backend call threw, so syncPushState()
                // would incorrectly show "enabled". Force false to match backend
                // state; the stale browser subscription is cleaned up on the next
                // enablePush via VAPID key comparison.
                setPushEnabled(false);
            } else {
                // Was trying to disable — unsubscribe may have partially succeeded;
                // re-read the browser to show accurate state.
                syncPushState();
            }
            if (err instanceof Error && err.message === "permission-denied") {
                toast(t("settings.pushPermissionDenied"), "error");
            } else if (err instanceof Error && err.message === "push-rotation-blocked") {
                toast(t("settings.pushRotationBlocked"), "error");
            } else {
                toast(t("settings.pushFailed"), "error");
            }
        } finally {
            setPushBusy(false);
        }
    }

    async function loadJellyfinLibraries() {
        const url = jellyfinUrl.trim();
        const key = jellyfinApiKey.trim();
        if (!url || !key) {
            toast(t("settings.jellyfinNotConfigured"), "error");
            return;
        }
        setJellyfinLibrariesLoading(true);
        try {
            // "***" means the key is unchanged (server-masked). Use stored credentials.
            // Otherwise use the typed credentials so the user can test before saving.
            const res =
                key === "***"
                    ? await api.jellyfin.libraries()
                    : await api.jellyfin.testLibraries(url, key);
            setJellyfinLibraries(res.data);
        } catch {
            toast(t("settings.jellyfinLoadLibrariesFailed"), "error");
        } finally {
            setJellyfinLibrariesLoading(false);
        }
    }

    function toggleJellyfinLibrary(id: string) {
        setJellyfinAutoDeleteIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    async function handleSave(e?: React.FormEvent) {
        if (e) e.preventDefault();

        // Frontend validation
        const interval = Number(syncIntervalMinutes);
        if (!Number.isInteger(interval) || interval < 1 || interval > 10080) {
            toast(t("settings.validationIntervalError"), "error");
            return;
        }

        // Validate displayLanguage (BCP 47 format: xx or xx-YY)
        const langTrimmed = displayLanguage.trim();
        if (langTrimmed && !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(langTrimmed)) {
            toast(t("settings.validationLanguageError"), "error");
            return;
        }

        // Validate httpProxy (must be http:// or https:// if specified)
        const proxyValue = httpProxy.trim();
        if (proxyValue && !/^https?:\/\/.+/i.test(proxyValue)) {
            toast(t("settings.validationProxyError"), "error");
            return;
        }

        try {
            await updateSettings({
                displayLanguage: langTrimmed,
                syncIntervalMinutes: interval,
                httpProxy: proxyValue || null,
                jellyfinUrl: jellyfinUrl.trim() || null,
                jellyfinApiKey: jellyfinApiKey.trim() || null,
                jellyfinAutoDeleteLibraryIds: jellyfinAutoDeleteIds,
                jellyfinAutoDeleteEnabled,
                notificationEventTypes: notifEventTypes,
            });
            hasSeededRef.current = false;
            setLocale(langTrimmed);
            toast(t("settings.saveSuccess"), "success");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("settings.saveFailed");
            toast(message, "error", {
                label: t("common.retry"),
                onClick: () => handleSave(),
            });
        }
    }

    // ── Sync state (right panel) ─────────────────────────────────────────────
    const { data: sync } = useSyncStatus();
    const { mutate: triggerSync, isPending: syncing } = useTriggerSync();
    const { mutate: triggerFull, isPending: fullSyncing } = useTriggerFullSync();
    const [syncError, setSyncError] = useState<string | null>(null);
    const { data: sysMetrics } = useSystemMetrics();

    // ── Jellyfin 自动删除队列 / 历史 ──────────────────────────────────────────
    const { data: deleteQueue, isLoading: deleteQueueLoading } = useJellyfinDeleteQueue();
    const { data: deleteHistory, isLoading: deleteHistoryLoading } = useJellyfinDeleteHistory(20);
    const { mutate: deferDelete, isPending: isDeferring } = useDeferJellyfinDelete();
    const { mutate: neverDelete, isPending: isNevering } = useNeverJellyfinDelete();
    const { mutate: deleteNow, isPending: isDeletingNow } = useDeleteNowJellyfinDelete();
    const { data: deleteExclusions, isLoading: exclusionsLoading } = useJellyfinDeleteExclusions();
    const { mutate: removeExclusion, isPending: isRemovingExclusion } =
        useRemoveJellyfinExclusion();
    const isQueueActionPending = isDeferring || isNevering || isDeletingNow;
    const [deleteNowTarget, setDeleteNowTarget] = useState<{ id: number; title: string } | null>(
        null,
    );

    function handleDeferDelete(id: number) {
        deferDelete(id, {
            onSuccess: () => toast(t("settings.jellyfinDeleteDeferSuccess"), "success"),
            onError: () => toast(t("settings.jellyfinDeleteQueueCancelFailed"), "error"),
        });
    }

    function handleNeverDelete(id: number) {
        neverDelete(id, {
            onSuccess: () => toast(t("settings.jellyfinDeleteNeverSuccess"), "success"),
            onError: () => toast(t("settings.jellyfinDeleteQueueCancelFailed"), "error"),
        });
    }

    function handleDeleteNowConfirm() {
        if (!deleteNowTarget) return;
        const { id } = deleteNowTarget;
        deleteNow(id, {
            onSuccess: (res) => {
                setDeleteNowTarget(null);
                if (res.status === "deleted") {
                    toast(t("settings.jellyfinDeleteNowSuccess"), "success");
                } else {
                    toast(t("settings.jellyfinDeleteNowFailed"), "error");
                }
            },
            onError: () => {
                setDeleteNowTarget(null);
                toast(t("settings.jellyfinDeleteNowFailed"), "error");
            },
        });
    }

    function handleRemoveExclusion(id: number) {
        removeExclusion(id, {
            onSuccess: () => toast(t("settings.jellyfinExclusionRemoved"), "success"),
            onError: () => toast(t("settings.jellyfinDeleteQueueCancelFailed"), "error"),
        });
    }

    const isRunning = sync?.status === "running";
    const anyPending = syncing || fullSyncing;

    function fmtBytes(n: number) {
        if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
        if (n >= 1048576) return `${(n / 1048576).toFixed(0)} MB`;
        return `${(n / 1024).toFixed(0)} KB`;
    }
    function fmtUptime(s: number) {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}天 ${h}时`;
        if (h > 0) return `${h}时 ${m}分`;
        return `${m}分`;
    }

    return (
        <div className="min-h-[calc(100svh-var(--app-nav-height))] bg-[var(--color-bg)]">
            <div className="app-container py-8">
                {/* Compact header */}
                <div className="mb-6 flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-[var(--action-violet-border)] bg-[var(--action-violet-surface)] text-[var(--action-violet-text)]">
                        <Server className="size-[15px]" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-semibold leading-tight">
                            {t("settings.title")}
                        </h1>
                        <span className="text-xs text-[var(--color-text-muted)]">
                            {t("settings.subtitle")}
                        </span>
                    </div>
                </div>

                {/* Two-column layout: form left, sync+metrics right */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 380px",
                        gap: "28px",
                        alignItems: "start",
                        maxWidth: "1160px",
                    }}
                >
                    <div>
                        {/* ── LEFT: Settings form ── */}

                        {isLoading ? (
                            <p
                                style={{
                                    color: "var(--color-text-muted)",
                                    fontSize: "14px",
                                }}
                            >
                                {t("common.loading")}
                            </p>
                        ) : (
                            <motion.form
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                onSubmit={handleSave}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "24px",
                                }}
                            >
                                {/* Fields card */}
                                <div
                                    style={{
                                        borderRadius: "var(--radius-lg)",
                                        padding: "24px",
                                        background: "var(--color-surface)",
                                        border: "1px solid var(--color-border-subtle)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "24px",
                                    }}
                                >
                                    {/* Theme */}
                                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                                        <legend style={labelStyle}>{t("settings.theme")}</legend>
                                        <div style={{ display: "flex", gap: "12px" }}>
                                            {(["dark", "light"] as Theme[]).map((themeOption) => (
                                                <label
                                                    key={themeOption}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                        cursor: "pointer",
                                                        fontSize: "14px",
                                                        color: "var(--color-text)",
                                                    }}
                                                >
                                                    <input
                                                        id={`settings-theme-${themeOption}`}
                                                        type="radio"
                                                        name="theme"
                                                        value={themeOption}
                                                        autoComplete="off"
                                                        checked={theme === themeOption}
                                                        onChange={() => {
                                                            setTheme(themeOption);
                                                            applyTheme(themeOption);
                                                            persistTheme(themeOption);
                                                        }}
                                                        style={{
                                                            accentColor: "var(--color-accent)",
                                                        }}
                                                    />
                                                    {t(
                                                        `settings.theme${themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}`,
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>

                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Display Language */}
                                    <div>
                                        <label
                                            htmlFor="settings-display-language"
                                            style={labelStyle}
                                        >
                                            {t("settings.displayLanguage")}
                                        </label>
                                        <input
                                            id="settings-display-language"
                                            name="displayLanguage"
                                            type="text"
                                            autoComplete="language"
                                            spellCheck={false}
                                            value={displayLanguage}
                                            onChange={(e) => setDisplayLanguage(e.target.value)}
                                            placeholder={t("settings.displayLanguagePlaceholder")}
                                            style={inputStyle}
                                        />
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginTop: "6px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {t("settings.displayLanguageHint")}
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Sync Interval */}
                                    <div>
                                        <label htmlFor="settings-sync-interval" style={labelStyle}>
                                            {t("settings.syncInterval")}
                                        </label>
                                        <input
                                            id="settings-sync-interval"
                                            name="syncIntervalMinutes"
                                            type="number"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            min={1}
                                            max={10080}
                                            value={syncIntervalMinutes}
                                            onChange={(e) =>
                                                setSyncIntervalMinutes(Number(e.target.value))
                                            }
                                            style={inputStyle}
                                        />
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginTop: "6px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {t("settings.syncIntervalHint")}
                                        </p>
                                    </div>

                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* HTTP Proxy */}
                                    <div>
                                        <label htmlFor="settings-http-proxy" style={labelStyle}>
                                            {t("settings.httpProxy")}
                                        </label>
                                        <input
                                            id="settings-http-proxy"
                                            name="httpProxy"
                                            type="url"
                                            inputMode="url"
                                            autoComplete="off"
                                            spellCheck={false}
                                            value={httpProxy}
                                            onChange={(e) => setHttpProxy(e.target.value)}
                                            placeholder={t("settings.httpProxyPlaceholder")}
                                            style={inputStyle}
                                        />
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginTop: "6px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {t("settings.httpProxyHint")}
                                        </p>
                                    </div>

                                    {/* Divider */}
                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Airing reminders (Web Push) */}
                                    <div>
                                        <span style={labelStyle}>
                                            {t("settings.notifications")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={togglePush}
                                            disabled={!pushSupported || pushBusy}
                                            style={{
                                                ...exportButtonStyle,
                                                opacity: !pushSupported || pushBusy ? 0.5 : 1,
                                                cursor:
                                                    !pushSupported || pushBusy
                                                        ? "not-allowed"
                                                        : "pointer",
                                            }}
                                        >
                                            <Bell size={14} />
                                            {pushEnabled
                                                ? t("settings.pushDisable")
                                                : t("settings.pushEnable")}
                                        </button>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginTop: "6px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {pushSupported
                                                ? t("settings.notificationsHint")
                                                : t("settings.pushUnsupported")}
                                        </p>

                                        {/* Notification event type checkboxes (F02) */}
                                        {pushSupported && (
                                            <div style={{ marginTop: "14px" }}>
                                                <span
                                                    style={{
                                                        ...labelStyle,
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    {t("settings.notifEventTypesTitle")}
                                                </span>
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "var(--color-text-muted)",
                                                        marginBottom: "8px",
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {t("settings.notifEventTypesHint")}
                                                </p>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "6px",
                                                        padding: "10px",
                                                        borderRadius: "var(--radius-md)",
                                                        background: "var(--color-surface-3)",
                                                        border: "1px solid var(--color-border)",
                                                    }}
                                                >
                                                    {(
                                                        [
                                                            [
                                                                "series_premiere",
                                                                t("settings.notifSeriesPremiere"),
                                                            ],
                                                            [
                                                                "season_premiere",
                                                                t("settings.notifSeasonPremiere"),
                                                            ],
                                                            ["finale", t("settings.notifFinale")],
                                                            ["regular", t("settings.notifRegular")],
                                                        ] as [string, string][]
                                                    ).map(([type, label]) => (
                                                        <label
                                                            key={type}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "8px",
                                                                fontSize: "13px",
                                                                color: "var(--color-text)",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={notifEventTypes.includes(
                                                                    type,
                                                                )}
                                                                onChange={() =>
                                                                    setNotifEventTypes((prev) =>
                                                                        prev.includes(type)
                                                                            ? prev.filter(
                                                                                  (t) => t !== type,
                                                                              )
                                                                            : [...prev, type],
                                                                    )
                                                                }
                                                                style={{
                                                                    accentColor:
                                                                        "var(--color-accent)",
                                                                }}
                                                            />
                                                            {label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Divider before Jellyfin */}
                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Jellyfin Integration */}
                                    <div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                marginBottom: "4px",
                                            }}
                                        >
                                            <Server
                                                size={14}
                                                style={{ color: "var(--color-text-secondary)" }}
                                            />
                                            <span
                                                style={{
                                                    ...labelStyle,
                                                    marginBottom: 0,
                                                }}
                                            >
                                                {t("settings.jellyfinTitle")}
                                            </span>
                                        </div>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginBottom: "16px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {t("settings.jellyfinSubtitle")}
                                        </p>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "12px",
                                            }}
                                        >
                                            <div>
                                                <label
                                                    htmlFor="settings-jellyfin-url"
                                                    style={labelStyle}
                                                >
                                                    {t("settings.jellyfinUrl")}
                                                </label>
                                                <input
                                                    id="settings-jellyfin-url"
                                                    type="url"
                                                    value={jellyfinUrl}
                                                    onChange={(e) => setJellyfinUrl(e.target.value)}
                                                    placeholder={t(
                                                        "settings.jellyfinUrlPlaceholder",
                                                    )}
                                                    style={inputStyle}
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    htmlFor="settings-jellyfin-key"
                                                    style={labelStyle}
                                                >
                                                    {t("settings.jellyfinApiKey")}
                                                </label>
                                                <input
                                                    id="settings-jellyfin-key"
                                                    type="password"
                                                    value={jellyfinApiKey}
                                                    onChange={(e) =>
                                                        setJellyfinApiKey(e.target.value)
                                                    }
                                                    placeholder={t(
                                                        "settings.jellyfinApiKeyPlaceholder",
                                                    )}
                                                    style={inputStyle}
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        marginBottom: "8px",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            ...labelStyle,
                                                            marginBottom: 0,
                                                        }}
                                                    >
                                                        {t("settings.jellyfinAutoDeleteLibraries")}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={loadJellyfinLibraries}
                                                        disabled={jellyfinLibrariesLoading}
                                                        style={{
                                                            fontSize: "12px",
                                                            padding: "4px 10px",
                                                            borderRadius: "var(--radius-sm)",
                                                            background: "var(--color-surface-3)",
                                                            border: "1px solid var(--color-border)",
                                                            color: "var(--color-text-secondary)",
                                                            cursor: jellyfinLibrariesLoading
                                                                ? "not-allowed"
                                                                : "pointer",
                                                        }}
                                                    >
                                                        {jellyfinLibrariesLoading
                                                            ? t("common.loading")
                                                            : t("settings.jellyfinLoadLibraries")}
                                                    </button>
                                                </div>
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "var(--color-text-muted)",
                                                        marginBottom: "8px",
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {t("settings.jellyfinAutoDeleteLibrariesHint")}
                                                </p>
                                                {jellyfinLibraries.length > 0 && (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "6px",
                                                            padding: "10px",
                                                            borderRadius: "var(--radius-md)",
                                                            background: "var(--color-surface-3)",
                                                            border: "1px solid var(--color-border)",
                                                        }}
                                                    >
                                                        {jellyfinLibraries.map((lib) => (
                                                            <label
                                                                key={lib.id}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "8px",
                                                                    fontSize: "13px",
                                                                    color: "var(--color-text)",
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={jellyfinAutoDeleteIds.includes(
                                                                        lib.id,
                                                                    )}
                                                                    onChange={() =>
                                                                        toggleJellyfinLibrary(
                                                                            lib.id,
                                                                        )
                                                                    }
                                                                />
                                                                <span>{lib.name}</span>
                                                                {lib.collectionType && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: "11px",
                                                                            color: "var(--color-text-muted)",
                                                                        }}
                                                                    >
                                                                        ({lib.collectionType})
                                                                    </span>
                                                                )}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 自动删除总开关 */}
                                            <div>
                                                <label
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        fontSize: "13px",
                                                        color: "var(--color-text)",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={jellyfinAutoDeleteEnabled}
                                                        onChange={(e) =>
                                                            setJellyfinAutoDeleteEnabled(
                                                                e.target.checked,
                                                            )
                                                        }
                                                        style={{
                                                            accentColor: "var(--color-accent)",
                                                        }}
                                                    />
                                                    {t("settings.jellyfinAutoDeleteEnabled")}
                                                </label>
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        color: jellyfinAutoDeleteEnabled
                                                            ? "var(--color-text-muted)"
                                                            : "#f59e0b",
                                                        marginTop: "6px",
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {jellyfinAutoDeleteEnabled
                                                        ? t(
                                                              "settings.jellyfinAutoDeleteEnabledHint",
                                                          )
                                                        : t(
                                                              "settings.jellyfinAutoDeleteDisabledHint",
                                                          )}
                                                </p>
                                            </div>

                                            {/* 待删除队列 */}
                                            <div>
                                                <span
                                                    style={{
                                                        ...labelStyle,
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    {t("settings.jellyfinDeleteQueueTitle")}
                                                </span>
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "var(--color-text-muted)",
                                                        marginBottom: "8px",
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {t("settings.jellyfinDeleteQueueHint")}
                                                </p>
                                                {deleteQueueLoading ? (
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
                                                                animation:
                                                                    "spin 1s linear infinite",
                                                                color: "var(--color-text-muted)",
                                                            }}
                                                        />
                                                    </div>
                                                ) : (deleteQueue?.length ?? 0) === 0 ? (
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            color: "var(--color-text-muted)",
                                                        }}
                                                    >
                                                        {t("settings.jellyfinDeleteQueueEmpty")}
                                                    </p>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "5px",
                                                        }}
                                                    >
                                                        {deleteQueue!.map((entry) => {
                                                            const title =
                                                                entry.show?.title ??
                                                                entry.movie?.title ??
                                                                "—";
                                                            const scope = entry.show
                                                                ? entry.seasonNumber === null
                                                                    ? t(
                                                                          "settings.jellyfinDeleteQueueWholeShow",
                                                                      )
                                                                    : t(
                                                                          "settings.jellyfinDeleteQueueSeason",
                                                                          {
                                                                              season: entry.seasonNumber,
                                                                          },
                                                                      )
                                                                : null;
                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "8px",
                                                                        padding: "7px 10px",
                                                                        borderRadius: 8,
                                                                        background:
                                                                            "var(--color-surface-2)",
                                                                        border: "1px solid rgba(248,113,113,0.2)",
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            fontSize: "11px",
                                                                            color: "var(--color-text)",
                                                                            flex: 1,
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {title}
                                                                        {scope ? ` · ${scope}` : ""}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            color: "var(--color-text-muted)",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        {new Date(
                                                                            entry.queuedAt,
                                                                        ).toLocaleDateString()}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isQueueActionPending
                                                                        }
                                                                        onClick={() =>
                                                                            handleDeferDelete(
                                                                                entry.id,
                                                                            )
                                                                        }
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            padding: "3px 8px",
                                                                            borderRadius: 6,
                                                                            border: "1px solid var(--color-border)",
                                                                            background:
                                                                                "var(--color-surface-3)",
                                                                            color: "var(--color-text-secondary)",
                                                                            cursor: isQueueActionPending
                                                                                ? "not-allowed"
                                                                                : "pointer",
                                                                            flexShrink: 0,
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            "settings.jellyfinDeleteDefer",
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isQueueActionPending
                                                                        }
                                                                        onClick={() =>
                                                                            handleNeverDelete(
                                                                                entry.id,
                                                                            )
                                                                        }
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            padding: "3px 8px",
                                                                            borderRadius: 6,
                                                                            border: "1px solid rgba(248,113,113,0.35)",
                                                                            background:
                                                                                "rgba(248,113,113,0.08)",
                                                                            color: "#f87171",
                                                                            cursor: isQueueActionPending
                                                                                ? "not-allowed"
                                                                                : "pointer",
                                                                            flexShrink: 0,
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            "settings.jellyfinDeleteNever",
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isQueueActionPending
                                                                        }
                                                                        onClick={() =>
                                                                            setDeleteNowTarget({
                                                                                id: entry.id,
                                                                                title:
                                                                                    title +
                                                                                    (scope
                                                                                        ? ` · ${scope}`
                                                                                        : ""),
                                                                            })
                                                                        }
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            padding: "3px 8px",
                                                                            borderRadius: 6,
                                                                            border: "1px solid rgba(248,113,113,0.5)",
                                                                            background:
                                                                                "rgba(248,113,113,0.16)",
                                                                            color: "#f87171",
                                                                            cursor: isQueueActionPending
                                                                                ? "not-allowed"
                                                                                : "pointer",
                                                                            flexShrink: 0,
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {t(
                                                                            "settings.jellyfinDeleteNow",
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 排除列表（永不删除 / 推迟中） */}
                                            <div>
                                                <span
                                                    style={{
                                                        ...labelStyle,
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    {t("settings.jellyfinExclusionsTitle")}
                                                </span>
                                                <p
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "var(--color-text-muted)",
                                                        marginBottom: "8px",
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {t("settings.jellyfinExclusionsHint")}
                                                </p>
                                                {exclusionsLoading ? (
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
                                                                animation:
                                                                    "spin 1s linear infinite",
                                                                color: "var(--color-text-muted)",
                                                            }}
                                                        />
                                                    </div>
                                                ) : (deleteExclusions?.length ?? 0) === 0 ? (
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            color: "var(--color-text-muted)",
                                                        }}
                                                    >
                                                        {t("settings.jellyfinExclusionsEmpty")}
                                                    </p>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "5px",
                                                        }}
                                                    >
                                                        {deleteExclusions!.map((ex) => {
                                                            const scope =
                                                                ex.seasonNumber !== null
                                                                    ? t(
                                                                          "settings.jellyfinDeleteQueueSeason",
                                                                          {
                                                                              season: ex.seasonNumber,
                                                                          },
                                                                      )
                                                                    : ex.showId
                                                                      ? t(
                                                                            "settings.jellyfinDeleteQueueWholeShow",
                                                                        )
                                                                      : null;
                                                            const modeLabel =
                                                                ex.mode === "never"
                                                                    ? t(
                                                                          "settings.jellyfinExclusionNever",
                                                                      )
                                                                    : t(
                                                                          "settings.jellyfinExclusionDeferUntil",
                                                                          {
                                                                              date: ex.deferUntil
                                                                                  ? new Date(
                                                                                        ex.deferUntil,
                                                                                    ).toLocaleDateString()
                                                                                  : "—",
                                                                          },
                                                                      );
                                                            return (
                                                                <div
                                                                    key={ex.id}
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "8px",
                                                                        padding: "7px 10px",
                                                                        borderRadius: 8,
                                                                        background:
                                                                            "var(--color-surface-2)",
                                                                        border: `1px solid ${ex.mode === "never" ? "rgba(248,113,113,0.25)" : "rgba(245,158,11,0.25)"}`,
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            fontSize: "11px",
                                                                            color: "var(--color-text)",
                                                                            flex: 1,
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {ex.title}
                                                                        {scope ? ` · ${scope}` : ""}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            color:
                                                                                ex.mode === "never"
                                                                                    ? "#f87171"
                                                                                    : "#f59e0b",
                                                                            fontWeight: 600,
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        {modeLabel}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isRemovingExclusion
                                                                        }
                                                                        onClick={() =>
                                                                            handleRemoveExclusion(
                                                                                ex.id,
                                                                            )
                                                                        }
                                                                        title={t(
                                                                            "settings.jellyfinExclusionRemove",
                                                                        )}
                                                                        style={{
                                                                            display: "inline-flex",
                                                                            alignItems: "center",
                                                                            justifyContent:
                                                                                "center",
                                                                            width: 20,
                                                                            height: 20,
                                                                            borderRadius: "50%",
                                                                            border: "none",
                                                                            background:
                                                                                "var(--color-surface-3)",
                                                                            color: "var(--color-text-secondary)",
                                                                            cursor: isRemovingExclusion
                                                                                ? "not-allowed"
                                                                                : "pointer",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 删除历史 */}
                                            <div>
                                                <span
                                                    style={{
                                                        ...labelStyle,
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    {t("settings.jellyfinDeleteHistoryTitle")}
                                                </span>
                                                {deleteHistoryLoading ? (
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
                                                                animation:
                                                                    "spin 1s linear infinite",
                                                                color: "var(--color-text-muted)",
                                                            }}
                                                        />
                                                    </div>
                                                ) : (deleteHistory?.length ?? 0) === 0 ? (
                                                    <p
                                                        style={{
                                                            fontSize: "12px",
                                                            color: "var(--color-text-muted)",
                                                        }}
                                                    >
                                                        {t("settings.jellyfinDeleteHistoryEmpty")}
                                                    </p>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "5px",
                                                        }}
                                                    >
                                                        {deleteHistory!.map((entry) => {
                                                            const statusColor =
                                                                entry.status === "deleted"
                                                                    ? "#10b981"
                                                                    : entry.status === "failed"
                                                                      ? "#ef4444"
                                                                      : "#f59e0b";
                                                            const statusLabel =
                                                                entry.status === "deleted"
                                                                    ? t(
                                                                          "settings.jellyfinDeleteStatusDeleted",
                                                                      )
                                                                    : entry.status === "failed"
                                                                      ? t(
                                                                            "settings.jellyfinDeleteStatusFailed",
                                                                        )
                                                                      : t(
                                                                            "settings.jellyfinDeleteStatusNotFound",
                                                                        );
                                                            const scope =
                                                                entry.seasonNumber !== null
                                                                    ? t(
                                                                          "settings.jellyfinDeleteQueueSeason",
                                                                          {
                                                                              season: entry.seasonNumber,
                                                                          },
                                                                      )
                                                                    : entry.showId
                                                                      ? t(
                                                                            "settings.jellyfinDeleteQueueWholeShow",
                                                                        )
                                                                      : null;
                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "8px",
                                                                        padding: "7px 10px",
                                                                        borderRadius: 8,
                                                                        background:
                                                                            "var(--color-surface-2)",
                                                                        border: `1px solid ${statusColor}33`,
                                                                    }}
                                                                >
                                                                    {entry.status === "deleted" ? (
                                                                        <Check
                                                                            size={12}
                                                                            style={{
                                                                                color: statusColor,
                                                                                flexShrink: 0,
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <X
                                                                            size={12}
                                                                            style={{
                                                                                color: statusColor,
                                                                                flexShrink: 0,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span
                                                                        style={{
                                                                            fontSize: "11px",
                                                                            color: "var(--color-text)",
                                                                            flex: 1,
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        {entry.title}
                                                                        {scope ? ` · ${scope}` : ""}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            color: statusColor,
                                                                            flexShrink: 0,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {statusLabel}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: "10px",
                                                                            color: "var(--color-text-muted)",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        {new Date(
                                                                            entry.processedAt,
                                                                        ).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Divider before data export */}
                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* Data export */}
                                    <div>
                                        <span style={labelStyle}>{t("settings.dataExport")}</span>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "10px",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <a
                                                href={api.history.export("all", "csv")}
                                                download="watch-history.csv"
                                                style={exportButtonStyle}
                                            >
                                                <Download size={14} />
                                                {t("settings.exportHistoryCsv")}
                                            </a>
                                            <a
                                                href={api.history.export("all", "json")}
                                                download="watch-history.json"
                                                style={exportButtonStyle}
                                            >
                                                <Download size={14} />
                                                {t("settings.exportHistoryJson")}
                                            </a>
                                        </div>
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--color-text-muted)",
                                                marginTop: "6px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {t("settings.dataExportHint")}
                                        </p>
                                    </div>

                                    {/* Divider before backup */}
                                    <div
                                        style={{
                                            height: "1px",
                                            background: "var(--color-border-subtle)",
                                        }}
                                    />

                                    {/* ── 备份与恢复 ─────────────────────────────────────── */}
                                    <div>
                                        <span style={labelStyle}>
                                            <HardDrive
                                                size={14}
                                                style={{ display: "inline", marginRight: 6 }}
                                            />
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
                                            {/* Google Drive */}
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
                                                                    background:
                                                                        "rgba(16,185,129,0.15)",
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
                                                                await api.backup
                                                                    .gdriveRevoke()
                                                                    .catch(() => null);
                                                                setGdriveConnected(false);
                                                                toast(
                                                                    t(
                                                                        "settings.backup.gdriveDisconnected",
                                                                    ),
                                                                    "success",
                                                                );
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
                                                                    const res =
                                                                        await api.backup.gdriveStartAuth();
                                                                    setGdriveDeviceAuth(res.data);
                                                                    // Stop polling once the device code expires.
                                                                    const deadline =
                                                                        Date.now() +
                                                                        res.data.expires_in * 1000;
                                                                    const stopPolling = (
                                                                        timer: ReturnType<
                                                                            typeof setInterval
                                                                        >,
                                                                    ) => {
                                                                        clearInterval(timer);
                                                                        setGdrivePollTimer(null);
                                                                        setGdriveDeviceAuth(null);
                                                                        setGdriveLoading(false);
                                                                    };
                                                                    const timer = setInterval(
                                                                        async () => {
                                                                            if (
                                                                                Date.now() >=
                                                                                deadline
                                                                            ) {
                                                                                stopPolling(timer);
                                                                                toast(
                                                                                    t(
                                                                                        "settings.backup.gdriveAuthFailed",
                                                                                    ),
                                                                                    "error",
                                                                                );
                                                                                return;
                                                                            }
                                                                            try {
                                                                                const poll =
                                                                                    await api.backup.gdrivePoll(
                                                                                        res.data
                                                                                            .device_code,
                                                                                    );
                                                                                if (
                                                                                    poll.connected
                                                                                ) {
                                                                                    stopPolling(
                                                                                        timer,
                                                                                    );
                                                                                    setGdriveConnected(
                                                                                        true,
                                                                                    );
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
                                                                                    t(
                                                                                        "settings.backup.gdriveAuthFailed",
                                                                                    ),
                                                                                    "error",
                                                                                );
                                                                            }
                                                                        },
                                                                        (res.data.interval + 1) *
                                                                            1000,
                                                                    );
                                                                    setGdrivePollTimer(timer);
                                                                } catch {
                                                                    setGdriveLoading(false);
                                                                    toast(
                                                                        t(
                                                                            "settings.backup.gdriveAuthFailed",
                                                                        ),
                                                                        "error",
                                                                    );
                                                                }
                                                            }}
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                padding: "5px 12px",
                                                                borderRadius: 7,
                                                                border: "1px solid var(--color-border)",
                                                                background:
                                                                    "var(--color-surface-2)",
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
                                                                        animation:
                                                                            "spin 1s linear infinite",
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
                                                            href={
                                                                gdriveDeviceAuth!.verification_url
                                                            }
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
                                                                if (gdrivePollTimer)
                                                                    clearInterval(gdrivePollTimer);
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

                                            {/* OneDrive */}
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
                                                                    background:
                                                                        "rgba(16,185,129,0.15)",
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
                                                                await api.backup
                                                                    .onedriveRevoke()
                                                                    .catch(() => null);
                                                                setOnedriveConnected(false);
                                                                toast(
                                                                    t(
                                                                        "settings.backup.onedriveDisconnected",
                                                                    ),
                                                                    "success",
                                                                );
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
                                                                    const res =
                                                                        await api.backup.onedriveStartAuth();
                                                                    setOnedriveDeviceAuth(res.data);
                                                                    const deadline =
                                                                        Date.now() +
                                                                        res.data.expires_in * 1000;
                                                                    const stopPolling = (
                                                                        timer: ReturnType<
                                                                            typeof setInterval
                                                                        >,
                                                                    ) => {
                                                                        clearInterval(timer);
                                                                        setOnedrivePollTimer(null);
                                                                        setOnedriveDeviceAuth(null);
                                                                        setOnedriveLoading(false);
                                                                    };
                                                                    const timer = setInterval(
                                                                        async () => {
                                                                            if (
                                                                                Date.now() >=
                                                                                deadline
                                                                            ) {
                                                                                stopPolling(timer);
                                                                                toast(
                                                                                    t(
                                                                                        "settings.backup.onedriveAuthFailed",
                                                                                    ),
                                                                                    "error",
                                                                                );
                                                                                return;
                                                                            }
                                                                            try {
                                                                                const poll =
                                                                                    await api.backup.onedrivePoll(
                                                                                        res.data
                                                                                            .device_code,
                                                                                    );
                                                                                if (
                                                                                    poll.connected
                                                                                ) {
                                                                                    stopPolling(
                                                                                        timer,
                                                                                    );
                                                                                    setOnedriveConnected(
                                                                                        true,
                                                                                    );
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
                                                                                    t(
                                                                                        "settings.backup.onedriveAuthFailed",
                                                                                    ),
                                                                                    "error",
                                                                                );
                                                                            }
                                                                        },
                                                                        (res.data.interval + 1) *
                                                                            1000,
                                                                    );
                                                                    setOnedrivePollTimer(timer);
                                                                } catch {
                                                                    setOnedriveLoading(false);
                                                                    toast(
                                                                        t(
                                                                            "settings.backup.onedriveAuthFailed",
                                                                        ),
                                                                        "error",
                                                                    );
                                                                }
                                                            }}
                                                            style={{
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                padding: "5px 12px",
                                                                borderRadius: 7,
                                                                border: "1px solid var(--color-border)",
                                                                background:
                                                                    "var(--color-surface-2)",
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
                                                                        animation:
                                                                            "spin 1s linear infinite",
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
                                                            href={
                                                                onedriveDeviceAuth.verification_url
                                                            }
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
                                                                if (onedrivePollTimer)
                                                                    clearInterval(
                                                                        onedrivePollTimer,
                                                                    );
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
                                                                    background:
                                                                        "rgba(16,185,129,0.15)",
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
                                                                await api.backup
                                                                    .webdavClear()
                                                                    .catch(() => null);
                                                                setWebdavConnected(false);
                                                                setWebdavUrl("");
                                                                setWebdavUsername("");
                                                                setWebdavPassword("");
                                                                toast(
                                                                    t(
                                                                        "settings.backup.webdavCleared",
                                                                    ),
                                                                    "success",
                                                                );
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
                                                            label: t(
                                                                "settings.backup.webdavUsername",
                                                            ),
                                                            value: webdavUsername,
                                                            onChange: setWebdavUsername,
                                                            placeholder: "username",
                                                        },
                                                        {
                                                            label: t(
                                                                "settings.backup.webdavPassword",
                                                            ),
                                                            value: webdavPassword,
                                                            onChange: setWebdavPassword,
                                                            placeholder: "••••••••",
                                                            type: "password",
                                                        },
                                                    ].map(
                                                        ({
                                                            label,
                                                            value,
                                                            onChange,
                                                            placeholder,
                                                            type,
                                                        }) => (
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
                                                                    onChange={(e) =>
                                                                        onChange(e.target.value)
                                                                    }
                                                                    placeholder={placeholder}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: "6px 10px",
                                                                        borderRadius: 7,
                                                                        border: "1px solid var(--color-border)",
                                                                        background:
                                                                            "var(--color-surface-2)",
                                                                        color: "var(--color-text)",
                                                                        fontSize: 12,
                                                                        fontFamily: "inherit",
                                                                    }}
                                                                />
                                                            </div>
                                                        ),
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            webdavSaving ||
                                                            !webdavUrl ||
                                                            !webdavUsername ||
                                                            !webdavPassword
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
                                                                toast(
                                                                    t(
                                                                        "settings.backup.webdavSaved",
                                                                    ),
                                                                    "success",
                                                                );
                                                            } catch (e) {
                                                                toast(
                                                                    (e as Error).message ||
                                                                        t(
                                                                            "settings.backup.webdavFailed",
                                                                        ),
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
                                                                !webdavUrl ||
                                                                !webdavUsername ||
                                                                !webdavPassword
                                                                    ? 0.45
                                                                    : 1,
                                                        }}
                                                    >
                                                        {webdavSaving ? (
                                                            <Loader2
                                                                size={11}
                                                                style={{
                                                                    animation:
                                                                        "spin 1s linear infinite",
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
                                                                    background:
                                                                        "rgba(16,185,129,0.15)",
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
                                                                await api.backup
                                                                    .s3Clear()
                                                                    .catch(() => null);
                                                                setS3Connected(false);
                                                                setS3Endpoint("");
                                                                setS3Region("");
                                                                setS3Bucket("");
                                                                setS3AccessKeyId("");
                                                                setS3SecretAccessKey("");
                                                                toast(
                                                                    t("settings.backup.s3Cleared"),
                                                                    "success",
                                                                );
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
                                                                placeholder:
                                                                    "https://s3.amazonaws.com",
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
                                                    ).map(
                                                        ({
                                                            label,
                                                            value,
                                                            onChange,
                                                            placeholder,
                                                            type,
                                                        }) => (
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
                                                                    onChange={(e) =>
                                                                        onChange(e.target.value)
                                                                    }
                                                                    placeholder={placeholder}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: "6px 10px",
                                                                        borderRadius: 7,
                                                                        border: "1px solid var(--color-border)",
                                                                        background:
                                                                            "var(--color-surface-2)",
                                                                        color: "var(--color-text)",
                                                                        fontSize: 12,
                                                                        fontFamily: "inherit",
                                                                    }}
                                                                />
                                                            </div>
                                                        ),
                                                    )}
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
                                                                    secretAccessKey:
                                                                        s3SecretAccessKey,
                                                                });
                                                                setS3Connected(true);
                                                                setS3SecretAccessKey("");
                                                                toast(
                                                                    t("settings.backup.s3Saved"),
                                                                    "success",
                                                                );
                                                            } catch (e) {
                                                                toast(
                                                                    (e as Error).message ||
                                                                        t(
                                                                            "settings.backup.s3Failed",
                                                                        ),
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
                                                                    animation:
                                                                        "spin 1s linear infinite",
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
                                                        await api.backup
                                                            .saveSettings({ scheduleHours: h })
                                                            .catch(() => null);
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
                                                    <option value={0}>
                                                        {t("settings.backup.scheduleOff")}
                                                    </option>
                                                    <option value={6}>6h</option>
                                                    <option value={12}>12h</option>
                                                    <option value={24}>24h</option>
                                                    <option value={48}>48h</option>
                                                    <option value={168}>7 days</option>
                                                </select>
                                            </div>

                                            {/* 立即备份 */}
                                            {(gdriveConnected ||
                                                webdavConnected ||
                                                onedriveConnected ||
                                                s3Connected) && (
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
                                                                const res =
                                                                    await api.backup.trigger("all");
                                                                const successCount =
                                                                    res.results.filter(
                                                                        (r) => r.ok,
                                                                    ).length;
                                                                if (res.ok) {
                                                                    toast(
                                                                        t(
                                                                            "settings.backup.triggerSuccess",
                                                                            {
                                                                                n: successCount,
                                                                            },
                                                                        ),
                                                                        "success",
                                                                    );
                                                                } else {
                                                                    toast(
                                                                        t(
                                                                            "settings.backup.triggerFailed",
                                                                        ),
                                                                        "error",
                                                                    );
                                                                }
                                                                // Refresh run history
                                                                api.backup
                                                                    .runs(10)
                                                                    .then((r) =>
                                                                        setBackupRuns(r.data),
                                                                    )
                                                                    .catch(() => null);
                                                            } catch (e) {
                                                                toast(
                                                                    (e as Error).message,
                                                                    "error",
                                                                );
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
                                                                    animation:
                                                                        "spin 1s linear infinite",
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
                                                                    background:
                                                                        "var(--color-surface-2)",
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
                                                                    {run.filename ??
                                                                        run.error ??
                                                                        "—"}
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        fontSize: 10,
                                                                        color: "var(--color-text-muted)",
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    {new Date(
                                                                        run.startedAt,
                                                                    ).toLocaleString()}
                                                                </span>
                                                                {run.sizeBytes && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: 10,
                                                                            color: "var(--color-text-muted)",
                                                                            flexShrink: 0,
                                                                        }}
                                                                    >
                                                                        {(
                                                                            run.sizeBytes /
                                                                            1024 /
                                                                            1024
                                                                        ).toFixed(1)}{" "}
                                                                        MB
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
                                        </div>
                                    </div>
                                </div>

                                {/* Save button */}
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <motion.button
                                        type="submit"
                                        disabled={saving}
                                        whileHover={
                                            saving
                                                ? {}
                                                : {
                                                      scale: 1.02,
                                                      boxShadow:
                                                          "0 4px 20px var(--color-accent-glow)",
                                                  }
                                        }
                                        whileTap={saving ? {} : { scale: 0.98 }}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "10px 24px",
                                            borderRadius: "var(--radius-md)",
                                            background: saving
                                                ? "var(--color-surface-3)"
                                                : "#10b981",
                                            color: saving ? "var(--color-text-muted)" : "#fff",
                                            fontSize: "14px",
                                            fontWeight: 600,
                                            border: "none",
                                            cursor: saving ? "not-allowed" : "pointer",
                                            letterSpacing: "-0.01em",
                                            transition: "background 0.15s",
                                            boxShadow: saving
                                                ? "none"
                                                : "0 2px 12px rgba(16,185,129,0.35)",
                                        }}
                                    >
                                        <Save size={15} />
                                        {saving ? t("common.saving") : t("common.save")}
                                    </motion.button>
                                </div>
                            </motion.form>
                        )}
                    </div>
                    {/* ── RIGHT: Sync status + System Metrics (sticky) ── */}
                    <div
                        style={{
                            position: "sticky",
                            top: "calc(var(--app-nav-height) + 20px)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {/* Sync status card */}
                        <div
                            style={{
                                borderRadius: "var(--radius-lg)",
                                padding: "16px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border-subtle)",
                            }}
                        >
                            {/* Status row */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 12,
                                }}
                            >
                                {sync?.status === "error" ? (
                                    <AlertCircle
                                        size={15}
                                        style={{ color: "var(--color-error)", flexShrink: 0 }}
                                    />
                                ) : sync?.status === "completed" ? (
                                    <CheckCircle2
                                        size={15}
                                        style={{ color: "var(--color-watched)", flexShrink: 0 }}
                                    />
                                ) : sync?.status === "running" ? (
                                    <Loader2
                                        size={15}
                                        className="animate-spin"
                                        style={{ color: "var(--color-accent)", flexShrink: 0 }}
                                    />
                                ) : (
                                    <RefreshCw
                                        size={15}
                                        style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
                                    />
                                )}
                                <span
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: "var(--color-text)",
                                    }}
                                >
                                    {sync?.status === "error"
                                        ? t("sync.statusFailed")
                                        : sync?.status === "completed"
                                          ? t("sync.statusDone")
                                          : sync?.status === "running"
                                            ? t("sync.syncingProgress", {
                                                  current: sync.progress,
                                                  total: sync.total,
                                              })
                                            : t("sync.statusReady")}
                                </span>
                            </div>

                            {/* Progress bar when running */}
                            {isRunning && sync.total > 0 && (
                                <div
                                    style={{
                                        height: 4,
                                        borderRadius: 999,
                                        background: "var(--color-surface-3)",
                                        overflow: "hidden",
                                        marginBottom: 12,
                                    }}
                                >
                                    <motion.div
                                        style={{
                                            height: "100%",
                                            borderRadius: 999,
                                            background: "var(--color-accent)",
                                        }}
                                        animate={{
                                            width: `${Math.round((sync.progress / sync.total) * 100)}%`,
                                        }}
                                        transition={{ duration: 0.4 }}
                                    />
                                </div>
                            )}

                            {sync?.lastSyncAt && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11,
                                        color: "var(--color-text-muted)",
                                        marginBottom: 12,
                                    }}
                                >
                                    <Clock size={11} />
                                    {t("sync.lastSync")}
                                    {new Date(sync.lastSyncAt).toLocaleString("zh-CN")}
                                </div>
                            )}

                            {syncError && (
                                <div
                                    style={{
                                        borderRadius: "var(--radius-md)",
                                        padding: "8px 12px",
                                        background: "#ef444412",
                                        border: "1px solid #ef444428",
                                        fontSize: 12,
                                        color: "var(--color-error)",
                                        marginBottom: 10,
                                    }}
                                >
                                    {syncError}
                                </div>
                            )}

                            {/* Trigger buttons */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSyncError(null);
                                        triggerSync(undefined, {
                                            onError: (err) =>
                                                setSyncError(
                                                    err instanceof Error
                                                        ? err.message
                                                        : t("sync.triggerFailed"),
                                                ),
                                        });
                                    }}
                                    disabled={anyPending || isRunning}
                                    style={{
                                        flex: 1,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        padding: "8px 12px",
                                        borderRadius: "var(--radius-md)",
                                        border: "none",
                                        background:
                                            anyPending || isRunning
                                                ? "var(--color-surface-3)"
                                                : "#7c6af7",
                                        color:
                                            anyPending || isRunning
                                                ? "var(--color-text-muted)"
                                                : "#fff",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: anyPending || isRunning ? "not-allowed" : "pointer",
                                        transition: "background 0.15s",
                                    }}
                                >
                                    <RefreshCw
                                        size={12}
                                        className={syncing ? "animate-spin" : ""}
                                    />
                                    {syncing ? t("sync.queued") : t("sync.syncNow")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSyncError(null);
                                        triggerFull(undefined, {
                                            onError: (err) =>
                                                setSyncError(
                                                    err instanceof Error
                                                        ? err.message
                                                        : t("sync.triggerFullFailed"),
                                                ),
                                        });
                                    }}
                                    disabled={anyPending || isRunning}
                                    style={{
                                        flex: 1,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        padding: "8px 12px",
                                        borderRadius: "var(--radius-md)",
                                        border: "1px solid #38bdf840",
                                        background:
                                            anyPending || isRunning
                                                ? "var(--color-surface-3)"
                                                : "#0ea5e9",
                                        color:
                                            anyPending || isRunning
                                                ? "var(--color-text-muted)"
                                                : "#fff",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: anyPending || isRunning ? "not-allowed" : "pointer",
                                        transition: "background 0.15s",
                                    }}
                                >
                                    <Database
                                        size={12}
                                        className={fullSyncing ? "animate-spin" : ""}
                                    />
                                    {fullSyncing ? t("sync.syncing") : t("sync.fullSync")}
                                </button>
                            </div>

                            {/* Completed summary */}
                            {sync?.status === "completed" && sync.total > 0 && (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 8,
                                        marginTop: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: "var(--radius-md)",
                                            background: "#10b98114",
                                            border: "1px solid #10b98128",
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontSize: 10,
                                                color: "#10b981",
                                                fontWeight: 700,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {t("sync.success")}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: "var(--color-text)",
                                                lineHeight: 1,
                                            }}
                                        >
                                            {sync.successCount ??
                                                sync.total - (sync.failedShows?.length ?? 0)}
                                        </p>
                                    </div>
                                    <div
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: "var(--radius-md)",
                                            background: "#ef444414",
                                            border: "1px solid #ef444428",
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontSize: 10,
                                                color: "#ef4444",
                                                fontWeight: 700,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {t("sync.failed")}
                                        </p>
                                        <p
                                            style={{
                                                fontSize: 20,
                                                fontWeight: 700,
                                                color: "var(--color-text)",
                                                lineHeight: 1,
                                            }}
                                        >
                                            {sync.failedCount ?? sync.failedShows?.length ?? 0}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* System Metrics */}
                        <div className="flex items-center gap-2">
                            <Activity className="size-[13px] text-[var(--color-text-muted)]" />
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase" as const,
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                系统状态
                            </span>
                        </div>
                        <div
                            style={{
                                borderRadius: "var(--radius-lg)",
                                padding: "16px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border-subtle)",
                            }}
                        >
                            {sysMetrics ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {/* System memory */}
                                    {/* Info grid */}
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: 6,
                                        }}
                                    >
                                        {[
                                            {
                                                label: "运行时长",
                                                value: fmtUptime(sysMetrics.process.uptimeSeconds),
                                            },
                                            {
                                                label: "系统内存",
                                                value: `${fmtBytes(sysMetrics.system.usedMem)} / ${fmtBytes(sysMetrics.system.totalMem)}`,
                                            },
                                            {
                                                label: "RSS 内存",
                                                value: fmtBytes(sysMetrics.process.rss),
                                            },
                                            {
                                                label: "堆内存",
                                                value: `${fmtBytes(sysMetrics.process.heapUsed)} / ${fmtBytes(sysMetrics.process.heapTotal)}`,
                                            },
                                            {
                                                label: "Node.js",
                                                value: sysMetrics.process.nodeVersion,
                                            },
                                            {
                                                label: "CPU 核心",
                                                value: `${sysMetrics.system.cpuCount} 核`,
                                            },
                                        ].map(({ label, value }) => (
                                            <div
                                                key={label}
                                                style={{
                                                    padding: "7px 9px",
                                                    borderRadius: "var(--radius-md)",
                                                    background: "var(--color-surface-2)",
                                                    border: "1px solid var(--color-border-subtle)",
                                                }}
                                            >
                                                <p
                                                    style={{
                                                        fontSize: 10,
                                                        color: "var(--color-text-muted)",
                                                        marginBottom: 2,
                                                    }}
                                                >
                                                    {label}
                                                </p>
                                                <p
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: "var(--color-text)",
                                                    }}
                                                >
                                                    {value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--color-text-muted)",
                                        textAlign: "center",
                                        padding: "12px 0",
                                    }}
                                >
                                    加载中…
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* end two-column grid */}
            </div>

            <ConfirmDialog
                isOpen={deleteNowTarget !== null}
                title={t("settings.jellyfinDeleteNowConfirmTitle")}
                description={t("settings.jellyfinDeleteNowConfirmDesc", {
                    title: deleteNowTarget?.title ?? "",
                })}
                confirmText={t("settings.jellyfinDeleteNow")}
                confirmColor="rose"
                cancelText={t("common.cancel")}
                isLoading={isDeletingNow}
                onConfirm={handleDeleteNowConfirm}
                onCancel={() => setDeleteNowTarget(null)}
            />
        </div>
    );
}
