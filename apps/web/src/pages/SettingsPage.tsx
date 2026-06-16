import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Download, Bell } from "lucide-react";
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
    const { toast } = useToast();
    const [theme, setTheme] = useState<Theme>(loadTheme);

    // Seed the editable form from fetched settings, during render (re-seeds only
    // when the settings object reference changes, mirroring the prior effect).
    const [syncedSettings, setSyncedSettings] = useState(settings);
    if (settings && settings !== syncedSettings) {
        setSyncedSettings(settings);
        setDisplayLanguage(settings.displayLanguage);
        setSyncIntervalMinutes(settings.syncIntervalMinutes);
        setHttpProxy(settings.httpProxy ?? "");
    }

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

    useEffect(() => {
        if (!pushBrowserSupported) return;
        // Run independently so one failure doesn't prevent the other from updating state.
        fetchVapidPublicKey()
            .then((key) => setVapidPublicKey(key))
            .catch(() => {});
        getExistingSubscription()
            .then((sub) => setPushEnabled(!!sub))
            .catch(() => {});
    }, [pushBrowserSupported]);

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
            // If we were disabling, the browser subscription may have already been
            // revoked before the backend call failed. Re-sync state from the browser.
            if (pushEnabled) {
                getExistingSubscription()
                    .then((sub) => setPushEnabled(!!sub))
                    .catch(() => {});
            }
            if (err instanceof Error && err.message === "permission-denied") {
                toast(t("settings.pushPermissionDenied"), "error");
            } else {
                toast(t("settings.pushFailed"), "error");
            }
        } finally {
            setPushBusy(false);
        }
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
            });
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
                        </div>

                        {/* Divider */}
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
