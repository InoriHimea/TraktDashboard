import { motion } from "framer-motion";
import type { ComponentType } from "react";
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
import {
    Tv2,
    CheckCircle2,
    Clock,
    TrendingUp,
    Star,
    Loader2,
} from "lucide-react";
import { useStats } from "../hooks";
import { tmdbImage } from "../lib/utils";
import { fmtDateZh } from "../lib/i18n";
import type { StatsOverview } from "@trakt-dashboard/types";

// ─── Design tokens ────────────────────────────────────────────────────────────

const CARD_BG = "var(--color-surface)";
const CARD_BDR = "1px solid var(--color-border)";
const CARD_BLR = "blur(24px)";
const CARD_SHD = "0 4px 24px rgba(0,0,0,0.15)";
const T1 = "var(--color-text)";
const T2 = "var(--color-text-secondary)";
const T3 = "var(--color-text-muted)";

// ─── Color palette for variety ────────────────────────────────────────────────
const COLORS = {
    violet: { base: "#7c6af7", light: "#9d8fff", bg: "rgba(124,106,247,0.15)" },
    emerald: { base: "#10b981", light: "#34d399", bg: "rgba(16,185,129,0.15)" },
    amber: { base: "#f59e0b", light: "#fbbf24", bg: "rgba(245,158,11,0.15)" },
    sky: { base: "#0ea5e9", light: "#38bdf8", bg: "rgba(14,165,233,0.15)" },
    rose: { base: "#f43f5e", light: "#fb7185", bg: "rgba(244,63,94,0.15)" },
    teal: { base: "#14b8a6", light: "#2dd4bf", bg: "rgba(20,184,166,0.15)" },
};

// Genre bar colors cycling through palette
const GENRE_COLORS = [
    COLORS.violet,
    COLORS.emerald,
    COLORS.amber,
    COLORS.sky,
    COLORS.rose,
    COLORS.teal,
];

// Bar chart: color each bar by its relative height bucket
function barColor(value: number, max: number): string {
    const ratio = value / max;
    if (ratio >= 0.85) return COLORS.violet.base;
    if (ratio >= 0.6) return COLORS.sky.base;
    if (ratio >= 0.35) return COLORS.emerald.base;
    return COLORS.amber.base;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    icon: Icon,
    sub,
    delay = 0,
    color = COLORS.violet,
}: {
    label: string;
    value: string | number;
    icon: ComponentType<{ size?: number; color?: string }>;
    sub?: string;
    delay?: number;
    color?: typeof COLORS.violet;
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
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                borderLeft: `3px solid ${color.base}`,
            }}
        >
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
                        borderRadius: "8px",
                        padding: "6px",
                    }}
                >
                    <Icon size={14} color={color.light} />
                </div>
            </div>
            <div>
                <div
                    style={{
                        fontSize: "38px",
                        fontWeight: 800,
                        color: color.light,
                        letterSpacing: "-0.05em",
                        lineHeight: 1,
                    }}
                >
                    {value}
                </div>
                {sub && (
                    <p
                        style={{
                            fontSize: "12px",
                            color: T3,
                            marginTop: "6px",
                        }}
                    >
                        {sub}
                    </p>
                )}
            </div>
        </motion.div>
    );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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
            <p style={{ color: T3, marginBottom: "3px", fontSize: "11px" }}>
                {label}
            </p>
            <p
                style={{
                    color: COLORS.violet.light,
                    fontWeight: 700,
                    fontSize: "16px",
                }}
            >
                {payload[0].value}{" "}
                <span style={{ fontSize: "11px", fontWeight: 400, color: T2 }}>
                    集
                </span>
            </p>
        </div>
    );
};

// ─── StatsPage ────────────────────────────────────────────────────────────────

