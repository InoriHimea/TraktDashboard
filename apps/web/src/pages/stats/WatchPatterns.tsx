import { motion } from "framer-motion";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, COLORS } from "./tokens";

const DAY_KEYS = [
    "stats.daySun",
    "stats.dayMon",
    "stats.dayTue",
    "stats.dayWed",
    "stats.dayThu",
    "stats.dayFri",
    "stats.daySat",
] as const;

const CustomTooltip = ({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
}) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: "var(--color-surface-2)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${COLORS.violet.base}44`,
                borderRadius: "12px",
                padding: "10px 14px",
                fontSize: "13px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
        >
            <p style={{ color: T3, marginBottom: "3px", fontSize: "11px" }}>{label}</p>
            <p style={{ color: COLORS.violet.light, fontWeight: 700, fontSize: "16px" }}>
                {payload[0].value}{" "}
                <span style={{ fontSize: "11px", fontWeight: 400, color: T2 }}>
                    {t("stats.weekdayUnit")}
                </span>
            </p>
        </div>
    );
};

export function WatchPatterns({
    weekdayDistribution,
}: {
    weekdayDistribution: Array<{ weekday: number; count: number }>;
}) {
    const dayLabels = DAY_KEYS.map((k) => t(k));
    const chartData = weekdayDistribution.map((d) => ({
        day: dayLabels[d.weekday] ?? String(d.weekday),
        count: d.count,
    }));
    const maxCount = Math.max(...chartData.map((d) => d.count), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.36 }}
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
                    marginBottom: "20px",
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
                    <BarChart2 size={15} color={COLORS.violet.base} aria-hidden />
                    {t("stats.weekdayTitle")}
                </h3>
                <span style={{ fontSize: "12px", color: T3 }}>{t("stats.weekdaySubtitle")}</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
                <BarChart
                    data={chartData}
                    barSize={22}
                    margin={{ top: 4, right: 0, bottom: 0, left: -28 }}
                >
                    <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
                    <XAxis
                        dataKey="day"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "rgba(139,92,246,0.07)", radius: 6 }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS.violet.base}
                                fillOpacity={
                                    entry.count === 0 ? 0.15 : 0.7 + (entry.count / maxCount) * 0.3
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
