import type { Dispatch, SetStateAction } from "react";
import { Bell } from "lucide-react";
import { t } from "../../lib/i18n";
import { exportButtonStyle, labelStyle } from "./shared";

interface NotificationsTabProps {
    pushSupported: boolean;
    pushEnabled: boolean;
    pushBusy: boolean;
    togglePush: () => void;
    notifEventTypes: string[];
    setNotifEventTypes: Dispatch<SetStateAction<string[]>>;
}

export function NotificationsTab({
    pushSupported,
    pushEnabled,
    pushBusy,
    togglePush,
    notifEventTypes,
    setNotifEventTypes,
}: NotificationsTabProps) {
    return (
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
                {pushSupported ? t("settings.notificationsHint") : t("settings.pushUnsupported")}
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
                                ["series_premiere", t("settings.notifSeriesPremiere")],
                                ["season_premiere", t("settings.notifSeasonPremiere")],
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
                                    style={{
                                        accentColor: "var(--color-accent)",
                                    }}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
