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
import { TrendingUp } from "lucide-react";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, COLORS, barColor } from "./tokens";

type ActivityDatum = {
    month: string;
    count: number;
};

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
                border: `1px solid ${COLORS.cyan.base}44`,
                borderRadius: "12px",
                padding: "10px 14px",
                fontSize: "13px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
        >
            <p style={{ color: T3, marginBottom: "3px", fontSize: "11px" }}>{label}</p>
            <p
                style={{
                    color: COLORS.cyan.light,
                    fontWeight: 700,
                    fontSize: "16px",
                }}
            >
                {payload[0].value}{" "}
                <span style={{ fontSize: "11px", fontWeight: 400, color: T2 }}>
                    {t("stats.chartUnit")}
                </span>
            </p>
        </div>
    );
};

export function ActivityChart({
    chartData,
    maxBar,
}: {
    chartData: ActivityDatum[];
    maxBar: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
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
                        fontSize: "15px",
                        fontWeight: 600,
                        color: T1,
                    }}
                >
                    {t("stats.chartTitle")}
                </h3>
                <span
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: T3,
                    }}
                >
                    <TrendingUp size={13} color={COLORS.cyan.base} aria-hidden />{" "}
                    {t("stats.chartSubtitle")}
                </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart
                    data={chartData}
                    barSize={14}
                    margin={{
                        top: 4,
                        right: 0,
                        bottom: 0,
                        left: -28,
                    }}
                >
                    <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
                    <XAxis
                        dataKey="month"
                        tick={{
                            fill: "var(--color-text-muted)",
                            fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{
                            fill: "var(--color-text-muted)",
                            fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{
                            fill: "rgba(37,244,238,0.07)",
                            radius: 6,
                        }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={
                                    entry.count === 0
                                        ? "var(--color-surface-3)"
                                        : barColor(entry.count, maxBar)
                                }
                                fillOpacity={entry.count === 0 ? 1 : 0.85}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
