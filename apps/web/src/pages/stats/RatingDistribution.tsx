import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Star } from "lucide-react";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_SHD, T1, T2, T3 } from "./tokens";

interface RatingDistributionProps {
    ratingDistribution: Array<{ rating: number; count: number }>;
}

const STAR_COLOR = "#f59e0b";

const CustomTooltip = ({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { rating: number } }>;
}) => {
    if (!active || !payload?.length) return null;
    const { rating } = payload[0].payload;
    const count = payload[0].value;
    return (
        <div
            style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
            }}
        >
            <p style={{ color: STAR_COLOR, fontWeight: 700, margin: 0 }}>
                {"★".repeat(Math.round(rating / 2))} {rating}/10
            </p>
            <p style={{ color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                {count} {t("rating.ratingsUnit")}
            </p>
        </div>
    );
};

export function RatingDistribution({ ratingDistribution }: RatingDistributionProps) {
    const total = ratingDistribution.reduce((s, r) => s + r.count, 0);
    if (total === 0) return null;

    const maxCount = Math.max(...ratingDistribution.map((r) => r.count), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            style={{
                background: CARD_BG,
                border: CARD_BDR,
                boxShadow: CARD_SHD,
                borderRadius: 16,
                padding: "20px 20px 16px",
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Star size={14} style={{ color: STAR_COLOR }} />
                <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T1, margin: 0 }}>
                        {t("rating.distributionTitle")}
                    </p>
                    <p style={{ fontSize: 11, color: T3, margin: "2px 0 0" }}>
                        {t("rating.distributionSubtitle", { count: total })}
                    </p>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={140}>
                <BarChart
                    data={ratingDistribution}
                    margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                >
                    <XAxis
                        dataKey="rating"
                        tick={{ fontSize: 10, fill: T3 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: T3 }} tickLine={false} axisLine={false} />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {ratingDistribution.map((entry) => (
                            <Cell
                                key={entry.rating}
                                fill={STAR_COLOR}
                                fillOpacity={0.25 + 0.75 * (entry.count / maxCount)}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* avg */}
            {total > 0 && (
                <p style={{ fontSize: 11, color: T2, textAlign: "right", margin: "8px 0 0" }}>
                    {t("rating.avgLabel", {
                        avg: (
                            ratingDistribution.reduce((s, r) => s + r.rating * r.count, 0) / total
                        ).toFixed(1),
                    })}
                </p>
            )}
        </motion.div>
    );
}
