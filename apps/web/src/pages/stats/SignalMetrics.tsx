import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, COLORS } from "./tokens";
import type { ChartColor } from "./tokens";

export type SignalMetric = {
    label: string;
    value: string;
    detail: string;
    icon: ComponentType<{ size?: number; color?: string; "aria-hidden"?: boolean }>;
    color: ChartColor;
};

export function SignalMetrics({ metrics }: { metrics: SignalMetric[] }) {
    if (metrics.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "16px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                    gap: "12px",
                }}
            >
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: T1 }}>信号指标</h3>
                <span
                    style={{
                        border: `1px solid ${COLORS.cyan.base}33`,
                        borderRadius: "999px",
                        background: COLORS.cyan.bg,
                        color: T2,
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "4px 9px",
                    }}
                >
                    Derived
                </span>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "10px",
                }}
            >
                {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <div
                            key={metric.label}
                            style={{
                                minWidth: 0,
                                border: `1px solid ${metric.color.base}26`,
                                borderRadius: "12px",
                                background: "rgba(255,255,255,0.025)",
                                padding: "12px",
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${metric.color.base}10`,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "8px",
                                    marginBottom: "10px",
                                }}
                            >
                                <span
                                    style={{
                                        color: T3,
                                        fontSize: "11px",
                                        fontWeight: 700,
                                    }}
                                >
                                    {metric.label}
                                </span>
                                <Icon size={15} color={metric.color.light} aria-hidden />
                            </div>
                            <div
                                style={{
                                    color: metric.color.light,
                                    fontSize: "22px",
                                    fontWeight: 800,
                                    fontVariantNumeric: "tabular-nums",
                                    lineHeight: 1,
                                }}
                            >
                                {metric.value}
                            </div>
                            <p
                                style={{
                                    color: T3,
                                    fontSize: "11px",
                                    marginTop: "7px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                                title={metric.detail}
                            >
                                {metric.detail}
                            </p>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
