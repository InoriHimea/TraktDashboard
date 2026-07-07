import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
    Save,
    Server,
    Loader2,
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
import {
    isPushSupported,
    getExistingSubscription,
    enablePush,
    disablePush,
    fetchVapidPublicKey,
} from "../lib/push";
import { loadTheme, Theme } from "../lib/theme";
import { t, setLocale } from "../lib/i18n";
import { useToast } from "../lib/toast";
import { Tabs } from "../components/ui/Tabs";
import { GeneralTab } from "./settings/GeneralTab";
import { NotificationsTab } from "./settings/NotificationsTab";
import { JellyfinTab } from "./settings/JellyfinTab";
import { BackupTab } from "./settings/BackupTab";
import type { DeviceAuthState } from "./settings/shared";

type SettingsTabId = "general" | "jellyfin" | "notifications" | "backup";

export default function SettingsPage() {
    const { data: settings, isLoading } = useSettings();
    const { mutateAsync: updateSettings, isPending: saving } = useUpdateSettings();

    const [activeTab, setActiveTab] = useState<SettingsTabId>("general");

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
    // 云盘 OAuth 应用凭据（GDRIVE_CLIENT_ID/SECRET、ONEDRIVE_CLIENT_ID）需自备并配进
    // 环境变量；未配置时隐藏对应卡片，只显示"已禁用"提示（N6 批次 3a）。默认 false，
    // 待 status 接口确认已配置后才显示，避免闪现一个注定失败的连接按钮。
    const [gdriveConfigured, setGdriveConfigured] = useState(false);
    const [onedriveConfigured, setOnedriveConfigured] = useState(false);
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
            .then((r) => {
                setGdriveConnected(r.connected);
                setGdriveConfigured(r.configured ?? true);
            })
            .catch(() => null);
        api.backup
            .onedriveStatus()
            .then((r) => {
                setOnedriveConnected(r.connected);
                setOnedriveConfigured(r.configured ?? true);
            })
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

    const tabs = [
        { id: "general" as const, label: t("settings.tabs.general") },
        { id: "jellyfin" as const, label: t("settings.tabs.jellyfin") },
        { id: "notifications" as const, label: t("settings.tabs.notifications") },
        { id: "backup" as const, label: t("settings.tabs.backup") },
    ];

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

                {/* Two-column layout: form left, sync+metrics right. Collapses to a
                    single column below lg so the fixed 380px sidebar can't overflow
                    narrow viewports (N6 batch 4 mobile audit). */}
                <div
                    className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]"
                    style={{ maxWidth: "1160px" }}
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
                                <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

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
                                    {activeTab === "general" && (
                                        <GeneralTab
                                            theme={theme}
                                            setTheme={setTheme}
                                            displayLanguage={displayLanguage}
                                            setDisplayLanguage={setDisplayLanguage}
                                            syncIntervalMinutes={syncIntervalMinutes}
                                            setSyncIntervalMinutes={setSyncIntervalMinutes}
                                            httpProxy={httpProxy}
                                            setHttpProxy={setHttpProxy}
                                        />
                                    )}

                                    {activeTab === "jellyfin" && (
                                        <JellyfinTab
                                            jellyfinUrl={jellyfinUrl}
                                            setJellyfinUrl={setJellyfinUrl}
                                            jellyfinApiKey={jellyfinApiKey}
                                            setJellyfinApiKey={setJellyfinApiKey}
                                            jellyfinLibraries={jellyfinLibraries}
                                            jellyfinLibrariesLoading={jellyfinLibrariesLoading}
                                            loadJellyfinLibraries={loadJellyfinLibraries}
                                            jellyfinAutoDeleteIds={jellyfinAutoDeleteIds}
                                            toggleJellyfinLibrary={toggleJellyfinLibrary}
                                            jellyfinAutoDeleteEnabled={jellyfinAutoDeleteEnabled}
                                            setJellyfinAutoDeleteEnabled={
                                                setJellyfinAutoDeleteEnabled
                                            }
                                            deleteQueue={deleteQueue}
                                            deleteQueueLoading={deleteQueueLoading}
                                            isQueueActionPending={isQueueActionPending}
                                            onDeferDelete={handleDeferDelete}
                                            onNeverDelete={handleNeverDelete}
                                            onOpenDeleteNow={setDeleteNowTarget}
                                            deleteExclusions={deleteExclusions}
                                            exclusionsLoading={exclusionsLoading}
                                            isRemovingExclusion={isRemovingExclusion}
                                            onRemoveExclusion={handleRemoveExclusion}
                                            deleteHistory={deleteHistory}
                                            deleteHistoryLoading={deleteHistoryLoading}
                                            deleteNowTarget={deleteNowTarget}
                                            isDeletingNow={isDeletingNow}
                                            onDeleteNowConfirm={handleDeleteNowConfirm}
                                            onDeleteNowCancel={() => setDeleteNowTarget(null)}
                                        />
                                    )}

                                    {activeTab === "notifications" && (
                                        <NotificationsTab
                                            pushSupported={pushSupported}
                                            pushEnabled={pushEnabled}
                                            pushBusy={pushBusy}
                                            togglePush={togglePush}
                                            notifEventTypes={notifEventTypes}
                                            setNotifEventTypes={setNotifEventTypes}
                                        />
                                    )}

                                    {activeTab === "backup" && (
                                        <BackupTab
                                            gdriveConfigured={gdriveConfigured}
                                            onedriveConfigured={onedriveConfigured}
                                            gdriveConnected={gdriveConnected}
                                            setGdriveConnected={setGdriveConnected}
                                            gdriveLoading={gdriveLoading}
                                            setGdriveLoading={setGdriveLoading}
                                            gdriveDeviceAuth={gdriveDeviceAuth}
                                            setGdriveDeviceAuth={setGdriveDeviceAuth}
                                            gdrivePollTimer={gdrivePollTimer}
                                            setGdrivePollTimer={setGdrivePollTimer}
                                            onedriveConnected={onedriveConnected}
                                            setOnedriveConnected={setOnedriveConnected}
                                            onedriveLoading={onedriveLoading}
                                            setOnedriveLoading={setOnedriveLoading}
                                            onedriveDeviceAuth={onedriveDeviceAuth}
                                            setOnedriveDeviceAuth={setOnedriveDeviceAuth}
                                            onedrivePollTimer={onedrivePollTimer}
                                            setOnedrivePollTimer={setOnedrivePollTimer}
                                            webdavUrl={webdavUrl}
                                            setWebdavUrl={setWebdavUrl}
                                            webdavUsername={webdavUsername}
                                            setWebdavUsername={setWebdavUsername}
                                            webdavPassword={webdavPassword}
                                            setWebdavPassword={setWebdavPassword}
                                            webdavConnected={webdavConnected}
                                            setWebdavConnected={setWebdavConnected}
                                            webdavSaving={webdavSaving}
                                            setWebdavSaving={setWebdavSaving}
                                            s3Endpoint={s3Endpoint}
                                            setS3Endpoint={setS3Endpoint}
                                            s3Region={s3Region}
                                            setS3Region={setS3Region}
                                            s3Bucket={s3Bucket}
                                            setS3Bucket={setS3Bucket}
                                            s3AccessKeyId={s3AccessKeyId}
                                            setS3AccessKeyId={setS3AccessKeyId}
                                            s3SecretAccessKey={s3SecretAccessKey}
                                            setS3SecretAccessKey={setS3SecretAccessKey}
                                            s3Connected={s3Connected}
                                            setS3Connected={setS3Connected}
                                            s3Saving={s3Saving}
                                            setS3Saving={setS3Saving}
                                            backupScheduleHours={backupScheduleHours}
                                            setBackupScheduleHours={setBackupScheduleHours}
                                            backupTriggerLoading={backupTriggerLoading}
                                            setBackupTriggerLoading={setBackupTriggerLoading}
                                            backupRuns={backupRuns}
                                            setBackupRuns={setBackupRuns}
                                            backupRunsLoading={backupRunsLoading}
                                        />
                                    )}
                                </div>

                                {/* Save button — always visible regardless of active tab: it
                                    submits the 常规/Jellyfin连接/通知 fields together (unchanged
                                    from before the tab split), while backup providers and the
                                    delete-queue actions save independently and immediately. */}
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
        </div>
    );
}
