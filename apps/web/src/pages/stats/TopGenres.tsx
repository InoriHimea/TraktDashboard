import { motion } from "framer-motion";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3, GENRE_COLORS } from "./tokens";

export function TopGenres({ topGenres }: { topGenres: { name: string; count: number }[] }) {
    if (!topGenres || topGenres.length === 0) return null;

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
            <h3
                style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: T1,
                    marginBottom: "20px",
                }}
            >
                {t("stats.topGenres")}
            </h3>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                }}
            >
                {topGenres.map((g, i) => {
                    const pct = Math.round((g.count / topGenres[0].count) * 100);
                    const c = GENRE_COLORS[i % GENRE_COLORS.length];
                    return (
                        <div key={g.name}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: "8px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        minWidth: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            border: `1px solid ${c.base}33`,
                                            borderRadius: "999px",
                                            background: c.bg,
                                            color: c.light,
                                            fontSize: "10px",
                                            fontWeight: 800,
                                            minWidth: "26px",
                                            padding: "2px 6px",
                                            textAlign: "center",
                                        }}
                                    >
                                        #{i + 1}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "13px",
                                            color: i === 0 ? T1 : T2,
                                            fontWeight: i === 0 ? 600 : 400,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {g.name}
                                    </span>
                                </div>
                                <span
                                    style={{
                                        fontSize: "12px",
                                        color: T3,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {g.count}
                                </span>
                            </div>
                            <div
                                style={{
                                    height: "4px",
                                    borderRadius: "999px",
                                    background: "var(--color-surface-3)",
                                    overflow: "hidden",
                                }}
                            >
                                <motion.div
                                    style={{
                                        height: "100%",
                                        borderRadius: "999px",
                                        background: `linear-gradient(90deg, ${c.base}, ${c.light})`,
                                        boxShadow: `0 0 14px ${c.base}44`,
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{
                                        duration: 1,
                                        delay: 0.38 + i * 0.06,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
