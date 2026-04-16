import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, } from "recharts";
import { Tv2, CheckCircle2, Clock, TrendingUp, Star, Loader2, } from "lucide-react";
import { useStats } from "../hooks";
import { tmdbImage } from "../lib/utils";
import { fmtDateZh } from "../lib/i18n";
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
function barColor(value, max) {
    const ratio = value / max;
    if (ratio >= 0.85)
        return COLORS.violet.base;
    if (ratio >= 0.6)
        return COLORS.sky.base;
    if (ratio >= 0.35)
        return COLORS.emerald.base;
    return COLORS.amber.base;
}
// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, sub, delay = 0, color = COLORS.violet, }) {
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }, whileHover: { y: -3, transition: { duration: 0.18 } }, style: {
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
        }, children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }, children: [_jsx("span", { style: {
                            fontSize: "11px",
                            fontWeight: 600,
                            color: T3,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }, children: label }), _jsx("div", { style: {
                            background: color.bg,
                            borderRadius: "8px",
                            padding: "6px",
                        }, children: _jsx(Icon, { size: 14, color: color.light }) })] }), _jsxs("div", { children: [_jsx("div", { style: {
                            fontSize: "38px",
                            fontWeight: 800,
                            color: color.light,
                            letterSpacing: "-0.05em",
                            lineHeight: 1,
                        }, children: value }), sub && (_jsx("p", { style: {
                            fontSize: "12px",
                            color: T3,
                            marginTop: "6px",
                        }, children: sub }))] })] }));
}
// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, }) => {
    if (!active || !payload?.length)
        return null;
    return (_jsxs("div", { style: {
            background: "var(--color-surface-2)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${COLORS.violet.base}44`,
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "13px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }, children: [_jsx("p", { style: { color: T3, marginBottom: "3px", fontSize: "11px" }, children: label }), _jsxs("p", { style: {
                    color: COLORS.violet.light,
                    fontWeight: 700,
                    fontSize: "16px",
                }, children: [payload[0].value, " ", _jsx("span", { style: { fontSize: "11px", fontWeight: 400, color: T2 }, children: "\u96C6" })] })] }));
};
// ─── StatsPage ────────────────────────────────────────────────────────────────
export default function StatsPage() {
    const { data: stats, isLoading, error } = useStats();
    if (isLoading)
        return (_jsx("div", { style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
            }, children: _jsxs("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                }, children: [_jsx(Loader2, { size: 24, color: COLORS.violet.base, className: "animate-spin" }), _jsx("p", { style: { fontSize: "13px", color: T3 }, children: "\u6B63\u5728\u52A0\u8F7D\u7EDF\u8BA1\u6570\u636E\u2026" })] }) }));
    if (error)
        return (_jsx("div", { style: {
                padding: "48px 32px",
                textAlign: "center",
                minHeight: "60vh",
            }, children: _jsx("p", { style: { color: "#f87171", fontSize: "14px" }, children: "\u7EDF\u8BA1\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" }) }));
    if (!stats)
        return null;
    const totalHours = Math.floor(stats.totalRuntimeMinutes / 60);
    const totalDays = (stats.totalRuntimeMinutes / (60 * 24)).toFixed(1);
    const chartData = (() => {
        const months = [];
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
    return (_jsxs("div", { style: {
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
        }, children: [_jsxs("div", { style: {
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                }, children: [_jsx("div", { style: {
                            position: "absolute",
                            width: "600px",
                            height: "600px",
                            top: "-150px",
                            left: "5%",
                            background: "radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 60%)",
                            filter: "blur(80px)",
                            borderRadius: "50%",
                        } }), _jsx("div", { style: {
                            position: "absolute",
                            width: "400px",
                            height: "400px",
                            bottom: "100px",
                            right: "5%",
                            background: "radial-gradient(circle, rgba(124,106,247,0.06) 0%, transparent 60%)",
                            filter: "blur(60px)",
                            borderRadius: "50%",
                        } })] }), _jsxs("div", { style: {
                    position: "relative",
                    zIndex: 1,
                    maxWidth: "1400px",
                    margin: "0 auto",
                    padding: "40px 24px 80px",
                }, children: [_jsxs(motion.div, { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 }, style: { marginBottom: "36px" }, children: [_jsx("h2", { style: {
                                    fontFamily: "var(--font-display)",
                                    fontSize: "36px",
                                    fontWeight: 400,
                                    color: T1,
                                    letterSpacing: "-0.02em",
                                    lineHeight: 1.1,
                                    marginBottom: "6px",
                                }, children: "\u6570\u636E\u7EDF\u8BA1" }), _jsx("p", { style: { color: T3, fontSize: "14px" }, children: "\u60A8\u7684\u89C2\u770B\u5386\u53F2\u6982\u89C8" })] }), stats.totalEpisodesWatched === 0 && (_jsx("div", { style: {
                            background: CARD_BG,
                            border: CARD_BDR,
                            borderRadius: "16px",
                            padding: "24px",
                            marginBottom: "24px",
                        }, children: _jsx("p", { style: { color: T2, fontSize: "14px" }, children: "\u6682\u65E0\u7EDF\u8BA1\u6570\u636E\u3002\u8BF7\u5148\u5728\u540C\u6B65\u9875\u9762\u89E6\u53D1\u4E00\u6B21\u540C\u6B65\uFF0C\u5B8C\u6210\u540E\u8FD9\u91CC\u5C06\u663E\u793A\u60A8\u7684\u89C2\u770B\u8D8B\u52BF\u3002" }) })), _jsxs("div", { style: {
                            display: "grid",
                            gridTemplateColumns: "320px 1fr",
                            gap: "24px",
                            alignItems: "start",
                        }, children: [_jsxs("div", { style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px",
                                }, children: [_jsx(StatCard, { label: "\u89C2\u770B\u96C6\u6570", value: stats.totalEpisodesWatched.toLocaleString("zh-CN"), icon: Tv2, delay: 0, color: COLORS.violet }), _jsx(StatCard, { label: "\u5DF2\u770B\u5267\u96C6", value: stats.totalShowsWatched.toLocaleString("zh-CN"), icon: Star, sub: `其中 ${stats.totalShowsCompleted} 部已完结`, delay: 0.07, color: COLORS.sky }), _jsx(StatCard, { label: "\u89C2\u770B\u65F6\u957F", value: `${totalHours.toLocaleString("zh-CN")}h`, icon: Clock, sub: `相当于 ${totalDays} 天`, delay: 0.14, color: COLORS.amber }), _jsx(StatCard, { label: "\u5B8C\u6210\u5267\u96C6", value: stats.totalShowsCompleted.toLocaleString("zh-CN"), icon: CheckCircle2, delay: 0.21, color: COLORS.emerald }), stats.topGenres?.length > 0 && (_jsxs(motion.div, { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.28 }, style: {
                                            background: CARD_BG,
                                            border: CARD_BDR,
                                            borderRadius: "16px",
                                            boxShadow: CARD_SHD,
                                            padding: "24px",
                                        }, children: [_jsx("h3", { style: {
                                                    fontSize: "15px",
                                                    fontWeight: 600,
                                                    color: T1,
                                                    marginBottom: "20px",
                                                }, children: "\u5E38\u770B\u6D41\u6D3E" }), _jsx("div", { style: {
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "16px",
                                                }, children: stats.topGenres.map((g, i) => {
                                                    const pct = Math.round((g.count /
                                                        stats.topGenres[0].count) *
                                                        100);
                                                    const c = GENRE_COLORS[i % GENRE_COLORS.length];
                                                    return (_jsxs("div", { children: [_jsxs("div", { style: {
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    marginBottom: "8px",
                                                                }, children: [_jsx("span", { style: {
                                                                            fontSize: "13px",
                                                                            color: i === 0
                                                                                ? T1
                                                                                : T2,
                                                                            fontWeight: i === 0
                                                                                ? 600
                                                                                : 400,
                                                                        }, children: g.name }), _jsx("span", { style: {
                                                                            fontSize: "12px",
                                                                            color: T3,
                                                                            fontVariantNumeric: "tabular-nums",
                                                                        }, children: g.count })] }), _jsx("div", { style: {
                                                                    height: "4px",
                                                                    borderRadius: "999px",
                                                                    background: "var(--color-surface-3)",
                                                                    overflow: "hidden",
                                                                }, children: _jsx(motion.div, { style: {
                                                                        height: "100%",
                                                                        borderRadius: "999px",
                                                                        background: `linear-gradient(90deg, ${c.base}, ${c.light})`,
                                                                    }, initial: {
                                                                        width: 0,
                                                                    }, animate: {
                                                                        width: `${pct}%`,
                                                                    }, transition: {
                                                                        duration: 1,
                                                                        delay: 0.38 +
                                                                            i * 0.06,
                                                                        ease: [
                                                                            0.16, 1,
                                                                            0.3, 1,
                                                                        ],
                                                                    } }) })] }, g.name));
                                                }) })] }))] }), _jsxs("div", { style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "24px",
                                }, children: [_jsxs(motion.div, { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.28 }, style: {
                                            background: CARD_BG,
                                            border: CARD_BDR,
                                            borderRadius: "16px",
                                            boxShadow: CARD_SHD,
                                            padding: "24px",
                                        }, children: [_jsxs("div", { style: {
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    marginBottom: "20px",
                                                }, children: [_jsx("h3", { style: {
                                                            fontSize: "15px",
                                                            fontWeight: 600,
                                                            color: T1,
                                                        }, children: "\u6708\u5EA6\u6D3B\u8DC3\u5EA6" }), _jsxs("span", { style: {
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "6px",
                                                            fontSize: "12px",
                                                            color: T3,
                                                        }, children: [_jsx(TrendingUp, { size: 13, color: COLORS.sky.base }), " ", "\u8FC7\u53BB 12 \u4E2A\u6708"] })] }), _jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(BarChart, { data: chartData, barSize: 14, margin: {
                                                        top: 4,
                                                        right: 0,
                                                        bottom: 0,
                                                        left: -28,
                                                    }, children: [_jsx(CartesianGrid, { vertical: false, stroke: "var(--color-border-subtle)" }), _jsx(XAxis, { dataKey: "month", tick: {
                                                                fill: "var(--color-text-muted)",
                                                                fontSize: 11,
                                                            }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: {
                                                                fill: "var(--color-text-muted)",
                                                                fontSize: 11,
                                                            }, axisLine: false, tickLine: false }), _jsx(Tooltip, { content: _jsx(CustomTooltip, {}), cursor: {
                                                                fill: "rgba(124,106,247,0.07)",
                                                                radius: 6,
                                                            } }), _jsx(Bar, { dataKey: "count", radius: [6, 6, 0, 0], children: chartData.map((entry, index) => (_jsx(Cell, { fill: entry.count === 0
                                                                    ? "var(--color-surface-3)"
                                                                    : barColor(entry.count, maxBar), fillOpacity: entry.count === 0 ? 1 : 0.85 }, `cell-${index}`))) })] }) })] }), stats.recentlyWatched?.length > 0 && (_jsxs(motion.div, { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.35 }, style: {
                                            background: CARD_BG,
                                            border: CARD_BDR,
                                            borderRadius: "16px",
                                            boxShadow: CARD_SHD,
                                            padding: "24px",
                                        }, children: [_jsx("h3", { style: {
                                                    fontSize: "15px",
                                                    fontWeight: 600,
                                                    color: T1,
                                                    marginBottom: "20px",
                                                }, children: "\u6700\u8FD1\u52A8\u6001" }), _jsx("div", { style: {
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "12px",
                                                }, children: stats.recentlyWatched
                                                    .slice(0, 15)
                                                    .map((r, i) => (_jsxs(motion.div, { initial: {
                                                        opacity: 0,
                                                        x: -8,
                                                    }, animate: {
                                                        opacity: 1,
                                                        x: 0,
                                                    }, transition: {
                                                        duration: 0.2,
                                                        delay: 0.4 + i * 0.04,
                                                    }, style: {
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "12px",
                                                    }, children: [_jsxs("div", { style: {
                                                                position: "relative",
                                                                width: "96px",
                                                                height: "54px",
                                                                borderRadius: "8px",
                                                                overflow: "hidden",
                                                                background: "var(--color-surface-3)",
                                                                flexShrink: 0,
                                                                outline: "1px solid var(--color-border)",
                                                            }, children: [r.stillPath ||
                                                                    r.posterPath ? (_jsx("img", { src: tmdbImage(r.stillPath ??
                                                                        r.posterPath, r.stillPath
                                                                        ? "w300"
                                                                        : "w92"), alt: "", style: {
                                                                        width: "100%",
                                                                        height: "100%",
                                                                        objectFit: "cover",
                                                                    }, loading: "lazy" })) : (_jsx("div", { style: {
                                                                        width: "100%",
                                                                        height: "100%",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                    }, children: _jsx(Tv2, { size: 18, color: "var(--color-text-muted)" }) })), _jsx("div", { style: {
                                                                        position: "absolute",
                                                                        bottom: 0,
                                                                        left: 0,
                                                                        right: 0,
                                                                        display: "flex",
                                                                        justifyContent: "center",
                                                                        paddingBottom: "3px",
                                                                    }, children: _jsxs("div", { style: {
                                                                            background: "rgba(0,0,0,0.7)",
                                                                            backdropFilter: "blur(4px)",
                                                                            borderRadius: "3px",
                                                                            padding: "1px 5px",
                                                                            fontSize: "9px",
                                                                            color: "rgba(255,255,255,0.85)",
                                                                            lineHeight: 1.6,
                                                                        }, children: ["S", String(r.seasonNumber).padStart(2, "0"), "E", String(r.episodeNumber).padStart(2, "0")] }) }), _jsx("div", { style: {
                                                                        position: "absolute",
                                                                        top: "4px",
                                                                        right: "4px",
                                                                        width: "16px",
                                                                        height: "16px",
                                                                        borderRadius: "50%",
                                                                        background: COLORS
                                                                            .emerald
                                                                            .base,
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        boxShadow: `0 1px 6px ${COLORS.emerald.base}99`,
                                                                    }, children: _jsx(CheckCircle2, { size: 10, color: "#fff", strokeWidth: 2.5 }) })] }), _jsxs("div", { style: {
                                                                flex: 1,
                                                                minWidth: 0,
                                                            }, children: [_jsx("p", { style: {
                                                                        fontSize: "13px",
                                                                        color: T1,
                                                                        fontWeight: 600,
                                                                        marginBottom: "2px",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }, children: r.showTitle }), _jsxs("p", { style: {
                                                                        fontSize: "11px",
                                                                        color: T3,
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    }, children: ["S", String(r.seasonNumber).padStart(2, "0"), "E", String(r.episodeNumber).padStart(2, "0"), r.episodeTitle
                                                                            ? ` · ${r.episodeTitle}`
                                                                            : ""] })] }), _jsx("span", { style: {
                                                                fontSize: "11px",
                                                                color: T3,
                                                                flexShrink: 0,
                                                            }, children: fmtDateZh(r.watchedAt) })] }, `${r.showId}-${r.seasonNumber}-${r.episodeNumber}-${r.watchedAt}`))) })] }))] })] })] })] }));
}
//# sourceMappingURL=StatsPage.js.map