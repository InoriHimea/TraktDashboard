import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T3, COLORS } from "./tokens";

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const WEEKS = 52;
const LEFT = 26;
const TOP = 18;

const LEVEL_COLORS = [
    "var(--color-surface-3)",
    "rgba(139,92,246,0.25)",
    "rgba(139,92,246,0.52)",
    "rgba(139,92,246,0.76)",
    "rgba(139,92,246,1.00)",
];

function cellLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
}

export function WatchHeatmap({ heatmap }: { heatmap: Array<{ date: string; count: number }> }) {
    const dateMap = new Map(heatmap.map((h) => [h.date, h.count]));

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split("T")[0];

    // Align to Sunday of current week, then go back 51 more weeks
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - 51 * 7);
    startDate.setHours(0, 0, 0, 0);

    // Month labels: add label when week crosses into a new month
    const monthLabels: Array<{ col: number; label: string }> = [];
    for (let w = 0; w < WEEKS; w++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + w * 7);
        if (w === 0) {
            monthLabels.push({ col: w, label: t("stats.monthShort", { n: d.getMonth() + 1 }) });
        } else {
            const prev = new Date(startDate);
            prev.setDate(startDate.getDate() + (w - 1) * 7);
            if (d.getMonth() !== prev.getMonth()) {
                monthLabels.push({
                    col: w,
                    label: t("stats.monthShort", { n: d.getMonth() + 1 }),
                });
            }
        }
    }

    const cells: Array<{ x: number; y: number; date: string; count: number }> = [];
    for (let w = 0; w < WEEKS; w++) {
        for (let d = 0; d < 7; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + w * 7 + d);
            const dateStr = cellDate.toISOString().split("T")[0];
            if (dateStr > todayStr) continue;
            cells.push({
                x: LEFT + w * STEP,
                y: TOP + d * STEP,
                date: dateStr,
                count: dateMap.get(dateStr) ?? 0,
            });
        }
    }

    const svgWidth = LEFT + WEEKS * STEP - GAP;
    const svgHeight = TOP + 7 * STEP - GAP;

    // Day labels: Mon(row1), Wed(row3), Fri(row5)
    const dayLabels = [
        { row: 1, label: t("stats.heatmapLabelMon") },
        { row: 3, label: t("stats.heatmapLabelWed") },
        { row: 5, label: t("stats.heatmapLabelFri") },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.32 }}
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "24px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                }}
            >
                <h3
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "15px",
                        fontWeight: 600,
                        color: T1,
                    }}
                >
                    <CalendarDays size={15} color={COLORS.violet.base} aria-hidden />
                    {t("stats.heatmapTitle")}
                </h3>
                <span style={{ fontSize: "12px", color: T3 }}>{t("stats.heatmapSubtitle")}</span>
            </div>

            <div style={{ overflowX: "auto" }}>
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    style={{ display: "block" }}
                    aria-label={t("stats.heatmapTitle")}
                >
                    {/* Day labels */}
                    {dayLabels.map(({ row, label }) => (
                        <text
                            key={label}
                            x={LEFT - 5}
                            y={TOP + row * STEP + CELL / 2 + 3}
                            textAnchor="end"
                            style={{
                                fontSize: "9px",
                                fill: "var(--color-text-muted)",
                                fontFamily: "var(--font-body)",
                            }}
                        >
                            {label}
                        </text>
                    ))}

                    {/* Month labels */}
                    {monthLabels.map(({ col, label }) => (
                        <text
                            key={`m-${col}`}
                            x={LEFT + col * STEP}
                            y={TOP - 5}
                            style={{
                                fontSize: "9px",
                                fill: "var(--color-text-muted)",
                                fontFamily: "var(--font-body)",
                            }}
                        >
                            {label}
                        </text>
                    ))}

                    {/* Cells */}
                    {cells.map(({ x, y, date, count }) => (
                        <rect
                            key={date}
                            x={x}
                            y={y}
                            width={CELL}
                            height={CELL}
                            rx={2}
                            style={{ fill: LEVEL_COLORS[cellLevel(count)] }}
                        >
                            <title>{`${date}: ${count}`}</title>
                        </rect>
                    ))}
                </svg>
            </div>

            {/* Legend */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    marginTop: "10px",
                    justifyContent: "flex-end",
                }}
            >
                <span style={{ fontSize: "10px", color: T3 }}>{t("stats.heatmapLegendLess")}</span>
                {LEVEL_COLORS.map((color, i) => (
                    <div
                        key={i}
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: color,
                        }}
                    />
                ))}
                <span style={{ fontSize: "10px", color: T3 }}>{t("stats.heatmapLegendMore")}</span>
            </div>
        </motion.div>
    );
}
