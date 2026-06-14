import { motion } from "framer-motion";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3 } from "./tokens";
import type { ChartColor } from "./tokens";

export function MediaComposition({
    totalEntries,
    mediaBreakdown,
    maxMedia,
}: {
    totalEntries: number;
    mediaBreakdown: { label: string; value: number; color: ChartColor }[];
    maxMedia: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.38 }}
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "18px",
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
                        fontSize: "15px",
                        fontWeight: 600,
                        color: T1,
                    }}
                >
                    {t("stats.composition")}
                </h3>
                <span style={{ fontSize: "12px", color: T3 }}>
                    {t("stats.compositionTotal", { n: totalEntries.toLocaleString("zh-CN") })}
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {mediaBreakdown.map((item) => {
                    const pct = Math.round((item.value / Math.max(totalEntries, 1)) * 100);
                    return (
                        <div key={item.label}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: "8px",
                                }}
                            >
                                <span style={{ fontSize: "13px", color: T2 }}>{item.label}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span
                                        style={{
                                            fontSize: "12px",
                                            color: T3,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {pct}%
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "13px",
                                            color: T1,
                                            fontWeight: 600,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {item.value.toLocaleString("zh-CN")}
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    height: "8px",
                                    borderRadius: "999px",
                                    background: "var(--color-surface-3)",
                                    overflow: "hidden",
                                }}
                            >
                                <motion.div
                                    style={{
                                        height: "100%",
                                        borderRadius: "999px",
                                        background: `linear-gradient(90deg, ${item.color.base}, ${item.color.light})`,
                                        boxShadow: `0 0 14px ${item.color.base}55`,
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${Math.round((item.value / maxMedia) * 100)}%`,
                                    }}
                                    transition={{ duration: 0.8, delay: 0.45 }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
