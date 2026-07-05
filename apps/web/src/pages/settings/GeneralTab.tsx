import { Download } from "lucide-react";
import { applyTheme, persistTheme, Theme } from "../../lib/theme";
import { t } from "../../lib/i18n";
import { api } from "../../lib/api";
import { exportButtonStyle, inputStyle, labelStyle } from "./shared";

interface GeneralTabProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    displayLanguage: string;
    setDisplayLanguage: (value: string) => void;
    syncIntervalMinutes: number;
    setSyncIntervalMinutes: (value: number) => void;
    httpProxy: string;
    setHttpProxy: (value: string) => void;
}

export function GeneralTab({
    theme,
    setTheme,
    displayLanguage,
    setDisplayLanguage,
    syncIntervalMinutes,
    setSyncIntervalMinutes,
    httpProxy,
    setHttpProxy,
}: GeneralTabProps) {
    return (
        <>
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
        </>
    );
}
