import { LayoutGrid } from "lucide-react";
import type { JellyfinHeatmapCell } from "@trakt-dashboard/types";
import { CARD_BG, CARD_BDR, T2, T3, COLORS } from "../stats/tokens";
import { t } from "../../lib/i18n";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun=0 ... Sat=6
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
    data: JellyfinHeatmapCell[];
    isLoading: boolean;
}

export function PlayHeatmap({ data, isLoading }: Props) {
    const cellMap = new Map<string, number>();
    let maxCount = 0;
    for (const cell of data) {
        const key = `${cell.dayOfWeek}_${cell.hour}`;
        cellMap.set(key, cell.count);
        if (cell.count > maxCount) maxCount = cell.count;
    }

    const getColor = (count: number) => {
        if (count === 0) return "var(--color-surface)";
        const ratio = count / maxCount;
        if (ratio >= 0.8) return COLORS.violet.base;
        if (ratio >= 0.55) return COLORS.sky.base;
        if (ratio >= 0.3) return COLORS.emerald.base;
        return COLORS.amber.bg;
    };

    return (
        <div
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "20px",
                backdropFilter: "blur(24px)",
                padding: "20px 22px",
            }}
        >
            <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}
            >
                <LayoutGrid size={14} color={T2} />
                <span
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: T2,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("jellyfinStats.playHeatmap")}
                </span>
            </div>

            {isLoading ? (
                <div
                    style={{
                        height: "140px",
                        background: "var(--color-surface)",
                        borderRadius: "10px",
                        opacity: 0.5,
                    }}
                />
            ) : data.length === 0 ? (
                <div
                    style={{ textAlign: "center", padding: "32px 0", color: T3, fontSize: "13px" }}
                >
                    {t("jellyfinStats.noData")}
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: "540px" }}>
                        {/* Hour labels */}
                        <div style={{ display: "flex", marginLeft: "38px", marginBottom: "4px" }}>
                            {HOURS.map((h) => (
                                <div
                                    key={h}
                                    style={{
                                        flex: 1,
                                        textAlign: "center",
                                        fontSize: "9px",
                                        color: T3,
                                        visibility: h % 4 === 0 ? "visible" : "hidden",
                                    }}
                                >
                                    {h}
                                </div>
                            ))}
                        </div>

                        {/* Grid rows */}
                        {DAYS.map((day) => (
                            <div
                                key={day}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    marginBottom: "2px",
                                }}
                            >
                                <div
                                    style={{
                                        width: "34px",
                                        fontSize: "10px",
                                        color: T3,
                                        textAlign: "right",
                                        paddingRight: "6px",
                                        flexShrink: 0,
                                    }}
                                >
                                    {DAY_LABELS[day]}
                                </div>
                                {HOURS.map((hour) => {
                                    const count = cellMap.get(`${day}_${hour}`) ?? 0;
                                    return (
                                        <div
                                            key={hour}
                                            title={count > 0 ? `${count} plays` : undefined}
                                            style={{
                                                flex: 1,
                                                aspectRatio: "1",
                                                borderRadius: "3px",
                                                background: getColor(count),
                                                transition: "background 0.2s",
                                                cursor: count > 0 ? "default" : undefined,
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}

                        {/* Legend */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                marginTop: "12px",
                                justifyContent: "flex-end",
                            }}
                        >
                            <span style={{ fontSize: "10px", color: T3 }}>
                                {t("jellyfinStats.less")}
                            </span>
                            {[0, 0.2, 0.45, 0.7, 1].map((ratio) => (
                                <div
                                    key={ratio}
                                    style={{
                                        width: "11px",
                                        height: "11px",
                                        borderRadius: "3px",
                                        background:
                                            ratio === 0
                                                ? "var(--color-surface)"
                                                : getColor(Math.ceil(ratio * maxCount)),
                                    }}
                                />
                            ))}
                            <span style={{ fontSize: "10px", color: T3 }}>
                                {t("jellyfinStats.more")}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
