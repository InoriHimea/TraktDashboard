import { Tv2, Film, Star, Repeat2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import type { TraktOfficialStats } from "@trakt-dashboard/types";
import { t } from "../../lib/i18n";
import { CARD_BG, CARD_BDR, CARD_BLR, CARD_SHD, T1, T2, T3, COLORS } from "./tokens";

function fmt(n: number) {
    return n.toLocaleString("zh-CN");
}

function toHours(minutes: number) {
    return Math.round(minutes / 60).toLocaleString("zh-CN");
}

function MetricRow({
    icon: Icon,
    label,
    primary,
    secondary,
    color,
}: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    label: string;
    primary: string;
    secondary?: string;
    color: (typeof COLORS)[keyof typeof COLORS];
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border-subtle)",
            }}
        >
            <div
                style={{
                    background: color.bg,
                    border: `1px solid ${color.base}33`,
                    borderRadius: "8px",
                    padding: "6px",
                    flexShrink: 0,
                }}
            >
                <Icon size={14} color={color.light} />
            </div>
            <span style={{ fontSize: "13px", color: T2, flex: 1 }}>{label}</span>
            <div style={{ textAlign: "right" }}>
                <span
                    style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: T1,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {primary}
                </span>
                {secondary && (
                    <span style={{ fontSize: "11px", color: T3, marginLeft: "6px" }}>
                        {secondary}
                    </span>
                )}
            </div>
        </div>
    );
}

export function TraktStats({ stats }: { stats: TraktOfficialStats }) {
    const totalMinutes = stats.movies.minutes + stats.episodes.minutes;
    const totalPlays = stats.movies.plays + stats.episodes.plays;
    const totalHours = toHours(totalMinutes);
    const totalDays = (totalMinutes / (60 * 24)).toFixed(1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
                background: CARD_BG,
                backdropFilter: CARD_BLR,
                WebkitBackdropFilter: CARD_BLR,
                border: CARD_BDR,
                borderRadius: "16px",
                boxShadow: CARD_SHD,
                padding: "20px",
                borderLeft: `3px solid ${COLORS.violet.base}`,
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* gradient top line */}
            <div
                style={{
                    position: "absolute",
                    inset: "0 0 auto 0",
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${COLORS.violet.light}, transparent)`,
                    opacity: 0.4,
                }}
            />

            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                }}
            >
                <TrendingUp size={14} color={COLORS.violet.light} />
                <span
                    style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: T3,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                    }}
                >
                    {t("stats.traktOfficial")}
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        color: T3,
                        background: "var(--color-surface-2)",
                        border: CARD_BDR,
                        borderRadius: "999px",
                        padding: "2px 8px",
                    }}
                >
                    Trakt
                </span>
            </div>

            {/* Summary row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginBottom: "16px",
                    marginTop: "12px",
                }}
            >
                {[
                    {
                        label: t("stats.traktTotalHours"),
                        value: `${totalHours}h`,
                        sub: `${totalDays}d`,
                        color: COLORS.amber,
                    },
                    {
                        label: t("stats.traktTotalPlays"),
                        value: fmt(totalPlays),
                        sub: t("stats.traktPlaysUnit"),
                        color: COLORS.cyan,
                    },
                    {
                        label: t("stats.traktRatings"),
                        value: fmt(stats.ratings.total),
                        sub: t("stats.traktRatingsUnit"),
                        color: COLORS.violet,
                    },
                ].map(({ label, value, sub, color }) => (
                    <div
                        key={label}
                        style={{
                            background: color.bg,
                            border: `1px solid ${color.base}22`,
                            borderRadius: "10px",
                            padding: "10px 12px",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "20px",
                                fontWeight: 800,
                                color: color.light,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {value}
                        </div>
                        <div style={{ fontSize: "10px", color: T3, marginTop: "2px" }}>{label}</div>
                        <div style={{ fontSize: "10px", color: T3 }}>{sub}</div>
                    </div>
                ))}
            </div>

            {/* Detail rows */}
            <div>
                <MetricRow
                    icon={Tv2}
                    label={t("stats.traktEpisodes")}
                    primary={fmt(stats.episodes.watched)}
                    secondary={`${toHours(stats.episodes.minutes)}h`}
                    color={COLORS.cyan}
                />
                <MetricRow
                    icon={Repeat2}
                    label={t("stats.traktEpisodePlays")}
                    primary={fmt(stats.episodes.plays)}
                    secondary={
                        stats.episodes.plays > stats.episodes.watched
                            ? `+${fmt(stats.episodes.plays - stats.episodes.watched)}`
                            : undefined
                    }
                    color={COLORS.sky}
                />
                <MetricRow
                    icon={Film}
                    label={t("stats.traktMovies")}
                    primary={fmt(stats.movies.watched)}
                    secondary={`${toHours(stats.movies.minutes)}h`}
                    color={COLORS.rose}
                />
                <MetricRow
                    icon={Repeat2}
                    label={t("stats.traktMoviePlays")}
                    primary={fmt(stats.movies.plays)}
                    secondary={
                        stats.movies.plays > stats.movies.watched
                            ? `+${fmt(stats.movies.plays - stats.movies.watched)}`
                            : undefined
                    }
                    color={COLORS.amber}
                />
                <div style={{ borderBottom: "none" }}>
                    <MetricRow
                        icon={Star}
                        label={t("stats.traktShowsWatched")}
                        primary={fmt(stats.shows.watched)}
                        secondary={t("stats.traktShowsUnit")}
                        color={COLORS.emerald}
                    />
                </div>
            </div>
        </motion.div>
    );
}
