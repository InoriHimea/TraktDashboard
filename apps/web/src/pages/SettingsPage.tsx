import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useSettings, useUpdateSettings } from "../hooks";
import { loadTheme, applyTheme, persistTheme, Theme } from "../lib/theme";

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
    const { mutateAsync: updateSettings, isPending: saving } =
        useUpdateSettings();

    const [displayLanguage, setDisplayLanguage] = useState("zh-CN");
    const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(60);
    const [httpProxy, setHttpProxy] = useState("");
    const [toast, setToast] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [theme, setTheme] = useState<Theme>(loadTheme);

    useEffect(() => {
        if (settings) {
            setDisplayLanguage(settings.displayLanguage);
            setSyncIntervalMinutes(settings.syncIntervalMinutes);
            setHttpProxy(settings.httpProxy ?? "");
        }
    }, [settings]);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setToast(null);

        // Frontend validation
        const interval = Number(syncIntervalMinutes);
        if (!Number.isInteger(interval) || interval < 1 || interval > 10080) {
            setToast({
                type: "error",
                message: "同步间隔必须是 1 到 10080 之间的整数。",
            });
            return;
        }

        // Validate displayLanguage (BCP 47 format: xx or xx-YY)
        const langTrimmed = displayLanguage.trim();
        if (
            langTrimmed &&
            !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(langTrimmed)
        ) {
            setToast({
                type: "error",
                message:
                    "显示语言格式不正确，请使用 BCP 47 格式（如 zh-CN、en-US）。",
            });
            return;
        }

        // Validate httpProxy (must be http:// or https:// if specified)
        const proxyValue = httpProxy.trim();
        if (proxyValue && !/^https?:\/\/.+/i.test(proxyValue)) {
            setToast({
                type: "error",
                message: "代理地址必须以 http:// 或 https:// 开头。",
            });
            return;
        }

        try {
            await updateSettings({
                displayLanguage: langTrimmed,
                syncIntervalMinutes: interval,
                httpProxy: proxyValue || null,
            });
            setToast({
                type: "success",
                message: "Settings saved successfully.",
            });
            setTimeout(() => setToast(null), 3000);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Failed to save settings.";
            setToast({ type: "error", message });
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
                    Settings
                </h2>
                <p
                    style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "14px",
                    }}
                >
                    Configure display language, sync interval, and proxy.
                </p>
            </div>

            {isLoading ? (
                <p
                    style={{
                        color: "var(--color-text-muted)",
                        fontSize: "14px",
                    }}
                >
                    Loading settings…
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
                        <div>
                            <label style={labelStyle}>Theme</label>
                            <div style={{ display: "flex", gap: "12px" }}>
                                {(["dark", "light"] as Theme[]).map((t) => (
                                    <label
                                        key={t}
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
                                            type="radio"
                                            name="theme"
                                            value={t}
                                            checked={theme === t}
                                            onChange={() => {
                                                setTheme(t);
                                                applyTheme(t);
                                                persistTheme(t);
                                            }}
                                            style={{
                                                accentColor:
                                                    "var(--color-accent)",
                                            }}
                                        />
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div
                            style={{
                                height: "1px",
                                background: "var(--color-border-subtle)",
                            }}
                        />

                        {/* Display Language */}
                        <div>
                            <label style={labelStyle}>Display Language</label>
                            <input
                                type="text"
                                value={displayLanguage}
                                onChange={(e) =>
                                    setDisplayLanguage(e.target.value)
                                }
                                placeholder="e.g. zh-CN, en-US, ja-JP"
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
                                BCP 47 language code for TMDB translated titles.
                                Re-sync after changing.
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
                            <label style={labelStyle}>
                                Sync Interval (minutes)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={10080}
                                value={syncIntervalMinutes}
                                onChange={(e) =>
                                    setSyncIntervalMinutes(
                                        Number(e.target.value),
                                    )
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
                                Auto-sync frequency. Range: 1–10080 minutes (up
                                to 1 week).
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
                            <label style={labelStyle}>HTTP Proxy</label>
                            <input
                                type="text"
                                value={httpProxy}
                                onChange={(e) => setHttpProxy(e.target.value)}
                                placeholder="http://proxy.example.com:7890"
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
                                Optional. Routes TMDB and Trakt requests through
                                a proxy. Leave empty to use env default.
                            </p>
                        </div>
                    </div>

                    {/* Toast */}
                    <AnimatePresence>
                        {toast && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "12px 16px",
                                    borderRadius: "var(--radius-md)",
                                    background:
                                        toast.type === "success"
                                            ? "#34d39912"
                                            : "#ef444412",
                                    border: `1px solid ${toast.type === "success" ? "#34d39928" : "#ef444428"}`,
                                    color:
                                        toast.type === "success"
                                            ? "var(--color-watched)"
                                            : "var(--color-error)",
                                    fontSize: "13px",
                                }}
                            >
                                {toast.type === "success" ? (
                                    <CheckCircle2 size={14} />
                                ) : (
                                    <AlertCircle size={14} />
                                )}
                                {toast.message}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Save button */}
                    <div
                        style={{ display: "flex", justifyContent: "flex-end" }}
                    >
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
                                color: saving
                                    ? "var(--color-text-muted)"
                                    : "#fff",
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
                            {saving ? "Saving…" : "Save Settings"}
                        </motion.button>
                    </div>
                </motion.form>
            )}
        </div>
    );
}
