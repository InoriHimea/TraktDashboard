import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { CARD_BG, CARD_BDR, CARD_BLR, CARD_SHD, T2, T3, COLORS } from "./tokens";
import type { ChartColor } from "./tokens";

export function StatCard({
    label,
    value,
    icon: Icon,
    sub,
    signal,
    delay = 0,
    color = COLORS.cyan,
}: {
    label: string;
    value: string | number;
    icon: ComponentType<{ size?: number; color?: string; "aria-hidden"?: boolean }>;
    sub?: string;
    signal?: string;
    delay?: number;
    color?: ChartColor;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            style={{
                background: CARD_BG,
                backdropFilter: CARD_BLR,
                WebkitBackdropFilter: CARD_BLR,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                borderLeft: `3px solid ${color.base}`,
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: "0 0 auto 0",
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${color.light}, transparent)`,
                    opacity: 0.45,
                }}
            />
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span
                    style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: T3,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                    }}
                >
                    {label}
                </span>
                <div
                    style={{
                        background: color.bg,
                        border: `1px solid ${color.base}33`,
                        borderRadius: "10px",
                        padding: "6px",
                        boxShadow: `0 0 18px ${color.base}22`,
                    }}
                >
                    <Icon size={14} color={color.light} aria-hidden />
                </div>
            </div>
            <div>
                <div
                    style={{
                        fontSize: "30px",
                        fontWeight: 800,
                        color: color.light,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {value}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginTop: "8px",
                    }}
                >
                    {sub && (
                        <p
                            style={{
                                fontSize: "12px",
                                color: T3,
                            }}
                        >
                            {sub}
                        </p>
                    )}
                    {signal && (
                        <span
                            style={{
                                marginLeft: "auto",
                                border: `1px solid ${color.base}33`,
                                borderRadius: "999px",
                                color: T2,
                                background: color.bg,
                                padding: "2px 7px",
                                fontSize: "10px",
                                fontWeight: 700,
                            }}
                        >
                            {signal}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
