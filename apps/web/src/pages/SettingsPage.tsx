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
} from "lucide-react";
import type { JellyfinLibrary } from "@trakt-dashboard/types";
import { useSettings, useUpdateSettings } from "../hooks";
import { api } from "../lib/api";
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
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [gdriveLoading, setGdriveLoading] = useState(false);
    const [deviceAuth, setDeviceAuth] = useState<{
        user_code: string;
        verification_url: string;
        device_code: string;
        interval: number;
    } | null>(null);
    const [gdrivePollTimer, setGdrivePollTimer] = useState<ReturnType<typeof setInterval> | null>(
        null,
    );
    const [webdavUrl, setWebdavUrl] = useState("");
    const [webdavUsername, setWebdavUsername] = useState("");
    const [webdavPassword, setWebdavPassword] = useState("");
    const [webdavConnected, setWebdavConnected] = useState(false);
    const [webdavSaving, setWebdavSaving] = useState(false);
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
        setNotifEventTypes(
            settings.notificationEventTypes.length > 0
                ? settings.notificationEventTypes
                : ["series_premiere", "season_premiere", "finale", "regular"],
        );
        hasSeededRef.current = true;
    }, [settings]);

    // 初始化备份状态
    useEffect(() => {
        api.backup
            .gdriveStatus()
            .then((r) => setGdriveConnected(r.connected))
            .catch(() => null);
        api.backup
            .webdavStatus()
            .then((r) => {
                setWebdavConnected(r.connected);
                if (r.url) setWebdavUrl(r.url);
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

    return (
        <div
            style={{
                maxWidth: "560px",
                margin: "0 auto",
                padding: "40px 24px",
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
                <h2
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "32px",
                        color: "var(--color-text)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                        marginBottom: "6px",
                    }}
                >
                    {t("settings.title")}
                </h2>
                <p
                    style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "14px",
                    }}
                >
                    {t("settings.subtitle")}
                </p>
            </div>

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
                            <label htmlFor="settings-display-language" style={labelStyle}>
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
                                onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))}
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
                            <span style={labelStyle}>{t("settings.notifications")}</span>
                            <button
                                type="button"
                                onClick={togglePush}
                                disabled={!pushSupported || pushBusy}
                                style={{
                                    ...exportButtonStyle,
                                    opacity: !pushSupported || pushBusy ? 0.5 : 1,
                                    cursor: !pushSupported || pushBusy ? "not-allowed" : "pointer",
                                }}
                            >
                                <Bell size={14} />
                                {pushEnabled ? t("settings.pushDisable") : t("settings.pushEnable")}
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
                                                    checked={notifEventTypes.includes(type)}
                                                    onChange={() =>
                                                        setNotifEventTypes((prev) =>
                                                            prev.includes(type)
                                                                ? prev.filter((t) => t !== type)
                                                                : [...prev, type],
                                                        )
                                                    }
                                                    style={{ accentColor: "var(--color-accent)" }}
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
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <label htmlFor="settings-jellyfin-url" style={labelStyle}>
                                        {t("settings.jellyfinUrl")}
                                    </label>
                                    <input
                                        id="settings-jellyfin-url"
                                        type="url"
                                        value={jellyfinUrl}
                                        onChange={(e) => setJellyfinUrl(e.target.value)}
                                        placeholder={t("settings.jellyfinUrlPlaceholder")}
                                        style={inputStyle}
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="settings-jellyfin-key" style={labelStyle}>
                                        {t("settings.jellyfinApiKey")}
                                    </label>
                                    <input
                                        id="settings-jellyfin-key"
                                        type="password"
                                        value={jellyfinApiKey}
                                        onChange={(e) => setJellyfinApiKey(e.target.value)}
                                        placeholder={t("settings.jellyfinApiKeyPlaceholder")}
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
                                                            toggleJellyfinLibrary(lib.id)
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
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
                        <div style={{ height: "1px", background: "var(--color-border-subtle)" }} />

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

                            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                                {/* Google Drive */}
                                <div
                                    style={{
                                        padding: "14px 16px",
                                        borderRadius: 12,
                                        border: "1px solid var(--color-border-subtle)",
                                        background: "var(--color-surface)",
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
                                                    await api.backup
                                                        .gdriveRevoke()
                                                        .catch(() => null);
                                                    setGdriveConnected(false);
                                                    toast(
                                                        t("settings.backup.gdriveDisconnected"),
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
                                                        setDeviceAuth(res.data);
                                                        const timer = setInterval(
                                                            async () => {
                                                                const poll =
                                                                    await api.backup.gdrivePoll(
                                                                        res.data.device_code,
                                                                    );
                                                                if (poll.connected) {
                                                                    clearInterval(timer);
                                                                    setGdrivePollTimer(null);
                                                                    setDeviceAuth(null);
                                                                    setGdriveConnected(true);
                                                                    setGdriveLoading(false);
                                                                    toast(
                                                                        t(
                                                                            "settings.backup.gdriveConnected",
                                                                        ),
                                                                        "success",
                                                                    );
                                                                }
                                                            },
                                                            (res.data.interval + 1) * 1000,
                                                        );
                                                        setGdrivePollTimer(timer);
                                                    } catch {
                                                        setGdriveLoading(false);
                                                        toast(
                                                            t("settings.backup.gdriveAuthFailed"),
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
                                    {deviceAuth && (
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
                                                {deviceAuth.user_code}
                                            </p>
                                            <a
                                                href={deviceAuth.verification_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--color-accent)",
                                                    marginTop: 4,
                                                    display: "block",
                                                }}
                                            >
                                                {deviceAuth.verification_url}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (gdrivePollTimer)
                                                        clearInterval(gdrivePollTimer);
                                                    setGdrivePollTimer(null);
                                                    setDeviceAuth(null);
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

                                {/* WebDAV */}
                                <div
                                    style={{
                                        padding: "14px 16px",
                                        borderRadius: 12,
                                        border: "1px solid var(--color-border-subtle)",
                                        background: "var(--color-surface)",
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
                                                    await api.backup
                                                        .webdavClear()
                                                        .catch(() => null);
                                                    setWebdavConnected(false);
                                                    setWebdavUrl("");
                                                    setWebdavUsername("");
                                                    setWebdavPassword("");
                                                    toast(
                                                        t("settings.backup.webdavCleared"),
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
                                        style={{ display: "flex", flexDirection: "column", gap: 8 }}
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
                                                        t("settings.backup.webdavSaved"),
                                                        "success",
                                                    );
                                                } catch (e) {
                                                    toast(
                                                        (e as Error).message ||
                                                            t("settings.backup.webdavFailed"),
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
                                                    !webdavUrl || !webdavUsername || !webdavPassword
                                                        ? 0.45
                                                        : 1,
                                            }}
                                        >
                                            {webdavSaving ? (
                                                <Loader2
                                                    size={11}
                                                    style={{ animation: "spin 1s linear infinite" }}
                                                />
                                            ) : (
                                                <Check size={11} />
                                            )}
                                            {t("settings.backup.webdavTest")}
                                        </button>
                                    </div>
                                </div>

                                {/* 立即备份 */}
                                {(gdriveConnected || webdavConnected) && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <button
                                            type="button"
                                            disabled={backupTriggerLoading}
                                            onClick={async () => {
                                                setBackupTriggerLoading(true);
                                                try {
                                                    const res = await api.backup.trigger("all");
                                                    const successCount = res.results.filter(
                                                        (r) => r.ok,
                                                    ).length;
                                                    if (res.ok) {
                                                        toast(
                                                            t("settings.backup.triggerSuccess", {
                                                                n: successCount,
                                                            }),
                                                            "success",
                                                        );
                                                    } else {
                                                        toast(
                                                            t("settings.backup.triggerFailed"),
                                                            "error",
                                                        );
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
                                                    style={{ animation: "spin 1s linear infinite" }}
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
                                                            {(run.sizeBytes / 1024 / 1024).toFixed(
                                                                1,
                                                            )}{" "}
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
                                          boxShadow: "0 4px 20px var(--color-accent-glow)",
                                      }
                            }
                            whileTap={saving ? {} : { scale: 0.98 }}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 24px",
                                borderRadius: "var(--radius-md)",
                                background: saving ? "var(--color-surface-3)" : "#10b981",
                                color: saving ? "var(--color-text-muted)" : "#fff",
                                fontSize: "14px",
                                fontWeight: 600,
                                border: "none",
                                cursor: saving ? "not-allowed" : "pointer",
                                letterSpacing: "-0.01em",
                                transition: "background 0.15s",
                                boxShadow: saving ? "none" : "0 2px 12px rgba(16,185,129,0.35)",
                            }}
                        >
                            <Save size={15} />
                            {saving ? t("common.saving") : t("common.save")}
                        </motion.button>
                    </div>
                </motion.form>
            )}
        </div>
    );
}
