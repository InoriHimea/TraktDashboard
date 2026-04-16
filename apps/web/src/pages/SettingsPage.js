import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useSettings, useUpdateSettings } from "../hooks";
import { loadTheme, applyTheme, persistTheme } from "../lib/theme";
// Move styles outside component to avoid recreation on every render
const inputStyle = {
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
const labelStyle = {
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
    const [toast, setToast] = useState(null);
    const [theme, setTheme] = useState(loadTheme);
    useEffect(() => {
        if (settings) {
            setDisplayLanguage(settings.displayLanguage);
            setSyncIntervalMinutes(settings.syncIntervalMinutes);
            setHttpProxy(settings.httpProxy ?? "");
        }
    }, [settings]);
    async function handleSave(e) {
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
        if (langTrimmed &&
            !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(langTrimmed)) {
            setToast({
                type: "error",
                message: "显示语言格式不正确，请使用 BCP 47 格式（如 zh-CN、en-US）。",
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save settings.";
            setToast({ type: "error", message });
        }
    }
    return (_jsxs("div", { style: {
            maxWidth: "560px",
            margin: "0 auto",
            padding: "40px 24px",
        }, children: [_jsxs("div", { style: { marginBottom: "32px" }, children: [_jsx("h2", { style: {
                            fontFamily: "var(--font-display)",
                            fontSize: "32px",
                            color: "var(--color-text)",
                            letterSpacing: "-0.02em",
                            lineHeight: 1.1,
                            marginBottom: "6px",
                        }, children: "Settings" }), _jsx("p", { style: {
                            color: "var(--color-text-secondary)",
                            fontSize: "14px",
                        }, children: "Configure display language, sync interval, and proxy." })] }), isLoading ? (_jsx("p", { style: {
                    color: "var(--color-text-muted)",
                    fontSize: "14px",
                }, children: "Loading settings\u2026" })) : (_jsxs(motion.form, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, onSubmit: handleSave, style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                }, children: [_jsxs("div", { style: {
                            borderRadius: "var(--radius-lg)",
                            padding: "24px",
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-border-subtle)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                        }, children: [_jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Theme" }), _jsx("div", { style: { display: "flex", gap: "12px" }, children: ["dark", "light"].map((t) => (_jsxs("label", { style: {
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                color: "var(--color-text)",
                                            }, children: [_jsx("input", { type: "radio", name: "theme", value: t, checked: theme === t, onChange: () => {
                                                        setTheme(t);
                                                        applyTheme(t);
                                                        persistTheme(t);
                                                    }, style: {
                                                        accentColor: "var(--color-accent)",
                                                    } }), t.charAt(0).toUpperCase() + t.slice(1)] }, t))) })] }), _jsx("div", { style: {
                                    height: "1px",
                                    background: "var(--color-border-subtle)",
                                } }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Display Language" }), _jsx("input", { type: "text", value: displayLanguage, onChange: (e) => setDisplayLanguage(e.target.value), placeholder: "e.g. zh-CN, en-US, ja-JP", style: inputStyle }), _jsx("p", { style: {
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                            marginTop: "6px",
                                            lineHeight: 1.5,
                                        }, children: "BCP 47 language code for TMDB translated titles. Re-sync after changing." })] }), _jsx("div", { style: {
                                    height: "1px",
                                    background: "var(--color-border-subtle)",
                                } }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Sync Interval (minutes)" }), _jsx("input", { type: "number", min: 1, max: 10080, value: syncIntervalMinutes, onChange: (e) => setSyncIntervalMinutes(Number(e.target.value)), style: inputStyle }), _jsx("p", { style: {
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                            marginTop: "6px",
                                            lineHeight: 1.5,
                                        }, children: "Auto-sync frequency. Range: 1\u201310080 minutes (up to 1 week)." })] }), _jsx("div", { style: {
                                    height: "1px",
                                    background: "var(--color-border-subtle)",
                                } }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "HTTP Proxy" }), _jsx("input", { type: "text", value: httpProxy, onChange: (e) => setHttpProxy(e.target.value), placeholder: "http://proxy.example.com:7890", style: inputStyle }), _jsx("p", { style: {
                                            fontSize: "12px",
                                            color: "var(--color-text-muted)",
                                            marginTop: "6px",
                                            lineHeight: 1.5,
                                        }, children: "Optional. Routes TMDB and Trakt requests through a proxy. Leave empty to use env default." })] })] }), _jsx(AnimatePresence, { children: toast && (_jsxs(motion.div, { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-md)",
                                background: toast.type === "success"
                                    ? "#34d39912"
                                    : "#ef444412",
                                border: `1px solid ${toast.type === "success" ? "#34d39928" : "#ef444428"}`,
                                color: toast.type === "success"
                                    ? "var(--color-watched)"
                                    : "var(--color-error)",
                                fontSize: "13px",
                            }, children: [toast.type === "success" ? (_jsx(CheckCircle2, { size: 14 })) : (_jsx(AlertCircle, { size: 14 })), toast.message] })) }), _jsx("div", { style: { display: "flex", justifyContent: "flex-end" }, children: _jsxs(motion.button, { type: "submit", disabled: saving, whileHover: saving
                                ? {}
                                : {
                                    scale: 1.02,
                                    boxShadow: "0 4px 20px var(--color-accent-glow)",
                                }, whileTap: saving ? {} : { scale: 0.98 }, style: {
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
                            }, children: [_jsx(Save, { size: 15 }), saving ? "Saving…" : "Save Settings"] }) })] }))] }));
}
//# sourceMappingURL=SettingsPage.js.map