export default function StatsPage() {
    const { data: stats, isLoading, error } = useStats();

    if (isLoading)
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "60vh",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <Loader2
                        size={24}
                        color={COLORS.violet.base}
                        className="animate-spin"
                    />
                    <p style={{ fontSize: "13px", color: T3 }}>
                        正在加载统计数据…
                    </p>
                </div>
            </div>
        );

    if (error)
        return (
            <div
                style={{
                    padding: "48px 32px",
                    textAlign: "center",
                    minHeight: "60vh",
                }}
            >
                <p style={{ color: "#f87171", fontSize: "14px" }}>
                    统计数据加载失败，请稍后重试。
                </p>
            </div>
        );

    if (!stats) return null;

    const totalHours = Math.floor(stats.totalRuntimeMinutes / 60);
    const totalDays = (stats.totalRuntimeMinutes / (60 * 24)).toFixed(1);

    const chartData = (() => {
        const months: { month: string; count: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const found = stats.monthlyActivity?.find((m) => m.month === key);
            months.push({
                month: `${d.getMonth() + 1}月`,
                count: found ? Number(found.count) : 0,
            });
        }
        return months;
    })();

    const maxBar = Math.max(...chartData.map((d) => d.count), 1);

    return (
        <div
            style={{
                minHeight: "100vh",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Ambient glows */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        width: "600px",
                        height: "600px",
                        top: "-150px",
                        left: "5%",
                        background:
                            "radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 60%)",
                        filter: "blur(80px)",
                        borderRadius: "50%",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        width: "400px",
                        height: "400px",
                        bottom: "100px",
                        right: "5%",
                        background:
                            "radial-gradient(circle, rgba(124,106,247,0.06) 0%, transparent 60%)",
                        filter: "blur(60px)",
                        borderRadius: "50%",
                    }}
                />
            </div>

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "1400px",
                    margin: "0 auto",
                    padding: "40px 24px 80px",
                }}
            >
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ marginBottom: "36px" }}
                >
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "36px",
                            fontWeight: 400,
                            color: T1,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.1,
                            marginBottom: "6px",
                        }}
                    >
                        数据统计
                    </h2>
                    <p style={{ color: T3, fontSize: "14px" }}>
                        您的观看历史概览
                    </p>
                </motion.div>

                {/* Empty state */}
                {stats.totalEpisodesWatched === 0 && (
                    <div
                        style={{
                            background: CARD_BG,
                            border: CARD_BDR,
                            borderRadius: "16px",
                            padding: "24px",
                            marginBottom: "24px",
                        }}
                    >
                        <p style={{ color: T2, fontSize: "14px" }}>
                            暂无统计数据。请先在同步页面触发一次同步，完成后这里将显示您的观看趋势。
                        </p>
                    </div>
                )}

                {/* ── Left / Right layout ─────────────────────────────────────────── */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "320px 1fr",
                        gap: "24px",
                        alignItems: "start",
                    }}
                >
                    {/* ── LEFT COLUMN: KPI cards + genres ── */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                        }}
                    >
                        {/* KPI cards */}
                        <StatCard
                            label="观看集数"
                            value={stats.totalEpisodesWatched.toLocaleString(
                                "zh-CN",
                            )}
                            icon={Tv2}
                            delay={0}
                            color={COLORS.violet}
                        />
                        <StatCard
                            label="已看剧集"
                            value={stats.totalShowsWatched.toLocaleString(
                                "zh-CN",
                            )}
                            icon={Star}
                            sub={`其中 ${stats.totalShowsCompleted} 部已完结`}
                            delay={0.07}
                            color={COLORS.sky}
                        />
                        <StatCard
                            label="观看时长"
                            value={`${totalHours.toLocaleString("zh-CN")}h`}
                            icon={Clock}
                            sub={`相当于 ${totalDays} 天`}
                            delay={0.14}
                            color={COLORS.amber}
                        />
                        <StatCard
                            label="完成剧集"
                            value={stats.totalShowsCompleted.toLocaleString(
                                "zh-CN",
                            )}
                            icon={CheckCircle2}
                            delay={0.21}
                            color={COLORS.emerald}
                        />

                        {/* Top genres */}
                        {stats.topGenres?.length > 0 && (
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
                                    常看流派
                                </h3>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "16px",
                                    }}
                                >
                                    {stats.topGenres.map(
                                        (
                                            g: { name: string; count: number },
                                            i: number,
                                        ) => {
                                            const pct = Math.round(
                                                (g.count /
                                                    stats.topGenres[0].count) *
                                                    100,
                                            );
                                            const c =
                                                GENRE_COLORS[
                                                    i % GENRE_COLORS.length
                                                ];
                                            return (
                                                <div key={g.name}>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "space-between",
                                                            marginBottom: "8px",
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    "13px",
                                                                color:
                                                                    i === 0
                                                                        ? T1
                                                                        : T2,
                                                                fontWeight:
                                                                    i === 0
                                                                        ? 600
                                                                        : 400,
                                                            }}
                                                        >
                                                            {g.name}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    "12px",
                                                                color: T3,
                                                                fontVariantNumeric:
                                                                    "tabular-nums",
                                                            }}
                                                        >
                                                            {g.count}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            height: "4px",
                                                            borderRadius:
                                                                "999px",
                                                            background:
                                                                "var(--color-surface-3)",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <motion.div
                                                            style={{
                                                                height: "100%",
                                                                borderRadius:
                                                                    "999px",
                                                                background: `linear-gradient(90deg, ${c.base}, ${c.light})`,
                                                            }}
                                                            initial={{
                                                                width: 0,
                                                            }}
                                                            animate={{
                                                                width: `${pct}%`,
                                                            }}
                                                            transition={{
                                                                duration: 1,
                                                                delay:
                                                                    0.38 +
                                                                    i * 0.06,
                                                                ease: [
                                                                    0.16, 1,
                                                                    0.3, 1,
                                                                ],
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN: chart + recent activity ── */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                        }}
                    >
                        {/* Monthly activity chart */}
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
                                    月度活跃度
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
                                    <TrendingUp
                                        size={13}
                                        color={COLORS.sky.base}
                                    />{" "}
                                    过去 12 个月
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
                                    <CartesianGrid
                                        vertical={false}
                                        stroke="var(--color-border-subtle)"
                                    />
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
                                            fill: "rgba(124,106,247,0.07)",
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
                                                        : barColor(
                                                              entry.count,
                                                              maxBar,
                                                          )
                                                }
                                                fillOpacity={
                                                    entry.count === 0 ? 1 : 0.85
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </motion.div>

                        {/* Recent activity */}
                        {stats.recentlyWatched?.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.35 }}
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
                                    最近动态
                                </h3>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "20px",
                                    }}
                                >
                                    {stats.recentlyWatched
                                        .slice(0, 15)
                                        .map(
                                            (
                                                r: StatsOverview["recentlyWatched"][number],
                                                i: number,
                                            ) => (
                                                <motion.div
                                                    key={`${r.showId}-${r.seasonNumber}-${r.episodeNumber}-${r.watchedAt}`}
                                                    initial={{
                                                        opacity: 0,
                                                        x: -8,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        x: 0,
                                                    }}
                                                    transition={{
                                                        duration: 0.2,
                                                        delay: 0.4 + i * 0.04,
                                                    }}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "12px",
                                                    }}
                                                >
                                                    {/* Thumbnail — 16:9 episode still, fallback to poster */}
                                                    <div
                                                        style={{
                                                            position:
                                                                "relative",
                                                            width: "320px",
                                                            height: "180px",
                                                            borderRadius: "12px",
                                                            overflow: "hidden",
                                                            background:
                                                                "var(--color-surface-3)",
                                                            flexShrink: 0,
                                                            outline:
                                                                "1px solid var(--color-border)",
                                                        }}
                                                    >
                                                        {r.stillPath ||
                                                        r.posterPath ? (
                                                            <img
                                                                src={
                                                                    tmdbImage(
                                                                        r.stillPath ??
                                                                            r.posterPath,
                                                                        r.stillPath
                                                                            ? "w500"
                                                                            : "w342",
                                                                    )!
                                                                }
                                                                alt=""
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    objectFit:
                                                                        "cover",
                                                                }}
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    display:
                                                                        "flex",
                                                                    alignItems:
                                                                        "center",
                                                                    justifyContent:
                                                                        "center",
                                                                }}
                                                            >
                                                                <Tv2
                                                                    size={32}
                                                                    color="var(--color-text-muted)"
                                                                />
                                                            </div>
                                                        )}
                                                        {/* Episode pill */}
                                                        <div
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                bottom: 0,
                                                                left: 0,
                                                                right: 0,
                                                                display: "flex",
                                                                justifyContent:
                                                                    "center",
                                                                paddingBottom:
                                                                    "8px",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    background:
                                                                        "rgba(0,0,0,0.75)",
                                                                    backdropFilter:
                                                                        "blur(8px)",
                                                                    borderRadius:
                                                                        "6px",
                                                                    padding:
                                                                        "4px 10px",
                                                                    fontSize:
                                                                        "13px",
                                                                    fontWeight: 600,
                                                                    color: "rgba(255,255,255,0.95)",
                                                                    lineHeight: 1.4,
                                                                }}
                                                            >
                                                                S
                                                                {String(
                                                                    r.seasonNumber,
                                                                ).padStart(
                                                                    2,
                                                                    "0",
                                                                )}
                                                                E
                                                                {String(
                                                                    r.episodeNumber,
                                                                ).padStart(
                                                                    2,
                                                                    "0",
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Watched badge */}
                                                        <div
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                top: "8px",
                                                                right: "8px",
                                                                width: "24px",
                                                                height: "24px",
                                                                borderRadius:
                                                                    "50%",
                                                                background:
                                                                    COLORS
                                                                        .emerald
                                                                        .base,
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                boxShadow: `0 2px 8px ${COLORS.emerald.base}99`,
                                                            }}
                                                        >
                                                            <CheckCircle2
                                                                size={14}
                                                                color="#fff"
                                                                strokeWidth={
                                                                    2.5
                                                                }
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Info */}
                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "6px",
                                                        }}
                                                    >
                                                        <p
                                                            style={{
                                                                fontSize:
                                                                    "16px",
                                                                color: T1,
                                                                fontWeight: 600,
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {r.showTitle}
                                                        </p>
                                                        <p
                                                            style={{
                                                                fontSize:
                                                                    "14px",
                                                                color: T2,
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            S
                                                            {String(
                                                                r.seasonNumber,
                                                            ).padStart(2, "0")}
                                                            E
                                                            {String(
                                                                r.episodeNumber,
                                                            ).padStart(2, "0")}
                                                            {r.episodeTitle
                                                                ? ` · ${r.episodeTitle}`
                                                                : ""}
                                                        </p>
                                                        <span
                                                            style={{
                                                                fontSize: "13px",
                                                                color: T3,
                                                            }}
                                                        >
                                                            {r.watchedAt ? new Date(r.watchedAt).toLocaleString('zh-CN', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: false
                                                            }) : '未知时间'}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ),
                                        )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
